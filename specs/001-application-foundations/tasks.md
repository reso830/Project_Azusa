# Tasks: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/api.md](./contracts/api.md) · [quickstart.md](./quickstart.md)  
**Prototype / Design Target**: `docs/handoffs/azusa-handoff-v1.zip` (`Visual-Fidelity Mode: Mixed`)

## Conventions

- **Status Legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel Marker**: `[P]` indicates tasks within the same phase that operate on distinct files and can run in parallel without shared edits.
- **Phase Dependency Order**: `01 → 02 → 03 → 04 → 05 → 06 → 07 → 08`
- **Phase Verification Commands**: Every phase is self-contained and MUST leave `npm run test:run` and `npm run lint` green at the end of that phase (plus `npm run test:visual` in Phase 05, `npm run test:e2e` in Phase 06, and all quality gates in Phases 07–08).

## Phase Summary

| Phase | Focus / Name | Task IDs | User Stories Covered |
|---|---|---|---|
| **Phase 01** | Project Setup, Tooling & Brand Assets | `T001–T004` | `US5` |
| **Phase 02** | Foundational Domain Modules, Schemas & Visual Harness | `T005–T008` | `US2, US3, US5` |
| **Phase 03** | Local PGlite Persistence, Race-Safe Lock, Migrations & Health API | `T009–T013` | `US3` |
| **Phase 04** | Deferred-Prune Backup-on-Start, Safe CLI Restore & Active Promotion | `T014–T016` | `US4` |
| **Phase 05** | Application Shell, Kumiko Icons, Today Widget, Routes & Tier-1 Visual Suite | `T017–T027` | `US1, US2, US3` |
| **Phase 06** | End-to-End Browser Smoke & `@axe-core/playwright` Accessibility Suite | `T028` | `US1, US2, US3, US4, US5` |
| **Phase 07** | Release Prep (Version Sync & Living Documentation) | `T029–T035` | `US5` |
| **Phase 08** | Browser Smoke Test & Post-UAT Roadmap Acceptance | `T036–T040` | `US1, US2, US3, US4, US5` |

---

## Phase 01: Project Setup, Tooling & Brand Assets

**Purpose**: Initialize the single strict-TypeScript Next.js (App Router) project bound to `127.0.0.1`, configure linting/formatting/Tailwind/font tokens, configure Vitest (`passWithNoTests: true`) and Drizzle Kit, and install the supplied Azusa logo assets so `npm run test:run` and `npm run lint` exit `0` from Phase 01 onward.

- [ ] **T001** `[US5]` Initialize Next.js, React, strict TypeScript, and package scripts
  - **Target files/components**: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`
  - **Expected behavior**:
    - Define `package.json` (`name: "azusa"`, `version: "0.1.0"`, `private: true`) with dependencies (`next`, `react`, `react-dom`, `@electric-sql/pglite`, `drizzle-orm`, `proper-lockfile`, `zod`, `@fontsource/zen-kaku-gothic-new`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) and devDependencies (`typescript`, `@types/node`, `@types/react`, `@types/react-dom`, `@types/proper-lockfile`, `drizzle-kit`, `tailwindcss`, `@tailwindcss/postcss`, `eslint`, `prettier`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `tsx`).
    - Define scripts: `dev` (`next dev --hostname 127.0.0.1`), `build` (`next build`), `start` (`next start --hostname 127.0.0.1`), `lint`, `format:check`, `typecheck` (`tsc --noEmit`), `test:run` (`vitest run`), `test:visual` (`playwright test --project=visual`), `test:e2e` (`playwright test --project=e2e`), `db:migrate` (`tsx scripts/db/migrate.ts`), `db:backup` (`tsx scripts/db/backup.ts`), `db:restore` (`tsx scripts/db/restore.ts`).
    - Configure `tsconfig.json` with `strict: true`, `noUncheckedIndexedAccess: true`, and `@/*` path alias mapped to `./src/*`.
    - Configure `next.config.ts` with `serverExternalPackages: ['@electric-sql/pglite']`, `distDir: process.env.AZUSA_NEXT_DIST_DIR || '.next'` (`m3`), and `process.env.NEXT_TELEMETRY_DISABLED = '1'`.
    - Update `.gitignore` to ignore `node_modules/`, `.next/`, `.next-playwright/`, `.azusa/`, `coverage/`, `playwright-report/`, and `test-results/`.
  - **Constraints**: 100% local packages; bind server scripts to `127.0.0.1`; no cloud SDKs or external telemetry (`NEXT_TELEMETRY_DISABLED=1`).
  - **Validation/test location**: `npm install` and `npm run typecheck` succeed.
  - **Out-of-scope files/components**: Application UI components, database schema files, and `docs/`.

- [ ] **T002** `[P]` `[US1, US5]` Configure ESLint, Prettier, PostCSS/Tailwind CSS, global design tokens, and local `@fontsource` imports
  - **Target files/components**: `eslint.config.mjs`, `.prettierrc`, `postcss.config.mjs`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
  - **Expected behavior**:
    - Configure ESLint (`eslint.config.mjs`) and Prettier (`.prettierrc`) for Next.js + strict TypeScript.
    - Configure `postcss.config.mjs` with `@tailwindcss/postcss`.
    - In `src/app/globals.css`, define CSS custom properties for all Azusa design tokens from `AZUSA_HANDOFF.md` §14.2–§14.3 (`--color-page-bg: #F4F1EC`, `--color-surface: #FFFFFF`, `--color-ink: #1A1B22`, `--color-brand-orange: #E07F24`, `--color-orange-text: #A65307`, `--color-clock-orange: #C2650E`, `--color-muted: #67635C`, `--color-secondary: #3F3C37`, `--color-active-tint: #FCEFE2`, `--color-sprint-tint: #FFF8F1`, `--color-hairline: #E7E2DA`, `--color-hairline-soft: #EFEAE3`, `--color-hairline-subtle: #F3EFE9`, `--color-asanoha-stroke: #E2D9CC`, default category/workflow/feature pastel tokens, load/threshold tokens, and `:focus-visible` outline rules `2px solid #E07F24` with `border: 0` at rest).
    - In `src/app/layout.tsx`, import `@fontsource/zen-kaku-gothic-new/500.css`, `@fontsource/zen-kaku-gothic-new/700.css`, `@fontsource/ibm-plex-sans/400.css`, `@fontsource/ibm-plex-sans/500.css`, `@fontsource/ibm-plex-sans/600.css`, `@fontsource/ibm-plex-sans/700.css`, `@fontsource/ibm-plex-mono/500.css`, and `@fontsource/ibm-plex-mono/600.css`, and set up a minimal `src/app/page.tsx` bootstrap so `npm run lint` and `npm run build` succeed.
  - **Constraints**: Do not load any fonts from `https://fonts.googleapis.com` (`Deviation D2`).
  - **Validation/test location**: `npm run lint`, `npm run format:check`, and `npm run typecheck`.
  - **Out-of-scope files/components**: `src/persistence/`, `src/domain/`.

- [ ] **T003** `[P]` `[US5]` Configure Vitest (`passWithNoTests: true`) and Drizzle Kit
  - **Target files/components**: `vitest.config.ts`, `drizzle.config.ts`
  - **Expected behavior**:
    - Configure `vitest.config.ts` with `@/*` path resolution, `node` test environment, `passWithNoTests: true` (so `npm run test:run` exits `0` in Phase 01 before unit tests are added in Phase 02), and inclusion of `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts`.
    - Configure `drizzle.config.ts` pointing `schema` to `./src/persistence/schema/index.ts`, `out` to `./src/persistence/migrations`, and `dialect: 'postgresql'`.
  - **Constraints**: Keep unit and integration suites separate from Playwright (`tests/visual/`, `tests/e2e/`).
  - **Validation/test location**: `npm run test:run` and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: `playwright.config.ts` (handled in `T008`).

- [ ] **T004** `[P]` `[US1]` Copy supplied Azusa logo assets into `public/assets/`
  - **Target files/components**: `public/assets/azusa-logo.png`, `public/assets/azusa-logo-256.png`
  - **Expected behavior**: Extract `azusa-handoff/assets/azusa-logo.png` and `azusa-handoff/assets/azusa-logo-256.png` from `docs/handoffs/azusa-handoff-v1.zip` into `public/assets/` byte-for-byte without modification.
  - **Constraints**: Use only the supplied brand assets (`AZUSA_HANDOFF.md` §14.5, §23).
  - **Validation/test location**: Verify files exist at `public/assets/azusa-logo.png` and `public/assets/azusa-logo-256.png`; `npm run test:run` and `npm run lint` exit `0`.
  - **Out-of-scope files/components**: SVG icons (handled in `T017`).

---

## Phase 02: Foundational Domain Modules, Schemas & Visual Harness

**Purpose**: Implement the pure TypeScript domain modules (`actor.ts`, `iso-week.ts`, `schemas.ts`) with full unit test coverage (Constitution Principle V) and stand up the isolated Playwright configuration (`port 3100`, `reuseExistingServer: false`) and reusable `npm run test:visual` Tier-1 harness.

- [ ] **T005** `[P]` `[US3]` Implement pre-authentication local actor domain module and unit tests
  - **Target files/components**: `src/domain/audit/actor.ts`, `tests/unit/actor.test.ts`
  - **Expected behavior**:
    - Export `DEFAULT_LOCAL_ACTOR = 'local:sm'`.
    - Export `resolveActor(explicitActor?: string | null, envActor?: string | null): string` returning the trimmed `explicitActor` if non-empty, otherwise trimmed `envActor ?? process.env.AZUSA_ACTOR_ID` if non-empty, otherwise `'local:sm'`.
    - Unit tests in `tests/unit/actor.test.ts` covering default `'local:sm'`, whitespace-only inputs falling back to `'local:sm'`, environment variable override, and explicit internal actor override precedence.
  - **Constraints**: Pure TypeScript in `src/domain/audit/actor.ts`; zero I/O or database imports.
  - **Validation/test location**: `tests/unit/actor.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: `src/persistence/`, authentication libraries.

- [ ] **T006** `[P]` `[US2]` Implement pure ISO-8601 calendar week, local date, fixed-offset timezone lookup + `UTC±offset` fallback, and clock formatting module with unit tests
  - **Target files/components**: `src/domain/calendar/iso-week.ts`, `tests/unit/iso-week.test.ts`
  - **Expected behavior**:
    - Export `normalizeTimeZone(tz?: string | null): string` mapping legacy aliases (`'Asia/Calcutta' -> 'Asia/Kolkata'`, `'US/Central' -> 'America/Chicago'`) and validating the timezone identifier against `Intl.DateTimeFormat`—falling back deterministically to `'UTC'` if `tz` is null, empty, or throws `RangeError` (`OD2`, `m5`).
    - Export `formatLocalDate(date: Date, timeZone?: string): string` returning `YYYY/MM/DD` in the normalized timezone.
    - Export `computeIsoCalendarWeek(year: number, month: number, day: number): { isoYear: number; isoWeek: number; isoWeekday: number; formatted: string }` returning `CWww.d` (where `ww` is zero-padded `01`–`53` and `d` is `1`=Monday … `7`=Sunday, matching `prototype/Main.dc.html#L155-L162` and hardened across year boundaries).
    - Export `resolveTimeZoneAbbreviation(date: Date, timeZone?: string): string` implementing `OD2` (`m5`):
      1. Normalize `timeZone` via `normalizeTimeZone()`.
      2. If in the fixed-offset lookup table (`Asia/Manila` → `'PHT'`, `Asia/Kolkata` → `'IST'`, `Asia/Tokyo` → `'JST'`, `Asia/Singapore` → `'SGT'`, `UTC` / `Etc/UTC` / `Etc/GMT` → `'UTC'`), return the mapped abbreviation.
      3. For all other valid IANA timezones (including DST-observing zones such as `America/Chicago` and `Europe/London`), extract the `timeZoneName` part from `Intl.DateTimeFormat('en-US', { timeZone: normalizedTz, timeZoneName: 'shortOffset' }).formatToParts(date)` and replace `'GMT'` with `'UTC'` (producing `'UTC-6'`, `'UTC-5'`, `'UTC+1'`, `'UTC+5:30'`, or `'UTC'` when offset is zero—**never** returning `'GMT'`).
    - Export `formatViewerClock(date: Date, timeZone?: string): { time: string; zone: string }` formatting `HHMMh` (`hourCycle: 'h23'`) and resolved timezone label, ensuring that if `timeZone` is invalid or missing, both the time and the zone badge are computed in `UTC` (`L5`).
    - Export `getTodayWidgetModel(date: Date, timeZone?: string)` returning `{ dateText, cwText, piSprintText: 'No active PI · No active Sprint', clockTime, clockZone }`.
    - Unit tests in `tests/unit/iso-week.test.ts` verifying ISO week boundaries (`2026-11-08` Sunday -> `CW45.7`, `2026-12-31` -> `CW53.4`, `2027-01-01` -> `CW53.5`, `2027-01-04` -> `CW01.1`, leap day `2028-02-29`), legacy alias normalization (`Asia/Calcutta` → `'IST'`, `US/Central` → `'UTC-6'` in winter / `'UTC-5'` in summer), lookup table resolution (`Asia/Manila` → `'PHT'`), `Europe/London` in winter (`'UTC'`) and summer (`'UTC+1'`, never `'GMT'`), unmapped half-hour offset zones (`Asia/Kathmandu` → `'UTC+5:45'`), invalid/empty timezone ID fallback to `'UTC'`, and `"No active PI · No active Sprint"` default.
  - **Constraints**: Pure TypeScript; no external date libraries; must never output `'GMT'` and must not invent an active PI or Sprint (`AC03`, `OD2`).
  - **Validation/test location**: `tests/unit/iso-week.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: React components (`TodayWidget.tsx` is built in `T021`).

- [ ] **T007** `[P]` `[US3, US4]` Implement Zod validation schemas for metadata records, health responses, strict diagnostic requests, and backup manifests with unit tests
  - **Target files/components**: `src/domain/health/schemas.ts`, `tests/unit/schemas.test.ts`
  - **Expected behavior**:
    - Define and export `AppMetadataValueSchema`, `DiagnosticCheckRequestSchema` (`z.object({ note: z.string().trim().min(1).max(280).optional().default('Manual diagnostic check') }).strict()`, rejecting `actor` or any unknown keys in public HTTP requests per `C13`), `BackupManifestSchema`, `HealthErrorItemSchema`, and `HealthResponseSchema` (`status: z.enum(['healthy', 'error'])` per `C11`) matching `specs/001-application-foundations/contracts/api.md` and `data-model.md`.
    - Unit tests in `tests/unit/schemas.test.ts` covering valid payloads, default value population, boundary lengths (`0` chars, `280` chars, `281` chars), strict rejection when `actor` is passed in `DiagnosticCheckRequestSchema` (`C13`), invalid UUID/timestamp rejection, and error stage validation.
  - **Constraints**: Pure TypeScript + `zod` only.
  - **Validation/test location**: `tests/unit/schemas.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: Route handlers and Drizzle tables.

- [ ] **T008** `[US1, US5]` Stand up strictly isolated Playwright configuration (`playwright.config.ts`), install Chromium browser, and create the reusable Tier-1 visual-fidelity helper module
  - **Target files/components**: `playwright.config.ts`, `tests/visual/shell-fidelity.spec.ts`
  - **Expected behavior**:
    - Run `npx playwright install chromium` so browser binaries are available locally (`C14`).
    - Configure `playwright.config.ts` (`m2`, `m3`) with:
      - Two projects: `visual` (`testDir: './tests/visual'`) and `e2e` (`testDir: './tests/e2e'`).
      - Deterministic `use` settings: `baseURL: 'http://127.0.0.1:3100'`, `timezoneId: 'Asia/Manila'`, `locale: 'en-US'` (`C5`, `m3`).
      - Strictly isolated `webServer`:
        - `command: 'npx tsx scripts/test/start-playwright-server.ts'`
        - `url: 'http://127.0.0.1:3100'`
        - `reuseExistingServer: false` (explicitly pinned to `false` in all environments so Playwright never attaches to a developer server on port `3000`, `m3`)
        - `env: { PORT: '3100', AZUSA_NEXT_DIST_DIR: '.next-playwright', AZUSA_DB_DIR: '.azusa/test-playwright/db', AZUSA_BACKUP_DIR: '.azusa/test-playwright/backups', AZUSA_ALLOW_TEST_FAULT_INJECTION: '1', NEXT_TELEMETRY_DISABLED: '1' }`
    - Create the reusable Tier-1 geometry, non-overlap, and computed-style helper utilities in `tests/visual/shell-fidelity.spec.ts` (RGB/hex conversion, font-family checks, bounding-box intersection checks, and frozen clock helper `2026-11-08T11:30:00.000Z`).
  - **Constraints**: Must support `npm run test:visual` and `npm run test:e2e` without external services or modifying `.azusa/data/` or `.next/`.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck`.
  - **Out-of-scope files/components**: `scripts/test/start-playwright-server.ts` (implemented in `T015` once persistence/backup helpers exist) and full shell assertions (completed in `T027` in Phase 05).

---

## Phase 03: Local PGlite Persistence, Race-Safe Lock, Migrations & Health API (User Story 3)

**Purpose**: Implement the race-safe cross-process lock manager (`lock.ts` using `proper-lockfile`), PGlite + Drizzle ORM persistence layer, reusable `auditColumns()` helper (UUIDv4 + `$onUpdate`), `app_metadata` schema and initial SQL migration, once-per-process singleton client, `db:migrate` CLI script, health service, and `/api/health` + `/api/health/check` endpoints, verified by integration tests for restart durability (`AC04`), real `init`-stage failure (`M1`), and migration safety (`AC05`).

- [ ] **T009** `[US3]` Create reusable `auditColumns()` helper (UUIDv4 + auto-updated `updated_at`), `app_metadata` Drizzle schema, and initial SQL migration
  - **Target files/components**: `src/persistence/schema/common.ts`, `src/persistence/schema/app-metadata.ts`, `src/persistence/schema/index.ts`, `src/persistence/migrations/0000_foundation_init.sql`, `src/persistence/migrations/meta/_journal.json`
  - **Expected behavior**:
    - In `src/persistence/schema/common.ts`, export `auditColumns()` providing:
      - `id`: `text('id').primaryKey().$defaultFn(() => crypto.randomUUID())` (RFC 9562 / RFC 4122 UUIDv4 per `C12`),
      - `createdAt`: `timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()`,
      - `updatedAt`: `timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow().$onUpdate(() => new Date())` (automatically refreshed on write per `C12`),
      - `createdBy`: `text('created_by').notNull().default('local:sm')`, and
      - `updatedBy`: `text('updated_by').notNull().default('local:sm')`.
    - In `src/persistence/schema/app-metadata.ts`, define the `appMetadata` table (`app_metadata`) with `key` (`text('key').notNull().unique()`), `value` (`jsonb('value').notNull()`), and `...auditColumns()`.
    - Provide the committed Drizzle SQL migration `0000_foundation_init.sql` and `meta/_journal.json` creating `app_metadata` and its unique index on `key`.
  - **Constraints**: Do not create any domain tables (`Train`, `Team`, `Story`, etc.) in F001 (`spec.md` Non-Goals).
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts` and `tests/integration/migration-upgrade.test.ts`.
  - **Out-of-scope files/components**: Domain tables belonging to `F002`–`F021`.

- [ ] **T010** `[US3]` Implement race-safe cross-process lock manager (`lock.ts` with `proper-lockfile`), configurable Drizzle migration runner (`migrate.ts`), once-per-process PGlite singleton client (`client.ts`), and `db:migrate` CLI script
  - **Target files/components**: `src/persistence/lock.ts`, `src/persistence/migrate.ts`, `src/persistence/client.ts`, `scripts/db/migrate.ts`
  - **Expected behavior**:
    - In `src/persistence/lock.ts`, implement `acquireDbLock(dbDir: string, processType: 'server' | 'cli:migrate' | 'cli:backup' | 'cli:restore', options?: { staleMs?: number })` using `proper-lockfile` (`lockfile.lock(sentinelPath, { realpath: false, retries: 0, stale: options?.staleMs ?? 10000, update: 2000, onCompromised: (err) => handleLockCompromised(err) })`) on per-directory sentinel `path.resolve(path.dirname(dbDir), `${path.basename(dbDir)}.azusa-lock`)` (`L3`). Keep `<sentinelPath>.lock` strictly empty so `rmdir`/`rmdirSync` unlock and exit cleanup succeed without `ENOTEMPTY` errors (`L1`). Optional diagnostic metadata `{ pid: process.pid, processType, acquiredAt }` may be written outside the lock folder to `${dbDir}.azusa-owner.json` (strictly non-authoritative). Implement `handleLockCompromised` to close PGlite, set `__azusaDbState` to error, and serve 503 instead of crashing Next.js mid-request (`L2`). For CLI commands, abort execution, clean up `.tmp-*`/`.restore-tmp-*` staging directories, roll back active promotion if underway, log to stderr, and exit code 1 (`F3`). After acquiring the lock, every lock holder (server, db:migrate, db:backup, db:restore) waits > 2000ms (just over one 2000ms heartbeat interval) to confirm the heartbeat succeeded and onCompromised has not fired before opening PGlite or reading, copying, or modifying the database folder (F3, G1). If the lock is held or malformed, fail closed immediately with `code: 'ELOCKED'`.
    - In `src/persistence/migrate.ts`, implement programmatic migration execution accepting `{ db, client, dbDir, migrationsFolder?: string, actor?: string }` (`migrationsFolder` defaulting to `path.resolve(process.cwd(), 'src/persistence/migrations')` per `C14`), removing `.azusa-last-healthy.json` before running pending migrations, seeding the `'foundation.init'` record in `app_metadata`, and writing `.azusa-last-healthy.json` upon success (`M1`).
    - In `src/persistence/client.ts`, manage the cross-process lock and once-per-process `globalThis.__azusaDbState` singleton (`M1`):
      - Initialization runs **at most once per process** (`globalThis.__azusaDbState` caches both `'healthy'` and `'error'` outcomes for the lifetime of the server process so subsequent HTTP requests never re-run startup backup on every page load).
      - Expose `getDbContext()`, `closeDbContext()`, and `resetDbStateForTesting()` (for unit/integration test teardown).
      - Validate `PG_VERSION` format when an existing `dbDir` is present so corrupted cluster directories fail deterministically at `stage: 'init'` (`M1`).
    - In `scripts/db/migrate.ts`, implement the CLI entry point for `npm run db:migrate` acquiring the lock for the duration of the migration and releasing it before exit.
  - **Constraints**: Must prevent concurrent server + CLI access and stale-lock takeover races (`M2`), and must run initialization at most once per server process (`M1`).
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts`, `tests/integration/migration-upgrade.test.ts`, and `tests/integration/backup-restore.test.ts`.
  - **Out-of-scope files/components**: UI components.

- [ ] **T011** `[US3]` Implement foundation health and diagnostic check application service
  - **Target files/components**: `src/application/health/health-service.ts`
  - **Expected behavior**:
    - Implement `getFoundationHealth(options?: { dbDir?: string; backupDir?: string; simulatedErrorStage?: 'init' | 'backup' | 'migration' })` returning a Zod-validated `HealthResponse` (`status: 'healthy' | 'error'`, `checkedAt`, `actor`, `database`, `migrations`, `backup`, `latestDiagnostic`, `errors`). Support `simulatedErrorStage` only when `process.env.AZUSA_ALLOW_TEST_FAULT_INJECTION === '1'` and `process.env.NODE_ENV !== 'production'` (`C4`).
    - Implement `recordDiagnosticCheck(input, options?: { actor?: string; dbDir?: string; backupDir?: string })` validating `input` with `DiagnosticCheckRequestSchema`, resolving the actor via `resolveActor(options?.actor)` (`C13`), upserting `'diagnostic.last_check'` in `app_metadata` with UUIDv4 primary key, UTC `created_at` and refreshed `updated_at`, incrementing `checkCount`, and returning `{ ok: true, record, health }`. If the database is in an initialization/backup/migration error state (`status === 'error'`), return `{ ok: false, statusCode: 503, error, stage, recoveryHint }` (`C11`).
  - **Constraints**: Must never swallow initialization, migration, backup, or query errors; any failure populates `errors` with `{ stage, message, recoveryHint }` and sets `status: 'error'`.
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts`.
  - **Out-of-scope files/components**: React components.

- [ ] **T012** `[US3]` Implement `GET /api/health` and `POST /api/health/check` JSON Route Handlers
  - **Target files/components**: `src/app/api/health/route.ts`, `src/app/api/health/check/route.ts`
  - **Expected behavior**:
    - `GET /api/health`: Calls `getFoundationHealth()` (passing `simulatedErrorStage` if header `x-azusa-test-simulate-error` is present and `AZUSA_ALLOW_TEST_FAULT_INJECTION === '1'`), returns `200 OK` when `status === 'healthy'` or `503 Service Unavailable` when `status === 'error'`, with `Cache-Control: no-store`.
    - `POST /api/health/check`: Parses request JSON with strict `DiagnosticCheckRequestSchema` (returning `400 Bad Request` with `issues` on invalid input or unknown fields like `actor`), calls `recordDiagnosticCheck()`, and returns `201 Created` (or `503 Service Unavailable` / `500 Internal Server Error` with `{ ok: false, error, stage, recoveryHint }` on startup/persistence failure) per `contracts/api.md`.
  - **Constraints**: Validate both request and response payloads with Zod schemas from `src/domain/health/schemas.ts`.
  - **Validation/test location**: `tests/integration/persistence-restart.test.ts` and `tests/e2e/foundation-smoke.spec.ts`.
  - **Out-of-scope files/components**: UI shell files.

- [ ] **T013** `[US3]` Add integration tests for PGlite restart persistence (`AC04`), real `init`-stage failure (`M1`), and configurable-folder database migration upgrade & failure reporting (`AC05`)
  - **Target files/components**: `tests/integration/persistence-restart.test.ts`, `tests/integration/migration-upgrade.test.ts`
  - **Expected behavior**:
    - `persistence-restart.test.ts`:
      1. Initializes PGlite in an isolated temp directory, writes a diagnostic record via `recordDiagnosticCheck()`, verifies UUIDv4 format, `checkCount === 1`, and `createdBy === 'local:sm'`, closes the PGlite connection and releases the lock completely (`await closeDbContext()`), reopens a new PGlite client on the same directory, verifies the record UUIDv4, note, timestamps, and actor survive, and verifies a second check increments `checkCount` to `2` while preserving `createdAt` and advancing `updatedAt` (`C12`).
      2. **Real `init`-stage failure test (`M1`)**: Creates a corrupted cluster directory (e.g., invalid `PG_VERSION` / corrupted `global/pg_control`), calls `getFoundationHealth()`, and verifies `status === 'error'`, `database.initialized === false`, and `errors[0].stage === 'init'` with a non-empty `recoveryHint`.
    - `migration-upgrade.test.ts`: Uses isolated temporary `migrationsFolder` directories (`C14`) to verify: (1) initializing an empty database creates `app_metadata`, seeds `'foundation.init'`, and writes `.azusa-last-healthy.json`; (2) applying an incremental second SQL migration on a populated database preserves 100% of existing records (`SC-003`); (3) a malformed SQL migration reports `status === 'error'` with `stage: 'migration'` and leaves `.azusa-last-healthy.json` absent.
  - **Constraints**: Clean up temporary filesystem directories after each test run; never write test migrations into `src/persistence/migrations/`.
  - **Validation/test location**: `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: Backup/restore tests (handled in `T016`).

---

## Phase 04: Deferred-Prune Backup-on-Start, Safe CLI Restore & Active Promotion (User Story 4)

**Purpose**: Implement atomic pre-migration directory backup-on-start (at most once per process, with 10-snapshot retention pruning deferred until after PGlite mounts and migrations succeed per `M1`), exclusive-lock manual CLI backup (`db:backup` without in-place PGlite mutation per `m1`), safe disjoint-path CLI restore (`db:restore`) with staged `.restore-tmp-<uuid>` verification and recoverable `db-replaced-<timestamp>` active promotion + startup recovery (`M3`), and the Playwright test-server bootstrap script (`m2`, `m3`).

- [ ] **T014** `[US4]` Implement atomic pre-migration backup manager with deferred post-migration pruning (`M1`), hash-verified manual backup (`m1`), disjoint restore engine (`C2`), and journaled active promotion/recovery (`M3`)
  - **Target files/components**: `src/persistence/backup.ts`, `src/persistence/client.ts`, `src/application/health/health-service.ts`
  - **Expected behavior**:
    - In `src/persistence/backup.ts`, implement:
      - `recoverInterruptedPromotionIfNeeded(dbDir: string)`: Inspects `<parent(dbDir)>/.azusa-promote-journal.json`. If present and `dbDir` is missing `PG_VERSION` (or `.azusa-last-healthy.json`) while `replacedDir` (`db-replaced-<timestamp>`) has a valid cluster, removes any partial `dbDir`/`.restore-tmp-*`, renames `replacedDir` back to `dbDir`, and deletes the journal; if `dbDir` is already healthy, cleans up the leftover journal while preserving `replacedDir` (`db-replaced-<timestamp>`) for operator inspection and audit (`L4`, `F2`).
      - `createStartupSnapshotIfNeeded({ dbDir, backupDir, actor })`:
        - If `PG_VERSION` does not exist in `dbDir`, returns `{ trigger: 'skipped_cold_start' }`.
        - If `PG_VERSION` exists but `.azusa-last-healthy.json` is absent (meaning the prior startup or migration failed), skips creating a redundant snapshot of the unverified directory so good backups are never displaced (`M1`).
        - Otherwise, removes stale `.tmp-*` folders in `backupDir`, generates a unique `backupId` (`backup-<YYYYMMDD-HHmmss-fff>-startup`, or `backup-<YYYYMMDD-HHmmss-fff>-01-startup` on same-millisecond tie per `INFO`), copies `dbDir` into `<backupDir>/.tmp-<backupId>`, writes `manifest.json` (`BackupManifestSchema`), and atomically renames `.tmp-<backupId>` to `<backupDir>/<backupId>` **without pruning yet** (`M1`).
      - `pruneCompletedStartupBackups(backupDir: string, retentionLimit = 10)`: Invoked by `src/persistence/client.ts` **only after** PGlite mounts, all migrations succeed, and `.azusa-last-healthy.json` is written (`M1`). Deletes completed `-startup` folders (having both `PG_VERSION` and valid `manifest.json`) beyond the 10 newest while never pruning `-manual` folders.
      - `createManualBackup({ dbDir, backupDir, actor })`: Acquires exclusive lock via `acquireDbLock(dbDir, 'cli:backup')` (`C1`, `M2`), verifies `PG_VERSION` exists, copies `dbDir` into `<backupDir>/.tmp-<backupId>`, verifies copied file sizes and SHA-256 digests against the quiescent source directory (without opening PGlite in place on the backup folder per `m1`), writes `manifest.json` (`trigger: 'manual'`), renames `.tmp-<backupId>` to `<backupId>`, and releases the lock.
      - `restoreBackup({ from, to, activeDbDir, backupDir, forceOverwriteActive = false, faultInjectStep?: 'after-move-old' | 'after-move-new' })`:
        1. Canonicalizes `source`, `activeDbDir`, `backupDir`, and `target` (`to` defaulting to `.azusa/data/restored-<YYYYMMDD-HHmmss-fff>`) via `path.resolve` + `fs.realpathSync.native` on existing ancestors, stripping trailing slashes and lowercasing on Windows (`C2`).
        2. Refuses before touching any files if: `target` overlaps `source` or `backupDir`; `target` strictly contains or sits inside `activeDbDir`; `target === activeDbDir` and `!forceOverwriteActive`; `target === activeDbDir` and `forceOverwriteActive` is true but the exclusive lock on `activeDbDir` cannot be acquired (`C1`, `C2`, `M2`); or `target !== activeDbDir` and `target` already exists and is non-empty (`C2`).
        3. Validates that `source` contains `PG_VERSION` and a valid `manifest.json`.
        4. Copies cluster files (excluding `manifest.json`) into `<parent(target)>/.restore-tmp-<uuid>`, opens PGlite on `.restore-tmp-<uuid>`, queries all rows from `app_metadata`, validates `'foundation.init'` presence and every column/field (`id` UUID, `key`, `value`, `created_at`, `updated_at`, `created_by`, `updated_by`) via Zod, writes `.azusa-last-healthy.json`, and closes PGlite (`C1`, `C2`, `C4`).
        5. If verification fails, removes `.restore-tmp-<uuid>` and throws—leaving `target`, `activeDbDir`, and `source` untouched.
        6. For `target !== activeDbDir`: atomically renames `.restore-tmp-<uuid>` to `target`.
        7. For `target === activeDbDir` (`forceOverwriteActive: true`, lock held — `M3`): writes `<parent(activeDbDir)>/.azusa-promote-journal.json`, moves `activeDbDir` to `db-replaced-<timestamp>`, moves `.restore-tmp-<uuid>` to `activeDbDir`, opens PGlite on `activeDbDir` to confirm readability and closes it, preserves `db-replaced-<timestamp>` intact on disk for safety/inspection (cleaning up only `.azusa-promote-journal.json`, `L4`), and outputs retention advice—rolling back `db-replaced-<timestamp>` to `activeDbDir` automatically if the move or post-move check fails!
  - **Constraints**: Must never evict good backups on failed startups (`M1`), must never mutate manual backups in place (`m1`), and must guarantee recoverable active replacement (`M3`).
  - **Validation/test location**: `tests/integration/backup-restore.test.ts`.
  - **Out-of-scope files/components**: Settings UI backup screens (`spec.md` Non-Goal 8).

- [ ] **T015** `[US4, US5]` Implement `db:backup` and `db:restore` CLI scripts and the Playwright isolated server bootstrap script (`scripts/test/start-playwright-server.ts`)
  - **Target files/components**: `scripts/db/backup.ts`, `scripts/db/restore.ts`, `scripts/test/start-playwright-server.ts`
  - **Expected behavior**:
    - `scripts/db/backup.ts`: Invokes `createManualBackup()`, handles `onCompromised` lock loss by cleaning up partial `.tmp-*` folders and exiting code 1 (`F3`), prints JSON summary (`{ ok: true, backupId, backupPath, filesCopied, createdAt }`), and exits `0` (or prints actionable error to stderr and exits `1` if locked by a running server or if no initialized DB exists).
    - `scripts/db/restore.ts`: Parses `--from <id-or-path|latest>`, optional `--to <target-dir>`, and optional `--force-overwrite-active`, invokes `restoreBackup()`, handles `onCompromised` lock loss by rolling back `db-replaced-<timestamp>` to `activeDbDir` (if active promotion was underway) or cleaning up `.restore-tmp-*` and exiting code 1 (`F3`), prints JSON verification summary (`{ ok: true, backupId, restoredTo, recordCount, foundationRecordId }`), and exits `0` (or prints actionable error to stderr and exits `1` on lock contention, path overlap, populated target, or invalid backup).
    - `scripts/test/start-playwright-server.ts` (`m2`, `m3`):
      1. Removes any existing `.azusa/test-playwright/` directory and recreates `.azusa/test-playwright/db` and `.azusa/test-playwright/backups`.
      2. Calls `getDbContext({ dbDir: '.azusa/test-playwright/db', backupDir: '.azusa/test-playwright/backups' })` and `closeDbContext()` so the test database is cleanly migrated, seeded with `'foundation.init'`, and marked with `.azusa-last-healthy.json`, with the lock released.
      3. Spawns `next dev --hostname 127.0.0.1 --port 3100` inheriting the isolated Playwright environment variables, so when the Next.js server boots on port `3100`, it sees the pre-seeded database and creates a real `backup-*-startup` snapshot (`backupCount: 1`, `lastBackupTrigger: 'startup'`) for US4 E2E verification!
  - **Constraints**: Match CLI contract in `specs/001-application-foundations/contracts/api.md` §2.2–§2.3.
  - **Validation/test location**: `tests/integration/backup-restore.test.ts` and `npm run test:e2e`.
  - **Out-of-scope files/components**: UI components.

- [ ] **T016** `[US4]` Add integration tests for child-process lock contention & stale-lock takeover race (`M2`), deferred pruning & backup non-eviction under failed startups (`M1`), disjoint/Windows path safety (`C2`), active promotion rollback & interrupted startup recovery (`M3`), byte-for-byte active-DB preservation (`SC-004`), and full record recovery (`AC06`)
  - **Target files/components**: `tests/integration/backup-restore.test.ts`
  - **Expected behavior**:
    - Test 1 (Cold start): Starting against an uninitialized `dbDir` skips backup cleanly (`lastBackupTrigger === 'skipped_cold_start'`) and initializes the database.
    - Test 2 (Child-process lock contention, clean release, killed-owner recovery & stale-lock takeover race `M2`, `L1`, `L2`, `L3`):
      - Verifies clean lock release followed by immediate fresh acquisition on the same target (`L1`).
      - Spawns a child process holding the lock, kills it with `SIGKILL`, and verifies the lock can be acquired after recovery (`L1`).
      - Creates an expired stale lock using a fixture of `>= 2000ms` (matching proper-lockfile's minimum stale threshold, `L1`), spawns `>= 4` concurrent child processes racing to call `acquireDbLock(dbDir, ...)`, keeps the winning child holding the lock until all contenders attempt acquisition, and asserts that losing contenders halt cleanly before writing anything to the database (`L2`).
      - Tests sibling restore: while a process holds the lock on active `dbDir`, verifies that `restoreBackup()` targeting a sibling directory (e.g. `.azusa/test-playwright/restored`) succeeds without `ELOCKED` (`L3`), and verifies lock contention between two simultaneous restores targeting the exact same target directory (`L3`).
      - Verifies that a corrupted/malformed lock artifact fails closed with `ELOCKED`.
    - Test 2b (Lost-lock simulation & graceful handling for server and CLI commands `G2`):
      - Simulates a lost lock on an active lock holder by deleting `<sentinel>.lock` or modifying its `mtime` to trigger `onCompromised`:
      - **Server lost-lock**: Asserts the server closes PGlite, `GET /api/health` and `POST /api/health/check` return `503 Service Unavailable`, and the error stage is `'init'` with structured recovery diagnostic (`G2`).
      - **db:backup lost-lock**: Asserts that if the lock is lost mid-copy, `db:backup` cleans up its partial `.tmp-*` folder and exits `1` (`G2`).
      - **db:restore lost-lock**: Asserts that if the lock is lost during staging, it cleans up `.restore-tmp-*` and exits `1`; if lost during active promotion, it rolls back `db-replaced-<timestamp>` to `activeDbDir` and exits `1` (`G2`).
      - **Heartbeat wait lost-lock**: Asserts that any lock holder (server or CLI) that loses the lock during the `> 2000ms` post-acquisition heartbeat wait aborts immediately and never opens PGlite or reads/writes to the database folder (`G1`, `G2`).
    - Test 3 (Startup backup, non-mutating manual backup `m1`, full record verification & byte-for-byte `SC-004` check): Writing a diagnostic record, closing DB, and re-running startup creates a `backup-*-startup` snapshot with valid `manifest.json`; running `createManualBackup()` creates a `backup-*-manual` snapshot whose cluster file SHA-256 digests match the quiescent source (`m1`); computing SHA-256 hashes of all files in quiescent `activeDbDir` before and after `restoreBackup()` into a staging directory proves `activeDbDir` is byte-for-byte unchanged (`SC-004`), and querying the restored DB verifies every field (`id`, `key`, `value`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`) matches the original records (`C4`).
    - Test 4 (Retention pruning, same-millisecond `-01-startup` suffix & incomplete `.tmp-*` exclusion): Creating 12 `-startup` snapshots (including same-millisecond tie-breakers `backup-...-01-startup`), 2 `-manual` snapshots, and 1 incomplete `.tmp-backup` folder prunes the incomplete folder and only the 2 oldest completed `-startup` snapshots, leaving 10 `-startup` snapshots and both `-manual` snapshots intact.
    - Test 5 (Non-eviction of good backups under failed startups `M1`): With 10 valid `-startup` backups present, corrupts `dbDir` (or injects a failing migration) and executes 5 repeated `getFoundationHealth()` calls and 5 simulated process restarts (`resetDbStateForTesting()`), asserting that all 10 original good `-startup` backups remain intact and zero good backups are evicted.
    - Test 6 (Path overlap, populated target, Windows case-insensitivity & invalid backup rollback `C2`): Verifies refusal (with zero file changes to `activeDbDir`, `source`, or `target`) when `to` equals `activeDbDir` (including relative/trailing-slash/uppercase variants on Windows) without `forceOverwriteActive: true`, when `to` is a parent or child of `activeDbDir` (even with `forceOverwriteActive: true`), when `to` overlaps `source` or `backupDir`, when `to` is an existing non-empty directory, or when a corrupted backup fails verification inside `.restore-tmp-<uuid>`.
    - Test 7 (Recoverable active promotion rollback & interrupted promotion startup recovery `M3`):
      - Verifies `restoreBackup({ to: activeDbDir, forceOverwriteActive: true })` succeeds when the server is stopped, replacing `activeDbDir` cleanly, preserving `db-replaced-<timestamp>` intact on disk for safety/inspection, and cleaning up `.azusa-promote-journal.json` (`L4`).
      - Injects a failure (`faultInjectStep: 'after-move-old'`) during active promotion after `activeDbDir` has been moved to `db-replaced-<timestamp>` and asserts automatic rollback restores the original `activeDbDir` byte-for-byte.
      - Simulates a mid-promotion crash (leaving `.azusa-promote-journal.json` and `db-replaced-<timestamp>` with missing `activeDbDir/PG_VERSION`) and asserts the next `getDbContext()` startup automatically recovers `db-replaced-<timestamp>` back to `activeDbDir` with all original records intact.
    - Test 8 (Cross-platform backup failure surfacing `C11`, `C14`): Creating a regular file at the `backupDir` path causes startup backup to fail deterministically on Windows/macOS/Linux (`EEXIST`/`ENOTDIR`), halting initialization before PGlite opens and surfacing `status: 'error'` with `stage: 'backup'`.
  - **Constraints**: Use isolated temp directories and clean up on teardown.
  - **Validation/test location**: `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: Browser E2E tests (handled in `T028`).

---

## Phase 05: Application Shell, Kumiko Icons, Today Widget, Placeholder Routes & Tier-1 Visual Suite (User Stories 1, 2 & 3)

**Purpose**: Implement the Azusa visual shell, 25 Kumiko line icons, `asanoha` background lattice, disclosure navigation dropdown, expandable search control, viewer-local `<TodayWidget />`, single-row floating header with `visibility: hidden` overlap protection (`OD4`), error alert banner, foundation status card, and 7 destination route pages, and complete the Tier-1 `npm run test:visual` suite so Phase 05 is 100% self-verifying (`C6`).

- [ ] **T017** `[P]` `[US1]` Implement the 25-icon Kumiko line SVG registry and `<KumikoIcon />` component
  - **Target files/components**: `src/ui/icons/kumiko-icons.ts`, `src/ui/icons/KumikoIcon.tsx`
  - **Match**: `icons/icons.json#L1`, `icons/svg/*.svg`, and `prototype/Icons.dc.html#L18-L37` (incorporating approved Deviation `D1`: apply Kumiko icons across the shell and replace `stroke="#FFFFFF"` on `delivery-flow`'s `M12 12L19.79 7.5` divider path with `stroke="var(--kumiko-surface, #FFFFFF)"`).
  - **Breakpoints/checkpoints**: Size ramp `16px`, `20px`, `24px`, `32px` (plus `18px` menu icon size and `40px` empty-state display); states: default ink (`#1A1B22` / `#67635C`), active menu (`#A65307`), disabled (`#B9B2A8`), and orange accent detail (`#E07F24`).
  - **Translation note**: Lift the exact SVG `<path>` coordinates from `icons/icons.json` into a strongly typed `KumikoIconName` map (`25` icons: `team-board`, `art-board`, `pi-brief`, `capacity`, `iteration`, `dashboard`, `settings`, `search`, `add`, `filter`, `export`, `present`, `refresh`, `warning`, `dependency`, `delivery-flow`, `calendar`, `location`, `clock`, `members`, `risk`, `objective`, `velocity`, `asanoha`, `chevron`) wrapped in `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="miter" strokeMiterlimit={10} strokeLinecap="butt">`.
  - **Provenance**: `lifted from prototype CSS` (`icons/icons.json` and `prototype/Icons.dc.html#L26-L36`).
  - **Constraints**: Zero external icon libraries; preserve exact 60° geometry and mitred joins.
  - **Out-of-scope files/components**: Header and page layout components.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) verifies all navigation and empty-state icons render with `viewBox="0 0 24 24"` and `stroke-width="1.75"`; Tier 2 screenshots reviewed against `screenshots/08-icon-set.png`.

- [ ] **T018** `[P]` `[US1]` Implement the top-right radial-masked `asanoha` SVG lattice background component
  - **Target files/components**: `src/ui/shell/AsanohaBackground.tsx`
  - **Match**: `prototype/Main.dc.html#L20` and `prototype/Settings.dc.html#L20`.
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px` (`aria-hidden="true"`, `position: absolute`, `top: 0`, `right: 0`, `width: 80%`, `aspect-ratio: 1 / 1`, `pointer-events: none`, radial mask from `100% 0`).
  - **Translation note**: Replicate the exact `<svg>` `<pattern id="asanohaBg" width="28" height="48.5" patternUnits="userSpaceOnUse">` path and radial-gradient mask (`rgba(0,0,0,.9) 0%, rgba(0,0,0,.6) 55%, rgba(0,0,0,0) 100%`, stroke `#E2D9CC`, `strokeWidth="1"`).
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L20`).
  - **Constraints**: Decorative background only (`aria-hidden="true"`, `pointer-events: none`, `z-index: 0`).
  - **Out-of-scope files/components**: Header controls and page content.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) confirms `AsanohaBackground` dimensions and `#E2D9CC` pattern stroke at `1440`, `1024`, `768`; Tier 2 screenshots reviewed against `screenshots/01-team-pi-board.png`.

- [ ] **T019** `[P]` `[US1]` Implement the navigation route metadata registry (aligned with `docs/feature-roadmap.md`), `60px` logo disclosure button, and `290px` navigation dropdown
  - **Target files/components**: `src/ui/shell/routes.ts`, `src/ui/shell/NavigationMenu.tsx`
  - **Match**: `prototype/Main.dc.html#L31-L39`, `prototype/Settings.dc.html#L25-L33`, and `prototype/Icons.dc.html#L32-L36` (with Deviations `D1` Kumiko menu icons, `D4` roadmap milestone labels, and `D5` disclosure `<nav>` semantics + `:focus-visible` keyboard outlines).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: menu closed (default `aria-expanded="false"`), menu open (`aria-expanded="true"`, `290px` width, `top: 70px`, `left: 0`, `#FFFFFF`, `border-radius: 16px`, `box-shadow: 0 16px 40px rgba(26,27,34,.16)`), active route item (`aria-current="page"`, `background: #FCEFE2`, `font-weight: 600`, icon color `#A65307`), inactive route item (icon color `#67635C`), keyboard focus-visible, `Escape` and outside-click close.
  - **Translation note**: Wrap in `<nav aria-label="Primary navigation">` (`OD1`, `C8`) containing the `64×64px` logo button (`border: 0`, `border-radius: 14px`, `aria-expanded`, `aria-controls="azusa-primary-nav-menu"`, `<img src="/assets/azusa-logo.png" alt="Azusa" width={60} height={60} />`) and the dropdown container (`id="azusa-primary-nav-menu"`) with grouped sections (`Plan`, `Capacity`, `Sprint`, `Insights`, and top-bordered `Settings` divider `#EFEAE3`) lifted from `prototype/Main.dc.html#L31-L39`. Bind the 7 `<Link>` (`<a>`) elements to `/`, `/program-board`, `/pi-brief`, `/capacity`, `/iteration`, `/dashboard`, and `/settings` with target milestone badges matching `contracts/api.md` §3 (`M2 — Team PI Planning (F008)`, `M3 — ART Planning & Commitment (F012)`, `M2 — Team PI Planning (F011)`, `M1 — Planning Fundamentals (F006)`, `M4 — Sprint Execution (F016)`, `M5 — Metrics & Reporting (F020)`, `M0 — Foundations (F002–F004)`).
  - **Provenance**: Visual geometry `lifted from prototype CSS` (`prototype/Main.dc.html#L31-L39` and `prototype/Icons.dc.html#L32-L36`); disclosure `<nav>` semantics per Deviation `D5` (`OD1`).
  - **Constraints**: Must support opening/closing via mouse click, `Enter`, or `Space`; traversing links via both `Tab`/`Shift+Tab` and `ArrowDown`/`ArrowUp`/`Home`/`End`; and closing on route change, `Escape` key (returning focus to the logo button), or outside click (`AC08`, `SC-005`).
  - **Out-of-scope files/components**: `TodayWidget.tsx` and `ExpandableSearch.tsx`.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) verifies `64×64px` button, `60×60px` logo image, `290px` open menu card, and `#FCEFE2` active state at `1440`, `1024`, `768`; Tier 2 screenshots reviewed against `screenshots/01b-team-pi-board-menu-open.png`.

- [ ] **T020** `[P]` `[US1]` Implement the expandable search control (`40px` circle button to `280px` pill input)
  - **Target files/components**: `src/ui/shell/ExpandableSearch.tsx`
  - **Match**: `prototype/Main.dc.html#L41-L42` and `prototype/Settings.dc.html#L35-L36` (with Deviations `D1` Kumiko `search` icon and `D5` `:focus-visible` outline).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: collapsed (`40×40px` circle button, `#FFFFFF`, `border-radius: 50%`, `aria-label="Search"`), expanded (`280px` width pill label, `min-height: 40px`, `padding: 0 12px`, `border-radius: 20px`, `#FFFFFF`, autofocus `<input type="search">` with placeholder `"Search settings…"` on `/settings` and `"Search stories, features…"` on all other routes), collapse on blur or `Escape`.
  - **Translation note**: Lift the collapsed `<button>` and expanded `<label>` DOM structure and inline token styles directly from `prototype/Main.dc.html#L41-L42` and `prototype/Settings.dc.html#L35-L36`, notifying `FloatingHeader` via `onExpandedChange?: (expanded: boolean) => void` so `FloatingHeader` can hide `TodayWidget` when expanded below `1100px` (`OD4`).
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L41-L42`, `prototype/Settings.dc.html#L35-L36`).
  - **Constraints**: Shell interaction only; do not implement search indexing or result dropdowns (`spec.md` Non-Goal 6).
  - **Out-of-scope files/components**: Backend search APIs.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) verifies `40×40px` collapsed state, `280px` expanded state, and route-specific placeholder text at `1440`, `1024`, `768`; Tier 2 screenshots reviewed against `screenshots/01-team-pi-board.png` and `screenshots/07-settings-locations-holidays.png`.

- [ ] **T021** `[P]` `[US2]` Implement the `<TodayWidget />` component with SSR-safe fixed-height hydration and overlap-hiding support (`OD4`)
  - **Target files/components**: `src/ui/shell/TodayWidget.tsx`
  - **Match**: `prototype/Main.dc.html#L25-L30`, `L155-L189` and `prototype/Settings.dc.html#L24-L38` (with Approved Deviations `D3` & `D5`: Line 1 displays `"No active PI · No active Sprint"` after the divider, Line 2 displays only the viewer's local clock in `#C2650E`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`, and `visibility: hidden` when `hiddenBySearchOverlap` is active below `1100px`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: visible on `/`, `/program-board`, `/pi-brief`, `/capacity`, `/iteration`, `/dashboard`; hidden with `visibility: hidden` (keeping layout space) when search is expanded at `< 1100px`; omitted on `/settings`.
  - **Translation note**: Lift the `<div role="timer" aria-label="Current date, calendar week, PI and sprint status, and local time">` structure (`position: absolute; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 3px`) and typography directly from `prototype/Main.dc.html#L25-L30`:
    - Line 1 (`12.5px`, `font-weight: 600`, `color: #3F3C37`, `letter-spacing: .03em`, `tabular-nums`, `white-space: nowrap`): `YYYY/MM/DD` · `CWww.d` `|` (`1px × 12px` `#D8D1C6` divider) `No active PI` · `No active Sprint`.
    - Line 2: Viewer-local clock `HHMMh` in `18px` `IBM Plex Mono` `font-weight: 600` `color: #C2650E` + timezone label in `10.5px` `font-weight: 600` `color: #67635C`, computed via `getTodayWidgetModel()` from `src/domain/calendar/iso-week.ts`, populated on mount in `useEffect` (with fixed-height `tabular-nums` layout and `suppressHydrationWarning`) and refreshing every `15000ms`.
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L25-L30`, `L178`).
  - **Constraints**: Must not invent an active PI or Sprint (`AC03`); must avoid SSR/client hydration mismatch warnings and layout shift.
  - **Out-of-scope files/components**: Multi-member team location clocks (deferred to `F002`/`F003`).
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) verifies `TodayWidget` presence on `/`, absence on `/settings`, `#C2650E` clock color, `IBM Plex Mono` font, and `visibility: hidden` when search is expanded at `1024`/`768`; Tier 2 screenshots reviewed against `screenshots/01-team-pi-board.png` and `screenshots/07-settings-locations-holidays.png`.

- [ ] **T022** `[US1, US2]` Implement the single-row floating header container (`FloatingHeader.tsx`) and `"SM"` profile badge (`OD4`)
  - **Target files/components**: `src/ui/shell/FloatingHeader.tsx`
  - **Match**: `prototype/Main.dc.html#L24-L44` and `prototype/Settings.dc.html#L24-L38` (with Deviation `D5` expanded-search overlap hiding below `1100px` per `OD4`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px` (single-row header at all widths; when search is collapsed `TodayWidget` and all controls fit without overlap down to `768px`; when search is expanded below `1100px`, `TodayWidget` gets `visibility: hidden` so controls never overlap, and restores `visibility: visible` when search collapses).
  - **Translation note**: Replicate the prototype's single-row `<header>` container (`display: flex; align-items: center; gap: 10px; padding: 14px 28px 0 22px; position: relative; z-index: 20`), mounting `NavigationMenu` on the left, `TodayWidget` in the center (omitted on `/settings`, with CSS/state setting `visibility: hidden; pointer-events: none` when `isSearchExpanded` is true on viewports `< 1100px`), a flex spacer, `ExpandableSearch`, and the `40×40px` `"SM"` account button (`border-radius: 50%; border: 0; background: #1A1B22; color: #FFFFFF; font-size: 13px; font-weight: 600; aria-label="Account"`).
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L24-L44`), with `visibility: hidden` expanded-search rule per `OD4`.
  - **Constraints**: Transparent single-row floating header with no background bar, no second row, and no compaction.
  - **Out-of-scope files/components**: Page body components.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) verifies single-row header layout, `40×40px` `"SM"` badge, zero overlap when search is collapsed at `1440`/`1024`/`768`, and `visibility: hidden` on `TodayWidget` when search is expanded at `1024`/`768`; Tier 2 screenshots reviewed against `screenshots/01-team-pi-board.png`.

- [ ] **T023** `[P]` `[US3]` Implement the accessible error alert banner (`role="alert"`) for persistence/migration/backup failures
  - **Target files/components**: `src/ui/shell/ErrorAlertBanner.tsx`
  - **Match**: `prototype/Main.dc.html#L108` and `L133-L134` semantic error token styling (`#FDECEA` background, `#B42318` text, `1.5px solid #D9443A` border, Kumiko `warning` icon) per Deviation `D5`.
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: hidden when `errors.length === 0`, visible (`role="alert"`) when initialization, migration, or startup backup fails.
  - **Translation note**: Use Azusa's semantic error palette from `AZUSA_HANDOFF.md` §14.2 (`#FDECEA` surface, `#B42318` heading/text, `#D9443A` border) and the Kumiko `warning` icon to display each failing stage (`init` / `backup` / `migration` / `query`), message, and `recoveryHint` referencing `docs/operations/database-and-recovery.md`.
  - **Provenance**: `recreated manually` (Deviation `D5`: required by Feature Brief §2.2, `AC05`, and Clarification Q3 to surface initialization, migration, and backup failures visibly; prototype screens only depict happy-path sample data).
  - **Constraints**: Status must not be conveyed by color alone—include the Kumiko `warning` icon and explicit stage label (`Constitution Principle VII`).
  - **Out-of-scope files/components**: Database persistence logic.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; verified in `tests/e2e/foundation-smoke.spec.ts` (`T028`).

- [ ] **T024** `[P]` `[US3]` Implement the compact Foundation Status Card component with diagnostic check trigger
  - **Target files/components**: `src/ui/shell/FoundationStatusCard.tsx`
  - **Match**: `prototype/Main.dc.html#L131-L137` card surface and semantic status chip tokens (`#FFFFFF` card, `border-radius: 14px`, `padding: 18px`, `#E7F3EA`/`#256B3B` healthy badge, `#FDECEA`/`#B42318` error badge, `#1A1B22` primary action button from `prototype/Main.dc.html#L57`, `IBM Plex Mono` `tabular-nums` for IDs/timestamps) per Deviation `D4`.
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: healthy, loading/submitting diagnostic check, error state.
  - **Translation note**: Compose a flat white Azusa card displaying:
    - Database status (`initialized`, `recordCount`, `foundationRecordId`),
    - Migrations status (`appliedCount`),
    - Startup backup status (`lastBackupId`, `lastBackupTrigger`, `backupCount / 10`),
    - Latest diagnostic check record (`id`, `note`, `checkCount`, `updatedAt`, `updatedBy: "local:sm"`), and
    - A primary button (`"Record diagnostic check"`) that calls `POST /api/health/check` and updates the displayed health state so `AC04` restart persistence can be verified interactively in the browser.
  - **Provenance**: `recreated manually` (Deviation `D4`: required by Clarification Q3 and `AC04`/`AC07` to surface local persistence, migration, and backup state without introducing premature domain tables).
  - **Constraints**: Must use flat surface styling (`border: 0`, `#FFFFFF` background, `tabular-nums`) and non-color-only text labels (`Healthy` / `Error`).
  - **Out-of-scope files/components**: Domain board/chart widgets.
  - **Done when**: `npm run typecheck` and `npm run lint` pass; verified in Tier-1 `npm run test:visual` (`T027`) and `tests/e2e/foundation-smoke.spec.ts` (`T028`).

- [ ] **T025** `[US1, US3]` Implement the shared `<PlaceholderScreen />` and root `<AppShell />` layout
  - **Target files/components**: `src/ui/shell/PlaceholderScreen.tsx`, `src/ui/shell/AppShell.tsx`
  - **Match**: `prototype/Main.dc.html#L19-L23`, `L46-L58`, `prototype/Settings.dc.html#L40-L54`, and `prototype/Icons.dc.html#L29` (`asanoha` brand mark for empty states) per Deviation `D4`.
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`.
  - **Translation note**:
    - `AppShell.tsx` replicates the root flex container (`min-height: 100vh; width: 100%; background: #F4F1EC; font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #1A1B22; position: relative; overflow-x: hidden`), rendering `AsanohaBackground`, `FloatingHeader`, `ErrorAlertBanner` (when errors exist), and `<main>`.
    - `PlaceholderScreen.tsx` renders the standardized page title row (`<h1>` in `Zen Kaku Gothic New` `700` `28px`, route subtitle in `14px` `#67635C`, and a reserved page-controls region on the right), an explicit empty-state card featuring the `40px` Kumiko `asanoha` mark, the target milestone/feature badge from `docs/feature-roadmap.md` (`contracts/api.md` §3, clearly stating the screen is a non-operational placeholder in F001 per `AC02`), and the `FoundationStatusCard`.
  - **Provenance**: Outer shell and page title row `lifted from prototype CSS` (`prototype/Main.dc.html#L19-L23`, `L46-L58`); placeholder notice panel `recreated manually` (Deviation `D4` per `AC02`).
  - **Constraints**: Future functionality must never be presented as operational (`AC02`).
  - **Out-of-scope files/components**: Prototype sample data arrays (`S`, `FEAT`, `CAT`, `locs`, `months`).
  - **Done when**: `npm run typecheck` and `npm run lint` pass; Tier 1 (`npm run test:visual` in `T027`) green at `1440`, `1024`, `768`; Tier 2 screenshots reviewed.

- [ ] **T026** `[US1, US2, US3]` Mount all 7 navigation destination route pages in `src/app/`
  - **Target files/components**: `src/app/page.tsx`, `src/app/program-board/page.tsx`, `src/app/pi-brief/page.tsx`, `src/app/capacity/page.tsx`, `src/app/iteration/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/settings/page.tsx`
  - **Expected behavior**:
    - Each route page reads incoming request headers (supporting `x-azusa-test-simulate-error` when `AZUSA_ALLOW_TEST_FAULT_INJECTION === '1'`), fetches initial `getFoundationHealth()` on the server (`dynamic = 'force-dynamic'`), and renders `<AppShell currentPath={...} health={health}><PlaceholderScreen route={...} initialHealth={health} /></AppShell>` matching the route metadata table in `contracts/api.md` §3 (`/`, `/program-board`, `/pi-brief`, `/capacity`, `/iteration`, `/dashboard`, `/settings`).
  - **Constraints**: Keep all 7 routes server-rendered with `force-dynamic` so fresh database/migration/backup status is reflected on load.
  - **Validation/test location**: `npm run build`, `npm run test:run`, and `npm run lint`.
  - **Out-of-scope files/components**: Unimplemented sub-routes.

- [ ] **T027** `[US1, US2, US3]` Complete and verify the Tier-1 visual-fidelity suite (`npm run test:visual`) and Tier-2 frozen-state screenshot review
  - **Target files/components**: `tests/visual/shell-fidelity.spec.ts`
  - **Expected behavior**:
    - Using frozen browser time (`page.clock.install({ time: new Date('2026-11-08T11:30:00.000Z') })`) and `timezoneId: 'Asia/Manila'` against `http://127.0.0.1:3100` (`reuseExistingServer: false`), verify across `1440px`, `1024px`, and `768px` viewports:
      1. Page background `#F4F1EC`, surface `#FFFFFF`, ink `#1A1B22`, and top-right `asanoha` SVG lattice (`width: 80%`, stroke `#E2D9CC`).
      2. Locally loaded `Zen Kaku Gothic New`, `IBM Plex Sans`, and `IBM Plex Mono` with zero external requests to `fonts.googleapis.com` or `fonts.gstatic.com`.
      3. `64×64px` logo button containing `60×60px` logo image, `290px` navigation dropdown (`<nav aria-label="Primary navigation">`) with all 7 Kumiko line icons (`viewBox="0 0 24 24"`, `stroke-width="1.75"`) and `#FCEFE2` / `#A65307` (`aria-current="page"`) active route styling.
      4. `TodayWidget` (`role="timer"`) typography, `#C2650E` viewer clock color (`1930h` + `PHT`), `"2026/11/08 · CW45.7"` + `"No active PI · No active Sprint"` label on `/`, and omission on `/settings`.
      5. `ExpandableSearch` `40×40px` circle button expanding to `280px` input (`"Search stories, features…"` on `/` and `"Search settings…"` on `/settings`) and `40×40px` `"SM"` profile badge.
      6. Single-row header non-overlap and expanded-search hiding check (`OD4`):
         - With search **collapsed** (`40px`): assert `TodayWidget` has `visibility: 'visible'` and assert zero bounding-box intersection between `LogoButton`, `TodayWidget`, `ExpandableSearch`, and `ProfileBadge` at `1440px`, `1024px`, and `768px`.
         - With search **expanded** (`280px`): at `1440px` assert `TodayWidget` is visible with zero bounding-box intersection; at `1024px` and `768px` (below `1100px`, where expanded search would overlap `TodayWidget`), assert `TodayWidget` has `computedStyle.visibility === 'hidden'`, and when search collapses (`Escape`), assert `TodayWidget` restores `computedStyle.visibility === 'visible'`.
      7. Capture frozen-state screenshots at `1440px`, `1024px`, and `768px` and visually compare against `screenshots/01-team-pi-board.png`, `screenshots/01b-team-pi-board-menu-open.png`, `screenshots/07-settings-locations-holidays.png`, and `screenshots/08-icon-set.png`.
  - **Constraints**: Must run deterministically against isolated `.azusa/test-playwright/` storage on port `3100` (`C5`, `C6`, `m3`).
  - **Validation/test location**: `npm run test:visual`, `npm run test:run`, and `npm run lint`.
  - **Out-of-scope files/components**: E2E workflow tests in `tests/e2e/` (handled in `T028`).

---

## Phase 06: End-to-End Browser Smoke & `@axe-core/playwright` Accessibility Suite (User Stories 1–5)

**Purpose**: Implement the comprehensive Playwright E2E browser smoke and `@axe-core/playwright` accessibility test suite (`npm run test:e2e`) covering User Stories 1–5, keyboard interactions (`Tab`, `Enter`, `Space`, `ArrowDown`, `ArrowUp`, `Escape`), fault-injected error-banner verification, diagnostic persistence, and pre-seeded startup backup + safe restore verification (`C4`, `C5`, `C8`, `m2`, `m3`).

- [ ] **T028** `[US1, US2, US3, US4, US5]` Implement Playwright E2E smoke and `@axe-core/playwright` accessibility suite (`tests/e2e/foundation-smoke.spec.ts`)
  - **Target files/components**: `tests/e2e/foundation-smoke.spec.ts`
  - **Expected behavior**:
    - Runs against `http://127.0.0.1:3100` (`reuseExistingServer: false`, pre-seeded `.azusa/test-playwright/` storage via `scripts/test/start-playwright-server.ts`) with frozen clock (`2026-11-08T11:30:00.000Z`) and `Asia/Manila` timezone (`C5`, `m2`, `m3`):
      1. **US1 & SC-005 (Navigation, Roadmap Badges & Zero Axe Violations)**:
         - Navigates all 7 menu destinations (`/`, `/program-board`, `/pi-brief`, `/capacity`, `/iteration`, `/dashboard`, `/settings`), verifying route titles, non-operational placeholder notices, and roadmap milestone badges (`M2 — Team PI Planning (F008)`, `M3 — ART Planning & Commitment (F012)`, `M2 — Team PI Planning (F011)`, `M1 — Planning Fundamentals (F006)`, `M4 — Sprint Execution (F016)`, `M5 — Metrics & Reporting (F020)`, `M0 — Foundations (F002–F004)` per `OD3`).
         - Verifies keyboard-only menu and search operation: opening the menu with `Space` and `Enter`, moving between menu items with both `Tab`/`Shift+Tab` and `ArrowDown`/`ArrowUp`/`Home`/`End`, closing with `Escape` (verifying focus returns to the logo button), and expanding/collapsing search via keyboard (`C4`, `OD1`).
         - Runs `new AxeBuilder({ page }).analyze()` on `/` (default state, open navigation dropdown state, expanded search state) and `/settings`, asserting `violations` is `[]` (`SC-005`, `C4`).
      2. **US2 (Viewer-Local Today Widget)**:
         - Verifies `2026/11/08 · CW45.7`, `No active PI · No active Sprint`, and `1930h PHT` on `/`, and verifies `TodayWidget` is absent on `/settings` while search placeholder is `"Search settings…"`.
      3. **US3 & C4 (Diagnostic Persistence & Fault-Injected Error Banner)**:
         - Clicks **"Record diagnostic check"** on the Foundation Status Card, verifies `POST /api/health/check` returns `201` and `GET /api/health` returns `200` with UUIDv4, incremented `checkCount`, and `createdBy: "local:sm"`, and confirms reloading the page retains the persisted record.
         - Simulates `init`, `migration`, and `backup` failures using `page.setExtraHTTPHeaders({ 'x-azusa-test-simulate-error': stage })` and verifies `GET /api/health` returns `503` and the shell renders `<ErrorAlertBanner role="alert" />` with stage label, message, and `docs/operations/database-and-recovery.md` recovery hint (`C4`, `C11`).
      4. **US4 & US5 (Pre-Seeded Startup Backup Surface & Safe Restore Verification — `m2`)**:
         - Because `scripts/test/start-playwright-server.ts` pre-seeded `.azusa/test-playwright/db` prior to booting `next dev` on port `3100`, verifies that the Foundation Status Card and `GET /api/health` report `backup.lastBackupTrigger === 'startup'`, `backup.backupCount === 1`, `backup.retentionLimit === 10`, and a non-null `backup.lastBackupId`.
         - Invokes `restoreBackup({ from: 'latest', to: '.azusa/test-playwright/restored', activeDbDir: '.azusa/test-playwright/db', backupDir: '.azusa/test-playwright/backups' })` and asserts the pre-migration startup snapshot restores cleanly into `.azusa/test-playwright/restored` with intact `'foundation.init'` metadata while `.azusa/test-playwright/db` remains untouched (`m2`).
  - **Constraints**: All tests must pass deterministically with zero external network dependencies and without touching `.azusa/data/`.
  - **Validation/test location**: `npm run test:e2e`, `npm run test:run`, and `npm run lint`.
  - **Out-of-scope files/components**: Application production code outside `tests/e2e/`.

---

## Phase 07: Release Prep (MANDATORY)

**Purpose**: Synchronize version metadata and author all 8 required Constitution Principle VI documentation artifacts (`README.md`, `CHANGELOG.md`, `docs/REPO_MAP.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md`, and `docs/operations/database-and-recovery.md`), verified by an automated documentation completeness test (`T035`). *(Per `C7`/`m4` and `docs/feature-roadmap.md:8`, `F001` remains unchecked in `docs/feature-roadmap.md` until conformance review and operator UAT acceptance complete.)*

- [ ] **T029** `[US5]` Synchronize version (`0.1.0`) and create `CHANGELOG.md`
  - **Target files/components**: `package.json`, `package-lock.json`, `CHANGELOG.md`
  - **Expected behavior**:
    - Ensure `package.json` and `package-lock.json` root `version` are synchronized at `0.1.0`.
    - Create `CHANGELOG.md` with the initial `0.1.0 (2026-11-08)` release entry summarizing Feature 001 (`Application Foundation`: Next.js + strict TypeScript foundation bound to `127.0.0.1`, PGlite + Drizzle persistence with `proper-lockfile` cross-process lock, `app_metadata`, and `"local:sm"` audit plumbing, deferred-prune atomic startup backup and recoverable CLI restore, Azusa design tokens, local `@fontsource` fonts, 25 Kumiko line icons, application shell across 7 placeholder routes, quality gates, and foundational documentation).
  - **Constraints**: Keep human-readable application version history distinct from internal PI Plan Versioning (`Constitution Principle VI`).
  - **Validation/test location**: Inspect `package.json`, `package-lock.json`, and `CHANGELOG.md`.
  - **Out-of-scope files/components**: Application source code.

- [ ] **T030** `[P]` `[US5]` Update `README.md` with setup (including `npx playwright install chromium`), run, test, stop/start backup & restore, and documentation navigation
  - **Target files/components**: `README.md`
  - **Expected behavior**: Replace the pre-implementation placeholders in `README.md` (`Prerequisites`, `Installation`, `Configuration`, `Running Locally`, `Testing`) with accurate Node.js 20+ prerequisites, `npm install`, `npx playwright install chromium` (`C14`), optional env vars (`AZUSA_DB_DIR`, `AZUSA_BACKUP_DIR`, `AZUSA_ACTOR_ID`, `AZUSA_NEXT_DIST_DIR`, `NEXT_TELEMETRY_DISABLED`), `npm run db:migrate`, `npm run dev` (`http://127.0.0.1:3000`), the explicit stop-server-first sequence for `npm run db:backup` and `npm run db:restore` (`C1`), quality gate commands (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`), and clickable links to all documents in `docs/`.
  - **Constraints**: Must match `specs/001-application-foundations/quickstart.md` and `package.json` scripts exactly (`AC01`, `AC09`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T031** `[P]` `[US5]` Create `docs/REPO_MAP.md`
  - **Target files/components**: `docs/REPO_MAP.md`
  - **Expected behavior**: Document the repository's major directories, module responsibilities, entry points (`src/app/`, `src/ui/`, `src/domain/`, `src/application/`, `src/persistence/`, `scripts/db/`, `scripts/test/`, `tests/`, `docs/`, `specs/`), architectural layer boundaries (what `src/domain/` may and may not import), and common modification paths for upcoming features (`F002`–`F021`).
  - **Constraints**: Architectural navigation guide, not an exhaustive file dump (`Feature Brief` §2.4).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T032** `[P]` `[US5]` Create `docs/architecture/overview.md` and ADR `0001-local-first-nextjs-pglite-foundation.md`
  - **Target files/components**: `docs/architecture/overview.md`, `docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md`
  - **Expected behavior**:
    - `docs/architecture/overview.md`: Describe the local-first Next.js + PGlite + Drizzle architecture, presentation/domain/persistence boundaries, `proper-lockfile` cross-process lock + once-per-process singleton lifecycle, startup failure state machine, deferred-prune atomic startup backup, and staged/recoverable safe restore flow with Mermaid component/data-flow diagrams.
    - `docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md`: Record context, decision, rationale, and trade-offs for choosing a single Next.js App Router app on `127.0.0.1`, embedded PGlite + Drizzle ORM with `proper-lockfile`, deferred-prune pre-migration directory snapshots, disclosure navigation semantics, and Tailwind CSS + CSS token variables.
  - **Constraints**: Reflect implemented F001 behavior accurately (`Constitution Principle VI`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T033** `[P]` `[US5]` Create `docs/architecture/domain-model.md` and `docs/architecture/data-dictionary.md`
  - **Target files/components**: `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`
  - **Expected behavior**:
    - `docs/architecture/domain-model.md`: Codify the approved Azusa conceptual domain model (`docs/azusa-data-model.md` v0.4, `docs/feature-roadmap.md` `M0`–`M5`, and `AZUSA_HANDOFF.md` §§7–12, 20), explicitly documenting:
      1. Organization, Calendar, ±1 working-day Team offset rules, and IANA timezone storage with fixed-offset lookup (`PHT`, `IST`, `JST`, `SGT`, `UTC`) + `UTC±offset` display formatting (`never GMT`, `OD2`/`m5`) (`F002`, `F003`),
      2. Capacity formula (`F004`, `F006`, `F007`: canonical integer minutes, PI days vs Sprint hours, 4-Sprint rolling ratio-of-sums normalized velocity, non-story overhead deductions),
      3. Work hierarchy & ownership (`F005`, `F008`, `F009`, `F012`: `Project` -> single-Team `Feature` -> `Story` with `StorySlice` within one PI; separate `Bug` work-item type in `Bugs` category; directed `Dependency` and `ExternalDependency`; view-scoped `BoardPlacement`),
      4. Strict separation of `PlanVersion` (`v1`, `v2`… in `F010`), `PICommitment` (`Start PI` in `F013`), `SprintCommitment` (`Start Sprint` in `F015`), `SprintClosure`/`Actuals` (`Close Sprint` in `F017`), and `StateChange` (`F014`) (`Constitution Principle III`), and
      5. The three Sprint lifecycle date concepts (`scheduled`, `effective`, and `recorded_at`).
    - `docs/architecture/data-dictionary.md`: Document all implemented F001 persistence structures (`app_metadata` table columns, types, constraints, standard keys `'foundation.init'` and `'diagnostic.last_check'`, reusable `auditColumns()` fields with UUIDv4 and `$onUpdate`, `<basename(dbDir)>.azusa-lock`, `.azusa-last-healthy.json`, `.azusa-promote-journal.json`, and backup `manifest.json` fields).
  - **Constraints**: Clearly distinguish implemented F001 physical tables (`data-dictionary.md`) from the conceptual domain model (`domain-model.md`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T034** `[P]` `[US5]` Create `docs/operations/database-and-recovery.md`
  - **Target files/components**: `docs/operations/database-and-recovery.md`
  - **Expected behavior**: Provide step-by-step developer operations procedures for local database initialization, running Drizzle migrations (`npm run db:migrate`), `proper-lockfile` cross-process lock behavior, automatic startup backup behavior and deferred 10-snapshot retention pruning, stopping the server before creating manual backups (`npm run db:backup`), safely restoring backups to a disjoint non-active staging directory (`npm run db:restore`), the recoverable active promotion procedure (`--force-overwrite-active` with `db-replaced-<timestamp>` preservation and interrupted-promotion startup recovery, `L4`), operational notes on the 10-second lock stale interval and 2-second heartbeat update (`INFO`), retention and manual cleanup of `db-replaced-<timestamp>` directories (`L4`), and troubleshooting initialization/migration/backup alert banners.
  - **Constraints**: Must match implemented CLI flags and safety rules in `scripts/db/` and `src/persistence/backup.ts` (`AC06`, `AC09`, `C1`, `C2`, `M1`, `M2`, `M3`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` (`T035`).
  - **Out-of-scope files/components**: `src/`.

- [ ] **T035** `[US5]` Add automated documentation completeness & link verification test (`tests/unit/docs-completeness.test.ts`)
  - **Target files/components**: `tests/unit/docs-completeness.test.ts`
  - **Expected behavior**:
    - Verify that all 8 required Constitution Principle VI documentation artifacts (`README.md`, `CHANGELOG.md`, `docs/REPO_MAP.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md`, and `docs/operations/database-and-recovery.md`) exist on disk, are non-empty, contain no leftover `TBD`/`TODO` placeholders, and every relative markdown link in `README.md` resolves to an existing file (`AC09`).
    - Verify `docs/feature-roadmap.md` lists all 21 features (`F001`–`F021`) across `M0`–`M5` and leaves `F002`–`F021` unchecked (`m4`).
  - **Constraints**: Read-only verification test in `tests/unit/docs-completeness.test.ts`; do not check off `F001` in `docs/feature-roadmap.md` before conformance review and operator UAT (`m4`).
  - **Validation/test location**: `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: `docs/feature-roadmap.md`.

---

## Phase 08: Browser Smoke Test & Post-UAT Roadmap Acceptance (MANDATORY)

**Purpose**: Walk each user story's **Independent Test** in a real browser against the final to-be-merged state (after Release Prep), confirm all 7 quality gates pass (`Constitution Principles II, V, VI, VII`), and record `F001` completion in `docs/feature-roadmap.md` only after conformance review (`agent-06-check-implementation.md`) and explicit operator UAT acceptance (`m4`, `docs/feature-roadmap.md:8`).

- [ ] **T036** `[US1]` Walk User Story 1 Independent Test in a real browser
  - **Target files/components**: Running application at `http://127.0.0.1:3000` (read-only verification of `src/ui/shell/*`, `src/ui/icons/*`, `src/app/*`)
  - **Expected behavior**:
    - Launch Azusa locally and verify the `#F4F1EC` background, top-right radial-masked `asanoha` lattice, locally bundled `Zen Kaku Gothic New`, `IBM Plex Sans`, and `IBM Plex Mono` fonts (zero external font/API requests in DevTools Network tab), `60px` logo button, and `40px` `"SM"` profile badge.
    - Open the `290px` navigation dropdown via mouse and keyboard (`Tab`, `Enter`/`Space`, `ArrowDown`/`ArrowUp`, `Escape`), navigate across all 7 destinations (`/`, `/program-board`, `/pi-brief`, `/capacity`, `/iteration`, `/dashboard`, `/settings`), confirm active item highlight (`#FCEFE2` / `#A65307`, `aria-current="page"`), confirm Kumiko icons render cleanly, confirm each route shows its roadmap milestone badge (`docs/feature-roadmap.md`) and explicit non-operational placeholder notice, and verify the `40px` → `280px` expandable search control (including `visibility: hidden` on `TodayWidget` when search is expanded below `1100px`).
  - **Constraints**: Read-only verification against the post-Release-Prep tree.
  - **Validation/test location**: Browser verification + `npm run test:visual` + `npm run test:e2e`.
  - **Out-of-scope files/components**: Source code edits unless a regression is discovered.

- [ ] **T037** `[US2]` Walk User Story 2 Independent Test in a real browser
  - **Target files/components**: Running application at `http://127.0.0.1:3000/` and `http://127.0.0.1:3000/settings`
  - **Expected behavior**:
    - On `/`, verify the centered Today widget (`role="timer"`) displays accurate viewer-local date (`YYYY/MM/DD`), ISO week/weekday (`CWww.d`), `"No active PI · No active Sprint"`, and viewer-local 24-hour clock (`HHMMh ZONE`) in `#C2650E` `IBM Plex Mono`.
    - Navigate to `/settings` and verify the Today widget is omitted from the header and the search input placeholder reads `"Search settings…"`.
  - **Constraints**: Read-only verification.
  - **Validation/test location**: Browser verification + `tests/e2e/foundation-smoke.spec.ts`.
  - **Out-of-scope files/components**: Source code edits.

- [ ] **T038** `[US3]` Walk User Story 3 Independent Test across a full server stop and restart
  - **Target files/components**: Running application Foundation Status Card and `GET /api/health` / `POST /api/health/check`
  - **Expected behavior**:
    - Click **"Record diagnostic check"** on the Foundation Status Card, record the displayed UUIDv4, `checkCount`, UTC timestamps, and `local:sm` actor.
    - Stop the Next.js server process completely, restart it, reload the browser, and confirm the persisted record UUIDv4, `checkCount`, timestamps, and `"local:sm"` audit fields remain intact after the restart (`AC04`).
  - **Constraints**: Must test an actual process stop and restart against `.azusa/data/db`.
  - **Validation/test location**: Browser + CLI verification + `tests/integration/persistence-restart.test.ts`.
  - **Out-of-scope files/components**: Source code edits.

- [ ] **T039** `[US4]` Walk User Story 4 Independent Test for automatic backup-on-start, exclusive lock refusal, and safe CLI restore
  - **Target files/components**: `.azusa/data/backups/`, `npm run db:backup`, `npm run db:restore`
  - **Expected behavior**:
    - Confirm that restarting the server produced a timestamped `backup-*-startup` directory in `.azusa/data/backups/` with a valid `manifest.json`.
    - While the server is running, verify `npm run db:backup` refuses with exit code `1` due to active database lock `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` (`C1`, `M2`, `L3`, `F1`).
    - Stop the running server (`Ctrl+C`), run `npm run db:backup`, and run `npm run db:restore -- --from latest`; confirm the CLI restores the snapshot into a separate target directory (`.azusa/data/restored-*`) and verifies all record fields while `.azusa/data/db` remains byte-for-byte untouched (`AC06`, `SC-004`).
    - Confirm running `npm run db:restore -- --from latest --to .azusa/data/db` without `--force-overwrite-active` aborts with exit code `1`.
    - Clean up temporary `.azusa/data/restored-*` directories and restart the server.
  - **Constraints**: Follow the documented stop/start sequence (`C1`).
  - **Validation/test location**: CLI execution + `tests/integration/backup-restore.test.ts`.
  - **Out-of-scope files/components**: Source code edits.

- [ ] **T040** `[US5]` Run final full quality gate verification and (after conformance review & operator UAT sign-off) record F001 completion in `docs/feature-roadmap.md`
  - **Target files/components**: Full repository verification suite; `docs/feature-roadmap.md` (updated only after conformance review and explicit operator UAT acceptance)
  - **Expected behavior**:
    1. **Step 1 (Quality Gates First — `m4`)**: Execute `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run test:visual`, and `npm run test:e2e`, confirming all 7 verification commands exit `0` (`AC07`, `SC-006`).
    2. **Step 2 (Conformance Review & Operator UAT Gate — `m4`)**: Present the completed Phase 08 verification results for post-implementation conformance review (`agent-06-check-implementation.md`) and explicit operator UAT acceptance (`docs/feature-roadmap.md:8`). Keep `F001` unchecked (`- [ ] **F001 — Application Foundation**`) in `docs/feature-roadmap.md` while conformance review or operator UAT is pending.
    3. **Step 3 (Post-UAT Roadmap Update — `m4`)**: Once conformance review passes and the operator explicitly grants UAT acceptance, check off `- [x] **F001 — Application Foundation**` and update the progress footer (`1/21 features implemented`) in `docs/feature-roadmap.md`, and re-run `npm run test:run` and `npm run lint` to confirm green status.
  - **Constraints**: Never check off `F001` in `docs/feature-roadmap.md` before quality gates, conformance review, and operator UAT are all completed (`m4`, `docs/feature-roadmap.md:8`).
  - **Validation/test location**: Terminal output of all 7 verification commands + recorded operator UAT sign-off.
  - **Out-of-scope files/components**: `M0` milestone checkbox and `F002`–`F021` rows in `docs/feature-roadmap.md`.
