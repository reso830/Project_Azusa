import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { MEMBER_ROLES } from '../../domain/organization/roles';
import { locations } from './calendar';
import { auditColumns } from './common';

export const trains = pgTable(
  'trains',
  {
    ...auditColumns(),
    name: text('name').notNull(),
    recordStatus: text('record_status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    check('trains_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check(
      'trains_record_status_valid',
      sql`${t.recordStatus} in ('active', 'archived')`,
    ),
    uniqueIndex('trains_name_ci_unique').on(sql`lower(trim(${t.name}))`),
  ],
);

export const teams = pgTable(
  'teams',
  {
    ...auditColumns(),
    trainId: text('train_id')
      .notNull()
      .references(() => trains.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    hoursPerDay: doublePrecision('hours_per_day').notNull().default(8),
    sprintOffsetWorkdays: integer('sprint_offset_workdays')
      .$type<-1 | 0 | 1>()
      .notNull()
      .default(0),
    recordStatus: text('record_status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    check('teams_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check(
      'teams_record_status_valid',
      sql`${t.recordStatus} in ('active', 'archived')`,
    ),
    check(
      'teams_hours_per_day_valid',
      sql`${t.hoursPerDay} > 0 and ${t.hoursPerDay} <= 24`,
    ),
    check('teams_offset_valid', sql`${t.sprintOffsetWorkdays} in (-1, 0, 1)`),
    uniqueIndex('teams_train_name_ci_unique').on(
      t.trainId,
      sql`lower(trim(${t.name}))`,
    ),
    index('teams_train_id_idx').on(t.trainId),
  ],
);

export const members = pgTable(
  'members',
  {
    ...auditColumns(),
    locationId: text('location_id')
      .notNull()
      .references((): AnyPgColumn => locations.id, { onDelete: 'restrict' }),
    fullName: text('full_name').notNull(),
    nickname: text('nickname').notNull().default(''),
    initials: text('initials').notNull(),
    role: text('role', { enum: MEMBER_ROLES }).notNull(),
    fteFactor: doublePrecision('fte_factor').notNull().default(1),
    avatarColor: text('avatar_color').notNull().default('#2F62C8'),
    recordStatus: text('record_status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    check('members_full_name_nonempty', sql`length(trim(${t.fullName})) > 0`),
    check(
      'members_initials_valid',
      sql`length(trim(${t.initials})) between 1 and 4`,
    ),
    check(
      'members_role_valid',
      sql`${t.role} in ('Admin', 'RTE', 'SM', 'PO', 'Team member')`,
    ),
    check('members_fte_valid', sql`${t.fteFactor} > 0 and ${t.fteFactor} <= 1`),
    check(
      'members_avatar_color_valid',
      sql`${t.avatarColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
      'members_record_status_valid',
      sql`${t.recordStatus} in ('active', 'archived')`,
    ),
    index('members_location_id_idx').on(t.locationId),
  ],
);

export const memberTeamAssignments = pgTable(
  'member_team_assignments',
  {
    ...auditColumns(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    startDate: text('start_date').notNull(),
    endDate: text('end_date'),
  },
  (t) => [
    check(
      'member_team_assignments_start_date_valid',
      sql`${t.startDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check(
      'member_team_assignments_end_date_valid',
      sql`${t.endDate} is null or (${t.endDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and ${t.startDate} <= ${t.endDate})`,
    ),
    uniqueIndex('member_team_assignments_member_open_unique')
      .on(t.memberId)
      .where(sql`${t.endDate} is null`),
    index('member_team_assignments_member_idx').on(t.memberId, t.startDate),
    index('member_team_assignments_team_idx').on(t.teamId, t.startDate),
  ],
);

export const pis = pgTable(
  'pis',
  {
    ...auditColumns(),
    trainId: text('train_id')
      .notNull()
      .references(() => trains.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    lifecycleStatus: text('lifecycle_status', {
      enum: ['planning', 'in_progress', 'closed'],
    })
      .notNull()
      .default('planning'),
    recordStatus: text('record_status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    check('pis_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check(
      'pis_start_date_valid',
      sql`${t.startDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check(
      'pis_end_date_valid',
      sql`${t.endDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and ${t.startDate} <= ${t.endDate}`,
    ),
    check(
      'pis_lifecycle_status_valid',
      sql`${t.lifecycleStatus} in ('planning', 'in_progress', 'closed')`,
    ),
    check(
      'pis_record_status_valid',
      sql`${t.recordStatus} in ('active', 'archived')`,
    ),
    uniqueIndex('pis_train_name_ci_unique').on(
      t.trainId,
      sql`lower(trim(${t.name}))`,
    ),
    index('pis_train_id_dates_idx').on(t.trainId, t.startDate, t.endDate),
  ],
);

export const iterations = pgTable(
  'iterations',
  {
    ...auditColumns(),
    piId: text('pi_id')
      .notNull()
      .references(() => pis.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['development', 'ip'] })
      .notNull()
      .default('development'),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
  },
  (t) => [
    check('iterations_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check('iterations_kind_valid', sql`${t.kind} in ('development', 'ip')`),
    check(
      'iterations_start_date_valid',
      sql`${t.startDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check(
      'iterations_end_date_valid',
      sql`${t.endDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and ${t.startDate} <= ${t.endDate}`,
    ),
    uniqueIndex('iterations_pi_name_ci_unique').on(
      t.piId,
      sql`lower(trim(${t.name}))`,
    ),
    index('iterations_pi_id_dates_idx').on(t.piId, t.startDate, t.endDate),
  ],
);
