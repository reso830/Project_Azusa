# Phase 1 Data Model: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-08  
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

This document defines:
1. **Part 1 — Implemented Physical Persistence Schema & Recovery Rules in F001**: The minimal infrastructure-owned database schema, reusable audit column conventions, backup manifest structure, runtime health read model, and race-safe lock/backup/restore invariants implemented in F001.
2. **Part 2 — Conceptual Domain Model Blueprint (`docs/architecture/domain-model.md`)**: The authoritative conceptual entities, ownership rules, and commitment/versioning lifecycle invariants from `docs/azusa-data-model.md` (v0.4), `docs/feature-roadmap.md` (`M0`–`M5`, `F001`–`F021`), and Constitution Principle III that F001 documents in `docs/architecture/domain-model.md` (without creating premature domain tables).

---

## Part 1 — Implemented Physical Persistence Schema & Recovery Rules (F001)

### 1.1 Reusable Identity & Audit Convention (`src/persistence/schema/common.ts`)

Every table in Azusa (starting with `app_metadata` in F001 and extending to domain tables in `F002`+) uses a standardized identity and audit column set (`auditColumns()`):

| Column | SQL Type (PGlite / Postgres) | Drizzle Definition | Constraints & Defaults | Description |
|---|---|---|---|---|
| `id` | `text` | `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` | `NOT NULL`, Primary Key | RFC 9562 / RFC 4122 UUIDv4 string generated automatically via `crypto.randomUUID()` when omitted |
| `created_at` | `timestamp with time zone` | `timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()` | `NOT NULL`, `DEFAULT now()` | UTC creation timestamp |
| `updated_at` | `timestamp with time zone` | `timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date())` | `NOT NULL`, `DEFAULT now()`, auto-updated on Drizzle `.update()` / `.onConflictDoUpdate()` | UTC last-modified timestamp |
| `created_by` | `text` | `text('created_by').notNull().default('local:sm')` | `NOT NULL`, `DEFAULT 'local:sm'` | Actor identifier at creation (`"local:sm"` until RBAC/Auth) |
| `updated_by` | `text` | `text('updated_by').notNull().default('local:sm')` | `NOT NULL`, `DEFAULT 'local:sm'` | Actor identifier at last update (`"local:sm"` until RBAC/Auth) |

**Validation & Invariants**:
- `id` MUST be a valid UUID string (`z.string().uuid()`).
- `created_at` and `updated_at` MUST be stored in UTC (`timestamptz`), with `updated_at >= created_at` and `updated_at` refreshed on every write.
- `created_by` and `updated_by` MUST be non-empty strings; pre-authentication writes default to `"local:sm"` via `resolveActor()`. Actor overrides are internal-only and never accepted from public HTTP request payloads.

---

### 1.2 Infrastructure Table: `app_metadata` (`src/persistence/schema/app-metadata.ts`)

F001 introduces a single infrastructure-owned table `app_metadata` to verify PGlite durability across restarts (`AC04`), test incremental Drizzle migrations (`AC05`), verify backup/restore integrity (`AC06`), and power the foundation status card (`FR-010`, `FR-014`).

| Column | SQL Type | Nullable | Default | Description |
|---|---|---|---|---|
| `id` | `text` | `NOT NULL` | `crypto.randomUUID()` | UUIDv4 primary key |
| `key` | `text` | `NOT NULL` | — | Unique logical key (`'foundation.init'`, `'diagnostic.last_check'`) |
| `value` | `jsonb` | `NOT NULL` | — | Structured JSON payload validated by Zod (`AppMetadataValueSchema`) |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | UTC timestamp when the record was first inserted |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` / `$onUpdate` | UTC timestamp when the record was last updated |
| `created_by` | `text` | `NOT NULL` | `'local:sm'` | Actor ID who created the record |
| `updated_by` | `text` | `NOT NULL` | `'local:sm'` | Actor ID who last updated the record |

**Indexes & Constraints**:
- `app_metadata_pkey`: Primary key on `(id)`.
- `app_metadata_key_unique`: Unique index on `(key)`.

**Standard Keys Used in F001**:
1. `'foundation.init'`: Seeded automatically on first database initialization if absent.
   - `value`: `{ schemaVersion: "001-application-foundations", initializedAt: "<ISO-8601 UTC>", note: "Azusa local foundation initialized" }`
2. `'diagnostic.last_check'`: Created or updated when the operator clicks **"Record diagnostic check"** on the foundation status card or invokes `POST /api/health/check`.
   - `value`: `{ note: string, checkCount: number, checkedAt: "<ISO-8601 UTC>" }`

---

### 1.3 Backup Snapshot Manifest (`.azusa/data/backups/<backup-id>/manifest.json`)

Each automatic startup backup (`backup-<YYYYMMDD-HHmmss-fff>-startup`) and manual CLI backup (`backup-<YYYYMMDD-HHmmss-fff>-manual`) writes a validated `manifest.json` as the final step in `.tmp-<backup-id>` before atomically renaming the directory to `<backup-id>`. If a folder for the same millisecond already exists, a zero-padded sequence counter is inserted before the trigger suffix (`backup-<YYYYMMDD-HHmmss-fff>-01-startup`, `backup-<YYYYMMDD-HHmmss-fff>-02-startup`) so all startup backups end with `-startup` and all manual backups end with `-manual`:

```json
{
  "backupId": "backup-20261108-193000-000-startup",
  "trigger": "startup",
  "createdAt": "2026-11-08T11:30:00.000Z",
  "createdBy": "local:sm",
  "sourceDbDir": ".azusa/data/db",
  "filesCopied": 14
}
```

**Retention, Completeness & Deferred Pruning Rules (`M1`)**:
- Only completed backup folders containing both `PG_VERSION` and a valid `manifest.json` (`BackupManifestSchema`) are eligible for `--from latest` or counted toward the 10-snapshot retention limit.
- Incomplete `.tmp-*` directories left behind by an interrupted backup are ignored and removed during backup housekeeping.
- **Deferred Post-Migration Pruning (`M1`)**: Startup backup pruning (`pruneCompletedStartupBackups(backupDir, 10)`) is executed **only after** PGlite mounts, all pending migrations succeed, and `.azusa-last-healthy.json` is written. If startup or migration fails, zero existing backups are pruned.
- Manual CLI backups (`trigger === "manual"`) are never automatically pruned by startup retention.

---

### 1.4 Runtime Foundation Health Read Model (`FoundationHealthStatus`)

Returned by the application health service (`src/application/health/health-service.ts`) and `GET /api/health`:

| Field | Type | Description |
|---|---|---|
| `status` | `'healthy' \| 'error'` | Overall foundation operational state (`'healthy'` when `errors.length === 0`, `'error'` otherwise) |
| `checkedAt` | `string` (ISO UTC) | Timestamp of health evaluation |
| `actor` | `string` | Active local actor identifier (default `'local:sm'`) |
| `database` | `{ initialized: boolean; dbDir: string; recordCount: number; foundationRecordId: string \| null; foundationInitializedAt: string \| null }` | PGlite connection and `foundation.init` record state |
| `migrations` | `{ applied: boolean; appliedCount: number; error: string \| null }` | Drizzle migration state |
| `backup` | `{ lastBackupId: string \| null; lastBackupAt: string \| null; lastBackupTrigger: 'startup' \| 'manual' \| 'skipped_cold_start' \| null; backupCount: number; retentionLimit: number; error: string \| null }` | Startup/manual backup state |
| `latestDiagnostic` | `{ id: string; key: string; note: string; checkCount: number; createdAt: string; updatedAt: string; createdBy: string; updatedBy: string } \| null` | Most recent `'diagnostic.last_check'` record from `app_metadata` |
| `errors` | `Array<{ stage: 'init' \| 'backup' \| 'migration' \| 'query'; message: string; recoveryHint: string }>` | Non-empty when `status === 'error'`, rendered in the shell `role="alert"` banner |

**Once-Per-Process Startup Failure State Machine (`M1`)**:
- `ensureDatabaseInitialized()` runs **at most once per process** (`globalThis.__azusaDbState` caches the resulting state—whether `'healthy'` or `'error'`—for the process lifetime, and `startupBackupTaken` ensures at most one startup backup per process).
- If the pre-migration startup backup fails when an existing cluster (`PG_VERSION`) is present: initialization halts **before** opening PGlite or running migrations (`database.initialized = false`, `migrations.applied = false`, `status = 'error'`, `errors = [{ stage: 'backup', ... }]`).
- If mounting PGlite (`stage: 'init'`) or applying migrations (`stage: 'migration'`) fails: `.azusa-last-healthy.json` is left absent (so even across repeated process restarts, an unverified/corrupt cluster is never snapshotted over good backups), retention pruning is skipped, PGlite is closed, the lock is released, and `status = 'error'` is cached on `globalThis.__azusaDbState`.
- When `status === 'error'`, `GET /api/health` and `POST /api/health/check` both return HTTP `503 Service Unavailable`, and `AppShell` renders `<ErrorAlertBanner role="alert" />`.

---

### 1.5 Race-Safe Cross-Process Lock, Pre-Migration Backup & Recoverable Restore Invariants (`CHK010`, `CHK013`)

1. **Race-Safe Cross-Process Ownership (`proper-lockfile` — `M2`, `L1`, `L2`, `L3`)**:
   - The server (`ensureDatabaseInitialized`) and CLI commands accessing the active database (`db:migrate`, `db:backup`, and `db:restore` when `--force-overwrite-active` targets `activeDbDir`) MUST acquire an exclusive lock via `proper-lockfile` (`retries: 0, stale: 10000, update: 2000, realpath: false`) targeting a per-directory canonical sentinel file: `path.resolve(path.dirname(dir), `${path.basename(dir)}.azusa-lock`)`.
   - **Empty Lock Directory Invariant (`L1`)**: Keep the library-owned `<sentinel>.lock` directory strictly empty! `proper-lockfile` uses non-recursive `rmdir`/`rmdirSync` for normal unlock, stale-lock takeover, and exit cleanup; writing `owner.json` inside it causes `ENOTEMPTY` errors and permanently locks the database. Optional diagnostic metadata (such as `{ pid, processType, acquiredAt }`) may be written outside the lock directory to `<dir>.azusa-owner.json`, and must never decide ownership.
   - **Graceful Lost-Lock Handling (`onCompromised` — `L2`, `F3`)**: Pass a custom `onCompromised: (err) => { ... }` handler to `proper-lockfile.lock()`. For the server, the callback closes PGlite, records error state on `globalThis.__azusaDbState`, and returns 503 instead of throwing an unhandled exception that crashes Next.js (`L2`). For CLI commands (`db:migrate`, `db:backup`, `db:restore`), the handler aborts execution, cleans up temporary staging folders (`.tmp-*`, `.restore-tmp-*`), rolls back any active promotion underway (`db-replaced-<timestamp>` back to `activeDbDir`), prints error details to stderr, and exits with code 1 (`F3`).
   - **Post-Acquisition Heartbeat Grace Verification (`F3`, `G1`)**: To reliably detect stale-lock takeover races where another contender attempts reclamation, every lock holder (the Next.js server process and all CLI commands: `db:migrate`, `db:backup`, `db:restore`) MUST wait just over one heartbeat interval (> 2000ms, e.g. 2100ms) after lock acquisition to confirm that heartbeat updates succeed and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying the database folder (`G1`). If `onCompromised` fires during this wait, the process aborts immediately before accessing any database files.
   - **Per-Target Sibling Decoupling (`L3`)**: Non-active `db:restore` (targeting a disjoint staging directory `targetDir`) acquires a lock on `targetDir`'s own sentinel (`<parent(targetDir)>/<basename(targetDir)>.azusa-lock`), remaining completely disjoint from `activeDbDir`'s lock even when `targetDir` and `activeDbDir` share the same parent directory (`.azusa/data/` or `.azusa/test-playwright/`).
   - If the lock is held by a live process or if the lock artifact is malformed/unreadable, `acquireDbLock` MUST fail closed (`ELOCKED`) immediately without reading, copying, or modifying `<dbDir>`. Under concurrent stale-lock reclamation (minimum stale threshold >= 2000ms), contenders fail closed (`ELOCKED`).
2. **Pre-Migration Automatic Startup Backup & Deferred Pruning (`M1`)**:
   - Before checking for `PG_VERSION`, startup inspects `<parent(dbDir)>/.azusa-promote-journal.json` to recover any interrupted active-restore promotion (`M3`).
   - When `PG_VERSION` is absent in `AZUSA_DB_DIR` (cold start), startup skips the backup step cleanly (`lastBackupTrigger: 'skipped_cold_start'`).
   - When `PG_VERSION` is present and `.azusa-last-healthy.json` is present, startup copies `AZUSA_DB_DIR` (before instantiating `PGlite`) into `<AZUSA_BACKUP_DIR>/.tmp-<backupId>`, writes `manifest.json`, and renames it to `<backupId>`.
   - Only **after** `PGlite` mounts, all migrations succeed, and `.azusa-last-healthy.json` is written does startup prune completed `-startup` folders beyond 10.
3. **Safe CLI Restore Path, Staged Verification & Recoverable Active Promotion (`C2`, `M3`)**:
   - All paths (`sourceBackupDir`, `activeDbDir`, `backupRootDir`, `targetDir`) are canonicalized (`path.resolve` + `realpathSync.native` on existing ancestors, trailing separators stripped, lowercased on Windows).
   - **Disjoint Path Requirement**:
     - `targetDir` MUST NOT overlap (equal, contain, or be inside) `sourceBackupDir` or `backupRootDir` under any circumstances.
     - `targetDir` MUST NOT strictly contain or sit inside `activeDbDir` under any circumstances.
     - If `targetDir === activeDbDir` and `forceOverwriteActive` is `false`, `restoreBackup` MUST refuse before touching any files.
     - If `targetDir === activeDbDir` and `forceOverwriteActive` is `true`, the server MUST be stopped (exclusive lock on `<parent(activeDbDir)>/<basename(activeDbDir)>.azusa-lock` held by `db:restore`).
   - **Populated Target Protection**:
     - If `targetDir !== activeDbDir` and `targetDir` already exists with any files or subdirectories, `restoreBackup` MUST refuse rather than merging or deleting existing files.
   - **Staged Pre-Swap Integrity Verification**:
     - `restoreBackup` validates that `sourceBackupDir` contains `PG_VERSION` and a valid `manifest.json`.
     - It copies the cluster files (excluding `manifest.json`) to `<parent(targetDir)>/.restore-tmp-<uuid>`, opens `PGlite` on `.restore-tmp-<uuid>`, queries all records in `app_metadata`, validates `'foundation.init'` and every column (`id`, `key`, `value`, `created_at`, `updated_at`, `created_by`, `updated_by`) via Zod, writes `.azusa-last-healthy.json`, and closes `PGlite`.
     - If verification fails or throws, `.restore-tmp-<uuid>` is deleted and `targetDir`, `activeDbDir`, and `sourceBackupDir` remain byte-for-byte untouched (`SC-004`).
   - **Final Placement / Recoverable Active Replacement (`M3`)**:
     - When `targetDir !== activeDbDir`: atomically rename `.restore-tmp-<uuid>` to `targetDir`.
     - When `targetDir === activeDbDir` (`forceOverwriteActive: true`, lock held):
       1. Write `<parent(activeDbDir)>/.azusa-promote-journal.json` recording `{ replacedDir: '<parent(activeDbDir)>/db-replaced-<timestamp>', stagingDir: '.restore-tmp-<uuid>', activeDbDir }`.
       2. Rename existing `activeDbDir` to `<parent(activeDbDir)>/db-replaced-<timestamp>`.
       3. Rename verified `.restore-tmp-<uuid>` to `activeDbDir`.
       4. Open `PGlite` on `activeDbDir`, confirm `SELECT count(*) FROM app_metadata` succeeds, and close `PGlite`.
       5. Preserve `db-replaced-<timestamp>` intact on disk for safety/inspection (documenting operator retention/cleanup), and delete `.azusa-promote-journal.json` (`L4`).
       - **Rollback on Failure**: If Step 3 or Step 4 fails, remove any partial `activeDbDir`, rename `db-replaced-<timestamp>` back to `activeDbDir`, remove `.azusa-promote-journal.json`, and throw an error—preserving the previous active database intact.
       - **Interrupted Promotion Recovery on Startup**: If a process was terminated mid-promotion (leaving `.azusa-promote-journal.json` on disk), the next startup or CLI lock holder inspects the journal: if `activeDbDir` is missing `PG_VERSION` (or fails verification) and `db-replaced-<timestamp>` contains `PG_VERSION`, it rolls back `db-replaced-<timestamp>` to `activeDbDir` and removes the journal; if `activeDbDir` already contains the verified cluster, it cleans up the leftover journal while preserving `db-replaced-<timestamp>`.

---

## Part 2 — Conceptual Domain Model Blueprint (`docs/architecture/domain-model.md`)

Per Feature Brief §2.4, §4, `docs/feature-roadmap.md` (`M0`–`M5`, `F001`–`F021`), and Constitution Principle III & VI, F001 documents the complete conceptual domain model in `docs/architecture/domain-model.md` (derived from `docs/azusa-data-model.md` v0.4 and `AZUSA_HANDOFF.md` §§7–12, 20) while deferring physical table creation to `F002`–`F021`:

### 2.1 Organization, Calendar & People (Target: `M0` — `F002`, `F003`)

- **`Train` (ART — `F002`)**: Owns default work categories and PI/Iteration cadence.
- **`Team` (`F002`)**: Belongs to one `Train`; defines `hours_per_day` (default `8`), `deduction_mode` (`percent` | `fixed_days`), and `sprint_offset_workdays` (`-1`, `0`, or `+1` working day relative to ART cadence).
- **`PI` & `Iteration` (Sprint — `F002`)**: Explicit Admin/RTE-configured start/end dates and names (`YYWW` ending ISO week is an optional convention, never derived from the name). Final `ip` iteration is planned like any other Sprint.
- **`Location`, `Holiday` (`F002`) & `Member`, `AbsenceType`, `Absence` (`F003`)**: Holidays belong to `Location` (seeded via `date-holidays` with company/manual overrides and `confirmed` flag); `Location` stores its canonical IANA timezone ID (formatted in UI clocks using the fixed-offset lookup table `PHT`/`IST`/`JST`/`SGT`/`UTC` or `UTC±offset` via `shortOffset` with `GMT` replaced by `UTC`, never `GMT`; invalid/missing timezone IDs fall back to computing both clock time and timezone label in 'UTC', `L5`); `Member` belongs to one `Team` and one `Location` (`role`, `fte_factor` default `1.0`). Invariant: Members with role `PO` or `SM` never contribute to development capacity; member working days deduct location holidays and active capacity-affecting absences (`full` = 1.0, `am`/`pm` = 0.5).

### 2.2 Work Categories, Overhead & Capacity Planning (Target: `M0` `F004`, `M1` `F006`–`F007`)

- **`Category` (`F004`)**: Per-Train configurable category with `kind` (`development` | `overhead`). Development categories (including `Bugs`) share post-overhead capacity and must sum to `100%`.
- **`TeamCategoryAllocation` (`F004`)**: Per-Team, per-PI override of development category `%`; unset inherits the Train default (never `0%`).
- **`Deduction`, `CeremonyTemplate`, `UnplannedDeduction` (`F004`, `F006`)**: Non-story overhead time deductions (`General Work`, `Training`, `Retrospectives`). Invariant: Overhead entries have **no `Project`**, **no Story Points**, and **never count toward velocity**.
- **Canonical Duration Unit (`F006`, `F007`)**: Capacity durations are tracked in integer minutes (or exact precision) and displayed in **days** at PI level and **hours** at Sprint Planning; Story Points are never converted directly to hours (bridged solely via 4-Sprint rolling `normalized_velocity = Σ completed dev SP ÷ Σ actual dev days`).

### 2.3 Work Hierarchy, Ownership & Dependencies (Target: `M1` `F005`, `M2` `F008`–`F009`, `M3` `F012`, `M4` `F014`–`F016`)

- **`Project` (`F005`)**: Long-lived container across PIs; participating Teams are derived from ownership of child `Feature`, `Story`, and `Bug` records.
- **`Feature` (`F005`)**: Required `Project`, **exactly one owning `Team`**, and **one `PI`**. Span is derived from child Stories' Sprint slices.
- **`Story` (`F005`)**: Required `Project` and owning `Team`; optional `Feature` (must match the Story's `Team` and `Project`); development `Category`; `designation` (`committed` | `stretch` | `unplanned`).
- **`Bug` (`F005`)**: Distinct work-item type (not a `Story`) with required `Project` and `Team`, restricted exclusively to the `Bugs` work category and its own workflow states.
- **`StorySlice` (`F005`, `F007`, `F008`)**: Links a `Story` to an `Iteration` within the **same `PI`** with planned `points` and confirmed `actual_points`. Committed Story = 1 slice; Stretch Story = multiple slices within one PI (`Σ slice points = Story points`). Invariant: **No Feature, Story, or StorySlice may cross a PI boundary.**
- **`Task` (`F005`, `F015`, `F016`)**: Sprint-level hour-estimated breakdown under a `Story` or `Bug`; never placed on PI boards.
- **`Dependency` & `ExternalDependency` (`F009`, `F012`)**: Directed `from_story` (predecessor/provider) → `to_story` (successor/consumer) across any Feature/Project/Team; Stretch dependency applies to the whole Story. Outside-ART prerequisites use `ExternalDependency` without fabricating internal Stories. Order violations produce advisory warnings, not hard blocks.
- **`BoardPlacement` (`F008`, `F012`)**: View-scoped (`board_instance` + `item` → `x`, `y`) freehand layout coordinates. Never determines scheduling, capacity, or commitments.

### 2.4 Plan Versions vs. Commitments vs. Actuals & Lifecycle Dates (Constitution Principle III — Target: `M2` `F010`–`F011`, `M3` `F013`, `M4` `F014`–`F017`, `M5` `F018`–`F021`)

`docs/architecture/domain-model.md` codifies the strict separation of these five concepts:

| Domain Concept | Roadmap Feature | Triggering Event & Actor | Mutability & Semantics |
|---|---|---|---|
| **`PlanVersion` (`v1`, `v2`, `v3`…)** | `F010` | Explicitly saved by user | Immutable complete snapshot of the current PI planning state (including unchanged prior-version items + revisions). **Not a commitment.** |
| **`PICommitment`** | `F013` | **Start PI** (Admin/RTE) | Immutable official PI commitment capturing each participating Team's then-current PI Plan. Never called *"Baseline the PI"*. |
| **`SprintCommitment`** | `F015` | **Start Sprint** (SM) | Immutable official Sprint commitment capturing the **current reviewed Team Sprint Plan** at confirmation time (including when backdated). |
| **`SprintClosure / Actuals`** | `F017` | **Close Sprint** (SM) + ongoing execution | Finalized actual Story/slice points and actual capacity on Sprint close, paired with continuous execution records. |
| **`StateChange`** | `F014` | Every workflow state transition | Immutable `(item, from_state, to_state, at, by)` audit trail feeding cycle time, throughput, and flow efficiency (`F018`–`F021`). |

**Three Distinct Sprint Lifecycle Date Fields (`F002`, `F015`, `F017`)**:
1. `scheduled_start` / `scheduled_end` (from ART iteration cadence ± Team's allowed 1-working-day offset).
2. `effective_start_date` / `effective_close_date` (selected by the SM in the Start/Close Sprint date picker to support retroactive or early clerical actions without mutating scheduled dates).
3. `recorded_at` (actual UTC action timestamp when confirmed in Azusa).
