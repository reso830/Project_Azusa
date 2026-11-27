import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  index,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { categories } from './categories';
import { auditColumns } from './common';
import { iterations, members, pis, teams } from './organization';

export const overheadDeductions = pgTable(
  'overhead_deductions',
  {
    ...auditColumns(),
    memberId: text('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    iterationId: text('iteration_id')
      .notNull()
      .references(() => iterations.id, { onDelete: 'restrict' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    deductedHours: doublePrecision('deducted_hours').notNull(),
    source: text('source', { enum: ['pi_plan', 'sprint_adjusted'] })
      .notNull()
      .default('pi_plan'),
  },
  (t) => [
    check(
      'overhead_deductions_hours_valid',
      sql`${t.deductedHours} >= 0 and ${t.deductedHours} <= 744 and (${t.deductedHours} * 4) = floor(${t.deductedHours} * 4)`,
    ),
    check(
      'overhead_deductions_source_valid',
      sql`${t.source} in ('pi_plan', 'sprint_adjusted')`,
    ),
    uniqueIndex('overhead_deductions_member_team_iter_cat_unique').on(
      t.memberId,
      t.teamId,
      t.iterationId,
      t.categoryId,
    ),
    index('overhead_deductions_team_iter_idx').on(t.teamId, t.iterationId),
    index('overhead_deductions_iteration_idx').on(t.iterationId),
    index('overhead_deductions_category_idx').on(t.categoryId),
  ],
);

export const teamPiVelocityOverrides = pgTable(
  'team_pi_velocity_overrides',
  {
    ...auditColumns(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    piId: text('pi_id')
      .notNull()
      .references(() => pis.id, { onDelete: 'restrict' }),
    velocity: doublePrecision('velocity').notNull(),
  },
  (t) => [
    check(
      'team_pi_velocity_override_velocity_valid',
      sql`${t.velocity} >= 0 and ${t.velocity} <= 1000`,
    ),
    uniqueIndex('team_pi_velocity_override_unique').on(t.teamId, t.piId),
    index('team_pi_velocity_override_pi_idx').on(t.piId),
  ],
);
