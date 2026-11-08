# Phase 1 Interface Contracts: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-08  
**Spec**: [spec.md](./spec.md) · **Data Model**: [data-model.md](./data-model.md)

This document defines the HTTP API contracts, CLI operational contracts, and UI route/component contracts introduced in Feature 001.

---

## 1. HTTP JSON API Contracts

### 1.1 `GET /api/health`

Evaluates and returns the current operational health of the local PGlite database, Drizzle migrations, automatic startup backup subsystem, and the most recent persisted diagnostic record from `app_metadata` (Confirmed in Planning Clarification PC3).

- **Method**: `GET`
- **Path**: `/api/health`
- **Cache Behavior**: `Cache-Control: no-store` (`dynamic = 'force-dynamic'`)
- **Status Codes**:
  - `200 OK`: Database initialized, migrations applied, and no startup backup errors (`status: "healthy"`).
  - `503 Service Unavailable`: Initialization, migration, or startup backup failed (`status: "error"`). Still returns a valid JSON payload matching `HealthResponseSchema` so the UI shell error banner (`role="alert"`) and foundation status card can display actionable diagnostics.

#### Response Body Schema (`HealthResponseSchema`)

```json
{
  "status": "healthy",
  "checkedAt": "2026-11-08T11:30:15.000Z",
  "actor": "local:sm",
  "database": {
    "initialized": true,
    "dbDir": ".azusa/data/db",
    "recordCount": 2,
    "foundationRecordId": "01930b7a-8c00-4000-8000-000000000001",
    "foundationInitializedAt": "2026-11-08T11:30:00.000Z"
  },
  "migrations": {
    "applied": true,
    "appliedCount": 1,
    "error": null
  },
  "backup": {
    "lastBackupId": "backup-20261108-193000-000-startup",
    "lastBackupAt": "2026-11-08T11:30:00.000Z",
    "lastBackupTrigger": "startup",
    "backupCount": 1,
    "retentionLimit": 10,
    "error": null
  },
  "latestDiagnostic": {
    "id": "01930b7a-9e10-4000-8000-000000000002",
    "key": "diagnostic.last_check",
    "note": "Smoke test persistence verification",
    "checkCount": 1,
    "createdAt": "2026-11-08T11:30:10.000Z",
    "updatedAt": "2026-11-08T11:30:10.000Z",
    "createdBy": "local:sm",
    "updatedBy": "local:sm"
  },
  "errors": []
}
```

---

### 1.2 `POST /api/health/check`

Writes or updates the `'diagnostic.last_check'` record in `app_metadata` to verify local PGlite durability across server restarts (`AC04`, `US3`) and validate audit column population (`id` UUIDv4, `created_at`, auto-updated `updated_at`, `created_by`, `updated_by`).

- **Method**: `POST`
- **Path**: `/api/health/check`
- **Content-Type**: `application/json`

#### Request Body Schema (`DiagnosticCheckRequestSchema`)

> **Security & Provenance Rule (`C13`)**: Public HTTP requests MUST NOT supply an `actor` override. `DiagnosticCheckRequestSchema` uses `.strict()` and accepts only `note`; actor resolution on HTTP writes uses the server's configured local actor (`resolveActor(undefined)` → `"local:sm"`). Internal TypeScript service functions (`recordDiagnosticCheck(input, options)`) accept `options?.actor` for automated unit/integration tests.

```ts
const DiagnosticCheckRequestSchema = z
  .object({
    note: z.string().trim().min(1).max(280).optional().default('Manual diagnostic check'),
  })
  .strict();
```

Example request:
```json
{
  "note": "Verify persistence across application restart"
}
```

#### Response Codes & Bodies

- **`201 Created`**: Record persisted in `app_metadata`.
  ```json
  {
    "ok": true,
    "record": {
      "id": "01930b7a-9e10-4000-8000-000000000002",
      "key": "diagnostic.last_check",
      "note": "Verify persistence across application restart",
      "checkCount": 2,
      "createdAt": "2026-11-08T11:30:10.000Z",
      "updatedAt": "2026-11-08T11:31:00.000Z",
      "createdBy": "local:sm",
      "updatedBy": "local:sm"
    },
    "health": {
      "status": "healthy",
      "checkedAt": "2026-11-08T11:31:00.000Z",
      "actor": "local:sm",
      "database": { "...": "..." },
      "migrations": { "...": "..." },
      "backup": { "...": "..." },
      "latestDiagnostic": { "...": "..." },
      "errors": []
    }
  }
  ```
- **`400 Bad Request`**: Request body failed Zod validation (e.g., empty/overlong `note` or unknown keys like `actor`).
  ```json
  {
    "ok": false,
    "error": "Validation failed",
    "issues": [
      { "path": ["note"], "message": "String must contain at most 280 character(s)" }
    ]
  }
  ```
- **`503 Service Unavailable` / `500 Internal Server Error`**: Database is in an uninitialized/failed startup state (`503`) or write query failed (`500`).
  ```json
  {
    "ok": false,
    "error": "Database initialization or write failed",
    "stage": "query",
    "recoveryHint": "Inspect PGlite storage permissions in .azusa/data/db or consult docs/operations/database-and-recovery.md"
  }
  ```

---

## 2. CLI Operational Contracts

All CLI commands that access or replace `AZUSA_DB_DIR` (`db:migrate`, `db:backup`, and `db:restore -- --to <AZUSA_DB_DIR> --force-overwrite-active`) enforce race-safe exclusive cross-process ownership via `proper-lockfile` targeting per-directory canonical sentinel files (`<parent(dir)>/<basename(dir)>.azusa-lock`, `C1`, `M2`, `L3`). The library-owned `<sentinel>.lock` directory is kept strictly empty so `rmdir`/`rmdirSync` unlock and exit cleanup succeed without `ENOTEMPTY` errors (`L1`), with optional non-authoritative diagnostics written outside to `<dir>.azusa-owner.json`. An `onCompromised` handler closes PGlite, records error state, and serves 503 instead of crashing Next.js ungracefully on lost locks (`L2`). Every CLI command (`db:migrate`, `db:backup`, and `db:restore`) MUST wait just over one heartbeat interval (> 2000ms, e.g. 2100ms) after acquiring its required lock to confirm that the heartbeat update cycle succeeds and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying any database files (`G1`). If `onCompromised` fires during this grace wait or mid-operation, the callback immediately aborts execution, cleans up any active staging directories (`.tmp-*`, `.restore-tmp-*`), executes rollback of active promotion if underway (`db-replaced-<timestamp>` back to `activeDbDir`), prints error diagnostics to stderr, and exits with code 1 (`F3`, `G1`). Non-active `db:restore` (targeting a disjoint staging directory `targetDir`) locks only `targetDir`'s own sentinel (`<parent(targetDir)>/<basename(targetDir)>.azusa-lock`), remaining completely disjoint from `AZUSA_DB_DIR`'s lock even when sharing the same parent directory (`L3`). If a command cannot acquire its required lock, it fails closed immediately before touching any files, prints an actionable error message to stderr, and exits with code `1`.

### 2.1 `npm run db:migrate`

- **Command**: `tsx scripts/db/migrate.ts`
- **Inputs**: Optional env `AZUSA_DB_DIR` (defaults to `.azusa/data/db`), `AZUSA_BACKUP_DIR` (defaults to `.azusa/data/backups`), `AZUSA_ACTOR_ID` (defaults to `local:sm`).
- **Behavior**:
  1. Acquires exclusive cross-process lock on `AZUSA_DB_DIR` via `proper-lockfile` on `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` (keeping `.lock` empty per `L1`, refusing with exit code `1` if another live process holds the lock).
  2. Recovers any interrupted active-restore promotion if `.azusa-promote-journal.json` is present (`M3`).
  3. Runs atomic pre-migration startup backup if `AZUSA_DB_DIR` contains a verified PGlite cluster (`PG_VERSION` and `.azusa-last-healthy.json`).
  4. Applies pending SQL migrations from `src/persistence/migrations/`.
  5. Ensures the `'foundation.init'` record exists in `app_metadata` and writes `.azusa-last-healthy.json`.
  6. Only after steps 4–5 succeed, prunes completed `-startup` backups beyond the 10-snapshot retention limit (`M1`).
  7. Releases the lock, prints structured JSON summary to stdout, and exits `0` (or exits `1` with error details on stderr if lock, backup, or migration fails).

### 2.2 `npm run db:backup`

- **Command**: `tsx scripts/db/backup.ts`
- **Inputs**: Optional env `AZUSA_DB_DIR`, `AZUSA_BACKUP_DIR`, `AZUSA_ACTOR_ID`.
- **Precondition**: The Azusa server MUST be stopped (exclusive lock on `AZUSA_DB_DIR` must not be held by a live process) and an initialized PGlite cluster (`PG_VERSION`) must exist at `AZUSA_DB_DIR`.
- **Behavior**:
  1. Acquires exclusive cross-process lock on `AZUSA_DB_DIR` via `proper-lockfile` on `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` (keeping `.lock` empty per `L1`, fails with exit code `1` if locked by a running server/CLI process or if `PG_VERSION` is absent).
  2. Copies `AZUSA_DB_DIR` into `<AZUSA_BACKUP_DIR>/.tmp-<backupId>`, verifies copied file sizes and SHA-256 digests against the quiescent source directory (without opening PGlite in place on the backup folder so the snapshot is never modified per `m1`), writes `manifest.json` (`trigger: "manual"`), and atomically renames `.tmp-<backupId>` to `<AZUSA_BACKUP_DIR>/<backupId>` (`backup-<YYYYMMDD-HHmmss-fff>-manual` or `backup-<YYYYMMDD-HHmmss-fff>-01-manual` on same-millisecond tie).
  3. Releases the lock, prints `{ ok: true, backupId, backupPath, filesCopied, createdAt }`, and exits `0`.

### 2.3 `npm run db:restore`

- **Command**: `tsx scripts/db/restore.ts --from <backup-id-or-path> [--to <target-dir>] [--force-overwrite-active]`
- **Arguments**:
  - `--from <backup-id-or-path>` *(required)*: Either `"latest"` (selects the newest completed snapshot in `AZUSA_BACKUP_DIR` that has both `PG_VERSION` and a valid `manifest.json`), a backup folder name inside `AZUSA_BACKUP_DIR`, or an explicit path to a backup folder.
  - `--to <target-dir>` *(optional)*: Destination directory for the restored database. Defaults to `.azusa/data/restored-<YYYYMMDD-HHmmss-fff>`.
  - `--force-overwrite-active` *(optional flag)*: Required only if `--to` resolves to the exact canonical path of `AZUSA_DB_DIR` (with the server stopped).
- **Safety, Verification & Recoverable Replacement Contract (`AC06`, `C1`, `C2`, `M3`)**:
  1. **Path Normalization**: All paths (`source`, `activeDbDir`, `backupRootDir`, `target`) are canonicalized (`path.resolve` + `realpathSync.native` on existing ancestors, trailing slashes stripped, and lowercased on Windows).
  2. **Disjoint & Non-Populated Target Checks (Refuse Before Any Mutation)**:
     - If `target` overlaps (equals, contains, or is inside) `source` or `backupRootDir`: abort with exit code `1` (even with `--force-overwrite-active`).
     - If `target` strictly contains or is strictly inside `activeDbDir`: abort with exit code `1` (even with `--force-overwrite-active`).
     - If `target === activeDbDir` and `--force-overwrite-active` is NOT passed: abort with exit code `1`.
     - If `target === activeDbDir` and `--force-overwrite-active` IS passed: acquire exclusive lock on `activeDbDir` via `proper-lockfile` (aborting with exit code `1` before touching any files if a running server holds the lock).
     - If `target !== activeDbDir` and `target` already exists and is non-empty: abort with exit code `1`.
  3. **Staged Copy & Full Record Integrity Verification**:
     - Validate that `source` contains `PG_VERSION` and a valid `manifest.json` (`BackupManifestSchema`).
     - Copy cluster files (excluding `manifest.json`) to a temporary sibling folder `<parent(target)>/.restore-tmp-<uuid>`.
     - Open PGlite on `.restore-tmp-<uuid>`, query all rows in `app_metadata`, verify `'foundation.init'` exists and every row passes Zod validation (`id` UUID, `key`, `value`, `created_at`, `updated_at`, `created_by`, `updated_by`), write `.azusa-last-healthy.json`, and close PGlite.
     - If verification fails, delete `.restore-tmp-<uuid>`, release any lock, and exit `1`—leaving `target`, `activeDbDir`, and `source` completely untouched.
  4. **Final Placement & Recoverable Active Promotion (`M3`)**:
     - If `target !== activeDbDir`: atomically rename `.restore-tmp-<uuid>` to `target`.
     - If `target === activeDbDir` (`--force-overwrite-active` with exclusive lock held):
       1. Write `<parent(activeDbDir)>/.azusa-promote-journal.json` (`{ replacedDir: '<parent(activeDbDir)>/db-replaced-<timestamp>', stagingDir: '.restore-tmp-<uuid>', activeDbDir }`).
       2. Move existing `activeDbDir` to `<parent(activeDbDir)>/db-replaced-<timestamp>`.
       3. Move verified `.restore-tmp-<uuid>` to `activeDbDir`.
       4. Open PGlite on `activeDbDir`, confirm `SELECT count(*) FROM app_metadata` succeeds, and close PGlite.
       5. Preserve `db-replaced-<timestamp>` intact in `<parent(activeDbDir)>` for safety/inspection (documenting operator retention/cleanup), and remove `.azusa-promote-journal.json` (`L4`).
       - **Rollback on Failure**: If Step 3 or Step 4 fails, remove any partial `activeDbDir`, move `db-replaced-<timestamp>` back to `activeDbDir`, remove `.azusa-promote-journal.json`, release the lock, and exit `1`.
     - Release the lock, print structured JSON verification summary (including `replacedDbPreserved: "<parent(activeDbDir)>/db-replaced-<timestamp>"` when `--force-overwrite-active` was used, `L4`), and exit `0`.

---

## 3. UI Route & Shell Contracts

All 7 navigation dropdown destinations render within the shared application shell (`src/ui/shell/AppShell.tsx`) and display route-specific placeholder content (`src/ui/shell/PlaceholderScreen.tsx`) clearly indicating their target milestone and feature ID from `docs/feature-roadmap.md` (`AC02`, Clarification Q2, Planning Clarification PC1, Operator Decision OD3).

| Menu Group | Menu Label | Route Path | Kumiko Icon (`18px` in menu) | Page Title (`Zen Kaku Gothic New`) | Today Widget Visible? | Search Input Placeholder | Target Milestone & Feature (`docs/feature-roadmap.md`) |
|---|---|---|---|---|---|---|---|
| **Plan** | `Team PI board` | `/` | `team-board` | `Team PI board` | Yes (`visibility: hidden` when search is expanded `< 1100px`) | `Search stories, features…` | `M2 — Team PI Planning (F008)` |
| **Plan** | `ART program board` | `/program-board` | `art-board` | `ART program board` | Yes (`visibility: hidden` when search is expanded `< 1100px`) | `Search stories, features…` | `M3 — ART Planning & Commitment (F012)` |
| **Plan** | `Team PI brief` | `/pi-brief` | `pi-brief` | `Team PI brief` | Yes (`visibility: hidden` when search is expanded `< 1100px`) | `Search stories, features…` | `M2 — Team PI Planning (F011)` |
| **Capacity** | `Capacity planner` | `/capacity` | `capacity` | `Capacity planner` | Yes (`visibility: hidden` when search is expanded `< 1100px`) | `Search stories, features…` | `M1 — Planning Fundamentals (F006)` |
| **Sprint** | `Iteration board` | `/iteration` | `iteration` | `Iteration board` | Yes (`visibility: hidden` when search is expanded `< 1100px`) | `Search stories, features…` | `M4 — Sprint Execution (F016)` |
| **Insights** | `Team dashboard` | `/dashboard` | `dashboard` | `Team dashboard` | Yes (`visibility: hidden` when search is expanded `< 1100px`) | `Search stories, features…` | `M5 — Metrics & Reporting (F020)` |
| *(Divider)* | `Settings` | `/settings` | `settings` | `Settings` | **No** (omitted per prototype) | `Search settings…` | `M0 — Foundations (F002–F004)` |
