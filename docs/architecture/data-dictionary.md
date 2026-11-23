# Physical data dictionary

F001 / application 0.1.0. This describes implemented persistence, not the future [conceptual domain model](domain-model.md). Only `app_metadata` is an application table; Drizzle separately manages migration bookkeeping. Paths below use the default configuration unless overridden. Source entry points are in the [repository map](../REPO_MAP.md).

## `app_metadata` and `auditColumns()`

`src/persistence/schema/app-metadata.ts` spreads `auditColumns()` from `schema/common.ts`. The migration stores identifiers as **text**, with UUIDv4 generation in the ORM, not a PostgreSQL UUID column/default. Restore validates UUIDv4 format.

| SQL field    | Drizzle property/type                        | Default and constraint                                             |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| `id`         | `id`, text                                   | Primary key, non-null; ORM `$defaultFn` uses `crypto.randomUUID()` |
| `created_at` | `createdAt`, timestamp with time zone / Date | Non-null, SQL `now()`                                              |
| `updated_at` | `updatedAt`, timestamp with time zone / Date | Non-null, SQL `now()`; ORM `$onUpdate` supplies Date on update     |
| `created_by` | `createdBy`, text                            | Non-null, SQL default `local:sm`                                   |
| `updated_by` | `updatedBy`, text                            | Non-null, SQL default `local:sm`                                   |
| `key`        | `key`, text                                  | Non-null, unique (`app_metadata_key_unique`)                       |
| `value`      | `value`, JSONB                               | Non-null; application validates against the schema for its key     |

Timestamps represent UTC instants and serialize as ISO strings (`Z`) in generated API responses. `$onUpdate` is an ORM hook, not a SQL trigger; raw SQL must maintain audit fields. Diagnostic conflict updates explicitly use SQL `now()` and the resolved actor. Actor precedence is trimmed explicit internal value, then `AZUSA_ACTOR_ID`, then `local:sm`; HTTP bodies cannot set actor. Creation identity/timestamps survive updates.

| Key                     | `value` payload                                                                                                           | Write semantics                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `foundation.init`       | `schemaVersion` nonempty string (`0000_foundation_init` seed label), `appVersion` (`0.1.0`), `initializedAt` ISO datetime | Insert only if absent after migration. Existing ID and timestamps remain intact. This initial record is not the authoritative count/latest applied migration.                        |
| `diagnostic.last_check` | `note` nonempty string up to 280 characters, `checkCount` nonnegative integer, `checkedAt` ISO datetime                   | Strict request trims note, defaults to `Manual diagnostic check`; blank/unknown fields rejected. First count 1; SQL-side increment on subsequent writes preserves ID/creation audit. |

`AppMetadataEntrySchema` ties key to payload. `app_metadata` can contain only foundation metadata in a fresh cluster; the diagnostic row appears after a manual check. Health is a derived response, not an extra persisted table.

## Migration structures

- `src/persistence/migrations/0000_foundation_init.sql`: initial table and constraints.
- `meta/_journal.json`: Drizzle migration tags and `when` timestamps; keep ordering metadata intact.
- `meta/0000_snapshot.json`: generation baseline, required for future schema diffs.
- `drizzle.__drizzle_migrations`: Drizzle-managed application history. Health reads applied rows/count and maps the latest `created_at` timestamp to the journal tag. Do not infer current migration state from the initial foundation record.

Schema changes require reviewed generated SQL and metadata, plus fresh/upgrade tests. No ART, Team, Story, Bug, capacity, commitment, or reporting tables exist in F001.

## Database-adjacent files

| Structure                                     | Fields, units, and purpose                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<parent(dir)>/<basename(dir)>.azusa-lock`    | Sentinel derived from the canonical database path (shared across symlinks/junctions, including missing database leaves) and passed to `proper-lockfile`; not an authoritative application record.                                                                                                                                   |
| `<sentinel>.lock/`                            | Empty library-managed lock directory, heartbeat via filesystem modification time. Stale threshold 10000 ms, heartbeat 2000 ms, grace wait 2100 ms. Never put metadata inside it.                                          |
| `<dir>.azusa-owner.json`                      | Optional non-authoritative `pid` (process number), `processType` (`server`, `cli:migrate`, `cli:backup`, `cli:restore`), `acquiredAt` ISO instant. Best-effort write/removal; may remain stale after a crash.             |
| `<dbDir>/PG_VERSION`                          | PGlite/PostgreSQL cluster version text; existing values must contain a numeric version.                                                                                                                                   |
| `<dbDir>/.azusa-last-healthy.json`            | `verifiedAt` ISO instant and `appVersion`; written after successful migration/seed and during verified restore. Removed before migration; absence suppresses startup snapshot/pruning for an existing unverified cluster. |
| `<parent(dbDir)>/.azusa-promote-journal.json` | `activeDbDir`, `replacedDir`, `stagingDir` absolute paths; `startedAt` ISO instant. Describes recoverable active replacement; recovery validates paths and clusters before choosing the valid active/predecessor.         |
| `.restore-tmp-<uuid>/`                        | Staged restore beside target; verified before promotion, cleaned on handled failure.                                                                                                                                      |
| `db-replaced-<timestamp>-<uuid>/`             | Preserved predecessor after successful active replacement; no automatic retention.                                                                                                                                        |

## Backup manifest and directories

Backups live under `AZUSA_BACKUP_DIR` (default `.azusa/data/backups`). IDs start `backup-<UTC timestamp>`, optionally include a collision suffix, and end `-startup` or `-manual`. An incomplete copy uses `.tmp-<backupId>`; a completed directory contains the cluster and `manifest.json`. Incomplete/invalid entries do not appear as completed backup summaries.

| Manifest field | Type/unit                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `backupId`     | Nonempty string matching directory ID                                                                             |
| `trigger`      | `startup` or `manual`                                                                                             |
| `createdAt`    | ISO datetime instant                                                                                              |
| `sourceDbDir`  | Nonempty canonical absolute source path                                                                           |
| `actor`        | Nonempty resolved audit actor                                                                                     |
| `pgVersion`    | Cluster version string, checked against copied `PG_VERSION` during restore                                        |
| `fileCount`    | Nonnegative integer; cluster files excluding `manifest.json`                                                      |
| `totalBytes`   | Nonnegative byte count, sum of file sizes                                                                         |
| `files[]`      | Per-file `relativePath` (forward-slash normalized), `sizeBytes` (nonnegative bytes), `sha256` (64 hex characters) |

Startup retention keeps ten newest completed **startup** snapshots; manual backups are separate. Health `backupCount` counts startup snapshots, while latest ID/time/trigger may identify a manual backup. With no completed backup, the trigger may report `skipped_cold_start` or `skipped_unverified`. Operational steps and cleanup policy are in the [runbook](../operations/database-and-recovery.md).
