import { sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getDbContext,
  getCachedDbError,
  FoundationError,
} from '../../persistence/client';
import { getBackupSummary } from '../../persistence/backup';
import { appMetadata } from '../../persistence/schema';
import {
  AppMetadataEntrySchema,
  DiagnosticCheckRequestSchema,
  HealthResponseSchema,
} from '../../domain/health/schemas';
import { resolveActor } from '../../domain/audit/actor';
type Options = {
  dbDir?: string;
  backupDir?: string;
  migrationsFolder?: string;
  actor?: string;
  simulatedErrorStage?: 'init' | 'backup' | 'migration';
};
export async function getFoundationHealth(options: Options = {}) {
  let ctx: Awaited<ReturnType<typeof getDbContext>> | undefined;
  let rows: (typeof appMetadata.$inferSelect)[] = [];
  let pgVersion: string | null = null;
  let migrationCount = 0;
  let latestTag: string | null = null;
  let backupSummary: Awaited<ReturnType<typeof getBackupSummary>> = {
    lastBackupId: null,
    lastBackupAt: null,
    lastBackupTrigger: null,
    backupCount: 0,
  };
  let latestDiagnostic: {
    id: string;
    key: string;
    note: string;
    checkCount: number;
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    updatedBy: string;
  } | null = null;
  const errors: {
    stage: 'init' | 'backup' | 'migration' | 'query';
    message: string;
    recoveryHint: string;
  }[] = [];
  try {
    if (
      options.simulatedErrorStage &&
      process.env.AZUSA_ALLOW_TEST_FAULT_INJECTION === '1' &&
      process.env.NODE_ENV !== 'production'
    )
      throw new FoundationError(
        options.simulatedErrorStage,
        'Simulated failure',
        'Inspect docs/operations/database-and-recovery.md',
      );
    ctx = await getDbContext(options);
    backupSummary = await getBackupSummary(ctx.backupDir);
    rows = await ctx.db.select().from(appMetadata);
    pgVersion = (
      await readFile(path.join(ctx.dbDir, 'PG_VERSION'), 'utf8')
    ).trim();
    const applied = await ctx.client.query<{ created_at: string }>(
      'SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at',
    );
    migrationCount = applied.rows.length;
    const journal = JSON.parse(
      await readFile(
        path.join(ctx.migrationsFolder, 'meta', '_journal.json'),
        'utf8',
      ),
    ) as { entries: { when: number; tag: string }[] };
    const last = Number(applied.rows.at(-1)?.created_at);
    latestTag =
      journal.entries.find((entry) => entry.when === last)?.tag ?? null;
    const row = rows.find((r) => r.key === 'diagnostic.last_check');
    if (row) {
      const parsed = AppMetadataEntrySchema.parse({
        key: row.key,
        value: row.value,
      });
      if (parsed.key === 'diagnostic.last_check')
        latestDiagnostic = {
          id: row.id,
          key: row.key,
          note: parsed.value.note,
          checkCount: parsed.value.checkCount,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
          createdBy: row.createdBy,
          updatedBy: row.updatedBy,
        };
    }
  } catch (e) {
    const err =
      getCachedDbError() ??
      (e instanceof FoundationError
        ? e
        : new FoundationError(
            'query',
            e instanceof Error ? e.message : String(e),
            'Inspect local database and migration metadata.',
          ));
    errors.push({
      stage: err.stage,
      message: err.message,
      recoveryHint: err.recoveryHint,
    });
  }
  return HealthResponseSchema.parse({
    status: errors.length ? 'error' : 'healthy',
    checkedAt: new Date().toISOString(),
    actor: resolveActor(options.actor),
    database: {
      initialized: !!ctx,
      dbDir:
        ctx?.dbDir ??
        options.dbDir ??
        process.env.AZUSA_DB_DIR ??
        '.azusa/data/db',
      pgVersion,
      metadataCount: rows.length,
    },
    migrations: { applied: !!ctx, count: migrationCount, latestTag },
    backup: {
      backupDir:
        ctx?.backupDir ??
        options.backupDir ??
        process.env.AZUSA_BACKUP_DIR ??
        '.azusa/data/backups',
      ...backupSummary,
      lastBackupTrigger:
        backupSummary.lastBackupTrigger ?? ctx?.startupBackup.trigger ?? null,
      retentionLimit: 10,
    },
    latestDiagnostic,
    errors,
  });
}
export async function recordDiagnosticCheck(
  input: unknown,
  options: Options = {},
) {
  const request = DiagnosticCheckRequestSchema.parse(input);
  const health = await getFoundationHealth(options);
  if (health.status === 'error')
    return {
      ok: false as const,
      statusCode: 503,
      error: health.errors[0]!.message,
      stage: health.errors[0]!.stage,
      recoveryHint: health.errors[0]!.recoveryHint,
    };
  try {
    const ctx = await getDbContext(options);
    const value = {
      note: request.note,
      checkCount: 1,
      checkedAt: new Date().toISOString(),
    };
    AppMetadataEntrySchema.parse({ key: 'diagnostic.last_check', value });
    await ctx.db
      .insert(appMetadata)
      .values({
        key: 'diagnostic.last_check',
        value,
        createdBy: resolveActor(options.actor),
        updatedBy: resolveActor(options.actor),
      })
      .onConflictDoUpdate({
        target: appMetadata.key,
        set: {
          value: sql`jsonb_build_object('note', ${request.note}::text, 'checkCount', coalesce((${appMetadata.value}->>'checkCount')::integer, 0) + 1, 'checkedAt', ${value.checkedAt}::text)`,
          updatedAt: sql`now()`,
          updatedBy: resolveActor(options.actor),
        },
      });
    const fresh = await getFoundationHealth(options);
    if (fresh.status === 'error')
      return {
        ok: false as const,
        statusCode: 503,
        error: fresh.errors[0]!.message,
        stage: fresh.errors[0]!.stage,
        recoveryHint: fresh.errors[0]!.recoveryHint,
      };
    return { ok: true as const, record: fresh.latestDiagnostic, health: fresh };
  } catch (e) {
    const err =
      getCachedDbError() ?? (e instanceof FoundationError ? e : undefined);
    return {
      ok: false as const,
      statusCode: err ? 503 : 500,
      error: err?.message ?? (e instanceof Error ? e.message : String(e)),
      stage: err?.stage ?? 'query',
      recoveryHint: err?.recoveryHint ?? 'Inspect local database.',
    };
  }
}
