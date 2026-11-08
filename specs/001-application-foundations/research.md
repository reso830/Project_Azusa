# Phase 0 Research: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-08  
**Spec**: [spec.md](./spec.md)

This document consolidates the technical research and architectural decisions for Feature 001 (`Application Foundation`). All ambiguities from the feature brief, prototype handoff, and pre-implementation reviews (`C1`–`C14`, `M1`–`M3`, `m1`–`m6`) have been resolved prior to implementation.

---

## R1 — Application Framework, Local Loopback Binding & Strict TypeScript Boundary

- **Decision**: Use a single Next.js (App Router) application on Node.js 20+ LTS with TypeScript configured in strict mode (`strict: true`, `noUncheckedIndexedAccess: true`), bound to `127.0.0.1` by default (`next dev --hostname 127.0.0.1`, `next start --hostname 127.0.0.1`) with `NEXT_TELEMETRY_DISABLED=1` and configurable `distDir: process.env.AZUSA_NEXT_DIST_DIR || '.next'`, organized into explicit layers under `src/`:
  - `src/app/` and `src/ui/` (Presentation layer: routes, shell, design system components, icons)
  - `src/domain/` and `src/application/` (Domain and application services: pure ISO-8601 calendar/clock logic, actor resolution, Zod schemas, foundation health orchestration)
  - `src/persistence/` (Persistence and infrastructure layer: `proper-lockfile` cross-process lock manager, PGlite client singleton, Drizzle ORM schema and migrations, atomic startup backup and safe restore managers)
- **Rationale**: Mandated by `docs/features/001-application-foundations.md` (§2.1), `AZUSA_HANDOFF.md` (§16), and Constitution Principle IV. Binding to `127.0.0.1` prevents LAN exposure of local diagnostic write endpoints, and configurable `distDir` allows Playwright to build/run in `.next-playwright` on port `3100` without colliding with an active developer `next dev` session (`m3`).

---

## R2 — Styling Foundation & Azusa Design Tokens

- **Decision**: Configure Tailwind CSS alongside semantic CSS custom properties in `src/app/globals.css` that encode the exact Azusa color, surface, typography, border, and shadow tokens from `AZUSA_HANDOFF.md` (§14.2–§14.4) and `prototype/Main.dc.html`. Category, workflow state, and feature pastel colors are defined as default palette tokens (since work categories become configurable per Train in `F004`).
- **Rationale**: Confirmed in Planning Clarification PC2 (2026-11-08). `AZUSA_HANDOFF.md` (§16) selects `shadcn/ui` charts for `F019` (`Reporting Foundation`), which relies on Tailwind CSS and CSS variables.

---

## R3 — Local Typography Bundling (`@fontsource`)

- **Decision**: Bundle **Zen Kaku Gothic New** (`500`, `700`), **IBM Plex Sans** (`400`, `500`, `600`, `700`), and **IBM Plex Mono** (`500`, `600`) locally via `@fontsource/zen-kaku-gothic-new`, `@fontsource/ibm-plex-sans`, and `@fontsource/ibm-plex-mono`, imported in `src/app/layout.tsx` and bound to `--font-heading`, `--font-sans`, and `--font-mono`.
- **Rationale**: Required by `docs/features/001-application-foundations.md` (§2.3), `AZUSA_HANDOFF.md` (§14.3), and Constitution Principle IV (no external runtime calls).

---

## R4 — PGlite + Drizzle ORM Persistence, Race-Safe Cross-Process Lock (`proper-lockfile`) & Once-Per-Process Singleton

- **Decision**:
  - Use `@electric-sql/pglite` with `drizzle-orm/pglite` and `drizzle-kit` for SQL migration generation and execution.
  - Configure `next.config.ts` with `serverExternalPackages: ['@electric-sql/pglite']` so Node.js resolves PGlite's native `.wasm` and `.data` bundle files directly from `node_modules`.
  - Store the active database in `process.env.AZUSA_DB_DIR ?? '.azusa/data/db'`.
  - **Race-Safe Cross-Process Exclusive Lock (`proper-lockfile` — `M2`, `L1`, `L2`, `L3`)**:
    - Use `proper-lockfile` (`^4.1.2`, MIT) in `src/persistence/lock.ts` to acquire an exclusive lock using a per-directory canonical sentinel file: `path.resolve(path.dirname(dir), `${path.basename(dir)}.azusa-lock`)` (`retries: 0, stale: 10000, update: 2000, realpath: false`). Because the sentinel sits outside `dir` in its parent directory and is keyed by `dir`'s basename, sibling restore targets (e.g. `.azusa/data/restored-*` or `.azusa/test-playwright/restored`) have distinct lock files from the active database (`db.azusa-lock`), eliminating `ELOCKED` collisions (`L3`).
    - **Empty Lock Directory Invariant (`L1`)**: Keep the library-owned `.lock` directory strictly empty! `proper-lockfile` relies on non-recursive `rmdir`/`rmdirSync` for normal unlock, stale-lock reclamation, and process exit handlers. Never write `owner.json` inside `<sentinelPath>.lock/`. Optional diagnostic metadata (such as `{ pid, processType, acquiredAt }`) may be written outside the lock directory to `<dir>.azusa-owner.json`, and must never be used to arbitrate ownership.
    - **Graceful Lost-Lock Handling (`onCompromised` — `L2`, `F3`)**: Configure `proper-lockfile` with a custom `onCompromised: (err) => { ... }` callback. In the Next.js server, the callback logs structured error diagnostics, closes PGlite, sets `globalThis.__azusaDbState` to `{ status: 'error', errors: [{ stage: 'init', message: 'Database lock lost or compromised', recoveryHint: 'Restart server and verify no conflicting processes access AZUSA_DB_DIR' }] }`, and returns `503 Service Unavailable` instead of crashing Next.js ungracefully (`L2`). In CLI scripts (`db:migrate`, `db:backup`, `db:restore`), the `onCompromised` callback aborts execution immediately, cleans up temporary staging directories (`.tmp-*`, `.restore-tmp-*`), triggers rollback of any active promotion underway (`db-replaced-<timestamp>` back to `activeDbDir`), logs to stderr, and exits with code `1` (`F3`).
    - **Post-Acquisition Heartbeat Grace Verification (`F3`, `G1`)**: Because `proper-lockfile` relies on heartbeat timestamp updates rather than process-ownership inspection APIs to detect contention, every lock holder (the Next.js server, `db:migrate`, `db:backup`, and `db:restore`) MUST wait just over one heartbeat interval (> 2000ms, e.g. 2100ms) after lock acquisition to confirm that the update heartbeat completes and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying the target database folder (`G1`). If `onCompromised` fires during this wait, the lock holder aborts immediately without touching any database files.
    - **Fail-Closed on Corrupted Lock State**: If the lock target or `<sentinelPath>.lock` is malformed/unreadable or held by an active owner (`ELOCKED`), `acquireDbLock` fails closed immediately without touching `<dbDir>`.
  - **Once-Per-Process Singleton (`globalThis.__azusaDbState` — `M1`)**:
    - Cache the initialization promise and final state (whether `'healthy'` or `'error'`) on `globalThis.__azusaDbState` for the lifetime of the Node.js process.
    - If startup fails (`stage: 'init' | 'backup' | 'migration'`), the lock is released and the error state is cached in memory so subsequent HTTP requests in the same server process immediately return the `503` / `role="alert"` diagnostic without re-running startup backups on every page load (`M1`). An explicit `resetDbStateForTesting()` helper is exported only for unit/integration test teardown.
- **Rationale**: Resolves `C1`, `M1`, and `M2`.

---

## R5 — Deferred-Prune Atomic Backup-on-Start & Recoverable Active Restore Swap

- **Decision**:
  - **Backup-on-Start & Deferred Retention Pruning (`M1`)**:
    - At most one automatic `-startup` backup is attempted per process (`globalThis.__azusaDbState.startupBackupTaken`).
    - Before taking a startup backup when `PG_VERSION` exists in `dbDir`, check that `<dbDir>/.azusa-last-healthy.json` is present (written only after a clean startup + migration completes, and removed immediately before running pending migrations). If `.azusa-last-healthy.json` is absent (indicating the previous startup or migration failed and left `dbDir` unverified/corrupted), skip creating a new `-startup` snapshot of the unverified directory and do not prune existing backups (`M1`).
    - When `PG_VERSION` and `.azusa-last-healthy.json` exist, copy `dbDir` into `<backupDir>/.tmp-<backupId>`, write `manifest.json` (`BackupManifestSchema`), and atomically rename `.tmp-<backupId>` to `<backupDir>/<backupId>`. Same-millisecond tie-breakers insert a zero-padded sequence number before the trigger suffix: `backup-<YYYYMMDD-HHmmss-fff>-01-startup` (`INFO`).
    - **Deferred Pruning**: Run `pruneCompletedStartupBackups(backupDir, 10)` **only after** PGlite mounts, all pending migrations succeed, and `.azusa-last-healthy.json` is written. If mount or migration fails, zero existing backups are pruned (`M1`).
  - **Manual CLI Backup (`npm run db:backup` — `m1`)**:
    - Acquires the exclusive database lock on `AZUSA_DB_DIR` (requiring the server to be stopped), copies `AZUSA_DB_DIR` into `<backupDir>/.tmp-<backupId>`, verifies copied file sizes and SHA-256 digests against the quiescent source plus `manifest.json` validity (without opening PGlite in place on the backup folder so the snapshot is never mutated per `m1`), renames `.tmp-<backupId>` to `<backupId>`, and releases the lock.
  - **Safe CLI Restore (`npm run db:restore`) & Recoverable Active Promotion (`C2`, `M3`)**:
    - Canonicalizes `source` (`S`), `activeDbDir` (`A`), `backupRootDir` (`B`), and `target` (`T`) paths (lowercased on Windows, trailing separators stripped).
    - Refuses before mutating any files if `T` overlaps `S` or `B`, if `T` strictly contains or sits inside `A`, if `T === A` without `--force-overwrite-active`, if `T === A` with `--force-overwrite-active` while `<A>` is locked, or if `T !== A` and `T` is an existing non-empty directory.
    - Copies `S` (excluding `manifest.json`) into `<parent(T)>/.restore-tmp-<uuid>`, opens PGlite on `.restore-tmp-<uuid>`, verifies `'foundation.init'` and all rows/columns in `app_metadata` via Zod, writes `.azusa-last-healthy.json`, and closes PGlite.
    - For a non-active target (`T !== A`), atomically renames `.restore-tmp-<uuid>` to `T`.
    - **For `--force-overwrite-active` (`T === A`, server stopped, exclusive lock held — `M3`)**:
      1. Write promotion journal `<parent(A)>/.azusa-promote-journal.json` (`{ replacedDir: '<parent(A)>/db-replaced-<timestamp>', stagingDir: '.restore-tmp-<uuid>', activeDbDir: '<A>', startedAt }`).
      2. Rename existing `<A>` to `<parent(A)>/db-replaced-<timestamp>`.
      3. Rename verified `.restore-tmp-<uuid>` to `<A>`.
      4. Open PGlite on `<A>`, confirm `app_metadata` query succeeds, and close PGlite.
      5. Preserve `<parent(A)>/db-replaced-<timestamp>` intact on disk for safety/inspection (documenting operator retention/cleanup), and delete `.azusa-promote-journal.json` (`L4`).
      - **Automatic Rollback on Step 3/4 Failure**: If Step 3 or Step 4 throws, remove any partial `<A>`, rename `db-replaced-<timestamp>` back to `<A>`, delete `.azusa-promote-journal.json`, and rethrow so the original active database is restored intact.
      - **Startup Recovery for Interrupted Promotion**: On startup (`ensureDatabaseInitialized`), while holding the exclusive lock and before running the startup backup check, inspect `.azusa-promote-journal.json`: if `<A>` is missing `PG_VERSION` (or fails verification) and `db-replaced-<timestamp>` exists with `PG_VERSION`, automatically roll back `db-replaced-<timestamp>` to `<A>` and remove the journal; if `<A>` is already valid and healthy, remove the leftover journal while preserving `db-replaced-<timestamp>`.
- **Rationale**: Resolves `M1`, `M2`, `M3`, `m1`, `L1`, `L2`, `L3`, and `L4`.

---

## R6 — Record Identity (UUIDv4) & Pre-Auth Local Actor Plumbing

- **Decision**:
  - Standardize on **RFC 9562 / RFC 4122 UUIDv4** strings generated via Node's built-in `crypto.randomUUID()` for primary keys across persistence schemas (`C12`).
  - Provide `auditColumns()` in `src/persistence/schema/common.ts` with `$defaultFn(() => crypto.randomUUID())` on `id` and `$onUpdate(() => new Date())` on `updated_at`.
  - Restrict `actor` overrides to internal TypeScript service/CLI options; remove `actor` from the public `POST /api/health/check` HTTP request body schema (`C13`).

---

## R7 — Kumiko Line Icon System & `delivery-flow` Seam Resolution

- **Decision**:
  - Extract the 25 SVG path definitions from `icons/icons.json` and `icons/svg/*.svg` into `src/ui/icons/kumiko-icons.ts` and render them via `<KumikoIcon name={...} size={16 | 20 | 24 | 32} />`, replacing `stroke="#FFFFFF"` on the `delivery-flow` divider path (`M12 12L19.79 7.5`) with `stroke="var(--kumiko-surface, #FFFFFF)"`.

---

## R8 — Viewer-Local Today Widget, ISO-8601 Week & Timezone Formatting (`OD2` / `m5`)

- **Decision**:
  - Implement a pure, deterministic domain module `src/domain/calendar/iso-week.ts` that computes:
    - Local calendar date formatted as `YYYY/MM/DD`.
    - ISO-8601 week number (`01`–`53`) and ISO weekday (`1` = Monday … `7` = Sunday) formatted as `CWww.d`.
    - Legacy IANA timezone alias normalization (`Asia/Calcutta` → `Asia/Kolkata`, `US/Central` → `America/Chicago`) and invalid/missing timezone ID fallback (computing **both** clock time and timezone label in `'UTC'`, `L5`).
    - Deterministic timezone label resolution (`OD2`, `m5`):
      1. Map fixed-offset named IANA zones via lookup table: `Asia/Manila` → `'PHT'`, `Asia/Kolkata` → `'IST'`, `Asia/Tokyo` → `'JST'`, `Asia/Singapore` → `'SGT'`, `UTC` / `Etc/UTC` / `Etc/GMT` → `'UTC'`.
      2. Format all other valid IANA zones (including DST-observing zones such as `America/Chicago` and `Europe/London`) using `Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'shortOffset' })` and replace `'GMT'` with `'UTC'` (producing `'UTC-6'`, `'UTC-5'`, `'UTC+1'`, `'UTC+5:30'`, or `'UTC'` when offset is zero—never `'GMT'`).
    - 24-hour viewer-local clock formatting (`HHMMh ZONE`, e.g., `1930h PHT` or `0530h UTC-6`), where an invalid zone ID deterministically formats the exact UTC time (`timeZone: 'UTC'`) with zone `'UTC'` (`L5`).
  - Keep the prototype's single-row floating header at all widths (`1440px`, `1024px`, `768px`). When the search field is expanded (`280px`) below `1100px` where it would overlap the centered Today widget, set `visibility: hidden` on `TodayWidget` (keeping its layout space) and restore `visibility: visible` when search collapses (`OD4`).
- **Rationale**: Resolves `m5`, `m6`, and `L5` (`OD2`, `OD4`).

---

## R9 — Disclosure Navigation & Strictly Isolated Playwright Environment (`m2`, `m3`)

- **Decision**:
  - Implement flat top-level routes aligned with `docs/feature-roadmap.md` (`OD3`).
  - Use the **Disclosure navigation pattern** (`<nav aria-label="Primary navigation">` with `aria-expanded`/`aria-controls` on the logo button and `<a aria-current="page">` links) (`OD1`).
  - Isolate Playwright runs (`C5`, `m2`, `m3`) by:
    - Binding Playwright's `webServer` to dedicated port `3100` (`http://127.0.0.1:3100`), pinning `reuseExistingServer: false`, and setting `AZUSA_NEXT_DIST_DIR: '.next-playwright'`, `AZUSA_DB_DIR: '.azusa/test-playwright/db'`, `AZUSA_BACKUP_DIR: '.azusa/test-playwright/backups'`, `AZUSA_ALLOW_TEST_FAULT_INJECTION: '1'`, and `NEXT_TELEMETRY_DISABLED: '1'`.
    - Running a pre-server bootstrap script (`scripts/test/start-playwright-server.ts`) that resets `.azusa/test-playwright/`, initializes and closes a seeded database (`'foundation.init'` + `.azusa-last-healthy.json`) *before* spawning `next dev --hostname 127.0.0.1 --port 3100`, so when the Next.js server boots it takes a real `backup-*-startup` snapshot (`backupCount: 1`) that the US4 browser test (`T028`) can inspect and restore deterministically!
- **Rationale**: Resolves `m2` and `m3`.
