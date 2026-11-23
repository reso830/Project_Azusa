# Data Model: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-20 (Regenerated against Feature Brief v0.2, Handoff v2, Data Model v0.6, and Roadmap v0.2)  
**Spec**: [spec.md](./spec.md) · **Research**: [research.md](./research.md)

This document has two strictly separated parts:
1. **Part 1 — Physical Persistence Implemented in F001**: Infrastructure-owned storage (`app_metadata`), reusable audit-column plumbing, local lock/backup/promotion artifacts, and recovery invariants. **Zero business-domain tables are created in F001.**
2. **Part 2 — Conceptual Domain Model Blueprint (`docs/architecture/domain-model.md`)**: Summary of **Data Model v0.6** (`docs/azusa-data-model.md` in `azusa-handoff-v2.zip`) and Constitution Principle III rules documented in F001 for `F002`–`F019` (`M0`–`M4`).

---

## Part 1 — Physical Persistence Implemented in F001

### 1.1 Reusable Audit & Identity Columns (`src/persistence/schema/common.ts`)

Every Drizzle table in Azusa (starting with `app_metadata` in F001 and all future domain tables in `F002`–`F019`) includes the standard `auditColumns()` helper:

| Column | Drizzle Type | SQL Type | Nullability / Default | Rule |
|---|---|---|---|---|
| `id` | `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` | `TEXT PRIMARY KEY` | `NOT NULL` | RFC 9562 / RFC 4122 UUIDv4 string |
| `created_at` | `timestamp('created_at', { withTimezone: true, mode: 'date' })` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | UTC creation timestamp |
| `updated_at` | `timestamp('updated_at', { withTimezone: true, mode: 'date' }).$onUpdate(() => new Date())` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | UTC timestamp auto-refreshed on every Drizzle write |
| `created_by` | `text('created_by')` | `TEXT` | `NOT NULL DEFAULT 'local:sm'` | Pre-auth local operator actor (`resolveActor()`, internal-only override) |
| `updated_by` | `text('updated_by')` | `TEXT` | `NOT NULL DEFAULT 'local:sm'` | Pre-auth local operator actor (`resolveActor()`, internal-only override) |

---

### 1.2 Physical Table: `app_metadata` (`src/persistence/schema/app-metadata.ts`)

Infrastructure-owned table verifying PGlite restart durability (`AC07`), Drizzle migration upgrades (`AC07`), and backup/restore record integrity (`AC08`).

| Column | SQL Type | Constraints | Description |
|---|---|---|---|
| `id` | `TEXT` | `PRIMARY KEY` | UUIDv4 primary key |
| `key` | `TEXT` | `NOT NULL UNIQUE` | Infrastructure key (`'foundation.init'`, `'diagnostic.last_check'`) |
| `value` | `JSONB` | `NOT NULL` | Zod-validated structured metadata payload |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | UTC creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | UTC update timestamp (`$onUpdate`) |
| `created_by` | `TEXT` | `NOT NULL DEFAULT 'local:sm'` | Creating actor |
| `updated_by` | `TEXT` | `NOT NULL DEFAULT 'local:sm'` | Updating actor |

**Standard Keys**:
- `'foundation.init'`: Seeded on first migration (`{ schemaVersion: '0000_foundation_init', appVersion: '0.1.0', initializedAt: ISO8601 }`).
- `'diagnostic.last_check'`: Upserted by `POST /api/health/check` (`{ note: string, checkCount: number, checkedAt: ISO8601 }`).

---

### 1.3 Local Filesystem Backup Manifest & Operational Metadata

| Artifact | Location | Schema / Purpose |
|---|---|---|
| **Lock Sentinel** | `<parent(dir)>/<basename(dir)>.azusa-lock` | File locked via `proper-lockfile`; creates `<sentinel>.lock/` directory (kept **strictly empty**) |
| **Owner Diagnostics** *(optional, non-authoritative)* | `<dir>.azusa-owner.json` | `{ pid: number, processType: 'server' \| 'cli:migrate' \| 'cli:backup' \| 'cli:restore', acquiredAt: ISO8601 }` — outside `.lock/`, never arbitrates ownership |
| **Last-Healthy Marker** | `<dbDir>/.azusa-last-healthy.json` | `{ verifiedAt: ISO8601, appVersion: string }` — removed before running pending migrations, written only after mount + migrations + `'foundation.init'` succeed |
| **Promotion Journal** | `<parent(activeDbDir)>/.azusa-promote-journal.json` | `{ replacedDir: string, stagingDir: string, activeDbDir: string, startedAt: ISO8601 }` — guards `--force-overwrite-active` swaps against crashes |
| **Backup Manifest** | `<backupDir>/<backupId>/manifest.json` | `{ backupId, trigger: 'startup' \| 'manual', createdAt, sourceDbDir, fileCount, totalBytes, actor, pgVersion, files: Array<{ relativePath, sizeBytes, sha256 }> }` (validated by `BackupManifestSchema`) |

**Backup Folder Naming**:
- `backup-<YYYYMMDD-HHmmss-fff>-startup` (automatic pre-migration snapshot) or `backup-<YYYYMMDD-HHmmss-fff>-manual` (CLI manual backup).
- Same-millisecond ties insert a zero-padded counter before the trigger suffix: `backup-<YYYYMMDD-HHmmss-fff>-01-startup`.
- Incomplete `.tmp-*` folders are ignored for `--from latest` and retention counts and cleaned up on next backup run.

---

### 1.4 Foundation Health Read Model (`HealthResponseSchema`)

| Field | Type | Description |
|---|---|---|
| `status` | `'healthy' \| 'error'` | Aggregate runtime health status (`200` if `'healthy'`, `503` if `'error'`) |
| `checkedAt` | `ISO8601 string` | UTC timestamp of health evaluation |
| `actor` | `string` | Active local actor (`"local:sm"`) |
| `database` | `{ initialized: boolean; dbDir: string; pgVersion: string \| null; metadataCount: number }` | Local PGlite status |
| `migrations` | `{ applied: boolean; count: number; latestTag: string \| null }` | Drizzle migration state |
| `backup` | `{ backupDir: string; lastBackupId: string \| null; lastBackupAt: string \| null; lastBackupTrigger: 'startup' \| 'manual' \| 'skipped_cold_start' \| 'skipped_unverified' \| null; backupCount: number; retentionLimit: 10 }` | The ID, timestamp, and trigger refer to the newest completed startup or manual backup; `backupCount` counts startup backups only, matching the retention limit. When none exists, the trigger reports the current skipped startup state. |
| `latestDiagnostic` | `{ id, key, note, checkCount, createdAt, updatedAt, createdBy, updatedBy } \| null` | Latest `'diagnostic.last_check'` record |
| `errors` | `Array<{ stage: 'init' \| 'backup' \| 'migration' \| 'query'; message: string; recoveryHint: string }>` | Structured diagnostics rendered in `<ErrorAlertBanner role="alert" />` when `status === 'error'` |

**Once-Per-Process Startup Failure State Machine**:
- `ensureDatabaseInitialized()` executes **at most once per process** (`globalThis.__azusaDbState` caches both `'healthy'` and `'error'` outcomes, and `startupBackupTaken` caps startup snapshots at 1 per process).
- If startup backup fails when `PG_VERSION` exists: initialization halts **before** opening PGlite or running migrations (`status: 'error'`, `stage: 'backup'`).
- If PGlite mount (`stage: 'init'`) or migration (`stage: 'migration'`) fails: `.azusa-last-healthy.json` remains absent (preventing subsequent restarts from snapshotting a corrupt cluster over good backups), retention pruning is skipped, PGlite is closed, the lock is released, and `status: 'error'` is cached so repeated page loads return `503` without re-running backups.

---

### 1.5 Race-Safe Cross-Process Lock, Pre-Migration Backup & Recoverable Restore Invariants

1. **Race-Safe Cross-Process Ownership (`proper-lockfile`)**:
   - Every process accessing a database or restore target acquires an exclusive lock via `proper-lockfile` (`retries: 0, stale: 10000, update: 2000, realpath: false`) on the per-directory canonical sentinel: `path.resolve(path.dirname(dir), `${path.basename(dir)}.azusa-lock`)`.
   - **Empty Lock Directory Invariant**: `<sentinel>.lock/` is kept **strictly empty** so `proper-lockfile`'s non-recursive `rmdir`/`rmdirSync` succeeds on unlock, stale takeover, and exit cleanup. Optional diagnostic metadata (`<dir>.azusa-owner.json`) sits outside `.lock/` and never arbitrates ownership.
   - **Post-Acquisition Heartbeat Grace Verification**: Every lock holder (`server`, `db:migrate`, `db:backup`, `db:restore`) MUST wait just over one heartbeat interval (`> 2000ms`, e.g., `2100ms`) after acquiring the lock to confirm that heartbeat updates succeed and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying the database folder. If `onCompromised` fires during this wait, the lock holder aborts immediately without touching database files.
   - **Graceful Lost-Lock Handling (`onCompromised`)**:
     - **Server**: Closes PGlite, caches `status: 'error'` (`stage: 'init'`) on `globalThis.__azusaDbState`, and serves `503` instead of throwing an unhandled crash.
     - **CLI (`db:migrate`, `db:backup`, `db:restore`)**: Immediately halts, cleans up `.tmp-*`/`.restore-tmp-*` staging folders, executes promotion rollback if an active swap is underway (`db-replaced-<timestamp>` → `activeDbDir`), logs to stderr, and exits `1`.
   - **Sibling Decoupling**: Non-active `db:restore` locks only `targetDir`'s sentinel (`<parent(targetDir)>/<basename(targetDir)>.azusa-lock`), allowing sibling restores (e.g., `.azusa/test-playwright/restored`) while the server holds `db.azusa-lock`.
   - **Fail-Closed**: Live lock or malformed lock artifact fails closed immediately (`ELOCKED`).
2. **Pre-Migration Automatic Startup Backup & Deferred Pruning**:
   - After lock acquisition + `> 2000ms` wait, startup inspects `<parent(dbDir)>/.azusa-promote-journal.json` to recover any interrupted active promotion.
   - Cold start (`PG_VERSION` absent): skips backup cleanly; `lastBackupTrigger` is `'skipped_cold_start'` when no completed backup exists.
   - Existing healthy cluster (`PG_VERSION` + `.azusa-last-healthy.json`): copies `dbDir` before opening PGlite into `<backupDir>/.tmp-<backupId>`, writes `manifest.json`, and atomically renames to `<backupId>`.
   - **Deferred Pruning**: Only **after** PGlite mounts, all migrations succeed, and `.azusa-last-healthy.json` is written does startup prune completed `-startup` snapshots beyond 10 (never pruning `-manual` snapshots).
3. **Safe CLI Restore Path, Staged Verification & Recoverable Active Promotion**:
   - Canonicalizes `sourceBackupDir`, `activeDbDir`, `backupRootDir`, and `targetDir` (`path.resolve` + `realpathSync.native` on existing ancestors, stripping trailing slashes; comparisons are case-insensitive on Windows while operational paths preserve casing).
   - **Refusal Rules (Before Any Mutation)**:
     - `targetDir` overlaps (equals, contains, or sits inside) `sourceBackupDir` or `backupRootDir` → refuse (even with `--force-overwrite-active`).
     - `targetDir` strictly contains or sits inside `activeDbDir` → refuse (even with `--force-overwrite-active`).
     - `targetDir === activeDbDir` without `--force-overwrite-active` → refuse.
     - `targetDir === activeDbDir` with `--force-overwrite-active` while `<parent(activeDbDir)>/<basename(activeDbDir)>.azusa-lock` is held → refuse.
     - `targetDir !== activeDbDir` and `targetDir` exists and is non-empty → refuse.
   - **Staged Pre-Swap Verification**: Validates `PG_VERSION` + `BackupManifestSchema` on `sourceBackupDir`, copies cluster files (excluding `manifest.json`) into `<parent(targetDir)>/.restore-tmp-<uuid>`, opens PGlite on `.restore-tmp-<uuid>`, validates `'foundation.init'` and all `app_metadata` rows/columns via Zod, writes `.azusa-last-healthy.json`, and closes PGlite. On any error, deletes `.restore-tmp-<uuid>` and leaves `targetDir`, `activeDbDir`, and `sourceBackupDir` byte-for-byte untouched.
   - **Final Placement / Recoverable Active Replacement**:
     - Non-active (`targetDir !== activeDbDir`): atomically renames `.restore-tmp-<uuid>` to `targetDir`.
     - Active (`targetDir === activeDbDir`, `--force-overwrite-active`, server stopped, lock held + `> 2000ms` wait):
       1. Write `<parent(activeDbDir)>/.azusa-promote-journal.json` (`{ replacedDir: '<parent(activeDbDir)>/db-replaced-<timestamp>', stagingDir: '.restore-tmp-<uuid>', activeDbDir, startedAt }`).
       2. Rename existing `activeDbDir` to `<parent(activeDbDir)>/db-replaced-<timestamp>`.
       3. Rename verified `.restore-tmp-<uuid>` to `activeDbDir`.
       4. Open PGlite on `activeDbDir`, confirm `SELECT count(*) FROM app_metadata` succeeds, and close PGlite.
       5. **Preserve `db-replaced-<timestamp>` intact on disk** for operator safety/inspection (documenting manual cleanup) and delete only `.azusa-promote-journal.json`.
       - **Rollback on Failure / Lock Loss**: Remove any partial `activeDbDir`, rename `db-replaced-<timestamp>` back to `activeDbDir`, delete `.azusa-promote-journal.json`, and exit `1`.
       - **Interrupted Promotion Startup Recovery**: On startup, if `.azusa-promote-journal.json` exists: if `activeDbDir` is missing `PG_VERSION` (or fails verification) and `db-replaced-<timestamp>` has `PG_VERSION`, roll back `db-replaced-<timestamp>` to `activeDbDir` and delete the journal; if `activeDbDir` is already healthy, delete only the leftover journal while **preserving `db-replaced-<timestamp>`**.

---

## Part 2 — Conceptual Domain Model Blueprint (`docs/architecture/domain-model.md`)

Per Feature Brief v0.2 §3.9, Constitution Principles III & VI, **Data Model v0.6** (`docs/azusa-data-model.md` in `azusa-handoff-v2.zip`), and **Roadmap v0.2** (`M0`–`M4`, `F001`–`F019`), F001 documents the complete conceptual domain model in `docs/architecture/domain-model.md` while deferring physical table creation to `F002`–`F019`:

### 2.1 Organisation & Calendar (`M0`: `F002`, `F005`)

- **`Train` (ART — `F002`)**: Owns default work categories and PI/Iteration cadence.
- **`Team` (`F002`, `F013`)**: Belongs to one `Train`; defines `hours_per_day` (default **`8.0`**, no separate focus factor), `deduction_mode`, `sprint_offset_workdays` (`-1`, `0`, or `+1` working day relative to shared ART iteration identity), **`planning_style`** (`owner` | `distributed`, snapshotted per Sprint), and per-kind DoR/DoD checklist templates (`F007`).
- **`Member`, `Location`, `Holiday`, `Absence` / `AbsenceType` (`F002`, `F005`)**: `Location` stores canonical IANA timezone ID (formatted via fixed-offset lookup `PHT`/`IST`/`JST`/`SGT`/`UTC` or `UTC±offset`, never `GMT`; invalid/missing IDs compute both clock time and label in `UTC`). `Member` belongs to one `Team` and one `Location` (`PO`/`SM` never contribute development capacity). Leave is always dated; `Absence` supports `affects_capacity` and optional `extra_hours` (planned overtime, e.g., `+2 h`).
- **`PI` & `Iteration` (Sprint — `F002`)**: Explicit Admin/RTE-configured dates and custom names (`YYWW` is optional).
- **`SprintCeremony`, `Meeting`, `Milestone` (`F005`)**: Ceremonies are entered per Sprint with dates (no fixed-day template); `Meeting` deducts hours only from attendees; `Milestone` is team-level (`scope = 'team'`, `scope = 'train'` reserved for `F019`), does not affect capacity, and takes date-header precedence.

### 2.2 Work Categories, Overhead & Capacity (`M0`: `F003`, `F004`, `F005`; `M1`–`M2`: `F009`, `F013`)

- **`Category` & `TeamCategoryAllocation` (`F003`)**: `kind` (`development` | `overhead`); development categories (including `Bugs`) share post-overhead capacity and must sum to `100%`; unset team allocation inherits Train default (never `0%`).
- **`OverheadReserve` & `OverheadTicket` (`F009`, `F013`)**: `OverheadReserve` (replaces `Deduction`) reserves per-member overhead hours (`Training`, `General work`) at PI planning (adjustable at Sprint Planning); `OverheadTicket` draws against it. Overhead is strictly time (never SP, never velocity, no Project).
- **Capacity & Velocity (`F004`, `F013`)**: Workday = `8.0 h` (canonical integer minutes internally; PI displays days, Sprint Planning displays hours). Velocity override chain: `Sprint override → PI override → 4-Sprint rolling normalized velocity`, value and source snapshotted at `Start Sprint`. Planned SP = committed + stretch + `Buffer`s. Per-person load follows `Team.planning_style` (`Owner` = owned SP vs forecast SP; `Distributed` = assigned task hours vs dev hours, with display-only buffer hours conversion on the holder's ring).

### 2.3 Work Hierarchy, Layouts, Buffers, Checklists & Dependencies (`M1`–`M2`: `F006`–`F010`, `F013`–`F014`)

- **`Project` & `Feature` (`F006`)**: `Project` is a long-lived umbrella spanning PIs/Teams; `Feature` belongs to one `Project`, one owning `Team`, and one `PI` (no priority field — ordered by rank).
- **`Story`, `Bug`, `ReproStep`, `StorySlice`, `Task` (`F007`, `F008`, `F013`)**:
  - `Story` has required `Project` and owning `Team`, optional `Feature`, optional `PI` (none = unscheduled backlog). Layout is derived from type + category: **Full story** (`Feature development`: statement + description + `AC`/`DoR`/`DoD`) vs **Light story** (`Enabler`/`Estimation`/`Tech debt`: description + `AC`/`DoD`, no statement/DoR).
  - `Bug` is a separate type restricted to `Bugs` category with `severity` (`S1`–`S4`), `environment`, `version`, `device_os`, ordered `ReproStep`, `expected_result`, `actual_result`, and `DoR`/`DoD` (no AC). Priority is backlog rank for every item type (no priority field).
  - `StorySlice` cannot cross a PI boundary. `Task` belongs to a Story/Bug with assignee defaulting to owner.
- **`Buffer` & `BufferDraw` (`F009`, `F013`, `F014`)**: Typed SP placeholder held by a member, counted in planned load, **outside commitment**, unused SP released at `Close Sprint`, never in velocity.
- **`ChecklistItem` & `ChecklistTemplate` (`F007`)**: Three-state (`not_done` | `done` | `na`) per-kind templates (`story_full` | `story_light` | `bug`).
- **`Tag` & `WorkItemTag` (`F007`)**: Universal lower-case hyphenated tags across the app.
- **`Dependency`, `ExternalDependency`, `BoardPlacement` (`F009`, `F010`, `F019`)**: Directed `from_story → to_story` (predecessor → successor); Stretch link applies to whole Story; `BoardPlacement` is view-scoped positioning only.
- **Workflows & `Removed` (`F007`, `F014`)**: Story (`New → Active → Quality Check → Acceptance → Closed`) and Bug (`Triage → Investigating → Correcting → Verification → Closed`), both with terminal **`Removed`** (done-type, `counts_as_completed = false`, reason required, excluded from velocity/throughput/say-do).

### 2.4 Plan Versions, Commitments, Execution History & Lifecycle Dates (Constitution Principle III — `F012`–`F016`)

- **Five Distinct Domain Concepts**:
  1. **`PlanVersion` (`F012`)**: Explicit user-saved complete PI snapshot (`v1`, `v2`, `v3`…); never an official commitment and never overwrites commitments.
  2. **`PICommitment` (`Start PI` — `F012`)**: Immutable Admin/RTE commitment snapshot (including per-member × Sprint capacity totals, overhead reserves, buffers).
  3. **`SprintCommitment` (`Start Sprint` — `F013`)**: Immutable SM commitment snapshot of the reviewed current Sprint plan (including per-member capacity totals, velocity value + source, `planning_style`, buffers, overhead reserves); retroactive Start Sprint commits the reviewed current plan without reconstructing history.
  4. **`SprintClosure` / `Actuals` (`Close Sprint` — `F015`)**: Confirmed final actual Story/slice SP, actual capacity/overhead, and released buffer SP; never overwrites PI or Sprint Commitments.
  5. **`StateChange` (`F014`)**: Immutable transition log (`item`, `from`, `to`, `when`, `by`) driving derived flags (`aging`, `missed target`, flow efficiency).
- **Three Distinct Sprint Lifecycle Dates**: (1) **Scheduled** Sprint start/end dates (with Team ±1 working-day offset), (2) SM-selected **effective** start/close date, and (3) **action timestamp** (`recorded_at`).
