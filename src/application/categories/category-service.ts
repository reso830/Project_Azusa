import {
  and,
  asc,
  eq,
  getTableName,
  gte,
  inArray,
  max,
  ne,
  sql,
} from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../../domain/audit/actor';
import { getServerTodayIsoDate } from '../../domain/calendar/iso-week';
import {
  resolveTeamPiAllocation,
  validateArtDefaultTotals,
  validateTeamPiAllocationSave,
} from '../../domain/categories/rules';
import { SAMPLE_CATEGORY_CATALOG } from '../../domain/categories/sample-catalog';
import {
  ApplySampleCatalogSchema,
  CreateCategorySchema,
  ReorderCategoriesSchema,
  SaveArtDefaultsSchema,
  SaveTeamPiAllocationSchema,
  TeamPiAllocationQuerySchema,
  UpdateCategorySchema,
} from '../../domain/categories/schemas';
import { IdPathSchema } from '../../domain/organization/schemas';
import {
  categories,
  overheadDeductions,
  pis,
  teamCategoryAllocations as allocations,
  teams,
  trains,
} from '../../persistence/schema';
import {
  ConflictError,
  NotFoundError,
  type OrganizationOptions,
  type OrganizationTransaction,
  requireActive,
  requireRecord,
  validate,
  ValidationError,
  writeOrganization,
} from '../organization/errors';

type Tx = OrganizationTransaction;
type Category = typeof categories.$inferSelect;
type Team = typeof teams.$inferSelect;
type Pi = typeof pis.$inferSelect;
type ListFilters = { trainId: string; includeArchived?: boolean };
type DriftedAllocation = {
  teamId: string;
  teamName: string;
  piId: string;
  piName: string;
  piEndDate: string;
  effectiveTotalPct: number;
};

const categoryIdColumn = sql`${sql.identifier(getTableName(categories))}.${sql.identifier(categories.id.name)}`;
// Keep the outer qualifier in correlated subqueries on the categories table.
const categoryReferences = {
  allocation: sql<boolean>`exists (select 1 from ${allocations} where ${allocations.categoryId} = ${categoryIdColumn})`,
  deduction: sql<boolean>`exists (select 1 from ${overheadDeductions} where ${overheadDeductions.categoryId} = ${categoryIdColumn})`,
};

const categoryOrder = [
  asc(categories.kind),
  asc(categories.sortOrder),
  asc(categories.name),
  asc(categories.id),
];

function categoryDto(category: Category, isReferenced: boolean) {
  const {
    id,
    trainId,
    name,
    shortLabel,
    color,
    kind,
    semanticRole,
    defaultPct,
    sortOrder,
    recordStatus,
  } = category;
  return {
    id,
    trainId,
    name,
    shortLabel,
    color,
    kind,
    semanticRole,
    defaultPct,
    sortOrder,
    recordStatus,
    isReferenced,
  };
}

function getTrain(tx: Tx, id: string) {
  return tx
    .select()
    .from(trains)
    .where(eq(trains.id, id))
    .then((rows) => requireRecord(rows, 'ART'));
}

function getCategory(tx: Tx, id: string) {
  return tx
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .then((rows) => requireRecord(rows, 'Category'));
}

async function readCategoryReferences(tx: Tx, id: string) {
  return requireRecord(
    await tx
      .select(categoryReferences)
      .from(categories)
      .where(eq(categories.id, id)),
    'Category',
  );
}

async function nextSortOrder(tx: Tx, trainId: string, kind: Category['kind']) {
  const [row] = await tx
    .select({ last: max(categories.sortOrder) })
    .from(categories)
    .where(and(eq(categories.trainId, trainId), eq(categories.kind, kind)));
  return (row?.last ?? -1) + 1;
}

async function requireUniqueCategory(
  tx: Tx,
  category: Pick<
    Category,
    'trainId' | 'name' | 'kind' | 'recordStatus' | 'semanticRole'
  >,
  excludeId?: string,
) {
  const art = and(
    eq(categories.trainId, category.trainId),
    excludeId ? ne(categories.id, excludeId) : undefined,
  );
  const duplicateName = await tx
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        art,
        sql`lower(trim(${categories.name})) = lower(trim(${category.name}))`,
      ),
    )
    .limit(1);
  if (duplicateName.length)
    throw new ConflictError(
      'A category with this name already exists in the ART.',
    );
  if (
    category.recordStatus === 'active' &&
    category.kind === 'development' &&
    category.semanticRole === 'maintenance_bugs'
  ) {
    const duplicateRole = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(
          art,
          eq(categories.recordStatus, 'active'),
          eq(categories.semanticRole, 'maintenance_bugs'),
        ),
      )
      .limit(1);
    if (duplicateRole.length)
      throw new ConflictError(
        'This ART already has an active Bugs and Maintenance category.',
      );
  }
}

function activeDevelopment(rows: readonly Category[]) {
  return rows.flatMap((row) => {
    const { kind, recordStatus, defaultPct, semanticRole } = row;
    if (kind !== 'development' || recordStatus !== 'active') return [];
    // The database guarantees both fields on development rows.
    if (defaultPct === null || semanticRole === null) {
      throw new Error(
        'Development category is missing its default percentage or role.',
      );
    }
    return [{ ...row, defaultPct, semanticRole }];
  });
}

function getDevelopment(tx: Tx, trainId: string) {
  return tx
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.trainId, trainId),
        eq(categories.kind, 'development'),
        eq(categories.recordStatus, 'active'),
      ),
    )
    .orderBy(...categoryOrder)
    .then(activeDevelopment);
}

function resolvePair(
  team: Team,
  pi: Pi,
  today: string,
  activeDevCategories: ReturnType<typeof activeDevelopment>,
  overridesByCategoryId: ReadonlyMap<string, number>,
) {
  return resolveTeamPiAllocation({
    trainId: team.trainId,
    teamId: team.id,
    piId: pi.id,
    teamRecordStatus: team.recordStatus,
    piRecordStatus: pi.recordStatus,
    piEndDate: pi.endDate,
    today,
    activeDevCategories,
    overridesByCategoryId,
  });
}

async function listDrift(
  tx: Tx,
  trainId: string,
  today: string,
  development: ReturnType<typeof activeDevelopment>,
) {
  const drifted: DriftedAllocation[] = [];
  if (!development.length) return drifted;
  const activeTeams = await tx
    .select()
    .from(teams)
    .where(and(eq(teams.trainId, trainId), eq(teams.recordStatus, 'active')))
    .orderBy(asc(teams.name), asc(teams.id));
  const activePis = await tx
    .select()
    .from(pis)
    .where(
      and(
        eq(pis.trainId, trainId),
        eq(pis.recordStatus, 'active'),
        gte(pis.endDate, today),
      ),
    )
    .orderBy(asc(pis.endDate), asc(pis.id));
  if (!activeTeams.length || !activePis.length) return drifted;

  const overrides = await tx
    .select()
    .from(allocations)
    .where(
      and(
        inArray(
          allocations.teamId,
          activeTeams.map(({ id }) => id),
        ),
        inArray(
          allocations.piId,
          activePis.map(({ id }) => id),
        ),
      ),
    );
  const byPair = new Map<string, Map<string, number>>();
  for (const { teamId, piId, categoryId, overridePct } of overrides) {
    const key = `${teamId}:${piId}`;
    const pair = byPair.get(key) ?? new Map<string, number>();
    pair.set(categoryId, overridePct);
    byPair.set(key, pair);
  }
  const inherit = new Map<string, number>();
  for (const team of activeTeams) {
    for (const pi of activePis) {
      const view = resolvePair(
        team,
        pi,
        today,
        development,
        byPair.get(`${team.id}:${pi.id}`) ?? inherit,
      );
      if (view.hasDriftWarning) {
        drifted.push({
          teamId: team.id,
          teamName: team.name,
          piId: pi.id,
          piName: pi.name,
          piEndDate: pi.endDate,
          effectiveTotalPct: view.effectiveTotalPct,
        });
      }
    }
  }
  return drifted;
}

async function readCatalog(
  tx: Tx,
  { trainId, includeArchived }: ListFilters,
  today: string,
) {
  const rows = await tx
    .select({
      category: categories,
      referenced: sql<boolean>`${categoryReferences.allocation} or ${categoryReferences.deduction}`,
    })
    .from(categories)
    .where(eq(categories.trainId, trainId))
    .orderBy(...categoryOrder);
  const catalog = rows.map(({ category }) => category);
  return {
    trainId,
    categories: rows
      .filter(
        ({ category }) => includeArchived || category.recordStatus === 'active',
      )
      .map(({ category, referenced }) => categoryDto(category, referenced)),
    totalCategoryCount: rows.length,
    ...validateArtDefaultTotals(catalog),
    driftedAllocations: await listDrift(
      tx,
      trainId,
      today,
      activeDevelopment(catalog),
    ),
  };
}

export function listCategories(
  db: PgliteDatabase,
  filters: ListFilters,
  options: OrganizationOptions = {},
) {
  validate(IdPathSchema, { id: filters.trainId });
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    await getTrain(tx, filters.trainId);
    return readCatalog(tx, filters, today);
  });
}

export function createCategory(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreateCategorySchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(
    db,
    async (tx) => {
      requireActive(await getTrain(tx, data.trainId), 'ART');
      const category = {
        ...data,
        recordStatus: 'active' as const,
        semanticRole: data.semanticRole ?? null,
        defaultPct: data.kind === 'development' ? 0 : null,
      };
      await requireUniqueCategory(tx, category);
      const rows = await tx
        .insert(categories)
        .values({
          ...category,
          sortOrder: await nextSortOrder(tx, data.trainId, data.kind),
          createdBy: actor,
          updatedBy: actor,
        })
        .returning();
      return categoryDto(requireRecord(rows, 'Category'), false);
    },
    'The category name or active Bugs and Maintenance role is already in use.',
  );
}

export function updateCategory(
  db: PgliteDatabase,
  id: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  validate(IdPathSchema, { id });
  const data = validate(UpdateCategorySchema, input);
  return writeOrganization(
    db,
    async (tx) => {
      const current = await getCategory(tx, id);
      requireActive(await getTrain(tx, current.trainId), 'ART');
      const references = await readCategoryReferences(tx, id);
      const referenced = references.allocation || references.deduction;
      const kind = data.kind ?? current.kind;
      const changingKind = kind !== current.kind;
      if (changingKind && references.deduction)
        throw new ConflictError(
          'A category with overhead deductions cannot change kind.',
        );
      if (changingKind && references.allocation)
        throw new ConflictError('A referenced category cannot change kind.');

      const role =
        data.semanticRole === undefined
          ? current.semanticRole
          : data.semanticRole;
      const result = {
        ...current,
        ...data,
        kind,
        recordStatus: data.recordStatus ?? current.recordStatus,
        name: data.name ?? current.name,
        semanticRole: kind === 'overhead' ? null : role,
        defaultPct:
          kind === 'overhead' ? null : changingKind ? 0 : current.defaultPct,
      };
      await requireUniqueCategory(tx, result, id);
      if (kind === 'development' && role === null) {
        throw new ValidationError(
          'Select a semantic role for a development category.',
        );
      }
      if (kind === 'overhead' && data.semanticRole != null) {
        throw new ValidationError(
          'Overhead categories do not have a semantic role.',
        );
      }
      const rows = await tx
        .update(categories)
        .set({
          name: result.name,
          shortLabel: result.shortLabel,
          color: result.color,
          kind,
          recordStatus: result.recordStatus,
          semanticRole: result.semanticRole,
          defaultPct: result.defaultPct,
          sortOrder: changingKind
            ? await nextSortOrder(tx, current.trainId, kind)
            : current.sortOrder,
          updatedBy: resolveActor(options.actor),
        })
        .where(eq(categories.id, id))
        .returning();
      return categoryDto(requireRecord(rows, 'Category'), referenced);
    },
    'The category name or active Bugs and Maintenance role is already in use.',
  );
}

export function deleteCategory(db: PgliteDatabase, id: string) {
  validate(IdPathSchema, { id });
  const message = 'A category with Team PI allocations cannot be deleted.';
  return writeOrganization(
    db,
    async (tx) => {
      const category = await getCategory(tx, id);
      requireActive(await getTrain(tx, category.trainId), 'ART');
      const references = await readCategoryReferences(tx, id);
      if (references.deduction)
        throw new ConflictError(
          'A category with overhead deductions cannot be deleted.',
        );
      if (references.allocation) throw new ConflictError(message);
      await tx.delete(categories).where(eq(categories.id, id));
      return { deleted: true as const, id };
    },
    message,
  );
}

async function getCategoryTargets(tx: Tx, ids: string[]) {
  const rows = ids.length
    ? await tx.select().from(categories).where(inArray(categories.id, ids))
    : [];
  if (rows.length !== ids.length)
    throw new NotFoundError('A submitted category was not found.');
  return rows;
}

function requireActiveTargets(
  targets: Category[],
  trainId: string,
  kind: Category['kind'],
) {
  if (
    targets.some(
      (row) =>
        row.trainId !== trainId ||
        row.kind !== kind ||
        row.recordStatus !== 'active',
    )
  ) {
    throw new ConflictError(`Choose active ${kind} categories from this ART.`);
  }
}

export function reorderCategories(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { trainId, kind, orderedIds } = validate(
    ReorderCategoriesSchema,
    input,
  );
  const actor = resolveActor(options.actor);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    const train = await getTrain(tx, trainId);
    const targets = await getCategoryTargets(tx, orderedIds);
    requireActive(train, 'ART');
    requireActiveTargets(targets, trainId, kind);
    const group = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.trainId, trainId), eq(categories.kind, kind)))
      .orderBy(...categoryOrder);
    const archived = group.filter(
      ({ recordStatus }) => recordStatus === 'archived',
    );
    if (orderedIds.length !== group.length - archived.length) {
      throw new ValidationError('Include every active category in this group.');
    }
    const order = [...orderedIds, ...archived.map(({ id }) => id)];
    for (const [sortOrder, id] of order.entries()) {
      await tx
        .update(categories)
        .set({ sortOrder, updatedBy: actor })
        .where(and(eq(categories.id, id), ne(categories.sortOrder, sortOrder)));
    }
    return readCatalog(tx, { trainId }, today);
  });
}

export function applySampleCatalog(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { trainId } = validate(ApplySampleCatalogSchema, input);
  const actor = resolveActor(options.actor);
  const today = options.today ?? getServerTodayIsoDate();
  const message = 'The sample catalog requires an ART with no categories.';
  return writeOrganization(
    db,
    async (tx) => {
      requireActive(await getTrain(tx, trainId), 'ART');
      const existing = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.trainId, trainId))
        .limit(1);
      if (existing.length) throw new ConflictError(message);
      await tx.insert(categories).values(
        SAMPLE_CATEGORY_CATALOG.map((category) => ({
          ...category,
          trainId,
          createdBy: actor,
          updatedBy: actor,
        })),
      );
      return readCatalog(tx, { trainId }, today);
    },
    message,
  );
}

export function saveArtDefaultAllocations(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { trainId, allocations: submitted } = validate(
    SaveArtDefaultsSchema,
    input,
  );
  const actor = resolveActor(options.actor);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    const train = await getTrain(tx, trainId);
    const targets = await getCategoryTargets(
      tx,
      submitted.map(({ categoryId }) => categoryId),
    );
    requireActive(train, 'ART');
    requireActiveTargets(targets, trainId, 'development');
    const development = await getDevelopment(tx, trainId);
    if (submitted.length !== development.length) {
      const submittedIds = new Set(
        submitted.map(({ categoryId }) => categoryId),
      );
      throw new ValidationError('Include every active development category.', [
        {
          missingCategoryIds: development
            .filter(({ id }) => !submittedIds.has(id))
            .map(({ id }) => id),
        },
      ]);
    }
    const proposed = submitted.map(({ defaultPct }) => ({
      defaultPct,
      kind: 'development' as const,
      recordStatus: 'active' as const,
    }));
    const totals = validateArtDefaultTotals(proposed);
    if (!totals.artDefaultsValid) {
      throw new ValidationError('ART default percentages must total 100%.', [
        {
          currentTotal: totals.activeDevelopmentTotalPct,
          requiredTotal: 100,
        },
      ]);
    }
    for (const { categoryId, defaultPct } of submitted) {
      await tx
        .update(categories)
        .set({ defaultPct, updatedBy: actor })
        .where(eq(categories.id, categoryId));
    }
    return readCatalog(tx, { trainId }, today);
  });
}

type PairIds = { teamId: string; piId: string };

async function getPair(tx: Tx, { teamId, piId }: PairIds) {
  const team = requireRecord(
    await tx.select().from(teams).where(eq(teams.id, teamId)),
    'Team',
  );
  const pi = requireRecord(
    await tx.select().from(pis).where(eq(pis.id, piId)),
    'PI',
  );
  return { team, pi };
}

function requireSameArt(team: Team, pi: Pi) {
  if (team.trainId !== pi.trainId) {
    throw new ConflictError('The Team and PI must belong to the same ART.');
  }
}

async function requireWritablePair(tx: Tx, team: Team, pi: Pi) {
  const train = await getTrain(tx, team.trainId);
  requireSameArt(team, pi);
  requireActive(train, 'ART');
  requireActive(team, 'Team');
  requireActive(pi, 'PI');
}

function matchPair({ teamId, piId }: PairIds) {
  return and(eq(allocations.teamId, teamId), eq(allocations.piId, piId));
}

async function readPair(
  tx: Tx,
  team: Team,
  pi: Pi,
  today: string,
  development: ReturnType<typeof activeDevelopment>,
) {
  const rows = await tx
    .select()
    .from(allocations)
    .where(matchPair({ teamId: team.id, piId: pi.id }));
  return resolvePair(
    team,
    pi,
    today,
    development,
    new Map(
      rows.map(({ categoryId, overridePct }) => [categoryId, overridePct]),
    ),
  );
}

export function getTeamPiAllocation(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const ids = validate(TeamPiAllocationQuerySchema, input);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    const { team, pi } = await getPair(tx, ids);
    requireSameArt(team, pi);
    return readTeamPiAllocation(tx, team, pi, today);
  });
}

export async function readTeamPiAllocation(
  tx: Tx,
  team: Team,
  pi: Pi,
  today: string,
) {
  return readPair(tx, team, pi, today, await getDevelopment(tx, team.trainId));
}

export function saveTeamPiAllocation(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { overrides, ...ids } = validate(SaveTeamPiAllocationSchema, input);
  const actor = resolveActor(options.actor);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    const { team, pi } = await getPair(tx, ids);
    const targets = await getCategoryTargets(
      tx,
      overrides.map(({ categoryId }) => categoryId),
    );
    await requireWritablePair(tx, team, pi);
    requireActiveTargets(targets, team.trainId, 'development');
    const development = await getDevelopment(tx, team.trainId);
    const result = validateTeamPiAllocationSave(development, overrides);
    if (!result.isValid) {
      const message =
        result.reason === 'category_coverage'
          ? 'Include every active development category.'
          : 'The resolved Team PI allocation must total 100%.';
      throw new ValidationError(message, [result.details]);
    }

    const inherit: string[] = [];
    const explicit: (typeof allocations.$inferInsert)[] = [];
    for (const { categoryId, overridePct } of overrides) {
      if (overridePct === null) inherit.push(categoryId);
      else
        explicit.push({
          ...ids,
          categoryId,
          overridePct,
          createdBy: actor,
          updatedBy: actor,
        });
    }
    if (inherit.length) {
      await tx
        .delete(allocations)
        .where(and(matchPair(ids), inArray(allocations.categoryId, inherit)));
    }
    if (explicit.length) {
      await tx
        .insert(allocations)
        .values(explicit)
        .onConflictDoUpdate({
          target: [
            allocations.teamId,
            allocations.piId,
            allocations.categoryId,
          ],
          set: { overridePct: sql`excluded.override_pct`, updatedBy: actor },
        });
    }
    return readPair(tx, team, pi, today, development);
  });
}

export function resetTeamPiAllocation(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const ids = validate(TeamPiAllocationQuerySchema, input);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    const { team, pi } = await getPair(tx, ids);
    await requireWritablePair(tx, team, pi);
    const development = await getDevelopment(tx, team.trainId);
    if (development.length) {
      await tx.delete(allocations).where(
        and(
          matchPair(ids),
          inArray(
            allocations.categoryId,
            development.map(({ id }) => id),
          ),
        ),
      );
    }
    return resolvePair(team, pi, today, development, new Map());
  });
}
