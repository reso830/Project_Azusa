import {
  and,
  asc,
  desc,
  eq,
  exists,
  gt,
  gte,
  isNull,
  lte,
  or,
} from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../../domain/audit/actor';
import { getServerTodayIsoDate } from '../../domain/calendar/iso-week';
import { contributesToDevCapacity } from '../../domain/organization/roles';
import {
  CreateMemberSchema,
  CreateTeamSchema,
  CreateTrainSchema,
  IdPathSchema,
  UpdateMemberSchema,
  UpdateTeamSchema,
  UpdateTrainSchema,
} from '../../domain/organization/schemas';
import {
  absences,
  locations,
  members,
  memberTeamAssignments as assignments,
  overheadDeductions,
  pis,
  teams,
  teamPiVelocityOverrides,
  trains,
} from '../../persistence/schema';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type OrganizationOptions,
  type OrganizationTransaction,
  requireActive,
  requireRecord,
  validate,
  writeOrganization,
} from './errors';

type ListOptions = { includeArchived?: boolean };
type TeamFilters = ListOptions & { trainId?: string };
type MemberFilters = ListOptions & { teamId?: string; asOf?: string };
type Assignment = typeof assignments.$inferSelect;

const assignmentAt = (date: string) =>
  and(
    lte(assignments.startDate, date),
    or(isNull(assignments.endDate), gte(assignments.endDate, date)),
  );

function previousDay(date: string): string {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export async function listTrains(
  db: PgliteDatabase,
  { includeArchived = false }: ListOptions = {},
) {
  return db
    .select({
      train: trains,
      teamCount: db.$count(teams, eq(teams.trainId, trains.id)),
      piCount: db.$count(pis, eq(pis.trainId, trains.id)),
    })
    .from(trains)
    .where(includeArchived ? undefined : eq(trains.recordStatus, 'active'))
    .orderBy(asc(trains.name), asc(trains.id))
    .then((rows) =>
      rows.map(({ train, ...counts }) => ({ ...train, ...counts })),
    );
}

export async function createTrain(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreateTrainSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(
    db,
    async (tx) =>
      requireRecord(
        await tx
          .insert(trains)
          .values({ ...data, createdBy: actor, updatedBy: actor })
          .returning(),
        'ART',
      ),
    'An ART with this name already exists.',
  );
}

export async function updateTrain(
  db: PgliteDatabase,
  trainId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: trainId });
  const data = validate(UpdateTrainSchema, input);
  return writeOrganization(
    db,
    async (tx) =>
      requireRecord(
        await tx
          .update(trains)
          .set({ ...data, updatedBy: resolveActor(options.actor) })
          .where(eq(trains.id, id))
          .returning(),
        'ART',
      ),
    'An ART with this name already exists.',
  );
}

export async function deleteTrain(db: PgliteDatabase, trainId: string) {
  const { id } = validate(IdPathSchema, { id: trainId });
  return writeOrganization(
    db,
    async (tx) =>
      requireRecord(
        await tx.delete(trains).where(eq(trains.id, id)).returning(),
        'ART',
      ),
    'Remove the ART’s Teams, PIs, and Categories before deleting it.',
  );
}

export async function listTeams(
  db: PgliteDatabase,
  filters: TeamFilters = {},
  options: OrganizationOptions = {},
) {
  const today = options.today ?? getServerTodayIsoDate();
  return db
    .select({
      team: teams,
      memberCount: db.$count(
        assignments,
        and(
          eq(assignments.teamId, teams.id),
          assignmentAt(today),
          exists(
            db
              .select({ id: members.id })
              .from(members)
              .where(
                and(
                  eq(members.id, assignments.memberId),
                  eq(members.recordStatus, 'active'),
                ),
              ),
          ),
        ),
      ),
    })
    .from(teams)
    .where(
      and(
        filters.trainId ? eq(teams.trainId, filters.trainId) : undefined,
        filters.includeArchived ? undefined : eq(teams.recordStatus, 'active'),
      ),
    )
    .orderBy(asc(teams.name), asc(teams.id))
    .then((rows) =>
      rows.map(({ team, memberCount }) => ({ ...team, memberCount })),
    );
}

export async function createTeam(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreateTeamSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(
    db,
    async (tx) => {
      const train = requireRecord(
        await tx.select().from(trains).where(eq(trains.id, data.trainId)),
        'ART',
      );
      requireActive(train, 'ART');
      return requireRecord(
        await tx
          .insert(teams)
          .values({ ...data, createdBy: actor, updatedBy: actor })
          .returning(),
        'Team',
      );
    },
    'A Team with this name already exists in this ART.',
  );
}

async function getTeam(db: PgliteDatabase, id: string) {
  return requireRecord(
    await db.select().from(teams).where(eq(teams.id, id)),
    'Team',
  );
}

export async function updateTeam(
  db: PgliteDatabase,
  teamId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: teamId });
  const data = validate(UpdateTeamSchema, input);
  const today = options.today ?? getServerTodayIsoDate();
  return writeOrganization(
    db,
    async (tx) => {
      const team = await getTeam(tx, id);
      if (data.recordStatus === 'active' && team.recordStatus === 'archived') {
        requireActive(
          requireRecord(
            await tx.select().from(trains).where(eq(trains.id, team.trainId)),
            'ART',
          ),
          'ART',
        );
      }
      if (
        data.recordStatus === 'archived' &&
        team.recordStatus === 'active' &&
        (await tx.$count(
          assignments,
          and(eq(assignments.teamId, id), gt(assignments.startDate, today)),
        ))
      ) {
        throw new ConflictError(
          'Cancel pending moves into this Team before archiving it.',
        );
      }
      return requireRecord(
        await tx
          .update(teams)
          .set({ ...data, updatedBy: resolveActor(options.actor) })
          .where(eq(teams.id, id))
          .returning(),
        'Team',
      );
    },
    'A Team with this name already exists in this ART.',
  );
}

export async function deleteTeam(db: PgliteDatabase, teamId: string) {
  const { id } = validate(IdPathSchema, { id: teamId });
  return writeOrganization(
    db,
    async (tx) => {
      if (
        await tx.$count(overheadDeductions, eq(overheadDeductions.teamId, id))
      )
        throw new ConflictError('This Team has overhead deductions.');
      if (
        await tx.$count(
          teamPiVelocityOverrides,
          eq(teamPiVelocityOverrides.teamId, id),
        )
      )
        throw new ConflictError('This Team has PI velocity overrides.');
      return requireRecord(
        await tx.delete(teams).where(eq(teams.id, id)).returning(),
        'Team',
      );
    },
    'This Team has Member assignments or category allocations.',
  );
}

async function memberRows(
  db: PgliteDatabase,
  filters: MemberFilters,
  today: string,
  memberId?: string,
) {
  const pending = db
    .select({
      memberId: assignments.memberId,
      teamId: assignments.teamId,
      effectiveDate: assignments.startDate,
      teamName: teams.name,
    })
    .from(assignments)
    .innerJoin(teams, eq(teams.id, assignments.teamId))
    .where(and(isNull(assignments.endDate), gt(assignments.startDate, today)))
    .as('pending');
  const rows = await db
    .select({
      member: members,
      teamId: assignments.teamId,
      location: {
        id: locations.id,
        name: locations.name,
        code: locations.code,
        timeZone: locations.timeZone,
        recordStatus: locations.recordStatus,
      },
      pendingMove: {
        teamId: pending.teamId,
        teamName: pending.teamName,
        effectiveDate: pending.effectiveDate,
      },
    })
    .from(members)
    .innerJoin(
      assignments,
      and(
        eq(assignments.memberId, members.id),
        assignmentAt(filters.asOf ?? today),
      ),
    )
    .innerJoin(locations, eq(locations.id, members.locationId))
    .leftJoin(pending, eq(pending.memberId, members.id))
    .where(
      and(
        memberId ? eq(members.id, memberId) : undefined,
        filters.teamId ? eq(assignments.teamId, filters.teamId) : undefined,
        filters.includeArchived
          ? undefined
          : eq(members.recordStatus, 'active'),
      ),
    )
    .orderBy(asc(members.fullName), asc(members.id));
  return rows.map(({ member, ...context }) => ({
    ...member,
    ...context,
    contributesToDevCapacity: contributesToDevCapacity(member.role),
  }));
}

export async function listMembers(
  db: PgliteDatabase,
  filters: MemberFilters = {},
  options: OrganizationOptions = {},
) {
  return memberRows(db, filters, options.today ?? getServerTodayIsoDate());
}

async function requireActiveLocation(db: PgliteDatabase, id: string) {
  requireActive(
    requireRecord(
      await db.select().from(locations).where(eq(locations.id, id)),
      'Location',
    ),
    'Location',
  );
}

async function currentMember(db: PgliteDatabase, id: string, today: string) {
  return requireRecord(
    await memberRows(db, { includeArchived: true }, today, id),
    'Member assignment',
  );
}

export async function createMember(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { teamId, ...data } = validate(CreateMemberSchema, input);
  const today = options.today ?? getServerTodayIsoDate();
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    requireActive(await getTeam(tx, teamId), 'Team');
    await requireActiveLocation(tx, data.locationId);
    const member = requireRecord(
      await tx
        .insert(members)
        .values({ ...data, createdBy: actor, updatedBy: actor })
        .returning(),
      'Member',
    );
    await tx.insert(assignments).values({
      memberId: member.id,
      teamId,
      startDate: today,
      createdBy: actor,
      updatedBy: actor,
    });
    return currentMember(tx, member.id, today);
  });
}

async function recentAssignments(db: PgliteDatabase, id: string) {
  return db
    .select()
    .from(assignments)
    .where(eq(assignments.memberId, id))
    .orderBy(desc(assignments.startDate))
    .limit(2);
}

async function cancelMove(
  tx: OrganizationTransaction,
  pending: Assignment,
  previous: Assignment,
  actor: string,
) {
  await tx.delete(assignments).where(eq(assignments.id, pending.id));
  await tx
    .update(assignments)
    .set({ endDate: null, updatedBy: actor })
    .where(eq(assignments.id, previous.id));
}

async function moveMember(
  tx: OrganizationTransaction,
  id: string,
  teamId: string,
  effectiveDate: string,
  today: string,
  actor: string,
) {
  if (effectiveDate < today)
    throw new ValidationError('Team moves cannot be backdated.');
  const history = await recentAssignments(tx, id);
  const latest = requireRecord(history, 'Member assignment');
  const pending = latest.startDate > today;
  if (pending && effectiveDate < latest.startDate) {
    throw new ValidationError(
      'Cancel the pending move before scheduling an earlier move.',
    );
  }
  const previous = history[1];
  if (
    pending &&
    effectiveDate === latest.startDate &&
    previous?.teamId === teamId
  ) {
    await cancelMove(tx, latest, previous, actor);
    return;
  }
  requireActive(await getTeam(tx, teamId), 'Destination Team');
  if (effectiveDate === latest.startDate) {
    if (previous?.teamId === teamId) {
      await cancelMove(tx, latest, previous, actor);
      return;
    }
    await tx
      .update(assignments)
      .set({ teamId, updatedBy: actor })
      .where(eq(assignments.id, latest.id));
  } else {
    if (pending)
      throw new ConflictError('This Member already has a pending move.');
    if (latest.teamId === teamId) return;
    await tx
      .update(assignments)
      .set({ endDate: previousDay(effectiveDate), updatedBy: actor })
      .where(eq(assignments.id, latest.id));
    await tx.insert(assignments).values({
      memberId: id,
      teamId,
      startDate: effectiveDate,
      createdBy: actor,
      updatedBy: actor,
    });
  }
}

export async function updateMember(
  db: PgliteDatabase,
  memberId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: memberId });
  const { teamId, effectiveDate, ...data } = validate(
    UpdateMemberSchema,
    input,
  );
  const today = options.today ?? getServerTodayIsoDate();
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    const member = requireRecord(
      await tx.select().from(members).where(eq(members.id, id)),
      'Member',
    );
    if (data.locationId && data.locationId !== member.locationId)
      await requireActiveLocation(tx, data.locationId);
    if (teamId)
      await moveMember(tx, id, teamId, effectiveDate ?? today, today, actor);
    if (data.recordStatus === 'active' && member.recordStatus === 'archived') {
      const current = await currentMember(tx, id, today);
      requireActive(await getTeam(tx, current.teamId), 'Current Team');
    }
    await tx
      .update(members)
      .set({ ...data, updatedBy: actor })
      .where(eq(members.id, id));
    return currentMember(tx, id, today);
  });
}

export async function cancelPendingMemberMove(
  db: PgliteDatabase,
  memberId: string,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: memberId });
  const today = options.today ?? getServerTodayIsoDate();
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    const [pending, previous] = await recentAssignments(tx, id);
    if (!pending || pending.startDate <= today)
      throw new NotFoundError('No pending move was found for this Member.');
    if (!previous)
      throw new ConflictError('The preceding assignment is missing.');
    await cancelMove(tx, pending, previous, actor);
    return currentMember(tx, id, today);
  });
}

export async function deleteMember(db: PgliteDatabase, memberId: string) {
  const { id } = validate(IdPathSchema, { id: memberId });
  return writeOrganization(
    db,
    async (tx) => {
      if (
        await tx.$count(overheadDeductions, eq(overheadDeductions.memberId, id))
      )
        throw new ConflictError('This Member has overhead deductions.');
      if (await tx.$count(absences, eq(absences.memberId, id)))
        throw new ConflictError('This Member has Absence records.');
      await tx.delete(assignments).where(eq(assignments.memberId, id));
      return requireRecord(
        await tx.delete(members).where(eq(members.id, id)).returning(),
        'Member',
      );
    },
    'This Member has Absence records.',
  );
}
