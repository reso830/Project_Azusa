# Tasks: Application Foundation (F001 — v0.2)

**Branch**: `001-application-foundations` | **Date**: 2026-11-20 (Regenerated against Feature Brief v0.2, Handoff v2, Data Model v0.6, and Roadmap v0.2)  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/api.md](./contracts/api.md)

## Conventions

- **Status legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel marker**: `[P]` indicates tasks touching distinct files with no shared edits that can run in parallel within the same phase
- **Phase dependencies**: `01 → 02 → 03 → 04 → 05 → 06 → 07 → 08` (every phase leaves the test suite and linter green)
- **Verification commands**: `npm run test:run` · `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run build` · `npm run test:visual` · `npm run test:e2e`

## Phase Summary

| Phase | Focus | Task IDs | User Stories |
|---|---|---|---|
| **Phase 01** | Project Setup, Tooling & Brand Assets | `T001–T004` | `US1, US5` |
| **Phase 02** | Foundational Domain Modules, Schemas & Visual Harness | `T005–T008` | `US1, US2, US3, US4, US5` |
| **Phase 03** | Local PGlite Persistence, Race-Safe Lock, Migrations & Health API | `T009–T013` | `US3` |
| **Phase 04** | Deferred-Prune Backup-on-Start, Safe CLI Restore & Active Promotion | `T014–T016` | `US4, US5` |
| **Phase 05** | Application Shell, 42 Kumiko Icons, Today Widget, 9 Routes, Profile Menu & Tier-1 Visual Suite | `T017–T027` | `US1, US2, US3` |
| **Phase 06** | End-to-End Browser Smoke & `@axe-core/playwright` Accessibility Suite | `T028` | `US1, US2, US3, US4, US5` |
| **Phase 07** | Release Prep (Version Sync & Living Documentation — Data Model v0.6 / Roadmap v0.2) | `T029–T035` | `US5` |
| **Phase 08** | Browser Smoke Test & Post-UAT Roadmap Acceptance | `T036–T040` | `US1, US2, US3, US4, US5` |

---

## Phase 01: Project Setup, Tooling & Brand Assets

**Purpose**: Initialize the single strict-TypeScript Next.js 15 (App Router) project bound to `127.0.0.1`, configure linting/formatting/Tailwind/font tokens, configure Vitest (`passWithNoTests: true`) and Drizzle Kit, and install the supplied Azusa logo assets so `npm run test:run` and `npm run lint` exit `0` from Phase 01 onward.

- [ ] **T001** `[US5]` Initialize Next.js, React, strict TypeScript, and package scripts
  - **Target files/components**: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`
  - **Expected behavior**:
    - Define `package.json` (`name: "azusa"`, `version: "0.1.0"`, `private: true`) with dependencies (`next`, `react`, `react-dom`, `@electric-sql/pglite`, `drizzle-orm`, `proper-lockfile`, `zod`, `@fontsource/zen-kaku-gothic-new`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) and devDependencies (`typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/proper-lockfile`, `drizzle-kit`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `eslint-config-next`, `prettier`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`).
    - Define scripts: `dev` (`next dev --hostname 127.0.0.1`), `build` (`next build`), `start` (`next start --hostname 127.0.0.1`), `lint`, `format:check`, `typecheck` (`tsc --noEmit`), `test:run` (`vitest run`), `test:visual` (`playwright test --project=visual`), `test:e2e` (`playwright test --project=e2e`), `db:migrate` (`tsx scripts/db/migrate.ts`), `db:backup` (`tsx scripts/db/backup.ts`), `db:restore` (`tsx scripts/db/restore.ts`).
    - Configure `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, and `@/*` → `./src/*`.
    - Configure `next.config.ts` with `serverExternalPackages: ['@electric-sql/pglite']`, `distDir: process.env.AZUSA_NEXT_DIST_DIR || '.next'`, and `process.env.NEXT_TELEMETRY_DISABLED = '1'`.
    - Update `.gitignore` to ignore `node_modules/`, `.next/`, `.next-playwright/`, `.azusa/`, `coverage/`, `playwright-report/`, and `test-results/`.
  - **Constraints**: 100% local packages; bind server scripts to `127.0.0.1`; no cloud SDKs or external telemetry.
  - **Validation/test location**: `npm install` and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components, database schema files, and `docs/`.

- [ ] **T002** `[P]` `[US1, US5]` Configure ESLint, Prettier, PostCSS/Tailwind CSS, Handoff v2 design tokens, and local `@fontsource` imports
  - **Target files/components**: `eslint.config.mjs`, `.prettierrc`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
  - **Expected behavior**:
    - Configure ESLint and Prettier for Next.js + strict TypeScript; configure `postcss.config.mjs` with `@tailwindcss/postcss`.
    - In `src/app/globals.css`, define CSS custom properties for all Azusa v2 design tokens (`AZUSA_HANDOFF.md` §14.2–§14.3 and `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §14): page `#F4F1EC`, surface `#FFFFFF`, ink `#1A1B22`, brand orange `#E07F24`, orange text `#A65307`, clock orange `#C2650E`, muted `#67635C`, secondary `#3F3C37`, active tint `#FCEFE2`, carry-over tint `#FBF1DF`, milestone red `#FF0000`, hairlines (`#E7E2DA`, `#EFEAE3`, `#F3EFE9`), asanoha stroke `#E2D9CC`, severity swatches (`#D9443A`, `#E8890C`, `#E9C46A`, `#A9ACB4`), default category/workflow/pastel tokens, and `:focus-visible` outline rules (`2px solid #E07F24`, `border: 0` at rest).
    - In `src/app/layout.tsx`, import `@fontsource/zen-kaku-gothic-new/{500,700}.css`, `@fontsource/ibm-plex-sans/{400,500,600,700}.css`, and `@fontsource/ibm-plex-mono/{500,600}.css`; add minimal `src/app/page.tsx` bootstrap so `lint` and `build` succeed.
  - **Constraints**: Zero external Google Fonts requests (`Deviation D2`).
  - **Validation/test location**: `npm run lint`, `npm run format:check`, and `npm run typecheck`.
  - **Out-of-scope files/components**: `src/persistence/`, `src/domain/`.

- [ ] **T003** `[P]` `[US5]` Configure Vitest (`passWithNoTests: true`) and Drizzle Kit
  - **Target files/components**: `vitest.config.ts`, `drizzle.config.ts`
  - **Expected behavior**:
    - Configure `vitest.config.ts` with `@/*` path resolution, `node` environment, `passWithNoTests: true`, and inclusion of `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`.
    - Configure `drizzle.config.ts` with `schema: './src/persistence/schema/index.ts'`, `out: './src/persistence/migrations'`, and `dialect: 'postgresql'`.
  - **Constraints**: Keep Vitest suites separate from Playwright (`tests/visual/`, `tests/e2e/`).
  - **Validation/test location**: `npm run test:run` and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: `playwright.config.ts` (handled in `T008`).

- [ ] **T004** `[P]` `[US1]` Copy supplied Azusa logo assets from Handoff v2 into `public/assets/`
  - **Target files/components**: `public/assets/azusa-logo.png`, `public/assets/azusa-logo-256.png`
  - **Expected behavior**: Extract `azusa-handoff/assets/azusa-logo.png` and `azusa-handoff/assets/azusa-logo-256.png` from `docs/handoffs/azusa-handoff-v2.zip` into `public/assets/` byte-for-byte without modification.
  - **Constraints**: Use only supplied brand assets.
  - **Validation/test location**: Verify files exist at `public/assets/azusa-logo*.png`; `npm run test:run` and `npm run lint` exit `0`.
  - **Out-of-scope files/components**: SVG icons (handled in `T017`).

---

## Phase 02: Foundational Domain Modules, Schemas & Visual Harness

**Purpose**: Implement pure TypeScript domain modules (`actor.ts`, `iso-week.ts`, `schemas.ts`) with full unit test coverage (Constitution Principle V) and stand up the isolated Playwright configuration (`port 3100`, `reuseExistingServer: false`) and reusable `npm run test:visual` Tier-1 harness.

- [ ] **T005** `[P]` `[US3]` Implement pre-authentication local actor domain module and unit tests
  - **Target files/components**: `src/domain/audit/actor.ts`, `tests/unit/actor.test.ts`
  - **Expected behavior**:
    - Export `DEFAULT_LOCAL_ACTOR = 'local:sm'` and `resolveActor(explicitActor?: string | null, envActor?: string | null): string` returning trimmed `explicitActor`, else trimmed `envActor ?? process.env.AZUSA_ACTOR_ID`, else `'local:sm'`.
    - Unit tests covering default `'local:sm'`, whitespace-only fallback, env override, and explicit internal override precedence.
  - **Constraints**: Pure TypeScript; zero I/O or framework imports.
  - **Validation/test location**: `tests/unit/actor.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: `src/persistence/`, auth libraries.

- [ ] **T006** `[P]` `[US2]` Implement pure ISO-8601 calendar week, local date, timezone formatting, and viewer clock module with unit tests
  - **Target files/components**: `src/domain/calendar/iso-week.ts`, `tests/unit/iso-week.test.ts`
  - **Expected behavior**:
    - Export `normalizeTimeZone(tz?: string | null): string` mapping legacy aliases (`Asia/Calcutta` → `Asia/Kolkata`, `US/Central` → `America/Chicago`) and validating via `Intl.DateTimeFormat`, falling back deterministically to `'UTC'` on null/empty/invalid IDs.
    - Export `formatLocalDate(date: Date, timeZone?: string): string` (`YYYY/MM/DD`) and `computeIsoCalendarWeek(year, month, day)` (`CWww.d`, `01`–`53`, `1`=Mon…`7`=Sun).
    - Export `resolveTimeZoneAbbreviation(date: Date, timeZone?: string): string`: fixed-offset lookup (`Asia/Manila` → `'PHT'`, `Asia/Kolkata` → `'IST'`, `Asia/Tokyo` → `'JST'`, `Asia/Singapore` → `'SGT'`, `UTC`/`Etc/UTC`/`Etc/GMT` → `'UTC'`); all other valid zones via `Intl` `shortOffset` replacing `'GMT'` with `'UTC'` (never `'GMT'`).
    - Export `formatViewerClock(date: Date, timeZone?: string): { time: string; zone: string }` formatting `HHMMh` (`hourCycle: 'h23'`) and zone badge, ensuring that if `timeZone` is invalid or missing, **both** the clock time and the zone badge are computed in `UTC`.
    - Export `getTodayWidgetModel(date: Date, timeZone?: string)` returning `{ dateText, cwText, piSprintText: 'No active PI · No active Sprint', clockTime, clockZone }`.
    - Unit tests covering ISO week year boundaries (`2026-11-08` Sun → `CW45.7`, `2026-12-31` → `CW53.4`, `2027-01-01` → `CW53.5`, `2027-01-04` → `CW01.1`, leap day `2028-02-29`), legacy aliases, lookup table, `Europe/London` winter (`'UTC'`) & summer (`'UTC+1'`, never `'GMT'`), half-hour/quarter-hour zones (`Asia/Kathmandu` → `'UTC+5:45'`), and invalid/empty timezone IDs asserting **both** formatted time and zone badge match exact UTC time and `'UTC'`.
  - **Constraints**: Pure TypeScript; no external date libraries; never output `'GMT'`.
  - **Validation/test location**: `tests/unit/iso-week.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: React components (`TodayWidget.tsx` is built in `T021`).

- [ ] **T007** `[P]` `[US3, US4]` Implement strict Zod validation schemas for metadata, health responses, diagnostic requests, and backup manifests with unit tests
  - **Target files/components**: `src/domain/health/schemas.ts`, `tests/unit/schemas.test.ts`
  - **Expected behavior**:
    - Export `AppMetadataValueSchema`, `DiagnosticCheckRequestSchema` (`z.object({ note: z.string().trim().min(1).max(280).optional().default('Manual diagnostic check') }).strict()`, rejecting `actor` or any unknown keys), `BackupManifestSchema`, `HealthErrorItemSchema`, and `HealthResponseSchema` (`status: z.enum(['healthy', 'error'])`) matching `contracts/api.md` and `data-model.md`.
    - Unit tests covering valid payloads, default values, boundary lengths (`0`, `280`, `281`), strict rejection of `actor`/unknown keys, invalid UUID/timestamp rejection, and error stage validation.
  - **Constraints**: Pure TypeScript + `zod` only.
  - **Validation/test location**: `tests/unit/schemas.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: Route handlers and Drizzle tables.

- [ ] **T008** `[US1, US5]` Stand up strictly isolated Playwright configuration (`playwright.config.ts`), install Chromium, and create reusable Tier-1 visual-fidelity helpers
  - **Target files/components**: `playwright.config.ts`, `tests/visual/shell-fidelity.spec.ts`
  - **Expected behavior**:
    - Run `npx playwright install chromium`.
    - Configure `playwright.config.ts` with `visual` (`./tests/visual`) and `e2e` (`./tests/e2e`) projects, `baseURL: 'http://127.0.0.1:3100'`, `timezoneId: 'Asia/Manila'`, `locale: 'en-US'`, `webServer: { command: 'npx tsx scripts/test/start-playwright-server.ts', url: 'http://127.0.0.1:3100', reuseExistingServer: false, env: { PORT: '3100', AZUSA_NEXT_DIST_DIR: '.next-playwright', AZUSA_DB_DIR: '.azusa/test-playwright/db', AZUSA_BACKUP_DIR: '.azusa/test-playwright/backups', AZUSA_ALLOW_TEST_FAULT_INJECTION: '1', NEXT_TELEMETRY_DISABLED: '1' } }`.
    - Create reusable Tier-1 geometry, non-overlap, RGB/hex, font-family, and frozen clock (`2026-11-08T11:30:00.000Z`) helpers in `tests/visual/shell-fidelity.spec.ts`.
  - **Constraints**: Never touch `.azusa/data/` or `.next/`.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck`.
  - **Out-of-scope files/components**: `scripts/test/start-playwright-server.ts` (`T015`) and full shell assertions (`T027`).

---

## Phase 03: Local PGlite Persistence, Race-Safe Lock, Migrations & Health API

**Purpose**: Implement `auditColumns()` + `app_metadata`, the race-safe `proper-lockfile` lock manager (`<parent(dir)>/<basename(dir)>.azusa-lock`, empty `.lock/` dir, `> 2000ms` heartbeat grace wait across every lock holder, server/CLI `onCompromised` handlers), configurable Drizzle migrations, once-per-process PGlite singleton, `db:migrate` CLI, and `/api/health` + `/api/health/check` endpoints.

- [ ] **T009** `[US3]` Create reusable `auditColumns()` helper (UUIDv4 + `$onUpdate`), `app_metadata` Drizzle schema, and initial SQL migration
  - **Target files/components**: `src/persistence/schema/common.ts`, `src/persistence/schema/app-metadata.ts`, `src/persistence/schema/index.ts`, `src/persistence/migrations/0000_foundation_init.sql`, `src/persistence/migrations/meta/_journal.json`
  - **Expected behavior**:
    - Export `auditColumns()` (`id` UUIDv4 via `crypto.randomUUID()`, UTC `created_at` and `$onUpdate(() => new Date())` `updated_at`, `created_by`/`updated_by` defaulting to `'local:sm'`).
    - Define `appMetadata` (`app_metadata`: `key` unique text, `value` jsonb, `...auditColumns()`) and committed SQL migration `0000_foundation_init.sql` + `meta/_journal.json`.
  - **Constraints**: Zero business-domain tables in F001.
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts` and `tests/integration/migration-upgrade.test.ts`.
  - **Out-of-scope files/components**: Domain tables (`F002`–`F019`).

- [ ] **T010** `[US3]` Implement race-safe cross-process lock manager (`lock.ts`), configurable Drizzle migration runner (`migrate.ts`), once-per-process PGlite singleton (`client.ts`), and `db:migrate` CLI
  - **Target files/components**: `src/persistence/lock.ts`, `src/persistence/migrate.ts`, `src/persistence/client.ts`, `scripts/db/migrate.ts`
  - **Expected behavior**:
    - In `src/persistence/lock.ts`, implement `acquireDbLock(dir, processType, options?)` using `proper-lockfile` (`realpath: false, retries: 0, stale: options?.staleMs ?? 10000, update: 2000, onCompromised`) on per-directory canonical sentinel `path.resolve(path.dirname(dir), `${path.basename(dir)}.azusa-lock`)`. Keep `<sentinelPath>.lock/` strictly empty so `rmdir`/`rmdirSync` unlock, stale takeover, and exit cleanup succeed without `ENOTEMPTY`; optional non-authoritative diagnostics `{ pid, processType, acquiredAt }` may be written outside to `${dir}.azusa-owner.json`. Implement `onCompromised` for server (close PGlite, set `__azusaDbState` to `status: 'error'`, `stage: 'init'`, serve `503`) and for CLI (abort immediately, clean up `.tmp-*`/`.restore-tmp-*`, roll back active promotion if underway, log to stderr, exit `1`). **After acquiring the lock, every lock holder (`server`, `db:migrate`, `db:backup`, `db:restore`) waits `> 2000ms` (just over one `2000ms` heartbeat interval, e.g., `2100ms`) to confirm the heartbeat succeeded and `onCompromised` has not fired before opening PGlite or reading, copying, or modifying the database folder.** Fail closed (`ELOCKED`) on live locks or malformed lock artifacts.
    - In `src/persistence/migrate.ts`, accept `{ db, client, dbDir, migrationsFolder?, actor? }`, remove `.azusa-last-healthy.json` before migrating, apply pending SQL migrations, seed `'foundation.init'`, and write `.azusa-last-healthy.json` on success.
    - In `src/persistence/client.ts`, manage once-per-process `globalThis.__azusaDbState` caching both `'healthy'` and `'error'` outcomes, validate `PG_VERSION` format so corrupt clusters fail at `stage: 'init'`, and expose `getDbContext()`, `closeDbContext()`, and `resetDbStateForTesting()`.
    - In `scripts/db/migrate.ts`, implement `npm run db:migrate` acquiring lock + `> 2000ms` wait, handling `onCompromised`, running migrations, and releasing lock before exit.
  - **Constraints**: Never write inside `<sentinelPath>.lock/`; never open PGlite before the `> 2000ms` grace wait completes.
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts`, `tests/integration/migration-upgrade.test.ts`, `tests/integration/backup-restore.test.ts`.
  - **Out-of-scope files/components**: UI components.

- [ ] **T011** `[US3]` Implement foundation health and diagnostic check application service
  - **Target files/components**: `src/application/health/health-service.ts`
  - **Expected behavior**:
    - Export `getFoundationHealth(options?)` returning Zod-validated `HealthResponse` (honoring `simulatedErrorStage` only when `AZUSA_ALLOW_TEST_FAULT_INJECTION === '1'` and `NODE_ENV !== 'production'`).
    - Export `recordDiagnosticCheck(input, options?)` validating via strict `DiagnosticCheckRequestSchema`, resolving actor via `resolveActor(options?.actor)`, upserting `'diagnostic.last_check'` (UUIDv4, `$onUpdate`, incremented `checkCount`), and returning `{ ok: true, record, health }` or `{ ok: false, statusCode: 503, error, stage, recoveryHint }`.
  - **Constraints**: Never swallow init/lock/backup/migration/query errors.
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts`.
  - **Out-of-scope files/components**: React components.

- [ ] **T012** `[US3]` Implement `GET /api/health` and `POST /api/health/check` JSON Route Handlers
  - **Target files/components**: `src/app/api/health/route.ts`, `src/app/api/health/check/route.ts`
  - **Expected behavior**:
    - `GET /api/health`: Calls `getFoundationHealth()` (forwarding `x-azusa-test-simulate-error` when fault injection enabled), returns `200` (`healthy`) or `503` (`error`) with `Cache-Control: no-store`.
    - `POST /api/health/check`: Validates JSON via strict `DiagnosticCheckRequestSchema` (`400` on invalid/unknown keys including `actor`), calls `recordDiagnosticCheck()`, returns `201` (or `503`/`500` on error) per `contracts/api.md`.
  - **Constraints**: Validate both requests and responses with Zod schemas.
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts` and `tests/e2e/foundation-smoke.spec.ts`.
  - **Out-of-scope files/components**: UI shell files.

- [ ] **T013** `[US3]` Add integration tests for PGlite restart durability (`AC07`), real `init`-stage failure, and configurable-folder migration safety
  - **Target files/components**: `tests/integration/persistence-restart.test.ts`, `tests/integration/migration-upgrade.test.ts`
  - **Expected behavior**:
    - `persistence-restart.test.ts`: Verifies diagnostic record survives full `closeDbContext()` + reopen with intact UUIDv4, timestamps, `"local:sm"`, and `$onUpdate` advancement on second check; verifies real `init`-stage failure on corrupted cluster (`PG_VERSION` / `global/pg_control`) surfaces `status: 'error'`, `stage: 'init'`, and non-empty `recoveryHint`.
    - `migration-upgrade.test.ts`: Uses isolated temp `migrationsFolder` verifying fresh init + `.azusa-last-healthy.json`, incremental migration preserving 100% of existing records (`SC-003`), and invalid SQL migration surfacing `stage: 'migration'` with `.azusa-last-healthy.json` absent.
  - **Constraints**: Clean up temp directories on teardown; never write test migrations into `src/persistence/migrations/`.
  - **Validation/test location**: `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: Backup/restore tests (`T016`).

---

## Phase 04: Deferred-Prune Backup-on-Start, Safe CLI Restore & Active Promotion

**Purpose**: Implement atomic pre-migration startup backup with deferred pruning, non-mutating SHA-256 manual backup, safe disjoint-path CLI restore with staged `.restore-tmp-<uuid>` verification and recoverable active promotion preserving `db-replaced-<timestamp>` intact on disk, the Playwright test-server bootstrap script, and full lock/lost-lock/recovery integration tests.

- [ ] **T014** `[US4]` Implement atomic pre-migration backup manager with deferred pruning, non-mutating manual backup, disjoint restore engine, and recoverable active promotion
  - **Target files/components**: `src/persistence/backup.ts`, `src/persistence/client.ts`, `src/application/health/health-service.ts`
  - **Expected behavior**:
    - `recoverInterruptedPromotionIfNeeded(dbDir)`: Inspects `<parent(dbDir)>/.azusa-promote-journal.json`. If `dbDir` is missing `PG_VERSION` (or fails verification) while `replacedDir` (`db-replaced-<timestamp>`) has a valid cluster, removes partial `dbDir`/`.restore-tmp-*`, renames `replacedDir` back to `dbDir`, and deletes the journal; if `dbDir` is already healthy, cleans up only the leftover journal while **preserving `replacedDir` (`db-replaced-<timestamp>`)** intact on disk.
    - `createStartupSnapshotIfNeeded({ dbDir, backupDir, actor })`: Returns `skipped_cold_start` if `PG_VERSION` absent; returns `skipped_unverified` if `.azusa-last-healthy.json` absent; otherwise cleans stale `.tmp-*`, generates unique `backupId` (`backup-<YYYYMMDD-HHmmss-fff>-startup` or `-01-startup` on same-ms tie), copies `dbDir` to `.tmp-<backupId>`, writes `manifest.json`, and renames to `<backupId>` **without pruning yet**.
    - `pruneCompletedStartupBackups(backupDir, retentionLimit = 10)`: Invoked by `client.ts` **only after** PGlite mounts, all migrations succeed, and `.azusa-last-healthy.json` is written. Prunes completed `-startup` folders beyond 10; never prunes `-manual` folders.
    - `createManualBackup({ dbDir, backupDir, actor })`: Acquires exclusive lock + waits `> 2000ms`, verifies `PG_VERSION`, copies to `.tmp-<backupId>`, verifies copied file sizes and SHA-256 digests against quiescent source without opening PGlite in place on the backup folder, writes `manifest.json` (`trigger: 'manual'`), renames to `<backupId>`, and releases lock.
    - `restoreBackup({ from, to, activeDbDir, backupDir, forceOverwriteActive = false, faultInjectStep? })`: Canonicalizes paths (Windows case-insensitive); refuses overlapping/active-without-flag/populated targets before any mutation; acquires target sentinel lock (`<parent(target)>/<basename(target)>.azusa-lock`) + waits `> 2000ms`; validates `source` (`PG_VERSION` + `BackupManifestSchema`); copies to `<parent(target)>/.restore-tmp-<uuid>`, opens PGlite to verify `'foundation.init'` and every `app_metadata` row/column via Zod, writes `.azusa-last-healthy.json`, closes PGlite; for non-active target renames to `target`; for `--force-overwrite-active` writes `.azusa-promote-journal.json`, moves `activeDbDir` → `db-replaced-<timestamp>`, moves `.restore-tmp-<uuid>` → `activeDbDir`, verifies PGlite readability, **preserves `db-replaced-<timestamp>` intact on disk**, and removes only `.azusa-promote-journal.json` (rolling back automatically on error or `onCompromised`).
  - **Constraints**: Never evict good backups on failed startups; never mutate manual backups in place; always preserve `db-replaced-<timestamp>` on promotion success.
  - **Validation/test location**: `tests/integration/backup-restore.test.ts`.
  - **Out-of-scope files/components**: UI backup/restore screens.

- [ ] **T015** `[US4, US5]` Implement `db:backup`, `db:restore` CLI scripts, and Playwright pre-seeded server bootstrap (`scripts/test/start-playwright-server.ts`)
  - **Target files/components**: `scripts/db/backup.ts`, `scripts/db/restore.ts`, `scripts/test/start-playwright-server.ts`
  - **Expected behavior**:
    - `scripts/db/backup.ts`: Invokes `createManualBackup()`, handles `onCompromised` by cleaning up partial `.tmp-*` and exiting `1`, prints JSON summary, and exits `0` (or `1` on error).
    - `scripts/db/restore.ts`: Parses `--from`, `--to`, `--force-overwrite-active`, invokes `restoreBackup()`, handles `onCompromised` by cleaning up `.restore-tmp-*` or rolling back `db-replaced-<timestamp>` → `activeDbDir` and exiting `1`, prints JSON summary (including `replacedDbPreserved` when `--force-overwrite-active` used), and exits `0` (or `1` on error).
    - `scripts/test/start-playwright-server.ts`: Resets `.azusa/test-playwright/`, seeds and closes `.azusa/test-playwright/db` (`'foundation.init'` + `.azusa-last-healthy.json`, lock released), and spawns `next dev --hostname 127.0.0.1 --port 3100` so boot creates a real `backup-*-startup` snapshot (`backupCount: 1`).
  - **Constraints**: Match `contracts/api.md` §2.2–§2.3.
  - **Validation/test location**: `tests/integration/backup-restore.test.ts` and `npm run test:e2e`.
  - **Out-of-scope files/components**: UI components.

- [ ] **T016** `[US4]` Add integration tests for locking, lost-lock simulation, deferred pruning, non-eviction, path safety, active promotion rollback, and full recovery
  - **Target files/components**: `tests/integration/backup-restore.test.ts`
  - **Expected behavior**:
    - **Test 1 (Cold start)**: Uninitialized `dbDir` skips backup (`skipped_cold_start`) and initializes cleanly.
    - **Test 2 (Lock lifecycle, contention & sibling restore)**:
      - Clean lock release followed by immediate re-acquisition.
      - Killed-owner (`SIGKILL`) recovery.
      - Stale-lock fixture `>= 2000ms` with `>= 4` racing child processes; winning child holds lock until all contenders try, asserting losers halt cleanly without writing.
      - Sibling restore (e.g. `.azusa/test-playwright/restored`) succeeds without `ELOCKED` while active server holds `db.azusa-lock`; two concurrent restores to the same target contend cleanly.
      - Malformed lock artifact fails closed (`ELOCKED`).
    - **Test 2b (Lost-lock simulation)**: Delete `<sentinel>.lock` or alter its `mtime` to trigger `onCompromised` and assert:
      - Server closes PGlite, `GET /api/health` and `POST /api/health/check` return `503`, and error stage is `'init'`.
      - `db:backup` losing lock mid-copy removes `.tmp-*` and exits `1`.
      - `db:restore` losing lock during staging removes `.restore-tmp-*` and exits `1`; losing lock during active promotion rolls `db-replaced-<timestamp>` back to `activeDbDir` and exits `1`.
      - Any lock holder (server or CLI) losing the lock during the `> 2000ms` heartbeat wait aborts immediately and never opens PGlite or touches the database folder.
    - **Test 3 (Startup backup, non-mutating manual backup, `SC-004` SHA-256 & full record recovery)**: Verifies startup backup, manual backup SHA-256 equality with quiescent source, byte-for-byte unchanged active DB after staging restore, and every recovered `app_metadata` field intact.
    - **Test 4 (Retention pruning & same-ms suffix)**: 12 `-startup` (with `-01-startup` tie), 2 `-manual`, and 1 `.tmp-*` prune to 10 `-startup` + 2 `-manual` + 0 `.tmp-*`.
    - **Test 5 (Non-eviction under failed startups)**: 10 good `-startup` backups survive 5 repeated `getFoundationHealth()` calls and 5 simulated restarts against a corrupt DB / failing migration.
    - **Test 6 (Path overlap, Windows case-insensitivity, populated target & corrupt backup refusal)**: Refuses all unsafe targets leaving `activeDbDir`, `source`, and `target` untouched.
    - **Test 7 (Active promotion preservation, rollback & interrupted startup recovery)**: Successful `--force-overwrite-active` preserves `db-replaced-<timestamp>` and removes journal; injected failure rolls back byte-for-byte; simulated crash recovers on next startup (preserving `db-replaced-<timestamp>` when active DB is healthy).
    - **Test 8 (Cross-platform backup failure)**: Regular file at `backupDir` halts init before PGlite opens and surfaces `status: 'error'`, `stage: 'backup'`.
  - **Constraints**: Isolated temp directories cleaned up on teardown.
  - **Validation/test location**: `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: Browser E2E tests (`T028`).

---

## Phase 05: Application Shell, 42 Kumiko Icons, Today Widget, 9 Routes, Profile Menu & Tier-1 Visual Suite

**Purpose**: Implement the Handoff v2 visual shell using the **Visual-Fidelity Task Pattern** (one visual scene/component per task, direct prototype references, breakpoints/checkpoints, translation notes, provenance tags, and Tier-1 + Tier-2 completion gates) and complete `npm run test:visual`.

- [ ] **T017** `[P]` `[US1]` Implement the complete 42-icon Kumiko SVG registry, `<KumikoIcon />` component, and icon unit tests
  - **Target files/components**: `src/ui/icons/kumiko-icons.ts`, `src/ui/icons/KumikoIcon.tsx`, `tests/unit/icons.test.ts`
  - **Match**: `icons/icons.json` and `prototype/Icons.dc.html#L25-L37` (Handoff v2, incorporating approved Deviation `D1`: replace `stroke="#FFFFFF"` on `delivery-flow`'s `M12 12L19.79 7.5` divider path with `stroke="var(--kumiko-surface, #FFFFFF)"`).
  - **Breakpoints/checkpoints**: Size ramp `16`, `18`, `20`, `24`, `32`, `40` px; states: default `#1A1B22` / `#67635C`, active `#A65307`, disabled `#B9B2A8`, orange accent `#E07F24`, and fixed semantic colours for the 6 solid badges.
  - **Translation note**: Lift all 42 SVG path definitions from `icons/icons.json` into `kumiko-icons.ts` and render **all 42 icons inside the same shared `<svg>` wrapper as the supplied `icons/svg/*.svg`** (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.75}`, `strokeLinejoin="miter"`, `strokeMiterlimit={10}`, `strokeLinecap="butt"`): **35** `currentColor` line icons (`team-board`, `art-board`, `pi-brief`, `capacity`, `backlog`, `sprint-plan`, `iteration`, `dashboard`, `settings`, `search`, `add`, `filter`, `export`, `present`, `refresh`, `chevron`, `expand`, `copy-link`, `more`, `edit`, `close-item`, `check`, `close`, `dependency`, `delivery-flow`, `objective`, `risk`, `velocity`, `calendar`, `info`, `lock`, `location`, `clock`, `members`, `asanoha`) and **7** fixed-colour glyphs (`warning`, `flag-missed`, `flag-aging`, `flag-blocked`, `commit-committed`, `commit-stretch`, `commit-buffer`) that inherit `fill="none"` and `1.75px` mitred stroke from the shared wrapper while keeping their fixed colours through their own inner `<path>` attributes so `currentColor` never reaches them. In `tests/unit/icons.test.ts`, assert all 42 keys exist, every rendered icon uses the shared `<svg>` wrapper (`fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, mitre/butt attributes), `commit-buffer` retains `fill="none"` and the `1.75px` dashed stroke, the other fixed-colour glyphs (`warning`, `flag-missed`, `flag-aging`, `flag-blocked`, `commit-committed`, `commit-stretch`) preserve their inner fixed colours without black fills, and `delivery-flow` uses `var(--kumiko-surface, #FFFFFF)`.
  - **Provenance**: `lifted from prototype CSS` (`icons/icons.json` & `prototype/Icons.dc.html#L26-L36`).
  - **Done when**: `tests/unit/icons.test.ts` passes, Tier-1 `test:visual` geometry green, and Tier-2 screenshot reviewed against `screenshots/08-icon-set.png`.
  - **Out-of-scope files/components**: Shell header layout (`T023`).

- [ ] **T018** `[P]` `[US1]` Implement top-right radial-masked `asanoha` SVG lattice background
  - **Target files/components**: `src/ui/shell/AsanohaBackground.tsx`
  - **Match**: `prototype/Main.dc.html#L20-L21` (Handoff v2).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px` (top-right square `width: 80%`, `aspect-ratio: 1 / 1`, `pointer-events: none`, `aria-hidden="true"`).
  - **Translation note**: Replicate the `28 × 48.5` `<pattern>` path (`stroke="#E2D9CC"`, `stroke-width="1"`) and `radial-gradient(circle farthest-side at 100% 0, rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 55%, rgba(0,0,0,0) 100%)` mask element-for-element.
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L21`).
  - **Done when**: Tier-1 `test:visual` geometry green at `1440px`, `1024px`, `768px` and Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: Header controls.

- [ ] **T019** `[P]` `[US1]` Implement 9-destination navigation config and disclosure `<NavigationMenu />`
  - **Target files/components**: `src/ui/shell/nav-config.ts`, `src/ui/shell/NavigationMenu.tsx`
  - **Match**: `prototype/Main.dc.html#L27-L34` (Handoff v2, incorporating approved Deviation `D5`: `<nav aria-label="Primary navigation">` disclosure button with `aria-expanded`/`aria-controls` and `<a aria-current="page">` links + `:focus-visible` `2px solid #E07F24`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; closed (`64×64px` button, `60px` logo) and open (`290px` white card, `border-radius: 16px`, `top: 70px`).
  - **Translation note**: Define the 9 primary destinations across 4 groups in `nav-config.ts` (`PI`: Team PI board `/` `M1 · F009`, ART program board `/program-board` `M4 · F019`, Team PI brief `/pi-brief` `M1 · F011`; `Capacity`: Team calendar `/calendar` `M0 · F005`, Capacity planner `/capacity` `M0 · F004`; `Sprint`: Team backlog `/backlog` `M1 · F008`, Sprint planning `/sprint-planning` `M2 · F013`, Iteration board `/iteration` `M2 · F014`; `Insights`: Team dashboard `/dashboard` `M3 · F017`) with `18px` Kumiko icons (`#67635C` default, `#A65307` on `#FCEFE2` active). Support `Tab`/`Shift+Tab`, `ArrowDown`/`ArrowUp`/`Home`/`End`, and `Escape` returning focus to the logo button. `Settings` is **not** in this menu.
  - **Provenance**: `lifted from prototype CSS` (`Main.dc.html#L27-L34`); disclosure semantics & `:focus-visible` `recreated manually` (reason: Constitution Principle VII / `D5`).
  - **Done when**: Tier-1 `test:visual` green at all breakpoints and Tier-2 screenshot reviewed against `screenshots/01b-nav-menu-open.png`.
  - **Out-of-scope files/components**: `ProfileMenu.tsx` (`T022`), header context breadcrumb (omitted per `D6`).

- [ ] **T020** `[P]` `[US1]` Implement expandable search control `<ExpandableSearch />`
  - **Target files/components**: `src/ui/shell/ExpandableSearch.tsx`
  - **Match**: `prototype/Main.dc.html#L49-L50` (Handoff v2).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; collapsed `40×40px` white circle (`16px` `search` icon) and expanded `280px` pill (`min-height: 40px`, `border-radius: 20px`, placeholder `"Search stories, features…"`).
  - **Translation note**: Replicate DOM and styles element-for-element; auto-focus input on expand; collapse on blur or `Escape`; expose `onExpandedChange(expanded: boolean)` so `FloatingHeader` hides `TodayWidget` below `1100px` (`D5`).
  - **Provenance**: `lifted from prototype CSS` (`Main.dc.html#L49-L50`); `:focus-visible` `recreated manually` (reason: `D5`).
  - **Done when**: Tier-1 `test:visual` green at all breakpoints and Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: Search indexing/results.

- [ ] **T021** `[P]` `[US2]` Implement viewer-local `<TodayWidget />`
  - **Target files/components**: `src/ui/shell/TodayWidget.tsx`
  - **Match**: `prototype/Main.dc.html#L41-L48` (Handoff v2, incorporating Deviations `D3` & `D5`: `"No active PI · No active Sprint"`, single viewer-local clock in `#C2650E`, centered layout `align-items: center` instead of v2's right-aligned `align-items: flex-end`, and `hiddenForSearchOverlap` applying `visibility: hidden; pointer-events: none`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; height `64px`, `tabular-nums`, `white-space: nowrap`, Line 1 `12.5px` `#3F3C37`, Line 2 `18px` `IBM Plex Mono` `#C2650E` + `10.5px` `#67635C`.
  - **Translation note**: On mount, read the browser's IANA timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` (inside a `try/catch` falling back to `undefined` → `'UTC'` only if discovery fails) and pass it to `getTodayWidgetModel(now, browserTimeZone)` from `src/domain/calendar/iso-week.ts` so date, ISO week, and clock all use the viewer's local timezone; render a fixed-height SSR placeholder then hydrate on mount with a `15000ms` interval to prevent hydration mismatch and CLS.
  - **Provenance**: Typography, height, and colour tokens `lifted from prototype CSS` (`Main.dc.html#L42-L46`); centered alignment (`align-items: center`) and `visibility: hidden` overlap toggle `recreated manually` (reason: `D5` / Feature Brief v0.2 §3.4 & §3.7).
  - **Done when**: Tier-1 `test:visual` green at all breakpoints and Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: PI/Sprint domain data (`F002`).

- [ ] **T022** `[P]` `[US1]` Implement local operator `<ProfileMenu />` with disabled non-navigating `Settings` placeholder
  - **Target files/components**: `src/ui/shell/ProfileMenu.tsx`
  - **Match**: `prototype/Main.dc.html#L51` and `prototype/Icons.dc.html#L36` (Handoff v2, incorporating Deviations `D5` & `D6`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; closed (`40×40px` `#1A1B22` circle displaying `"SM"`) and open (`250px` white card, `border-radius: 16px`, `top: 48px`, `right: 0`).
  - **Translation note**: Replicate the `Main.dc.html#L51` trigger (`aria-label="Account menu"`, `aria-expanded`, `aria-controls="azusa-profile-menu"`) and dropdown header (`36px` `"SM"` avatar, Title **`Scrum Master`**, Subtitle **`No ART or team configured`** — never exposing `local:sm`), followed by a **disabled, non-navigating `Settings` placeholder** (`aria-disabled="true"`, styled per `Icons.dc.html#L36`: `#8A847C` text, `#B9B2A8` `18px` `settings` Kumiko icon) with visible muted helper text (`"Configured per feature (F002–F014)"`) linked via `aria-describedby` (not hover-only). Support `Escape` closing and focus restoration.
  - **Provenance**: `lifted from prototype CSS` (`Main.dc.html#L51`, `Icons.dc.html#L36`); disabled non-navigating state & unconfigured subtitle `recreated manually` (reason: Clarifications Q1, Q2 / `D5`, `D6`).
  - **Done when**: Tier-1 `test:visual` green at all breakpoints and Tier-2 screenshot reviewed against `prototype/Main.dc.html#L51`.
  - **Out-of-scope files/components**: `/settings` route (explicitly out of scope in F001), auth/RBAC.

- [ ] **T023** `[US1, US2]` Implement single-row `<FloatingHeader />` coordinating overlays and `< 1100px` search overlap hiding
  - **Target files/components**: `src/ui/shell/FloatingHeader.tsx`
  - **Match**: `prototype/Main.dc.html#L25-L52` (Handoff v2, incorporating Deviations `D5` & `D6`: omit sample ART/Team/PI context breadcrumb, enforce mutual exclusion between `NavigationMenu` and `ProfileMenu`, and hide `TodayWidget` via `visibility: hidden` when search is expanded `< 1100px`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px` (single row, zero bounding-box overlap in both collapsed and expanded search states).
  - **Translation note**: Replicate the sticky header (`position: sticky; top: 0; z-index: 20`) with masked `asanoha` fade backdrop (`Main.dc.html#L25-L26`) composing `NavigationMenu` (left), `TodayWidget` wrapped in an absolutely centered slot (`position: absolute; left: 50%; transform: translateX(-50%)` per `D5`), and `ExpandableSearch` + `ProfileMenu` (right).
  - **Provenance**: Sticky header and fade backdrop `lifted from prototype CSS` (`Main.dc.html#L25-L26`); absolute centering of `TodayWidget`, mutual exclusion, and `< 1100px` overlap-hiding state `recreated manually` (reason: `D5`, `D6`).
  - **Done when**: Tier-1 `test:visual` green at `1440px`, `1024px`, `768px` and Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: Header context breadcrumb (`F002`).

- [ ] **T024** `[P]` `[US3]` Implement `<ErrorAlertBanner />` (`role="alert"`) and `<FoundationStatusCard />`
  - **Target files/components**: `src/ui/shell/ErrorAlertBanner.tsx`, `src/ui/shell/FoundationStatusCard.tsx`
  - **Expected behavior**:
    - `ErrorAlertBanner`: Renders visible accessible alert (`role="alert"`) displaying failing `stage`, `message`, and `recoveryHint` (referencing `docs/operations/database-and-recovery.md`) whenever `health.status === 'error'`.
    - `FoundationStatusCard`: Compact flat white card displaying DB initialization status, applied migration count/tag, backup count/latest trigger/ID, latest diagnostic check (`UUID`, `checkCount`, UTC timestamp), and **"Record diagnostic check"** button triggering `POST /api/health/check`.
  - **Constraints**: Use Azusa flat surface/hairline/semantic tokens and `tabular-nums`; never pretend domain features are operational.
  - **Validation/test location**: `tests/e2e/foundation-smoke.spec.ts` (`T028`).
  - **Out-of-scope files/components**: Domain cards or charts.

- [ ] **T025** `[US1, US3]` Implement `<PlaceholderScreen />`, `<AppShell />`, and root layout wiring
  - **Target files/components**: `src/ui/shell/PlaceholderScreen.tsx`, `src/ui/shell/AppShell.tsx`, `src/app/layout.tsx`
  - **Match**: `prototype/Main.dc.html#L20-L24`, `#L54-L59` (Handoff v2, incorporating Deviation `D4`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`.
  - **Translation note**: Compose `AsanohaBackground`, `FloatingHeader`, conditional `ErrorAlertBanner`, and main content container. `PlaceholderScreen` renders the `Zen Kaku Gothic New` `28px` title row, `40px` `asanoha` Kumiko mark, Roadmap v0.2 milestone/feature badge (`M0`–`M4`, `F004`–`F019`), explicit non-operational notice, and `FoundationStatusCard`.
  - **Provenance**: `lifted from prototype CSS` (`Main.dc.html#L20-L24`, `#L54-L59`); placeholder card composition `recreated manually` (reason: `D4`).
  - **Done when**: Tier-1 `test:visual` green at all breakpoints and Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: Operational domain screens.

- [ ] **T026** `[US1, US2, US3]` Wire all 9 primary App Router placeholder routes
  - **Target files/components**: `src/app/page.tsx`, `src/app/program-board/page.tsx`, `src/app/pi-brief/page.tsx`, `src/app/calendar/page.tsx`, `src/app/capacity/page.tsx`, `src/app/backlog/page.tsx`, `src/app/sprint-planning/page.tsx`, `src/app/iteration/page.tsx`, `src/app/dashboard/page.tsx`
  - **Expected behavior**: Each route renders `<PlaceholderScreen />` with its metadata from `nav-config.ts` and server-loaded `getFoundationHealth()`.
  - **Constraints**: Do **not** create `src/app/settings/page.tsx` (`Clarification Q1`).
  - **Validation/test location**: `npm run build`, `npm run test:visual`, and `npm run test:e2e`.
  - **Out-of-scope files/components**: `/settings` route, domain CRUD routes.

- [ ] **T027** `[US1, US2]` Complete Tier-1 `npm run test:visual` geometry, token, 42-icon, profile-dropdown, and single-row non-overlap suite
  - **Target files/components**: `tests/visual/shell-fidelity.spec.ts`
  - **Expected behavior**:
    - Assert Azusa tokens (`#F4F1EC`, `#FFFFFF`, `#1A1B22`, `#E07F24`, `#A65307`, `#C2650E`), local font families (`Zen Kaku Gothic New`, `IBM Plex Sans`, `IBM Plex Mono`), sticky header (`position: sticky; top: 0px`), horizontally centered `TodayWidget` bounding box, bounding boxes (`60px` logo inside `64×64px` button, `290px` nav menu, `250px` profile menu, `40px`→`280px` search, `40px` `"SM"` badge, `80%` `asanoha` lattice), absence of header context breadcrumb, and disabled `Settings` item with visible `aria-describedby`-linked helper text in profile dropdown.
    - Assert single-row non-overlap at `1440px`, `1024px`, and `768px` (collapsed search: `TodayWidget` visible with zero overlap; expanded search: zero overlap at `1440px`, `TodayWidget` `visibility: hidden` at `1024px` and `768px`, restored to `visibility: visible` on collapse).
  - **Constraints**: Runs against isolated port `3100` (`reuseExistingServer: false`) with frozen clock `2026-11-08T11:30:00.000Z` and `Asia/Manila`.
  - **Validation/test location**: `npm run test:visual`, `npm run test:run`, and `npm run lint`.
  - **Out-of-scope files/components**: Application production code.

---

## Phase 06: End-to-End Browser Smoke & `@axe-core/playwright` Accessibility Suite

**Purpose**: Verify all 5 User Stories (`US1`–`US5`) and `SC-005` accessibility requirements end-to-end in headless Chromium against the isolated port `3100` test server.

- [ ] **T028** `[US1, US2, US3, US4, US5]` Implement Playwright E2E smoke and `@axe-core/playwright` accessibility suite
  - **Target files/components**: `tests/e2e/foundation-smoke.spec.ts`
  - **Expected behavior**:
    - **US1 & SC-005**: Assert zero external network requests; test keyboard-only operation (`Tab`, `Shift+Tab`, `Enter`, `Space`, `ArrowDown`/`ArrowUp`/`Home`/`End`, `Escape`) across logo menu (all 9 primary routes in `PI`/`Capacity`/`Sprint`/`Insights`, confirming `Settings` is absent from logo menu), search control, and `"SM"` profile dropdown (`"Scrum Master"`, `"No ART or team configured"`, disabled non-navigating `Settings`, mutual exclusion with logo menu); verify Roadmap v0.2 badges on all 9 routes; run `new AxeBuilder({ page }).analyze()` asserting `violations` is `[]` on `/` (default, logo menu open, profile dropdown open, expanded search) and representative routes.
    - **US2**: Assert `2026/11/08 · CW45.7`, `No active PI · No active Sprint`, and `1930h PHT` on `/` at `2026-11-08T11:30:00.000Z` in `Asia/Manila`; also run a UTC-date-crossing browser-timezone test (`2026-11-08T18:30:00.000Z` in `Asia/Manila` → `2026/11/09 · CW46.1`, `0230h PHT`, distinct from UTC `2026/11/08 · CW45.7`, `1830h UTC`) proving `TodayWidget` discovers and forwards the browser's IANA timezone on mount.
    - **US3**: Click **"Record diagnostic check"**, assert `POST /api/health/check` returns `201` with UUIDv4 and `"local:sm"`, reload page and confirm persistence; inject `init`/`migration`/`backup` errors via `x-azusa-test-simulate-error` and assert `503` + `<ErrorAlertBanner role="alert" />`.
    - **US4**: Verify pre-seeded server boot created a real `backup-*-startup` (`backupCount: 1`) surfaced on `FoundationStatusCard`, and run sibling `restoreBackup()` into `.azusa/test-playwright/restored` while server runs, confirming intact `'foundation.init'` recovery while `.azusa/test-playwright/db` remains untouched.
  - **Constraints**: Must pass deterministically without external network calls or touching `.azusa/data/`.
  - **Validation/test location**: `npm run test:e2e`, `npm run test:run`, and `npm run lint`.
  - **Out-of-scope files/components**: Production source files outside `tests/e2e/`.

---

## Phase 07: Release Prep (MANDATORY)

**Purpose**: Synchronize version metadata and author all required Constitution Principle VI documentation artifacts aligned with **Data Model v0.6** and **Roadmap v0.2**, verified by an automated documentation completeness test (`T035`). *(Per `docs/feature-roadmap.md` v0.2 line 12, `F001` remains unchecked in `docs/feature-roadmap.md` until conformance review and explicit operator UAT acceptance complete in `T040`.)*

- [ ] **T029** `[US5]` Synchronize version (`0.1.0`) and create `CHANGELOG.md`
  - **Target files/components**: `package.json`, `package-lock.json`, `CHANGELOG.md`
  - **Expected behavior**: Sync `version: "0.1.0"` across `package.json` and `package-lock.json`; create `CHANGELOG.md` with `0.1.0 (2026-11-20)` summarizing F001 (Next.js 15 + strict TS on `127.0.0.1`, PGlite + Drizzle + `proper-lockfile` locking, `app_metadata` + `"local:sm"` audit plumbing, deferred-prune startup backup + safe restore preserving `db-replaced-<timestamp>`, Handoff v2 design tokens, local `@fontsource` fonts, 42-icon Kumiko set, 9-destination shell + profile dropdown, quality gates, and Data Model v0.6 documentation).
  - **Constraints**: Keep app changelog distinct from internal PI Plan Versioning.
  - **Validation/test location**: Inspect `package.json`, `package-lock.json`, and `CHANGELOG.md`.
  - **Out-of-scope files/components**: Application source code.

- [ ] **T030** `[P]` `[US5]` Update `README.md` with setup, CLI commands, quality gates, and documentation index
  - **Target files/components**: `README.md`
  - **Expected behavior**: Document Node 20+ prerequisites, `npm install`, `npx playwright install chromium`, optional env vars (`AZUSA_DB_DIR`, `AZUSA_BACKUP_DIR`, `AZUSA_ACTOR_ID`, `AZUSA_NEXT_DIST_DIR`, `NEXT_TELEMETRY_DISABLED`), `npm run db:migrate`, `npm run dev` (`http://127.0.0.1:3000`), stop-server backup/restore commands, all 7 quality gate commands, and clickable links to all `docs/` artifacts.
  - **Constraints**: Match `quickstart.md` and `package.json` scripts exactly (`AC01`, `AC10`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T031** `[P]` `[US5]` Create `docs/REPO_MAP.md`
  - **Target files/components**: `docs/REPO_MAP.md`
  - **Expected behavior**: Architectural navigation guide covering major directories, entry points (`src/app/`, `src/ui/`, `src/domain/`, `src/application/`, `src/persistence/`, `scripts/`, `tests/`, `docs/`, `specs/`), layer boundaries, and common modification paths for `F002`–`F019`.
  - **Constraints**: Concise navigation guide, not an exhaustive file dump.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T032** `[P]` `[US5]` Create `docs/architecture/overview.md` and ADR `0001-local-first-nextjs-pglite-foundation.md`
  - **Target files/components**: `docs/architecture/overview.md`, `docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md`
  - **Expected behavior**: Document runtime architecture, layer boundaries, `proper-lockfile` locking (`<parent(dir)>/<basename(dir)>.azusa-lock`, empty `.lock/`, `> 2000ms` grace wait, server/CLI `onCompromised`), startup failure state machine, deferred-prune backup, safe restore + preserved `db-replaced-<timestamp>`, and ADR 0001 rationale/alternatives/consequences.
  - **Constraints**: Reflect implemented F001 accurately.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T033** `[P]` `[US5]` Create `docs/architecture/domain-model.md` (Data Model v0.6) and `docs/architecture/data-dictionary.md`
  - **Target files/components**: `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`
  - **Expected behavior**:
    - `docs/architecture/domain-model.md`: Codify **Data Model v0.6** (`docs/azusa-data-model.md` in `azusa-handoff-v2.zip`), **Roadmap v0.2 (`M0`–`M4`, `F001`–`F019`)**, and Constitution Principle III (8.0h workday with no focus factor, `Team.planning_style`, dated `SprintCeremony`/`Meeting`/`Milestone`/`Absence` overtime, `OverheadReserve`/`OverheadTicket` vs `Buffer`/`BufferDraw`, `Story` full/light layouts vs `Bug` with severity/environment/repro steps, `ChecklistItem`/`ChecklistTemplate`, universal `Tag`, `Removed` terminal state, rank as priority, strict separation of `PlanVersion`/`PICommitment`/`SprintCommitment`/`SprintClosure`/`StateChange`, and 3 Sprint lifecycle date concepts).
    - `docs/architecture/data-dictionary.md`: Document implemented F001 persistence structures only (`app_metadata`, `auditColumns()`, `<basename(dbDir)>.azusa-lock`, `<dir>.azusa-owner.json`, `.azusa-last-healthy.json`, `.azusa-promote-journal.json`, and backup `manifest.json`).
  - **Constraints**: Clearly separate conceptual domain blueprint from F001 physical tables.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T034** `[P]` `[US5]` Create `docs/operations/database-and-recovery.md`
  - **Target files/components**: `docs/operations/database-and-recovery.md`
  - **Expected behavior**: Step-by-step runbook for DB initialization, `db:migrate`, `proper-lockfile` locking (`<parent(dir)>/<basename(dir)>.azusa-lock`, `> 2000ms` heartbeat grace wait, operational note on the `10s` stale threshold and `2s` heartbeat interval), startup backup + deferred 10-snapshot pruning, stop-server `db:backup`, sibling `db:restore`, `--force-overwrite-active` recoverable promotion + retention and manual cleanup of `db-replaced-<timestamp>`, and troubleshooting `ErrorAlertBanner` diagnostics.
  - **Constraints**: Match implemented CLI flags and safety rules (`AC08`, `AC10`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T035** `[US5]` Add automated documentation completeness & link verification test
  - **Target files/components**: `tests/unit/docs-completeness.test.ts`
  - **Expected behavior**: Verify all 8 Constitution Principle VI docs exist, are non-empty, contain zero `TBD`/`TODO` placeholders, every relative markdown link in `README.md` resolves, and `docs/feature-roadmap.md` lists `F001`–`F019` across `M0`–`M4` with `F002`–`F019` unchecked.
  - **Constraints**: Read-only test; do not tick `F001` in `docs/feature-roadmap.md` before `T040`.
  - **Validation/test location**: `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: `docs/feature-roadmap.md`.

---

## Phase 08: Browser Smoke Test & Post-UAT Roadmap Acceptance (MANDATORY)

**Purpose**: Walk each user story's Independent Test in a real browser against the to-be-merged state (`http://127.0.0.1:3000`), run all 7 quality gates, complete conformance review (`agent-06`) and operator UAT, and tick `F001` in `docs/feature-roadmap.md` only upon acceptance.

- [ ] **T036** `[US1]` Live browser smoke test — Application shell, 9-destination navigation, profile dropdown & design foundations
  - **Target files/components**: Live app at `http://127.0.0.1:3000` (no code edits)
  - **Expected behavior**: Walk US1 Independent Test: verify `#F4F1EC`, radial-masked `asanoha` lattice, local fonts, zero external network requests, no header context breadcrumb, 9 primary routes in `PI`/`Capacity`/`Sprint`/`Insights` (confirming `Settings` is absent from logo menu) with Roadmap v0.2 badges, `"SM"` profile dropdown (`"Scrum Master"`, `"No ART or team configured"`, disabled non-navigating `Settings`, mutual exclusion), search expand/collapse, and keyboard/focus operation.
  - **Validation/test location**: Manual live browser walk-through.

- [ ] **T037** `[US2]` Live browser smoke test — Viewer-local Today widget & narrow-viewport overlap hiding
  - **Target files/components**: Live app at `http://127.0.0.1:3000` (no code edits)
  - **Expected behavior**: Walk US2 Independent Test: verify viewer-local date, `CWww.d`, `"No active PI · No active Sprint"`, single `#C2650E` clock `HHMMh ZONE`, and `visibility: hidden` when search expands at `< 1100px`.
  - **Validation/test location**: Manual live browser walk-through.

- [ ] **T038** `[US3]` Live browser smoke test — Local persistence & restart durability
  - **Target files/components**: Live app at `http://127.0.0.1:3000` (no code edits)
  - **Expected behavior**: Walk US3 Independent Test: trigger **"Record diagnostic check"**, stop server (`Ctrl+C`), restart (`npm run dev`), reload `/`, and confirm UUIDv4, `checkCount`, UTC timestamps, and `"local:sm"` survive intact.
  - **Validation/test location**: Manual live browser walk-through.

- [ ] **T039** `[US4]` Live browser smoke test — Startup backup, active-lock refusal & safe sibling restore
  - **Target files/components**: Live app at `http://127.0.0.1:3000` and CLI (no code edits)
  - **Expected behavior**: Walk US4 Independent Test: confirm startup backup appears on `FoundationStatusCard`; while server runs, verify `npm run db:backup` refuses (`exit 1`) due to `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` and verify sibling `npm run db:restore -- --from latest` succeeds into `.azusa/data/restored-<timestamp>` without touching `.azusa/data/db`; stop server and verify `npm run db:backup` succeeds.
  - **Validation/test location**: Manual live CLI + browser walk-through.

- [ ] **T040** `[US1, US2, US3, US4, US5]` Run full quality gates, conformance review, operator UAT, and tick `F001` in `docs/feature-roadmap.md`
  - **Target files/components**: `docs/feature-roadmap.md` (updated only after acceptance)
  - **Expected behavior**:
    - Run and confirm exit code `0` for all 7 gates: `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run test:visual`, and `npm run test:e2e`.
    - Complete post-implementation conformance review (`agent-06-check-implementation.md`) and obtain explicit operator UAT acceptance.
    - Only after conformance review and explicit operator UAT pass, check off `- [x] **F001 — Application Foundation**` in `docs/feature-roadmap.md`.
  - **Constraints**: Never check off `F001` before quality gates, conformance review, and operator UAT succeed.
  - **Validation/test location**: All 7 npm quality gate commands + conformance review + operator UAT sign-off.
