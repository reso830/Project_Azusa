import { and, asc, eq } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../../domain/audit/actor';
import {
  computeTeamIterationSchedule,
  validateIterationInPi,
  validatePiContainsIterations,
  validatePiNoOverlap,
} from '../../domain/organization/cadence';
import {
  CreateIterationSchema,
  CreatePiSchema,
  IdPathSchema,
  UpdateIterationSchema,
  UpdatePiSchema,
} from '../../domain/organization/schemas';
import { iterations, pis, teams, trains } from '../../persistence/schema';
import {
  ConflictError,
  type OrganizationOptions,
  requireActive,
  requireRecord,
  validate,
  ValidationError,
  writeOrganization,
} from './errors';

type Pi = typeof pis.$inferSelect;
type Iteration = typeof iterations.$inferSelect;

async function getPi(db: PgliteDatabase, id: string) {
  return requireRecord(await db.select().from(pis).where(eq(pis.id, id)), 'PI');
}

async function getIterations(db: PgliteDatabase, piId: string) {
  return db
    .select()
    .from(iterations)
    .where(eq(iterations.piId, piId))
    .orderBy(asc(iterations.startDate), asc(iterations.id));
}

export async function listPis(
  db: PgliteDatabase,
  filters: { trainId?: string; includeArchived?: boolean } = {},
) {
  const rows = await db
    .select({
      pi: pis,
      iteration: iterations,
    })
    .from(pis)
    .leftJoin(iterations, eq(iterations.piId, pis.id))
    .where(
      and(
        filters.trainId ? eq(pis.trainId, filters.trainId) : undefined,
        filters.includeArchived ? undefined : eq(pis.recordStatus, 'active'),
      ),
    )
    .orderBy(
      asc(pis.startDate),
      asc(pis.id),
      asc(iterations.startDate),
      asc(iterations.id),
    );
  const result = new Map<string, Pi & { iterations: Iteration[] }>();
  for (const { pi, iteration } of rows) {
    const entry = result.get(pi.id) ?? { ...pi, iterations: [] };
    if (iteration) entry.iterations.push(iteration);
    result.set(pi.id, entry);
  }
  return [...result.values()];
}

async function validatePi(
  db: PgliteDatabase,
  candidate: Pick<Pi, 'startDate' | 'endDate' | 'trainId'> & {
    id?: string;
    recordStatus: Pi['recordStatus'];
  },
) {
  const siblings =
    candidate.recordStatus === 'active'
      ? await db
          .select()
          .from(pis)
          .where(
            and(
              eq(pis.trainId, candidate.trainId),
              eq(pis.recordStatus, 'active'),
            ),
          )
      : [];
  const issue = validatePiNoOverlap(candidate, siblings);
  if (issue?.reason === 'date-order')
    throw new ValidationError(
      'PI end date must be on or after its start date.',
    );
  if (issue?.reason === 'overlap') {
    const { id, name } = issue.conflictingRecord;
    throw new ConflictError(`PI dates overlap “${name}” in this ART.`, [
      { id, name },
    ]);
  }
}

export async function createPi(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreatePiSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(
    db,
    async (tx) => {
      requireActive(
        requireRecord(
          await tx.select().from(trains).where(eq(trains.id, data.trainId)),
          'ART',
        ),
        'ART',
      );
      await validatePi(tx, { ...data, recordStatus: 'active' });
      return requireRecord(
        await tx
          .insert(pis)
          .values({ ...data, createdBy: actor, updatedBy: actor })
          .returning(),
        'PI',
      );
    },
    'A PI with this name already exists in this ART.',
  );
}

export async function updatePi(
  db: PgliteDatabase,
  piId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: piId });
  const data = validate(UpdatePiSchema, input);
  return writeOrganization(
    db,
    async (tx) => {
      const pi = await getPi(tx, id);
      const candidate = { ...pi, ...data };
      if (
        candidate.recordStatus === 'active' &&
        pi.recordStatus === 'archived'
      ) {
        requireActive(
          requireRecord(
            await tx.select().from(trains).where(eq(trains.id, pi.trainId)),
            'ART',
          ),
          'ART',
        );
      }
      await validatePi(tx, candidate);
      const issue = validatePiContainsIterations(
        candidate,
        await getIterations(tx, id),
      );
      if (issue?.reason === 'outside-pi') {
        const { id, name } = issue.conflictingRecord;
        throw new ConflictError(
          `Iteration “${name}” must remain within the PI dates.`,
          [{ id, name }],
        );
      }
      return requireRecord(
        await tx
          .update(pis)
          .set({ ...data, updatedBy: resolveActor(options.actor) })
          .where(eq(pis.id, id))
          .returning(),
        'PI',
      );
    },
    'A PI with this name already exists in this ART.',
  );
}

export async function deletePi(db: PgliteDatabase, piId: string) {
  const { id } = validate(IdPathSchema, { id: piId });
  return writeOrganization(
    db,
    async (tx) =>
      requireRecord(
        await tx.delete(pis).where(eq(pis.id, id)).returning(),
        'PI',
      ),
    'Remove the PI’s Iterations and category allocations before deleting it.',
  );
}

export async function listIterations(
  db: PgliteDatabase,
  piId: string,
  { teamId }: { teamId?: string } = {},
) {
  const { id } = validate(IdPathSchema, { id: piId });
  if (teamId !== undefined) validate(IdPathSchema, { id: teamId });
  return db.transaction(async (tx) => {
    const pi = await getPi(tx, id);
    const rows = await getIterations(tx, id);
    if (!teamId)
      return rows.map((iteration) => ({
        ...iteration,
        teamSchedule: undefined,
      }));
    const team = requireRecord(
      await tx.select().from(teams).where(eq(teams.id, teamId)),
      'Team',
    );
    if (team.trainId !== pi.trainId)
      throw new ConflictError('The Team and PI must belong to the same ART.');
    return rows.map((iteration) => ({
      ...iteration,
      teamSchedule: computeTeamIterationSchedule(
        iteration,
        team.id,
        team.sprintOffsetWorkdays,
      ),
    }));
  });
}

async function validateIteration(
  db: PgliteDatabase,
  candidate: Pick<Iteration, 'startDate' | 'endDate'> & { id?: string },
  pi: Pi,
) {
  const issue = validateIterationInPi(
    candidate,
    pi,
    await getIterations(db, pi.id),
  );
  switch (issue?.reason) {
    case 'date-order':
      throw new ValidationError(
        'Iteration end date must be on or after its start date.',
      );
    case 'weekend-boundary':
      throw new ValidationError(
        'Iteration dates must fall Monday through Friday.',
      );
    case 'outside-pi':
      throw new ConflictError(
        `Iteration dates must be within PI “${pi.name}”.`,
      );
    case 'overlap': {
      const { id, name } = issue.conflictingRecord;
      throw new ConflictError(`Iteration dates overlap “${name}” in this PI.`, [
        { id, name },
      ]);
    }
  }
}

export async function createIteration(
  db: PgliteDatabase,
  piId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: piId });
  const data = validate(CreateIterationSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(
    db,
    async (tx) => {
      const pi = await getPi(tx, id);
      requireActive(pi, 'PI');
      await validateIteration(tx, data, pi);
      return requireRecord(
        await tx
          .insert(iterations)
          .values({ ...data, piId: id, createdBy: actor, updatedBy: actor })
          .returning(),
        'Iteration',
      );
    },
    'An Iteration with this name already exists in this PI.',
  );
}

export async function updateIteration(
  db: PgliteDatabase,
  iterationId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: iterationId });
  const data = validate(UpdateIterationSchema, input);
  return writeOrganization(
    db,
    async (tx) => {
      const iteration = requireRecord(
        await tx.select().from(iterations).where(eq(iterations.id, id)),
        'Iteration',
      );
      await validateIteration(
        tx,
        { ...iteration, ...data },
        await getPi(tx, iteration.piId),
      );
      return requireRecord(
        await tx
          .update(iterations)
          .set({ ...data, updatedBy: resolveActor(options.actor) })
          .where(eq(iterations.id, id))
          .returning(),
        'Iteration',
      );
    },
    'An Iteration with this name already exists in this PI.',
  );
}

export async function deleteIteration(db: PgliteDatabase, iterationId: string) {
  const { id } = validate(IdPathSchema, { id: iterationId });
  return writeOrganization(db, async (tx) =>
    requireRecord(
      await tx.delete(iterations).where(eq(iterations.id, id)).returning(),
      'Iteration',
    ),
  );
}

export async function getOrganizationContextTree(db: PgliteDatabase) {
  return db.transaction(async (tx) => {
    const trainRows = await tx
      .select()
      .from(trains)
      .where(eq(trains.recordStatus, 'active'))
      .orderBy(asc(trains.name), asc(trains.id));
    const teamRows = await tx
      .select()
      .from(teams)
      .where(eq(teams.recordStatus, 'active'))
      .orderBy(asc(teams.name), asc(teams.id));
    const piRows = await listPis(tx);
    return {
      trains: trainRows.flatMap((train) => {
        const activeTeams = teamRows.filter(
          (team) => team.trainId === train.id,
        );
        return activeTeams.length
          ? [
              {
                id: train.id,
                name: train.name,
                recordStatus: train.recordStatus,
                teams: activeTeams.map(
                  ({
                    id,
                    name,
                    sprintOffsetWorkdays,
                    hoursPerDay,
                    recordStatus,
                  }) => ({
                    id,
                    name,
                    sprintOffsetWorkdays,
                    hoursPerDay,
                    recordStatus,
                  }),
                ),
                pis: piRows
                  .filter((pi) => pi.trainId === train.id)
                  .map(
                    ({
                      id,
                      name,
                      startDate,
                      endDate,
                      lifecycleStatus,
                      recordStatus,
                      iterations,
                    }) => ({
                      id,
                      name,
                      startDate,
                      endDate,
                      lifecycleStatus,
                      recordStatus,
                      iterations: iterations.map(
                        ({ id, name, kind, startDate, endDate }) => ({
                          id,
                          name,
                          kind,
                          startDate,
                          endDate,
                        }),
                      ),
                    }),
                  ),
              },
            ]
          : [];
      }),
    };
  });
}
