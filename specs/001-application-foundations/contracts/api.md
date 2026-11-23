# Interface & Operational Contracts: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-20 (Regenerated against Feature Brief v0.2, Handoff v2, and Roadmap v0.2)  
**Spec**: [spec.md](../spec.md) · **Data Model**: [data-model.md](../data-model.md)

---

## 1. HTTP API Contracts (Local Next.js Route Handlers)

All API endpoints serve JSON from `http://127.0.0.1:3000` (or `http://127.0.0.1:3100` in Playwright tests), validate inputs/outputs with Zod (`src/domain/health/schemas.ts`), and return `Cache-Control: no-store`.

### 1.1 `GET /api/health`

Returns the current foundation health read model (`HealthResponseSchema`).

- **Optional Test Fault Injection Header** *(only honored when `AZUSA_ALLOW_TEST_FAULT_INJECTION === '1'` and `NODE_ENV !== 'production'`)*:
  - `x-azusa-test-simulate-error: init | backup | migration` — simulates the specified startup failure stage to verify `503` and UI `ErrorAlertBanner` rendering.
- **Responses**:
  - **`200 OK`** (`status: "healthy"`):
    ```json
    {
      "status": "healthy",
      "checkedAt": "2026-11-20T07:30:00.000Z",
      "actor": "local:sm",
      "database": {
        "initialized": true,
        "dbDir": ".azusa/data/db",
        "pgVersion": "16",
        "metadataCount": 1
      },
      "migrations": {
        "applied": true,
        "count": 1,
        "latestTag": "0000_foundation_init"
      },
      "backup": {
        "backupDir": ".azusa/data/backups",
        "lastBackupId": "backup-20261120-153000-000-startup",
        "lastBackupAt": "2026-11-20T07:30:00.000Z",
        "lastBackupTrigger": "startup",
        "backupCount": 1,
        "retentionLimit": 10
      },
      "latestDiagnostic": null,
      "errors": []
    }
    ```
  - **`503 Service Unavailable`** (`status: "error"`): Returned whenever initialization, lock acquisition/loss (`stage: "init"`), startup backup (`stage: "backup"`), or migration (`stage: "migration"`) failed. `errors` contains at least one `{ stage, message, recoveryHint }` entry.

### 1.2 `POST /api/health/check`

Upserts the `'diagnostic.last_check'` record in `app_metadata` to verify live local persistence and audit column updates.

- **Request Body** (`DiagnosticCheckRequestSchema` — `.strict()`, **rejects `actor` or any unknown keys**):
  ```json
  {
    "note": "Manual diagnostic check"
  }
  ```
  - `note`: optional trimmed string, `1..280` chars, defaults to `"Manual diagnostic check"`.
- **Responses**:
  - **`201 Created`**:
    ```json
    {
      "ok": true,
      "record": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "key": "diagnostic.last_check",
        "note": "Manual diagnostic check",
        "checkCount": 1,
        "createdAt": "2026-11-20T07:30:00.000Z",
        "updatedAt": "2026-11-20T07:30:00.000Z",
        "createdBy": "local:sm",
        "updatedBy": "local:sm"
      },
      "health": { "...": "HealthResponseSchema" }
    }
    ```
  - **`400 Bad Request`**: Zod validation error (including unknown keys such as `actor`).
    ```json
    { "ok": false, "error": "Invalid request payload", "issues": [] }
    ```
  - **`503 Service Unavailable` / `500 Internal Server Error`**: Database is in an error/lost-lock state (`503`) or write query failed (`500`).
    ```json
    {
      "ok": false,
      "error": "Database initialization or write failed",
      "stage": "init",
      "recoveryHint": "Inspect PGlite storage permissions in .azusa/data/db or consult docs/operations/database-and-recovery.md"
    }
    ```

---

## 2. CLI Operational Contracts

All CLI commands that access or replace `AZUSA_DB_DIR` (`db:migrate`, `db:backup`, and `db:restore -- --to <AZUSA_DB_DIR> --force-overwrite-active`) enforce race-safe exclusive cross-process ownership via `proper-lockfile` targeting per-directory canonical sentinel files (`<parent(dir)>/<basename(dir)>.azusa-lock`). The library-owned `<sentinel>.lock/` directory is kept **strictly empty** so `rmdir`/`rmdirSync` unlock, stale takeover, and exit cleanup succeed without `ENOTEMPTY` errors; optional non-authoritative diagnostics are written outside to `<dir>.azusa-owner.json`.

Every CLI command (`db:migrate`, `db:backup`, and `db:restore`) MUST wait just over one heartbeat interval (`> 2000ms`, e.g., `2100ms`) after acquiring its required lock to confirm that the heartbeat update cycle succeeds and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying any database files. If `onCompromised` fires during this grace wait or mid-operation, the callback immediately aborts execution, cleans up any active staging directories (`.tmp-*`, `.restore-tmp-*`), executes rollback of active promotion if underway (`db-replaced-<timestamp>` back to `activeDbDir`, removing journal), prints error diagnostics to stderr, and exits with code `1`.

Non-active `db:restore` (targeting a disjoint staging directory `targetDir`) locks only `targetDir`'s own sentinel (`<parent(targetDir)>/<basename(targetDir)>.azusa-lock`), remaining completely disjoint from `AZUSA_DB_DIR`'s lock even when sharing the same parent directory (e.g., `.azusa/data/restored-*` or `.azusa/test-playwright/restored`). If a command cannot acquire its required lock (live lock or malformed lock artifact), it fails closed immediately before touching any files, prints an actionable error to stderr, and exits with code `1`.

### 2.1 `npm run db:migrate`

- **Command**: `tsx scripts/db/migrate.ts`
- **Inputs**: Optional env `AZUSA_DB_DIR` (default `.azusa/data/db`), `AZUSA_BACKUP_DIR` (default `.azusa/data/backups`), `AZUSA_ACTOR_ID` (default `local:sm`).
- **Behavior**:
  1. Acquires exclusive lock on `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` (keeping `.lock/` empty) and waits `> 2000ms` to confirm `onCompromised` has not fired.
  2. Recovers any interrupted active-restore promotion if `.azusa-promote-journal.json` is present.
  3. Runs atomic pre-migration startup backup if `AZUSA_DB_DIR` contains both `PG_VERSION` and `.azusa-last-healthy.json`.
  4. Removes `.azusa-last-healthy.json`, applies pending SQL migrations from `src/persistence/migrations/`, seeds `'foundation.init'`, and writes `.azusa-last-healthy.json`.
  5. Only after Step 4 succeeds, prunes completed `-startup` backups beyond the 10-snapshot retention limit.
  6. Releases the lock, prints structured JSON summary to stdout, and exits `0` (or exits `1` on stderr on failure).

### 2.2 `npm run db:backup`

- **Command**: `tsx scripts/db/backup.ts`
- **Inputs**: Optional env `AZUSA_DB_DIR`, `AZUSA_BACKUP_DIR`, `AZUSA_ACTOR_ID`.
- **Precondition**: Azusa server MUST be stopped and an initialized cluster (`PG_VERSION`) MUST exist at `AZUSA_DB_DIR`.
- **Behavior**:
  1. Acquires exclusive lock on `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` (keeping `.lock/` empty) and waits `> 2000ms` to confirm `onCompromised` has not fired (fails with exit code `1` if locked or `PG_VERSION` absent).
  2. Copies `AZUSA_DB_DIR` into `<AZUSA_BACKUP_DIR>/.tmp-<backupId>`, verifies copied file sizes and SHA-256 digests against the quiescent source without opening PGlite in place on the backup folder, writes `manifest.json` (`trigger: "manual"`), and atomically renames `.tmp-<backupId>` to `<AZUSA_BACKUP_DIR>/<backupId>`.
  3. Releases the lock, prints `{ ok: true, backupId, backupPath, filesCopied, createdAt }`, and exits `0`.

### 2.3 `npm run db:restore`

- **Command**: `tsx scripts/db/restore.ts --from <backup-id-or-path> [--to <target-dir>] [--force-overwrite-active]`
- **Arguments**:
  - `--from <backup-id-or-path>` *(required)*: `"latest"` (newest completed snapshot with `PG_VERSION` and valid `manifest.json`), a backup folder name inside `AZUSA_BACKUP_DIR`, or an explicit path.
  - `--to <target-dir>` *(optional)*: Destination directory; defaults to `.azusa/data/restored-<YYYYMMDD-HHmmss-fff>`.
  - `--force-overwrite-active` *(optional)*: Required only if `--to` resolves to the exact canonical path of `AZUSA_DB_DIR` (with server stopped).
- **Safety, Verification & Recoverable Replacement Contract**:
  1. **Path Normalization**: Canonicalizes `source`, `activeDbDir`, `backupRootDir`, `target` (`path.resolve` + `realpathSync.native` on existing ancestors, stripping trailing slashes; comparisons are case-insensitive on Windows and operational paths preserve casing).
  2. **Disjoint & Non-Populated Checks (Refuse Before Any Mutation)**:
     - `target` overlaps `source` or `backupRootDir` → exit `1` (even with `--force-overwrite-active`).
     - `target` strictly contains or sits inside `activeDbDir` → exit `1` (even with `--force-overwrite-active`).
     - `target === activeDbDir` without `--force-overwrite-active` → exit `1`.
     - `target !== activeDbDir` and `target` exists and is non-empty → exit `1`.
  3. **Target Lock & Heartbeat Grace Wait**:
     - Acquires exclusive lock on `<parent(target)>/<basename(target)>.azusa-lock` (which is the active DB sentinel when `target === activeDbDir`, or an independent target sentinel otherwise) and waits `> 2000ms` to confirm `onCompromised` has not fired.
  4. **Staged Copy & Full Record Verification**:
     - Validates `source` has `PG_VERSION` and valid `manifest.json` (`BackupManifestSchema`).
     - Copies cluster files (excluding `manifest.json`) into `<parent(target)>/.restore-tmp-<uuid>`, opens PGlite on `.restore-tmp-<uuid>`, queries all `app_metadata` rows, validates `'foundation.init'` and every column/field via Zod, writes `.azusa-last-healthy.json`, and closes PGlite.
     - On verification failure, deletes `.restore-tmp-<uuid>`, releases the lock, and exits `1` (leaving `target`, `activeDbDir`, and `source` untouched).
  5. **Final Placement & Recoverable Active Promotion**:
     - If `target !== activeDbDir`: atomically renames `.restore-tmp-<uuid>` to `target`.
     - If `target === activeDbDir` (`--force-overwrite-active`, lock held):
       1. Write `<parent(activeDbDir)>/.azusa-promote-journal.json` (`{ replacedDir: '<parent(activeDbDir)>/db-replaced-<timestamp>', stagingDir: '.restore-tmp-<uuid>', activeDbDir, startedAt }`).
       2. Rename existing `activeDbDir` to `<parent(activeDbDir)>/db-replaced-<timestamp>`.
       3. Rename verified `.restore-tmp-<uuid>` to `activeDbDir`.
       4. Open PGlite on `activeDbDir`, confirm `SELECT count(*) FROM app_metadata` succeeds, and close PGlite.
       5. **Preserve `db-replaced-<timestamp>` intact** in `<parent(activeDbDir)>` for operator inspection/manual cleanup, and remove `.azusa-promote-journal.json`.
       - **Rollback on Failure / `onCompromised`**: Remove any partial `activeDbDir`, rename `db-replaced-<timestamp>` back to `activeDbDir`, delete `.azusa-promote-journal.json`, release lock, and exit `1`.
     - Release lock, print `{ ok: true, backupId, restoredTo, recordCount, foundationRecordId, replacedDbPreserved?: string }`, and exit `0`.

---

## 3. UI Route & Shell Contracts (Handoff v2 & Roadmap v0.2)

### 3.1 Nine Primary Navigation Destinations

All 9 primary navigation destinations render within `src/ui/shell/AppShell.tsx` and display route-specific placeholder content (`src/ui/shell/PlaceholderScreen.tsx`) clearly displaying their target milestone and feature ID from `docs/feature-roadmap.md` v0.2 (`M0`–`M4`, `F004`–`F019`).

| Menu Group | Menu Label | Route Path | Kumiko Icon (`18px` in menu) | Page Title (`Zen Kaku Gothic New`) | Today Widget Visible? | Search Placeholder | Target Milestone & Feature (`docs/feature-roadmap.md` v0.2) |
|---|---|---|---|---|---|---|---|
| **PI** | `Team PI board` | `/` | `team-board` | `Team PI board` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M1 — Team PI Planning (F009)` |
| **PI** | `ART program board` | `/program-board` | `art-board` | `ART program board` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M4 — ART-Level Planning (F019)` |
| **PI** | `Team PI brief` | `/pi-brief` | `pi-brief` | `Team PI brief` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M1 — Team PI Planning (F011)` |
| **Capacity** | `Team calendar` | `/calendar` | `calendar` | `Team calendar` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M0 — Foundations (F005)` |
| **Capacity** | `Capacity planner` | `/capacity` | `capacity` | `Capacity planner` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M0 — Foundations (F004)` |
| **Sprint** | `Team backlog` | `/backlog` | `backlog` | `Team backlog` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M1 — Team PI Planning (F008)` |
| **Sprint** | `Sprint planning` | `/sprint-planning` | `sprint-plan` | `Sprint planning` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M2 — Sprint Execution (F013)` |
| **Sprint** | `Iteration board` | `/iteration` | `iteration` | `Iteration board` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M2 — Sprint Execution (F014)` |
| **Insights** | `Team dashboard` | `/dashboard` | `dashboard` | `Team dashboard` | Yes (`visibility: hidden` when search expanded `< 1100px`) | `Search stories, features…` | `M3 — Metrics & Reporting (F017)` |

### 3.2 Profile Dropdown Contract (`src/ui/shell/ProfileMenu.tsx`)

- **Trigger**: `40px` `#1A1B22` circle button displaying `"SM"`, `aria-label="Account menu for SM"`, `aria-expanded`, `aria-controls="azusa-profile-menu"`.
- **Mutual Exclusion**: Opening the profile dropdown closes the primary navigation dropdown, and vice versa. Pressing `Escape` closes the dropdown and returns focus to the `"SM"` button.
- **Dropdown Content (`250px`, white surface, `border-radius: 16px`)**:
  - **Operator Identity Header**: `36px` `"SM"` avatar circle + Title **`Scrum Master`** + Subtitle **`No ART or team configured`** (internal `local:sm` actor is never shown in this header).
  - **Settings Placeholder Item**: Disabled, non-navigating item (`aria-disabled="true"`) with `18px` `settings` Kumiko icon, label `Settings`, and visible muted helper text (`"Configured per feature (F002–F014)"`) linked via `aria-describedby` (never hover-only) so keyboard and screen-reader users can reach it. **No `/settings` route is created in F001.**
