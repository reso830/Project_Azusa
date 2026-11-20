# Research & Architectural Decisions: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-20 (Regenerated against Feature Brief v0.2, Handoff v2, Data Model v0.6, and Roadmap v0.2)  
**Spec**: [spec.md](./spec.md)

---

## R1 — Single Local Next.js Runtime, Strict TypeScript & Flat Routes

- **Decision**: Build Azusa as a single Next.js 15 (App Router) application using strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), bound to `127.0.0.1` by default with `NEXT_TELEMETRY_DISABLED=1`, using flat top-level App Router routes for the **9 primary navigation destinations**:
  - `/` (`Team PI board`)
  - `/program-board` (`ART program board`)
  - `/pi-brief` (`Team PI brief`)
  - `/calendar` (`Team calendar`)
  - `/capacity` (`Capacity planner`)
  - `/backlog` (`Team backlog`)
  - `/sprint-planning` (`Sprint planning`)
  - `/iteration` (`Iteration board`)
  - `/dashboard` (`Team dashboard`)
- **No `/settings` route in F001**: Per Clarification Q1 (`2026-11-20`) and Roadmap v0.2, F001 does **not** create a `/settings` route or standalone Settings page; `Settings` is rendered inside the profile dropdown as a disabled, non-navigating placeholder (`aria-disabled="true"`). Configuration is delivered incrementally by owning features (`F002`–`F014`).
- **Rationale**: Satisfies Feature Brief v0.2 §3.1, §3.4, §3.5 and Constitution Principles I & IV.

---

## R2 — Styling Foundation & Azusa Design Tokens (Handoff v2)

- **Decision**: Configure Tailwind CSS alongside semantic CSS custom properties in `src/app/globals.css` encoding the Azusa color, surface, typography, border, shadow, status/severity/category pastel, and `:focus-visible` tokens from `AZUSA_HANDOFF.md` (§14.2–§14.4) and `AZUSA_HANDOFF_UPDATE_2026-11-20.md` (§14).
- **Rationale**: Provides consistent design tokens for F001 and prepares for future component/chart integration without coupling to external CDNs.

---

## R3 — Local Typography Bundling (`@fontsource`)

- **Decision**: Bundle **Zen Kaku Gothic New** (`500`, `700`), **IBM Plex Sans** (`400`, `500`, `600`, `700`), and **IBM Plex Mono** (`500`, `600`) locally via `@fontsource/zen-kaku-gothic-new`, `@fontsource/ibm-plex-sans`, and `@fontsource/ibm-plex-mono`, imported in `src/app/layout.tsx` and bound to `--font-heading`, `--font-sans`, and `--font-mono`, with `font-variant-numeric: tabular-nums` on numeric displays.
- **Rationale**: Required by Feature Brief v0.2 §3.3, Constitution Principle IV, and Deviation D2 (zero external font CDN requests).

---

## R4 — PGlite + Drizzle ORM Persistence, Race-Safe Cross-Process Lock (`proper-lockfile`) & Once-Per-Process Singleton

- **Decision** *(carried forward from Pass 1–5 review per Clarification Q3)*:
  - Use `@electric-sql/pglite` with `drizzle-orm/pglite` and `drizzle-kit` for version-controlled SQL migrations.
  - Configure `next.config.ts` with `serverExternalPackages: ['@electric-sql/pglite']` so Node.js resolves PGlite's native `.wasm` and `.data` bundle files directly from `node_modules`.
  - Store the active database in `process.env.AZUSA_DB_DIR ?? '.azusa/data/db'`.
  - **Race-Safe Cross-Process Exclusive Lock (`proper-lockfile`)**:
    - Use `proper-lockfile` (`^4.1.2`, MIT) in `src/persistence/lock.ts` targeting a per-directory canonical sentinel file: `path.resolve(path.dirname(dir), `${path.basename(dir)}.azusa-lock`)` (`retries: 0, stale: 10000, update: 2000, realpath: false`). Because the sentinel sits outside `dir` and is keyed by `dir`'s basename, sibling restore targets (e.g., `.azusa/data/restored-*`, `.azusa/test-playwright/restored`) lock their own independent sentinels and never collide with the active database lock (`db.azusa-lock`), nor are they disturbed when `activeDbDir` is renamed during active promotion.
    - **Empty Lock Directory Invariant**: Keep `<sentinelPath>.lock/` strictly empty! `proper-lockfile` uses non-recursive `rmdir`/`rmdirSync` for unlock, stale takeover, and exit cleanup; writing any file inside `.lock/` causes `ENOTEMPTY`. Optional diagnostic metadata (`{ pid, processType, acquiredAt }`) may be written outside the lock directory to `<dir>.azusa-owner.json` and must never arbitrate ownership.
    - **Post-Acquisition Heartbeat Grace Wait**: Because `proper-lockfile` detects takeover races via heartbeat timestamp updates rather than process-ownership inspection APIs, **every** lock holder (`server`, `db:migrate`, `db:backup`, `db:restore`) MUST wait just over one heartbeat interval (`> 2000ms`, e.g., `2100ms`) after acquiring the lock to confirm that the heartbeat update cycle succeeds and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying the target database folder. If `onCompromised` fires during this wait, the lock holder aborts immediately without touching any database files.
    - **Graceful Lost-Lock Handling (`onCompromised`)**:
      - **Server**: Closes PGlite if open, sets `globalThis.__azusaDbState` to `{ status: 'error', errors: [{ stage: 'init', message: 'Database lock lost or compromised', recoveryHint: 'Restart server and verify no conflicting processes access AZUSA_DB_DIR' }] }`, and returns `503 Service Unavailable` on subsequent health/check requests instead of throwing an unhandled crash.
      - **CLI (`db:migrate`, `db:backup`, `db:restore`)**: Immediately aborts execution, cleans up any active temporary staging folders (`.tmp-*`, `.restore-tmp-*`), executes rollback of any active promotion underway (`db-replaced-<timestamp>` back to `activeDbDir`, removing journal), logs diagnostics to stderr, and exits with code `1`.
    - **Fail-Closed on Corrupted Lock State**: If `<sentinelPath>.lock` is malformed/unreadable or held by an active owner (`ELOCKED`), `acquireDbLock` fails closed immediately without touching `<dbDir>`.
  - **Once-Per-Process Singleton (`globalThis.__azusaDbState`)**:
    - Cache initialization promise and final state (`'healthy'` or `'error'`) on `globalThis.__azusaDbState` for the lifetime of the Node.js process (reused across Next.js HMR reloads). Export `resetDbStateForTesting()` strictly for test teardown.

---

## R5 — Deferred-Prune Atomic Backup-on-Start & Recoverable Active Restore Swap

- **Decision** *(carried forward from Pass 1–5 review per Clarification Q3)*:
  - **Backup-on-Start & Deferred Retention Pruning**:
    - At most one automatic `-startup` backup is attempted per process (`globalThis.__azusaDbState.startupBackupTaken`).
    - When `PG_VERSION` exists in `dbDir`, require `<dbDir>/.azusa-last-healthy.json` (written only after clean startup + migration, removed immediately before running pending migrations). If `.azusa-last-healthy.json` is absent, skip creating a redundant snapshot of the unverified directory and skip pruning so failed startups never evict good backups.
    - When both `PG_VERSION` and `.azusa-last-healthy.json` exist, copy `dbDir` into `<backupDir>/.tmp-<backupId>`, write `manifest.json` (`BackupManifestSchema`), and atomically rename `.tmp-<backupId>` to `<backupDir>/<backupId>`. Same-millisecond ties insert a zero-padded sequence number before the trigger suffix (`backup-<YYYYMMDD-HHmmss-fff>-01-startup`).
    - **Deferred Pruning**: Run `pruneCompletedStartupBackups(backupDir, 10)` **only after** PGlite mounts, all pending migrations succeed, and `.azusa-last-healthy.json` is written. `-manual` backups are never auto-pruned.
  - **Non-Mutating Manual CLI Backup (`npm run db:backup`)**:
    - Acquires exclusive lock on `AZUSA_DB_DIR` + waits `> 2000ms` (requiring server stopped), copies `AZUSA_DB_DIR` to `<backupDir>/.tmp-<backupId>`, verifies copied file sizes and SHA-256 digests against the quiescent source without opening PGlite in place on the backup folder, writes `manifest.json` (`trigger: "manual"`), renames `.tmp-<backupId>` to `<backupId>`, and releases the lock.
  - **Safe CLI Restore (`npm run db:restore`) & Recoverable Active Promotion**:
    - Canonicalizes `source` (`S`), `activeDbDir` (`A`), `backupRootDir` (`B`), and `target` (`T`) (case-insensitively on Windows, stripping trailing slashes).
    - Refuses before any file mutation if `T` overlaps `S` or `B`, if `T` strictly contains or sits inside `A`, if `T === A` without `--force-overwrite-active`, if `T === A` while `<A>` is locked, or if `T !== A` and `T` is an existing non-empty directory.
    - Locks `T`'s canonical sentinel (`<parent(T)>/<basename(T)>.azusa-lock`) and waits `> 2000ms` to confirm lock integrity.
    - Copies `S` (excluding `manifest.json`) to `<parent(T)>/.restore-tmp-<uuid>`, opens PGlite on `.restore-tmp-<uuid>`, validates `'foundation.init'` and all `app_metadata` columns/fields via Zod, writes `.azusa-last-healthy.json`, and closes PGlite.
    - For `T !== A`: atomically renames `.restore-tmp-<uuid>` to `T`.
    - For `--force-overwrite-active` (`T === A`, server stopped, lock held):
      1. Write `<parent(A)>/.azusa-promote-journal.json` (`{ replacedDir: '<parent(A)>/db-replaced-<timestamp>', stagingDir: '.restore-tmp-<uuid>', activeDbDir: '<A>', startedAt }`).
      2. Rename existing `<A>` to `<parent(A)>/db-replaced-<timestamp>`.
      3. Rename verified `.restore-tmp-<uuid>` to `<A>`.
      4. Open PGlite on `<A>`, confirm `SELECT count(*) FROM app_metadata` succeeds, and close PGlite.
      5. **Preserve `<parent(A)>/db-replaced-<timestamp>` intact on disk** for operator inspection/safety (documenting manual cleanup) and delete only `.azusa-promote-journal.json`.
      - **Rollback on Failure / `onCompromised`**: If Step 3/4 throws or the lock is lost, remove any partial `<A>`, rename `db-replaced-<timestamp>` back to `<A>`, delete `.azusa-promote-journal.json`, and exit `1`.
      - **Startup Recovery for Interrupted Promotion**: On startup (while holding the lock and after the `> 2000ms` wait, before startup backup), inspect `.azusa-promote-journal.json`: if `<A>` is missing `PG_VERSION` (or fails verification) and `db-replaced-<timestamp>` has `PG_VERSION`, roll back `db-replaced-<timestamp>` to `<A>` and remove the journal; if `<A>` is already healthy, remove only the leftover journal while preserving `db-replaced-<timestamp>`.

---

## R6 — Record Identity (UUIDv4) & Pre-Auth Local Actor Plumbing

- **Decision**:
  - Standardize on RFC 9562 / RFC 4122 UUIDv4 primary keys generated via `crypto.randomUUID()`.
  - Provide `auditColumns()` in `src/persistence/schema/common.ts` with `$defaultFn(() => crypto.randomUUID())` on `id`, UTC `created_at`/`updated_at` (`$onUpdate(() => new Date())`), and `created_by`/`updated_by` defaulting to `"local:sm"`.
  - Restrict `actor` overrides to internal TypeScript service/CLI options; reject `actor` or unknown keys on public HTTP `POST /api/health/check` via `.strict()` Zod schema.
  - Keep `local:sm` internal-only for audit records; do not expose `local:sm` in the profile dropdown UI (Clarification Q2).

---

## R7 — Complete 42-Icon Kumiko Component System (Handoff v2)

- **Decision**:
  - Extract all **42 SVG definitions** from `docs/handoffs/azusa-handoff-v2.zip` (`icons/icons.json` and `icons/svg/*.svg`) into `src/ui/icons/kumiko-icons.ts` and render **all 42 icons inside the same shared `<svg>` wrapper** as the supplied SVGs (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinejoin="miter"`, `strokeMiterlimit={10}`, `strokeLinecap="butt"`, size ramp `16`, `18`, `20`, `24`, `32`, `40` px):
    - **35 `currentColor` Line Icons**: Inherit `currentColor` ink + `#E07F24` accent details, replacing `stroke="#FFFFFF"` on `delivery-flow`'s divider path with `stroke="var(--kumiko-surface, #FFFFFF)"` (`Deviation D1`).
    - **7 Fixed-Colour Glyphs**: `warning` (plan-check triangle) plus the 6 solid status/commitment badges (`flag-missed`, `flag-aging`, `flag-blocked`, `commit-committed`, `commit-stretch`, `commit-buffer`) inherit `fill="none"`, `strokeWidth={1.75}`, and mitre/butt geometry from the shared `<svg>` wrapper while preserving their fixed semantic colours via their own inner `<path>` attributes so `currentColor` never reaches them.
- **Rationale**: Required by `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §15 and Feature Brief v0.2 §3.3, AC02.

---

## R8 — Viewer-Local Today Widget, ISO-8601 Week & Timezone Formatting

- **Decision** *(carried forward per Clarification Q3)*:
  - Pure domain module `src/domain/calendar/iso-week.ts` computing:
    - Viewer-local date `YYYY/MM/DD` and ISO-8601 week/weekday `CWww.d` (`01`–`53`, `1`=Mon…`7`=Sun).
    - Legacy IANA alias normalization (`Asia/Calcutta` → `Asia/Kolkata`, `US/Central` → `America/Chicago`).
    - Deterministic timezone label resolution: fixed-offset lookup table (`Asia/Manila` → `'PHT'`, `Asia/Kolkata` → `'IST'`, `Asia/Tokyo` → `'JST'`, `Asia/Singapore` → `'SGT'`, `UTC`/`Etc/UTC`/`Etc/GMT` → `'UTC'`), all other valid zones via `Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })` replacing `'GMT'` with `'UTC'` (never `'GMT'`).
    - Invalid/missing timezone ID fallback: computes **both** the formatted clock time (`HHMMh`) and the timezone badge (`'UTC'`) in `UTC`.
  - `TodayWidget` reads the browser's IANA timezone on mount via `Intl.DateTimeFormat().resolvedOptions().timeZone` (catching errors and falling back to `'UTC'` only on failure/invalid zone) and passes it to `getTodayWidgetModel(now, browserTimeZone)` so local date, ISO week, and clock reflect the viewer's actual timezone.
  - Sticky single-row floating header at `1440px`, `1024px`, `768px` with `TodayWidget` absolutely centered (`position: absolute; left: 50%; transform: translateX(-50%)`); when expanded search (`280px`) would overlap `TodayWidget` below `1100px`, set `visibility: hidden` (`pointer-events: none`) on `TodayWidget` and restore `visibility: visible` on collapse.

---

## R9 — Disclosure Navigation, Profile Dropdown & Strictly Isolated Playwright Environment

- **Decision**:
  - **Primary Navigation**: Disclosure pattern (`<nav aria-label="Primary navigation">` with `aria-expanded`/`aria-controls` on the logo button and `<a aria-current="page">` links across the 9 destinations in 4 groups: `PI`, `Capacity`, `Sprint`, `Insights`).
  - **Profile Dropdown (`src/ui/shell/ProfileMenu.tsx`)**: `40px` `"SM"` button (`aria-label="Account menu"`, `aria-expanded`, `aria-controls="azusa-profile-menu"`) toggling a `250px` white dropdown showing `"Scrum Master"`, `"No ART or team configured"`, and a disabled non-navigating `Settings` placeholder (`aria-disabled="true"`). Mutually exclusive with `NavigationMenu` (opening one closes the other; `Escape` closes and returns focus).
  - **Isolated Playwright Harness**:
    - Dedicated port `3100` (`http://127.0.0.1:3100`), `reuseExistingServer: false`, `AZUSA_NEXT_DIST_DIR: '.next-playwright'`, `AZUSA_DB_DIR: '.azusa/test-playwright/db'`, `AZUSA_BACKUP_DIR: '.azusa/test-playwright/backups'`, `AZUSA_ALLOW_TEST_FAULT_INJECTION: '1'`, `NEXT_TELEMETRY_DISABLED: '1'`.
    - Pre-server bootstrap script (`scripts/test/start-playwright-server.ts`) resets `.azusa/test-playwright/`, seeds and closes `'foundation.init'` + `.azusa-last-healthy.json`, and then spawns `next dev --hostname 127.0.0.1 --port 3100` so the server boots with a real `backup-*-startup` snapshot (`backupCount: 1`) for US4 E2E verification.
