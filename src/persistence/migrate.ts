import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq, sql } from 'drizzle-orm';
import { writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { appMetadata } from './schema';
import { AppMetadataEntrySchema } from '../domain/health/schemas';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../domain/audit/actor';
import { seedReferenceData } from './seed';
import { APP_VERSION } from './version';
export async function runMigrations({
  db,
  dbDir,
  migrationsFolder = path.resolve('src/persistence/migrations'),
  actor,
  today,
}: {
  db: PgliteDatabase;
  dbDir: string;
  migrationsFolder?: string;
  actor?: string;
  today?: string;
}) {
  const marker = path.join(dbDir, '.azusa-last-healthy.json');
  await rm(marker, { force: true });
  await migrate(db, { migrationsFolder });
  const now = new Date().toISOString();
  const entry = AppMetadataEntrySchema.parse({
    key: 'foundation.init',
    value: {
      schemaVersion: '0000_foundation_init',
      appVersion: APP_VERSION,
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
  // A caller can supply a migration folder containing only the F001 baseline.
  const { rows } = await db.execute<{ hasLocations: boolean }>(sql`
    select to_regclass('public.locations') is not null as "hasLocations"
  `);
  if (rows[0]?.hasLocations) await seedReferenceData(db, { actor, today });
  await writeFile(
    marker,
    JSON.stringify({
      verifiedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
    }),
  );
}
