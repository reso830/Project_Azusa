import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { auditColumns } from './common';
export const appMetadata = pgTable('app_metadata', {
  ...auditColumns(),
  key: text('key').notNull().unique(),
  value: jsonb('value').notNull(),
});
