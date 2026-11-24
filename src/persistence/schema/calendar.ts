import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { auditColumns } from './common';
import { members } from './organization';

export const locations = pgTable(
  'locations',
  {
    ...auditColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    countryCode: text('country_code').notNull(),
    subdivisionCode: text('subdivision_code'),
    timeZone: text('time_zone').notNull(),
    calendarSource: text('calendar_source').notNull(),
    lastRefreshedAt: timestamp('last_refreshed_at', {
      withTimezone: true,
      mode: 'date',
    }),
    seededYears: jsonb('seeded_years')
      .$type<number[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    librarySeedCutoffDate: text('library_seed_cutoff_date'),
    recordStatus: text('record_status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    check('locations_code_nonempty', sql`length(trim(${t.code})) > 0`),
    check('locations_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check('locations_country_code_valid', sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
    check(
      'locations_subdivision_code_valid',
      sql`${t.subdivisionCode} is null or ${t.subdivisionCode} ~ '^[A-Z0-9]{1,3}$'`,
    ),
    check(
      'locations_seed_cutoff_valid',
      sql`${t.librarySeedCutoffDate} is null or ${t.librarySeedCutoffDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check(
      'locations_record_status_valid',
      sql`${t.recordStatus} in ('active', 'archived')`,
    ),
    uniqueIndex('locations_code_ci_unique').on(sql`lower(trim(${t.code}))`),
  ],
);

export const holidays = pgTable(
  'holidays',
  {
    ...auditColumns(),
    locationId: text('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    date: text('date').notNull(),
    name: text('name').notNull(),
    portion: text('portion', { enum: ['full', 'half'] })
      .notNull()
      .default('full'),
    source: text('source', { enum: ['library', 'company', 'manual'] })
      .notNull()
      .default('library'),
    confirmed: boolean('confirmed').notNull().default(true),
  },
  (t) => [
    check(
      'holidays_date_valid',
      sql`${t.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check('holidays_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check('holidays_portion_valid', sql`${t.portion} in ('full', 'half')`),
    check(
      'holidays_source_valid',
      sql`${t.source} in ('library', 'company', 'manual')`,
    ),
    uniqueIndex('holidays_library_identity_unique')
      .on(t.locationId, t.date, t.name)
      .where(sql`${t.source} = 'library'`),
    index('holidays_location_date_idx').on(t.locationId, t.date),
  ],
);

export const absenceTypes = pgTable(
  'absence_types',
  {
    ...auditColumns(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    color: text('color').notNull(),
    affectsCapacity: boolean('affects_capacity').notNull(),
  },
  (t) => [
    check('absence_types_code_nonempty', sql`length(trim(${t.code})) > 0`),
    check('absence_types_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check('absence_types_color_valid', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    uniqueIndex('absence_types_code_ci_unique').on(sql`lower(trim(${t.code}))`),
  ],
);

export const absences = pgTable(
  'absences',
  {
    ...auditColumns(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    absenceTypeId: text('absence_type_id')
      .notNull()
      .references(() => absenceTypes.id, { onDelete: 'restrict' }),
    date: text('date').notNull(),
    portion: text('portion', { enum: ['full', 'am', 'pm'] })
      .notNull()
      .default('full'),
    planned: boolean('planned').notNull().default(true),
    status: text('status', { enum: ['active', 'cancelled'] })
      .notNull()
      .default('active'),
    extraHours: doublePrecision('extra_hours'),
    note: text('note'),
  },
  (t) => [
    check(
      'absences_date_valid',
      sql`${t.date} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
    ),
    check('absences_portion_valid', sql`${t.portion} in ('full', 'am', 'pm')`),
    check('absences_status_valid', sql`${t.status} in ('active', 'cancelled')`),
    check(
      'absences_extra_hours_valid',
      sql`${t.extraHours} is null or ${t.extraHours} >= 0`,
    ),
    index('absences_member_date_idx').on(t.memberId, t.date),
  ],
);
