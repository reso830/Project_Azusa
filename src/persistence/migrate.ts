import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { appMetadata } from './schema';
import { AppMetadataEntrySchema } from '../domain/health/schemas';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../domain/audit/actor';
export async function runMigrations({
  db,
  dbDir,
  migrationsFolder = path.resolve('src/persistence/migrations'),
  actor,
}: {
  db: PgliteDatabase;
  dbDir: string;
  migrationsFolder?: string;
  actor?: string;
}) {
  const marker = path.join(dbDir, '.azusa-last-healthy.json');
  await rm(marker, { force: true });
  await migrate(db, { migrationsFolder });
  const now = new Date().toISOString();
  const entry = AppMetadataEntrySchema.parse({
    key: 'foundation.init',
    value: {
      schemaVersion: '0000_foundation_init',
      appVersion: '0.1.0',
      initializedAt: now,
    },
  });
  const existing = await db
    .select()
    .from(appMetadata)
    .where(eq(appMetadata.key, entry.key));
  if (!existing.length)
    await db.insert(appMetadata).values({
      ...entry,
      createdBy: resolveActor(actor),
      updatedBy: resolveActor(actor),
    });
  await writeFile(
    marker,
    JSON.stringify({ verifiedAt: now, appVersion: '0.1.0' }),
  );
}
