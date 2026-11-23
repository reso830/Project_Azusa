import { z } from 'zod';
const timestamp = z.iso.datetime({ offset: true });
const uuid = z.uuid();
const count = z.number().int().nonnegative();
export const DiagnosticCheckRequestSchema = z
  .object({
    note: z
      .string()
      .trim()
      .min(1)
      .max(280)
      .optional()
      .default('Manual diagnostic check'),
  })
  .strict();
export const AppMetadataValueSchema = z.union([
  z.object({
    schemaVersion: z.string().min(1),
    appVersion: z.string().min(1),
    initializedAt: timestamp,
  }),
  z.object({
    note: z.string().min(1).max(280),
    checkCount: count,
    checkedAt: timestamp,
  }),
]);
export const BackupManifestSchema = z.object({
  backupId: z.string().min(1),
  trigger: z.enum(['startup', 'manual']),
  createdAt: timestamp,
  sourceDbDir: z.string().min(1),
  fileCount: count,
  totalBytes: count,
  actor: z.string().min(1),
  pgVersion: z.string().min(1),
  files: z.array(
    z.object({
      relativePath: z.string().min(1),
      sizeBytes: count,
      sha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
    }),
  ),
});
export const HealthErrorItemSchema = z.object({
  stage: z.enum(['init', 'backup', 'migration', 'query']),
  message: z.string().min(1),
  recoveryHint: z.string().min(1),
});
const diagnostic = z.object({
  id: uuid,
  key: z.string(),
  note: z.string(),
  checkCount: count,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
});
export const AppMetadataEntrySchema = z.discriminatedUnion('key', [
  z.object({
    key: z.literal('foundation.init'),
    value: AppMetadataValueSchema.options[0],
  }),
  z.object({
    key: z.literal('diagnostic.last_check'),
    value: AppMetadataValueSchema.options[1],
  }),
]);
export const HealthResponseSchema = z
  .object({
    status: z.enum(['healthy', 'error']),
    checkedAt: timestamp,
    actor: z.string().min(1),
    database: z.object({
      initialized: z.boolean(),
      dbDir: z.string(),
      pgVersion: z.string().nullable(),
      metadataCount: count,
    }),
    migrations: z.object({
      applied: z.boolean(),
      count,
      latestTag: z.string().nullable(),
    }),
    backup: z.object({
      backupDir: z.string(),
      lastBackupId: z.string().nullable(),
      lastBackupAt: timestamp.nullable(),
      lastBackupTrigger: z
        .enum(['startup', 'manual', 'skipped_cold_start', 'skipped_unverified'])
        .nullable(),
      backupCount: count,
      retentionLimit: z.literal(10),
    }),
    latestDiagnostic: diagnostic.nullable(),
    errors: z.array(HealthErrorItemSchema),
  })
  .superRefine((health, ctx) => {
    if ((health.status === 'healthy') !== (health.errors.length === 0))
      ctx.addIssue({
        code: 'custom',
        path: ['errors'],
        message: 'Status and errors must agree',
      });
  });
