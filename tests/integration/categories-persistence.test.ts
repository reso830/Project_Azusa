import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import * as service from '../../src/application/categories/category-service';
import {
  deleteTrain,
  deleteTeam,
} from '../../src/application/organization/organization-service';
import { deletePi } from '../../src/application/organization/cadence-service';
import {
  pis,
  teamCategoryAllocations,
  teams,
  trains,
} from '../../src/persistence/schema';

const options = { today: '2027-03-12', actor: 'local:test' };
const metadata = { name: 'Extra', shortLabel: 'EX', color: '#123456' };
let client: PGlite;
let db: PgliteDatabase;

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: 'src/persistence/migrations' });
});
afterEach(async () => client.close());

async function createArt(name: string) {
  const [row] = await db.insert(trains).values({ name }).returning();
  return row!.id;
}

async function setup() {
  const trainId = await createArt('Payments');
  const [team, otherTeam] = await db
    .insert(teams)
    .values([
      { trainId, name: 'Palawan' },
      { trainId, name: 'Cebu' },
    ])
    .returning();
  const [pi, nextPi, pastPi, archivedPi] = await db
    .insert(pis)
    .values([
      {
        trainId,
        name: 'Current',
        startDate: '2027-01-04',
        endDate: options.today,
      },
      {
        trainId,
        name: 'Future',
        startDate: '2027-03-15',
        endDate: '2027-05-14',
      },
      { trainId, name: 'Past', startDate: '2026-10-01', endDate: '2026-12-31' },
      {
        trainId,
        name: 'Archived',
        startDate: '2027-05-17',
        endDate: '2027-07-16',
        recordStatus: 'archived',
      },
    ])
    .returning();
  const catalog = await service.applySampleCatalog(db, { trainId }, options);
  const development = catalog.categories.filter(
    ({ kind }) => kind === 'development',
  );
  const [feature, bugs, enablers, estimations, debt] = development;
  const pair = { teamId: team!.id, piId: pi!.id };
  const overrides = (values: (number | null)[]) =>
    development.map(({ id }, index) => ({
      categoryId: id,
      overridePct: values[index]!,
    }));
  const defaults = (values: number[]) =>
    development.map(({ id }, index) => ({
      categoryId: id,
      defaultPct: values[index]!,
    }));
  return {
    trainId,
    pair,
    otherTeam: otherTeam!,
    nextPi: nextPi!,
    pastPi: pastPi!,
    archivedPi: archivedPi!,
    feature: feature!,
    bugs: bugs!,
    enablers: enablers!,
    estimations: estimations!,
    debt: debt!,
    overrides,
    defaults,
  };
}

it('creates and reorders categories by kind while preserving archived relative order', async () => {
  const trainId = await createArt('Payments');
  expect(await service.listCategories(db, { trainId }, options)).toMatchObject({
    artConfigStatus: 'not_configured',
    totalCategoryCount: 0,
    driftedAllocations: [],
  });
  const sample = await service.applySampleCatalog(db, { trainId }, options);
  expect(sample).toMatchObject({
    totalCategoryCount: 7,
    activeDevelopmentTotalPct: 100,
  });
  expect(
    sample.categories
      .filter(({ kind }) => kind === 'development')
      .map(({ defaultPct }) => defaultPct),
  ).toEqual([49, 20, 14, 10, 7]);
  expect(
    sample.categories.find(({ semanticRole }) => semanticRole === 'feature')
      ?.shortLabel,
  ).toBe('Feature dev.');
  await expect(
    service.applySampleCatalog(db, { trainId }, options),
  ).rejects.toMatchObject({ status: 409 });
  const dev = {
    ...metadata,
    trainId,
    kind: 'development',
    semanticRole: 'standard',
  };
  const extra = await service.createCategory(db, dev, options);
  expect(extra).toMatchObject({
    defaultPct: 0,
    sortOrder: 5,
    isReferenced: false,
  });
  await expect(
    service.createCategory(db, { ...dev, name: ' eXTRA ' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    service.createCategory(
      db,
      { ...dev, name: 'Second Bugs', semanticRole: 'maintenance_bugs' },
      options,
    ),
  ).rejects.toMatchObject({ status: 409 });
  const other = await createArt('Platform');
  await expect(
    service.createCategory(
      db,
      { ...dev, trainId: other, semanticRole: 'maintenance_bugs' },
      options,
    ),
  ).resolves.toMatchObject({ sortOrder: 0, semanticRole: 'maintenance_bugs' });
  const overhead = await service.createCategory(
    db,
    { ...metadata, name: 'Overhead', trainId, kind: 'overhead' },
    options,
  );
  expect(overhead).toMatchObject({
    defaultPct: null,
    semanticRole: null,
    sortOrder: 2,
  });

  const development = sample.categories.filter(
    ({ kind }) => kind === 'development',
  );
  const [first, secondArchived, ...rest] = development;
  await service.updateCategory(
    db,
    first!.id,
    { recordStatus: 'archived' },
    options,
  );
  await service.updateCategory(
    db,
    secondArchived!.id,
    { recordStatus: 'archived' },
    options,
  );
  const orderedIds = [extra.id, ...rest.map(({ id }) => id)];
  await service.reorderCategories(
    db,
    { trainId, kind: 'development', orderedIds },
    options,
  );
  const listed = await service.listCategories(
    db,
    { trainId, includeArchived: true },
    options,
  );
  expect(
    listed.categories
      .filter(({ kind }) => kind === 'development')
      .map(({ id, sortOrder }) => [id, sortOrder]),
  ).toEqual(
    [...orderedIds, first!.id, secondArchived!.id].map((id, index) => [
      id,
      index,
    ]),
  );
  expect(
    listed.categories
      .filter(({ kind }) => kind === 'overhead')
      .map(({ sortOrder }) => sortOrder),
  ).toEqual([0, 1, 2]);
  const overheadIds = listed.categories
    .filter(({ kind }) => kind === 'overhead')
    .map(({ id }) => id)
    .reverse();
  expect(
    (
      await service.reorderCategories(
        db,
        { trainId, kind: 'overhead', orderedIds: overheadIds },
        options,
      )
    ).categories
      .filter(({ kind }) => kind === 'overhead')
      .map(({ id }) => id),
  ).toEqual(overheadIds);
  const unknown = crypto.randomUUID();
  for (const [ids, status] of [
    [[unknown], 404],
    [[overhead.id], 409],
    [[first!.id], 409],
    [[extra.id], 400],
  ] as const) {
    await expect(
      service.reorderCategories(
        db,
        { trainId, kind: 'development', orderedIds: ids },
        options,
      ),
    ).rejects.toMatchObject({ status });
  }
  await service.createCategory(
    db,
    { ...dev, name: 'Replacement Bugs', semanticRole: 'maintenance_bugs' },
    options,
  );
  await expect(
    service.updateCategory(
      db,
      secondArchived!.id,
      { recordStatus: 'active' },
      options,
    ),
  ).rejects.toMatchObject({ status: 409 });
}, 60000);

it('saves complete splits atomically and flags only eligible drifting pairs', async () => {
  const {
    trainId,
    pair,
    otherTeam,
    nextPi,
    pastPi,
    archivedPi,
    overrides,
    defaults,
    debt,
  } = await setup();
  const split = overrides([56, 15, null, 8, null]);
  await service.saveArtDefaultAllocations(
    db,
    { trainId, allocations: defaults([49, 20, 14, 10, 7]) },
    options,
  );
  for (const target of [
    pair,
    { ...pair, piId: pastPi.id },
    { ...pair, teamId: otherTeam.id },
  ]) {
    await service.saveTeamPiAllocation(
      db,
      { ...target, overrides: split },
      options,
    );
  }
  await service.saveTeamPiAllocation(
    db,
    { ...pair, overrides: overrides([63, 15, null, 8, 0]) },
    options,
  );
  expect(
    (await service.getTeamPiAllocation(db, pair, options)).items.find(
      ({ categoryId }) => categoryId === debt.id,
    ),
  ).toMatchObject({ overridePct: 0, source: 'override' });
  const listed = await service.listCategories(db, { trainId }, options);
  const referenced = new Set(
    overrides([63, 15, null, 8, 0])
      .filter(({ overridePct }) => overridePct !== null)
      .map(({ categoryId }) => categoryId),
  );
  expect(listed.categories).toHaveLength(7);
  for (const { id, isReferenced } of listed.categories) {
    expect(isReferenced, id).toBe(referenced.has(id));
  }
  const before = await db.select().from(teamCategoryAllocations);
  await expect(
    service.saveTeamPiAllocation(
      db,
      { ...pair, overrides: split.slice(1) },
      options,
    ),
  ).rejects.toMatchObject({
    status: 400,
    details: [
      expect.objectContaining({ missingCategoryIds: [split[0]!.categoryId] }),
    ],
  });
  await expect(
    service.saveTeamPiAllocation(
      db,
      { ...pair, overrides: overrides([51, 15, null, 8, null]) },
      options,
    ),
  ).rejects.toMatchObject({
    status: 400,
    details: [{ currentTotal: 95, requiredTotal: 100 }],
  });
  expect(await db.select().from(teamCategoryAllocations)).toEqual(before);
  const cleared = await service.saveTeamPiAllocation(
    db,
    { ...pair, overrides: split },
    options,
  );
  expect(cleared.items.map(({ effectivePct }) => effectivePct)).toEqual([
    56, 15, 14, 8, 7,
  ]);
  expect(
    cleared.items.find(({ categoryId }) => categoryId === debt.id),
  ).toMatchObject({ overridePct: null, source: 'inherit' });
  expect(
    (
      await service.getTeamPiAllocation(
        db,
        { ...pair, piId: nextPi.id },
        options,
      )
    ).items.every(({ source }) => source === 'inherit'),
  ).toBe(true);

  await db
    .update(teams)
    .set({ recordStatus: 'archived' })
    .where(eq(teams.id, otherTeam.id));
  await db
    .insert(teamCategoryAllocations)
    .values(
      split.flatMap(({ categoryId, overridePct }) =>
        overridePct === null
          ? []
          : [{ ...pair, piId: archivedPi.id, categoryId, overridePct }],
      ),
    );
  await expect(
    service.saveArtDefaultAllocations(
      db,
      { trainId, allocations: defaults([44, 20, 14, 10, 7]) },
      options,
    ),
  ).rejects.toMatchObject({
    status: 400,
    details: [{ currentTotal: 95, requiredTotal: 100 }],
  });
  expect(
    (await service.getTeamPiAllocation(db, pair, options)).items.map(
      ({ artDefaultPct }) => artDefaultPct,
    ),
  ).toEqual([49, 20, 14, 10, 7]);
  const saved = await service.saveArtDefaultAllocations(
    db,
    { trainId, allocations: defaults([45, 20, 18, 10, 7]) },
    options,
  );
  expect(saved.driftedAllocations).toEqual([
    {
      ...pair,
      teamName: 'Palawan',
      piName: 'Current',
      piEndDate: options.today,
      effectiveTotalPct: 104,
    },
  ]);
  expect(await service.getTeamPiAllocation(db, pair, options)).toMatchObject({
    effectiveTotalPct: 104,
    hasDriftWarning: true,
  });
  for (const target of [
    { ...pair, piId: pastPi.id },
    { ...pair, piId: archivedPi.id },
    { ...pair, teamId: otherTeam.id },
  ]) {
    expect(
      await service.getTeamPiAllocation(db, target, options),
    ).toMatchObject({
      effectiveTotalPct: 104,
      hasDriftWarning: false,
      isValid: false,
    });
  }
}, 60000);

it('preserves archived overrides, allows role edits, and rechecks totals after catalog changes', async () => {
  const { trainId, pair, otherTeam, feature, bugs, debt, defaults, overrides } =
    await setup();
  await service.saveArtDefaultAllocations(
    db,
    { trainId, allocations: defaults([44, 20, 14, 10, 12]) },
    options,
  );
  await service.saveTeamPiAllocation(
    db,
    { ...pair, overrides: overrides([44, 20, 14, 10, 12]) },
    options,
  );
  expect(
    await service.updateCategory(
      db,
      bugs.id,
      { name: 'Bugs & Support' },
      options,
    ),
  ).toMatchObject({
    id: bugs.id,
    semanticRole: 'maintenance_bugs',
    isReferenced: true,
  });
  expect(
    await service.updateCategory(
      db,
      bugs.id,
      { semanticRole: 'standard' },
      options,
    ),
  ).toMatchObject({ semanticRole: 'standard' });
  await expect(
    service.updateCategory(db, bugs.id, { semanticRole: null }, options),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    service.updateCategory(db, bugs.id, { kind: 'overhead' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(service.deleteCategory(db, bugs.id)).rejects.toMatchObject({
    status: 409,
  });
  await service.updateCategory(
    db,
    debt.id,
    { recordStatus: 'archived' },
    options,
  );
  const archived = await service.listCategories(db, { trainId }, options);
  expect(archived).toMatchObject({
    activeDevelopmentTotalPct: 88,
    totalCategoryCount: 7,
  });
  for (const teamId of [pair.teamId, otherTeam.id]) {
    expect(archived.driftedAllocations).toContainEqual(
      expect.objectContaining({
        teamId,
        piId: pair.piId,
        effectiveTotalPct: 88,
      }),
    );
  }
  expect(await service.resetTeamPiAllocation(db, pair, options)).toMatchObject({
    effectiveTotalPct: 88,
    hasDriftWarning: true,
  });
  expect(await db.select().from(teamCategoryAllocations)).toEqual([
    expect.objectContaining({ categoryId: debt.id, overridePct: 12 }),
  ]);
  await service.saveArtDefaultAllocations(
    db,
    { trainId, allocations: defaults([56, 20, 14, 10, 12]).slice(0, 4) },
    options,
  );
  await service.updateCategory(
    db,
    debt.id,
    { recordStatus: 'active' },
    options,
  );
  const reactivated = await service.getTeamPiAllocation(db, pair, options);
  expect(reactivated).toMatchObject({
    effectiveTotalPct: 112,
    hasDriftWarning: true,
  });
  expect(
    reactivated.items.find(({ categoryId }) => categoryId === debt.id),
  ).toMatchObject({ overridePct: 12, source: 'override' });
  const reset = await service.resetTeamPiAllocation(db, pair, options);
  expect(reset.items.every(({ source }) => source === 'inherit')).toBe(true);
  expect(
    await service.updateCategory(
      db,
      feature.id,
      { kind: 'overhead', semanticRole: null },
      options,
    ),
  ).toMatchObject({ kind: 'overhead', defaultPct: null, semanticRole: null });
  expect(
    await service.updateCategory(
      db,
      feature.id,
      { kind: 'development', semanticRole: 'feature' },
      options,
    ),
  ).toMatchObject({ defaultPct: 0, semanticRole: 'feature' });
  const disposable = await createArt('Disposable');
  const only = await service.createCategory(
    db,
    {
      ...metadata,
      trainId: disposable,
      kind: 'development',
      semanticRole: 'standard',
    },
    options,
  );
  await service.saveArtDefaultAllocations(
    db,
    {
      trainId: disposable,
      allocations: [{ categoryId: only.id, defaultPct: 100 }],
    },
    options,
  );
  await service.deleteCategory(db, only.id);
  expect(
    await service.listCategories(db, { trainId: disposable }, options),
  ).toMatchObject({ artConfigStatus: 'not_configured' });
  await expect(deleteTrain(db, disposable)).resolves.toBeDefined();
}, 60000);

it('enforces ownership and error precedence and explains F002 delete conflicts', async () => {
  const { trainId, pair, bugs, archivedPi, otherTeam, overrides } =
    await setup();
  const foreign = await createArt('Foreign');
  const foreignCategory = await service.createCategory(
    db,
    {
      ...metadata,
      trainId: foreign,
      kind: 'development',
      semanticRole: 'standard',
    },
    options,
  );
  const [foreignPi] = await db
    .insert(pis)
    .values({
      trainId: foreign,
      name: 'Foreign',
      startDate: '2027-01-04',
      endDate: options.today,
    })
    .returning();
  const reference = (categoryId: string) => [{ categoryId, overridePct: null }];
  await expect(
    service.saveTeamPiAllocation(
      db,
      {
        ...pair,
        piId: foreignPi!.id,
        overrides: reference(crypto.randomUUID()),
      },
      options,
    ),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    service.saveTeamPiAllocation(
      db,
      { ...pair, overrides: reference(foreignCategory.id) },
      options,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    service.getTeamPiAllocation(db, { ...pair, piId: foreignPi!.id }, options),
  ).rejects.toMatchObject({ status: 409 });
  await service.saveTeamPiAllocation(
    db,
    { ...pair, overrides: overrides([56, 15, null, 8, null]) },
    options,
  );
  const categoryOnlyArt = await createArt('Categories only');
  await service.createCategory(
    db,
    { ...metadata, trainId: categoryOnlyArt, kind: 'overhead' },
    options,
  );
  await expect(deleteTrain(db, categoryOnlyArt)).rejects.toMatchObject({
    status: 409,
    message: 'Remove the ART’s Teams, PIs, and Categories before deleting it.',
  });
  await expect(deleteTeam(db, pair.teamId)).rejects.toMatchObject({
    status: 409,
    message: 'This Team has Member assignments or category allocations.',
  });
  await expect(deletePi(db, pair.piId)).rejects.toMatchObject({
    status: 409,
    message:
      'Remove the PI’s Iterations and category allocations before deleting it.',
  });
  await db
    .update(teams)
    .set({ recordStatus: 'archived' })
    .where(eq(teams.id, otherTeam.id));
  for (const target of [
    { ...pair, teamId: otherTeam.id },
    { ...pair, piId: archivedPi.id },
  ]) {
    await expect(
      service.resetTeamPiAllocation(db, target, options),
    ).rejects.toMatchObject({ status: 409 });
  }
  await db
    .update(trains)
    .set({ recordStatus: 'archived' })
    .where(eq(trains.id, trainId));
  await expect(
    service.resetTeamPiAllocation(db, pair, options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    service.updateCategory(db, bugs.id, { recordStatus: 'active' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(service.deleteCategory(db, bugs.id)).rejects.toMatchObject({
    status: 409,
  });
}, 60000);
