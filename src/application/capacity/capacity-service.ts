import { and, asc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../../domain/audit/actor';
import { getServerTodayIsoDate } from '../../domain/calendar/iso-week';
import {
  calculateMemberIterationAvailability,
  calculateTeamPiCapacity,
  computeBulkOverheadDeductionHours,
} from '../../domain/capacity/engine';
import {
  BulkApplyOverheadDeductionsSchema,
  CapacityViewQuerySchema,
  DeleteTeamPiVelocityOverrideQuerySchema,
  SetTeamPiVelocityOverrideSchema,
  UpdateTeamCapacitySettingsSchema,
  UpsertOverheadDeductionSchema,
} from '../../domain/capacity/schemas';
import { computeTeamIterationSchedule } from '../../domain/organization/cadence';
import { contributesToDevCapacity } from '../../domain/organization/roles';
import {
  absenceTypes,
  absences,
  categories,
  holidays,
  iterations,
  locations,
  members,
  memberTeamAssignments as assignments,
  overheadDeductions as deductions,
  pis,
  teamPiVelocityOverrides as overrides,
  teams,
  trains,
} from '../../persistence/schema';
import { readTeamPiAllocation } from '../categories/category-service';
import {
  ConflictError,
  type OrganizationOptions,
  type OrganizationTransaction as Tx,
  requireActive,
  requireRecord,
  validate,
  ValidationError,
  writeOrganization,
} from '../organization/errors';

type Team = typeof teams.$inferSelect;
type Pi = typeof pis.$inferSelect;
type Iteration = typeof iterations.$inferSelect;
type Category = typeof categories.$inferSelect;
type DeductionChange = Pick<
  typeof deductions.$inferInsert,
  'memberId' | 'iterationId' | 'categoryId' | 'deductedHours'
>;

async function getTeamContext(tx: Tx, teamId: string) {
  const { team, train } = requireRecord(
    await tx
      .select({ team: teams, train: trains })
      .from(teams)
      .innerJoin(trains, eq(teams.trainId, trains.id))
      .where(eq(teams.id, teamId)),
    'Team',
  );
  return { team, train };
}

async function getPi(tx: Tx, piId: string) {
  return requireRecord(
    await tx.select().from(pis).where(eq(pis.id, piId)),
    'PI',
  );
}

function requireSameArt(team: Team, pi: Pi) {
  if (team.trainId !== pi.trainId)
    throw new ConflictError('The Team and PI must belong to the same ART.');
}

function requireWritableTeam({
  team,
  train,
}: Awaited<ReturnType<typeof getTeamContext>>) {
  requireActive(train, 'ART');
  requireActive(team, 'Team');
}

async function getWritablePair(
  tx: Tx,
  { teamId, piId }: { teamId: string; piId: string },
) {
  const context = await getTeamContext(tx, teamId);
  const pi = await getPi(tx, piId);
  requireSameArt(context.team, pi);
  requireWritableTeam(context);
  requireActive(pi, 'PI');
  return { team: context.team, pi };
}

function getIterations(tx: Tx, piId: string) {
  return tx
    .select()
    .from(iterations)
    .where(eq(iterations.piId, piId))
    .orderBy(asc(iterations.startDate), asc(iterations.id));
}

function overlappingAssignments(teamId: string, start: string, end: string) {
  return and(
    eq(assignments.teamId, teamId),
    lte(assignments.startDate, end),
    or(isNull(assignments.endDate), gte(assignments.endDate, start)),
  );
}

async function getAvailabilityInputs(
  tx: Tx,
  team: Team,
  sprints: readonly Iteration[],
  today: string,
) {
  const schedules = sprints.map((sprint) =>
    computeTeamIterationSchedule(sprint, team.id, team.sprintOffsetWorkdays),
  );
  const start =
    schedules.map((schedule) => schedule.scheduledStartDate).sort()[0] ?? today;
  const end =
    schedules
      .map((schedule) => schedule.scheduledEndDate)
      .sort()
      .at(-1) ?? today;
  const rosterAssignments = await tx
    .select()
    .from(assignments)
    .where(overlappingAssignments(team.id, start, end));
  const memberIds = [
    ...new Set(rosterAssignments.map((assignment) => assignment.memberId)),
  ];
  if (!memberIds.length) {
    return {
      schedules,
      members: [],
      assignments: rosterAssignments,
      holidays: [],
      absences: [],
    };
  }
  const roster = (
    await tx
      .select({ member: members, location: locations })
      .from(members)
      .innerJoin(locations, eq(members.locationId, locations.id))
      .where(inArray(members.id, memberIds))
      .orderBy(asc(members.fullName), asc(members.id))
  ).map(({ member, location }) => ({
    memberId: member.id,
    fullName: member.fullName,
    nickname: member.nickname,
    initials: member.initials,
    role: member.role,
    fteFactor: member.fteFactor,
    avatarColor: member.avatarColor,
    recordStatus: member.recordStatus,
    location: {
      id: location.id,
      code: location.code,
      name: location.name,
      timeZone: location.timeZone,
    },
  }));
  const rosterHolidays = schedules.length
    ? await tx
        .select({
          id: holidays.id,
          locationId: holidays.locationId,
          date: holidays.date,
          name: holidays.name,
          portion: holidays.portion,
          source: holidays.source,
          confirmed: holidays.confirmed,
        })
        .from(holidays)
        .where(
          and(
            inArray(holidays.locationId, [
              ...new Set(roster.map((member) => member.location.id)),
            ]),
            gte(holidays.date, start),
            lte(holidays.date, end),
          ),
        )
        .orderBy(asc(holidays.date), asc(holidays.name), asc(holidays.id))
    : [];
  const rosterAbsences = schedules.length
    ? await tx
        .select({
          id: absences.id,
          memberId: absences.memberId,
          date: absences.date,
          portion: absences.portion,
          status: absences.status,
          name: absenceTypes.name,
          affectsCapacity: absenceTypes.affectsCapacity,
        })
        .from(absences)
        .innerJoin(absenceTypes, eq(absences.absenceTypeId, absenceTypes.id))
        .where(
          and(
            inArray(absences.memberId, memberIds),
            gte(absences.date, start),
            lte(absences.date, end),
          ),
        )
        .orderBy(asc(absences.date), asc(absences.id))
    : [];
  return {
    schedules,
    members: roster,
    assignments: rosterAssignments,
    holidays: rosterHolidays,
    absences: rosterAbsences,
  };
}

function velocityScope(teamId: string, piId: string) {
  return and(eq(overrides.teamId, teamId), eq(overrides.piId, piId));
}

export function getTeamPiCapacity(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { teamId, piId } = validate(CapacityViewQuerySchema, input);
  const today = options.today ?? getServerTodayIsoDate();
  return db.transaction(async (tx) => {
    const { team, train } = await getTeamContext(tx, teamId);
    const pi = await getPi(tx, piId);
    requireSameArt(team, pi);
    const sprints = await getIterations(tx, piId);
    const availability = await getAvailabilityInputs(tx, team, sprints, today);
    const overheadDeductions = sprints.length
      ? await tx
          .select({
            teamId: deductions.teamId,
            memberId: deductions.memberId,
            iterationId: deductions.iterationId,
            categoryId: deductions.categoryId,
            deductedHours: deductions.deductedHours,
            source: deductions.source,
          })
          .from(deductions)
          .where(
            and(
              eq(deductions.teamId, teamId),
              inArray(
                deductions.iterationId,
                sprints.map(({ id }) => id),
              ),
            ),
          )
          .orderBy(asc(deductions.categoryId))
      : [];
    const overheadCategoryIds = [
      ...new Set(overheadDeductions.map((deduction) => deduction.categoryId)),
    ];
    const overheadCategories = await tx
      .select({
        categoryId: categories.id,
        name: categories.name,
        shortLabel: categories.shortLabel,
        color: categories.color,
        sortOrder: categories.sortOrder,
        recordStatus: categories.recordStatus,
      })
      .from(categories)
      .where(
        and(
          eq(categories.trainId, team.trainId),
          eq(categories.kind, 'overhead'),
          or(
            eq(categories.recordStatus, 'active'),
            inArray(categories.id, overheadCategoryIds),
          ),
        ),
      );
    const [override] = await tx
      .select({ velocity: overrides.velocity })
      .from(overrides)
      .where(velocityScope(teamId, piId));
    return calculateTeamPiCapacity({
      ...availability,
      today,
      iterations: sprints,
      overheadCategories,
      overheadDeductions,
      team: {
        id: team.id,
        trainId: team.trainId,
        trainName: train.name,
        trainRecordStatus: train.recordStatus,
        name: team.name,
        hoursPerDay: team.hoursPerDay,
        sprintOffsetWorkdays: team.sprintOffsetWorkdays,
        deductionMode: team.deductionMode,
        seedNormalizedVelocity: team.seedNormalizedVelocity,
        recordStatus: team.recordStatus,
      },
      pi: {
        id: pi.id,
        trainId: pi.trainId,
        name: pi.name,
        startDate: pi.startDate,
        endDate: pi.endDate,
        lifecycleStatus: pi.lifecycleStatus,
        recordStatus: pi.recordStatus,
      },
      allocation: await readTeamPiAllocation(tx, team, pi, today),
      piVelocityOverride: override?.velocity ?? null,
    });
  });
}

export function updateTeamCapacitySettings(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { teamId, ...settings } = validate(
    UpdateTeamCapacitySettingsSchema,
    input,
  );
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    requireWritableTeam(await getTeamContext(tx, teamId));
    const team = requireRecord(
      await tx
        .update(teams)
        .set({ ...settings, updatedBy: actor })
        .where(eq(teams.id, teamId))
        .returning({
          id: teams.id,
          trainId: teams.trainId,
          name: teams.name,
          hoursPerDay: teams.hoursPerDay,
          sprintOffsetWorkdays: teams.sprintOffsetWorkdays,
          deductionMode: teams.deductionMode,
          seedNormalizedVelocity: teams.seedNormalizedVelocity,
          recordStatus: teams.recordStatus,
          updatedAt: teams.updatedAt,
        }),
      'Team',
    );
    return { team };
  });
}

export function setTeamPiVelocityOverride(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(SetTeamPiVelocityOverrideSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    await getWritablePair(tx, data);
    const override = requireRecord(
      await tx
        .insert(overrides)
        .values({ ...data, createdBy: actor, updatedBy: actor })
        .onConflictDoUpdate({
          target: [overrides.teamId, overrides.piId],
          set: {
            velocity: data.velocity,
            updatedBy: actor,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: overrides.id,
          teamId: overrides.teamId,
          piId: overrides.piId,
          velocity: overrides.velocity,
          updatedAt: overrides.updatedAt,
        }),
      'Team PI velocity override',
    );
    return { override };
  });
}

export function clearTeamPiVelocityOverride(
  db: PgliteDatabase,
  input: unknown,
) {
  const ids = validate(DeleteTeamPiVelocityOverrideQuerySchema, input);
  return writeOrganization(db, async (tx) => {
    await getWritablePair(tx, ids);
    await tx.delete(overrides).where(velocityScope(ids.teamId, ids.piId));
    return { cleared: true as const, ...ids };
  });
}

function requireOverheadCategory(category: Category | undefined, team: Team) {
  const target = requireRecord(category ? [category] : [], 'Category');
  if (target.trainId !== team.trainId || target.kind !== 'overhead')
    throw new ConflictError('Use an overhead category in the Team’s ART.');
  requireActive(target, 'Category');
}

async function saveDeductions(
  tx: Tx,
  teamId: string,
  changes: DeductionChange[],
  actor: string,
) {
  const pending = changes.filter(({ deductedHours }) => deductedHours > 0);
  const clears = changes.filter(({ deductedHours }) => deductedHours === 0);
  // Batch large requests while keeping the entire mutation in one transaction.
  const batchSize = 500;
  let appliedCount = 0;
  for (let offset = 0; offset < pending.length; offset += batchSize) {
    const applied = await tx
      .insert(deductions)
      .values(
        pending.slice(offset, offset + batchSize).map((change) => ({
          ...change,
          teamId,
          source: 'pi_plan' as const,
          createdBy: actor,
          updatedBy: actor,
        })),
      )
      .onConflictDoUpdate({
        target: [
          deductions.memberId,
          deductions.teamId,
          deductions.iterationId,
          deductions.categoryId,
        ],
        set: {
          deductedHours: sql`excluded.deducted_hours`,
          updatedBy: actor,
          updatedAt: new Date(),
        },
        setWhere: eq(deductions.source, 'pi_plan'),
      })
      .returning({ id: deductions.id });
    appliedCount += applied.length;
  }
  let clearedCount = 0;
  for (let offset = 0; offset < clears.length; offset += batchSize) {
    const removed = await tx
      .delete(deductions)
      .where(
        and(
          eq(deductions.teamId, teamId),
          eq(deductions.source, 'pi_plan'),
          or(
            ...clears
              .slice(offset, offset + batchSize)
              .map(({ memberId, iterationId, categoryId }) =>
                and(
                  eq(deductions.memberId, memberId),
                  eq(deductions.iterationId, iterationId),
                  eq(deductions.categoryId, categoryId),
                ),
              ),
          ),
        ),
      )
      .returning({ id: deductions.id });
    clearedCount += removed.length;
  }
  return { appliedCount, clearedCount };
}

export function bulkApplyOverheadDeductions(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { teamId, piId, mode, entries } = validate(
    BulkApplyOverheadDeductionsSchema,
    input,
  );
  const actor = resolveActor(options.actor);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(db, async (tx) => {
    const { team } = await getWritablePair(tx, { teamId, piId });
    if (mode !== team.deductionMode)
      throw new ConflictError(
        'The requested deduction mode does not match the Team’s deduction mode.',
      );
    const targets = new Map(
      (
        await tx
          .select()
          .from(categories)
          .where(
            inArray(
              categories.id,
              entries.map(({ categoryId }) => categoryId),
            ),
          )
      ).map((category) => [category.id, category]),
    );
    for (const { categoryId } of entries)
      requireOverheadCategory(targets.get(categoryId), team);
    const availability = await getAvailabilityInputs(
      tx,
      team,
      await getIterations(tx, piId),
      today,
    );
    const changes: DeductionChange[] = [];
    for (const member of availability.members) {
      if (
        member.recordStatus !== 'active' ||
        !contributesToDevCapacity(member.role)
      )
        continue;
      for (const schedule of availability.schedules) {
        const available = calculateMemberIterationAvailability({
          ...availability,
          member,
          schedule,
          hoursPerDay: team.hoursPerDay,
        });
        if (available.assignedWeekdays === 0) continue;
        for (const { categoryId, value } of entries) {
          const deductedHours = computeBulkOverheadDeductionHours(
            mode,
            value,
            team.hoursPerDay,
            available,
          );
          if (deductedHours > 744)
            throw new ValidationError(
              'The computed overhead deduction exceeds 744 hours.',
              [
                {
                  memberId: member.memberId,
                  memberName: member.fullName,
                  iterationId: schedule.iterationId,
                  iterationName: schedule.name,
                  categoryId,
                  computedHours: deductedHours,
                  maxHours: 744,
                },
              ],
            );
          changes.push({
            memberId: member.memberId,
            iterationId: schedule.iterationId,
            categoryId,
            deductedHours,
          });
        }
      }
    }
    return {
      teamId,
      piId,
      mode,
      ...(await saveDeductions(tx, teamId, changes, actor)),
    };
  });
}

export function upsertOverheadDeduction(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { teamId, ...data } = validate(UpsertOverheadDeductionSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    const iteration = requireRecord(
      await tx
        .select()
        .from(iterations)
        .where(eq(iterations.id, data.iterationId)),
      'Iteration',
    );
    const { team } = await getWritablePair(tx, {
      teamId,
      piId: iteration.piId,
    });
    const [category] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId));
    requireOverheadCategory(category, team);
    const member = requireRecord(
      await tx.select().from(members).where(eq(members.id, data.memberId)),
      'Member',
    );
    requireActive(member, 'Member');
    if (!contributesToDevCapacity(member.role))
      throw new ConflictError(
        'Only Team members can have overhead deductions.',
      );
    const schedule = computeTeamIterationSchedule(
      iteration,
      teamId,
      team.sprintOffsetWorkdays,
    );
    const overlaps = await tx
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.memberId, member.id),
          overlappingAssignments(
            teamId,
            schedule.scheduledStartDate,
            schedule.scheduledEndDate,
          ),
        ),
      )
      .limit(1);
    if (!overlaps.length)
      throw new ConflictError(
        'The Member is not assigned to the Team during this Iteration.',
      );
    const { appliedCount, clearedCount } = await saveDeductions(
      tx,
      teamId,
      [data],
      actor,
    );
    if (!appliedCount && !clearedCount) {
      const [protectedRow] = await tx
        .select({ id: deductions.id })
        .from(deductions)
        .where(
          and(
            eq(deductions.teamId, teamId),
            eq(deductions.memberId, data.memberId),
            eq(deductions.iterationId, data.iterationId),
            eq(deductions.categoryId, data.categoryId),
            eq(deductions.source, 'sprint_adjusted'),
          ),
        );
      if (protectedRow)
        throw new ConflictError(
          'Sprint-adjusted deductions cannot be edited from PI Planning.',
        );
    }
    return {
      deduction: {
        teamId,
        ...data,
        source: data.deductedHours === 0 ? null : ('pi_plan' as const),
      },
    };
  });
}
