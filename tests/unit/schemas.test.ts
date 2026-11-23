import { it, expect } from 'vitest';
import {
  DiagnosticCheckRequestSchema,
  BackupManifestSchema,
  HealthErrorItemSchema,
  HealthResponseSchema,
  AppMetadataValueSchema,
  AppMetadataEntrySchema,
} from '../../src/domain/health/schemas';
it('validates diagnostic boundaries and unknown keys', () => {
  expect(DiagnosticCheckRequestSchema.parse({}).note).toBe(
    'Manual diagnostic check',
  );
  for (const note of ['', ' ', 'x'.repeat(281)])
    expect(DiagnosticCheckRequestSchema.safeParse({ note }).success).toBe(
      false,
    );
  expect(
    DiagnosticCheckRequestSchema.safeParse({ note: 'x'.repeat(280) }).success,
  ).toBe(true);
  expect(DiagnosticCheckRequestSchema.safeParse({ actor: 'x' }).success).toBe(
    false,
  );
});
it('validates metadata, manifests and health', () => {
  const t = '2026-11-20T07:30:00.000Z';
  expect(
    AppMetadataValueSchema.safeParse({
      schemaVersion: 'x',
      appVersion: '1',
      initializedAt: t,
    }).success,
  ).toBe(true);
  expect(
    AppMetadataValueSchema.safeParse({
      note: 'ok',
      checkCount: 1,
      checkedAt: t,
    }).success,
  ).toBe(true);
  expect(
    DiagnosticCheckRequestSchema.safeParse({ surprise: true }).success,
  ).toBe(false);
  const manifest = {
    backupId: 'b',
    trigger: 'startup',
    createdAt: t,
    sourceDbDir: 'db',
    fileCount: 1,
    totalBytes: 1,
    actor: 'local:sm',
    pgVersion: '16',
    files: [{ relativePath: 'x', sizeBytes: 1, sha256: 'a'.repeat(64) }],
  };
  expect(BackupManifestSchema.safeParse(manifest).success).toBe(true);
  expect(
    BackupManifestSchema.safeParse({ ...manifest, createdAt: 'bad' }).success,
  ).toBe(false);
  expect(
    HealthErrorItemSchema.safeParse({
      stage: 'oops',
      message: 'x',
      recoveryHint: 'x',
    }).success,
  ).toBe(false);
  const h = {
    status: 'healthy',
    checkedAt: t,
    actor: 'local:sm',
    database: {
      initialized: true,
      dbDir: 'db',
      pgVersion: '16',
      metadataCount: 1,
    },
    migrations: { applied: true, count: 1, latestTag: 'x' },
    backup: {
      backupDir: 'b',
      lastBackupId: null,
      lastBackupAt: null,
      lastBackupTrigger: 'skipped_cold_start',
      backupCount: 0,
      retentionLimit: 10,
    },
    latestDiagnostic: null,
    errors: [],
  };
  expect(HealthResponseSchema.safeParse(h).success).toBe(true);
  const diagnostic = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    key: 'diagnostic.last_check',
    note: 'ok',
    checkCount: 1,
    createdAt: t,
    updatedAt: t,
    createdBy: 'local:sm',
    updatedBy: 'local:sm',
  };
  expect(
    HealthResponseSchema.safeParse({ ...h, latestDiagnostic: diagnostic })
      .success,
  ).toBe(true);
  expect(
    HealthResponseSchema.safeParse({
      ...h,
      latestDiagnostic: { ...diagnostic, id: 'bad' },
    }).success,
  ).toBe(false);
  const error = { stage: 'init', message: 'failed', recoveryHint: 'restart' };
  expect(
    HealthResponseSchema.safeParse({ ...h, status: 'error', errors: [error] })
      .success,
  ).toBe(true);
  expect(
    HealthResponseSchema.safeParse({ ...h, status: 'error', errors: [] })
      .success,
  ).toBe(false);
  expect(
    HealthResponseSchema.safeParse({ ...h, status: 'healthy', errors: [error] })
      .success,
  ).toBe(false);
});

it('ties metadata values to their logical key', () => {
  const value = {
    schemaVersion: 'x',
    appVersion: '1',
    initializedAt: '2026-11-20T07:30:00.000Z',
  };
  expect(
    AppMetadataEntrySchema.safeParse({ key: 'foundation.init', value }).success,
  ).toBe(true);
  expect(
    AppMetadataEntrySchema.safeParse({ key: 'diagnostic.last_check', value })
      .success,
  ).toBe(false);
});
