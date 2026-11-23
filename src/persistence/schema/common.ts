import { text, timestamp } from 'drizzle-orm/pg-core';
export function auditColumns() {
  return {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    createdBy: text('created_by').notNull().default('local:sm'),
    updatedBy: text('updated_by').notNull().default('local:sm'),
  };
}
