import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import {
  CATEGORY_KINDS,
  CATEGORY_SEMANTIC_ROLES,
} from '../../domain/categories/rules';
import { auditColumns } from './common';
import { pis, teams, trains } from './organization';

export const categories = pgTable(
  'categories',
  {
    ...auditColumns(),
    trainId: text('train_id')
      .notNull()
      .references(() => trains.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    shortLabel: text('short_label').notNull(),
    color: text('color').notNull(),
    kind: text('kind', { enum: CATEGORY_KINDS }).notNull(),
    semanticRole: text('semantic_role', { enum: CATEGORY_SEMANTIC_ROLES }),
    defaultPct: integer('default_pct'),
    sortOrder: integer('sort_order').notNull().default(0),
    recordStatus: text('record_status', { enum: ['active', 'archived'] })
      .notNull()
      .default('active'),
  },
  (t) => [
    check('categories_name_nonempty', sql`length(trim(${t.name})) > 0`),
    check(
      'categories_short_label_nonempty',
      sql`length(trim(${t.shortLabel})) > 0`,
    ),
    check('categories_color_valid', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
    check(
      'categories_kind_valid',
      sql`${t.kind} in ('development', 'overhead')`,
    ),
    check(
      'categories_record_status_valid',
      sql`${t.recordStatus} in ('active', 'archived')`,
    ),
    check('categories_sort_order_valid', sql`${t.sortOrder} >= 0`),
    check(
      'categories_kind_fields_valid',
      sql`(
        ${t.kind} = 'development'
        and ${t.semanticRole} is not null
        and ${t.semanticRole} in ('feature', 'maintenance_bugs', 'standard')
        and ${t.defaultPct} is not null
        and ${t.defaultPct} between 0 and 100
      ) or (
        ${t.kind} = 'overhead'
        and ${t.semanticRole} is null
        and ${t.defaultPct} is null
      )`,
    ),
    uniqueIndex('categories_train_name_ci_unique').on(
      t.trainId,
      sql`lower(trim(${t.name}))`,
    ),
    uniqueIndex('categories_train_active_bugs_unique')
      .on(t.trainId)
      .where(
        sql`${t.recordStatus} = 'active' and ${t.semanticRole} = 'maintenance_bugs'`,
      ),
    index('categories_train_kind_sort_idx').on(t.trainId, t.kind, t.sortOrder),
  ],
);

export const teamCategoryAllocations = pgTable(
  'team_category_allocations',
  {
    ...auditColumns(),
    teamId: text('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'restrict' }),
    piId: text('pi_id')
      .notNull()
      .references(() => pis.id, { onDelete: 'restrict' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    overridePct: integer('override_pct').notNull(),
  },
  (t) => [
    check(
      'team_cat_alloc_override_pct_valid',
      sql`${t.overridePct} between 0 and 100`,
    ),
    uniqueIndex('team_cat_alloc_unique').on(t.teamId, t.piId, t.categoryId),
    index('team_cat_alloc_category_idx').on(t.categoryId),
  ],
);
