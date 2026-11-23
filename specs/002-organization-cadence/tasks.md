# Tasks: Organization & PI Cadence (F002)

**Branch**: `002-organization-cadence` | **Date**: 2026-11-23 (Updated for Review Pass 2 — OD-1..OD-10 & R2-1..R2-4)  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/api.md](./contracts/api.md)

## Conventions

- **Status legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel marker**: `[P]` indicates tasks touching distinct files with no shared edits that can run in parallel within the same phase
- **Phase dependencies**: `01 → 02 → 03 → 04 → 05 → 06 → 07 → 08` (every phase is additive and leaves the test suite and linter green)
- **Verification commands**: `npm run test:run` · `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run build` · `npm run test:visual` · `npm run test:e2e`

## Phase Summary

| Phase | Focus | Task IDs | User Stories |
|---|---|---|---|
| **Phase 01** | Dependency Setup & Pure Organization / Cadence / Holiday Domain | `T001–T004` | `US1, US2, US3, US4, US5` |
| **Phase 02** | Drizzle Schema (10 Tables), Migration `0001`, Idempotent Seeder & Golden Seed Tests | `T005–T007` | `US1, US2, US3, US5` |
| **Phase 03** | Transactional Application Services & Integration Tests | `T008–T011` | `US1, US2, US3, US5` |
| **Phase 04** | Local HTTP API Route Handlers (`/api/organization/*`) | `T012–T014` | `US1, US2, US3, US4` |
| **Phase 05** | Live Shell Context, `/organization` Header, Profile Menu, Today Widget & Visual Fidelity | `T015–T019` | `US4` |
| **Phase 06** | `/organization` Workspace UI & E2E / Accessibility Suite | `T020–T024` | `US1, US2, US3, US4` |
| **Phase 07** | Release Prep (Version Sync & Living Documentation) | `T025–T030` | `US5` |
| **Phase 08** | Browser Smoke Test & Post-UAT Roadmap Acceptance | `T031–T035` | `US1, US2, US3, US4, US5` |

---

## Phase 01: Dependency Setup & Pure Organization / Cadence / Holiday Domain

**Purpose**: Install `date-holidays` (ISC, offline), configure Next.js `serverExternalPackages`, and implement all pure TypeScript domain rules (roles, holiday seed/override/unconfirmed rules, Mon–Fri Sprint weekday validation & offset math, PI/Iteration overlap & containment, `YYWW` helper, Today cadence resolver & Sprint prefix formatting, active-context reconciliation, strict Zod v4 schemas) with deterministic Vitest unit tests before touching persistence or UI.

- [ ] **T001** `[US3, US5]` Add `date-holidays` dependency and Next.js `serverExternalPackages` entry
  - **Target files/components**: `package.json`, `package-lock.json`, `next.config.ts`
  - **Expected behavior**:
    - Install `date-holidays` (ISC licence) into `dependencies` in `package.json` and update `package-lock.json`.
    - Add `'date-holidays'` alongside `'@electric-sql/pglite'` in `serverExternalPackages` in `next.config.ts`.
  - **Constraints**: Offline local library only; do not modify `distDir`, `NEXT_TELEMETRY_DISABLED`, or existing F001 scripts.
  - **Validation/test location**: `npm run typecheck`, `npm run lint`, and `npm run test:run` exit `0`.
  - **Out-of-scope files/components**: `src/persistence/`, `src/ui/`.

- [ ] **T002** `[P]` `[US1, US3, US5]` Implement Member roles, Holiday domain rules, and strict Zod v4 schemas with unit tests
  - **Target files/components**: `src/domain/organization/roles.ts`, `src/domain/organization/holidays.ts`, `src/domain/organization/schemas.ts`, `tests/unit/organization-roles-schemas.test.ts`
  - **Expected behavior**:
    - In `roles.ts`, export `MEMBER_ROLES = ['Admin', 'RTE', 'SM', 'PO', 'Team member'] as const` (excluding tentative `Business Owner`) and `contributesToDevCapacity(role): boolean` returning `false` for `'PO'` and `'SM'` and `true` for `'Admin'`, `'RTE'`, and `'Team member'`.
    - In `holidays.ts`, export:
      - `getHolidaySeedYears(referenceYear: number): number[]` returning sorted unique years covering `[referenceYear - 1, referenceYear + 2] ∪ {2026, 2027, 2028}`.
      - `isEstimatedHolidayRule(rule?: string): boolean` returning `true` (`confirmed = false`) iff the `date-holidays` rule uses an Islamic/Hijri moon-sighting calendar expression (`F5`), and `false` (`confirmed = true`) for fixed/solar/Easter/Chinese lunisolar rules (including SG Chinese New Year).
      - `resolveEffectiveLocationHolidays(rows)` returning `company`/`manual` rows in preference to `library` rows when both exist on the same `date` (`F3`).
    - In `schemas.ts`, define strict Zod v4 schemas (`.strict()` rejecting unknown keys and any `actor`/`createdBy`/`updatedBy` fields) for all entity create/update payloads (using `recordStatus: 'active' | 'archived'`, Member move `{ teamId?, effectiveDate? }`, `sprintOffsetWorkdays` strictly `-1 | 0 | 1`, `fteFactor` `> 0 && <= 1.0`, ISO 3166-1/3166-2 & `Intl.DateTimeFormat`-validated IANA `timeZone`, dated-only `Absence`), plus path UUIDv4 and query parameter schemas (`includeArchived`, `year`, `trainId`, `teamId`).
    - Write unit tests in `tests/unit/organization-roles-schemas.test.ts` covering valid payloads, `PO`/`SM` exclusion, Hijri `confirmed = false` vs Chinese New Year `confirmed = true`, effective holiday override precedence, invalid offsets (`-2`, `2`, `0.5`), invalid FTE (`0`, `1.01`), malformed UUID/query params, invalid timezones, actor injection rejection, and undated Absence rejection.
  - **Constraints**: Pure TypeScript + `zod` only; zero React, Drizzle, PGlite, `date-holidays`, or `node:fs` imports.
  - **Validation/test location**: `tests/unit/organization-roles-schemas.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: Persistence tables and API routes.

- [ ] **T003** `[P]` `[US2, US4, US5]` Implement pure cadence date math, Mon–Fri Sprint boundary validation, weekday Team offset, `YYWW` helper, overlap/containment validators, and Today cadence resolver with unit tests
  - **Target files/components**: `src/domain/organization/cadence.ts`, `src/domain/calendar/iso-week.ts`, `tests/unit/organization-cadence.test.ts`
  - **Expected behavior**:
    - In `cadence.ts`:
      - Export `isWeekday(isoDate: string): boolean` and enforce Mon–Fri weekday `startDate` and `endDate` on Iterations (`OD-1`).
      - Export `shiftWorkdays(isoDate: string, offsetWorkdays: -1 | 0 | 1): string` shifting Monday–Friday weekdays only (Mon `-1` → previous Fri; Fri `+1` → next Mon; `0` unchanged).
      - Export `computeTeamIterationSchedule(iteration, teamId, offsetWorkdays)` returning `TeamIterationSchedule` with canonical dates and Team-scheduled dates kept distinct.
      - Export `suggestYywwName(endDate: string): string` using `computeIsoCalendarWeek` on `endDate` (`YYWW`, ISO week-year accurate).
      - Export `dateRangesOverlap(a, b)`, `validatePiNoOverlap(candidate, activeSiblings)`, `validateIterationInPi(candidate, pi, siblings)`, and `validatePiContainsIterations(updatedPi, childIterations)`.
      - Export `formatTodaySprintLabel(name: string): string` (`OD-5`: returns `Sprint <name>`, skipping `Sprint ` when `/^sprint\b/i.test(name)`, no IP marker) and `resolveTodayCadenceStatus(todayIsoDate, selectedPi, teamSchedules)` (`OD-2`, `OD-5`: matches `todayIsoDate` against **Team-shifted** dates including days just outside canonical PI bounds, with safety-net tie-break preferring the Sprint whose canonical range contains `todayIsoDate`, never implying commitment).
    - Extend `getTodayWidgetModel(date, timeZone?, cadenceOverride?)` in `src/domain/calendar/iso-week.ts` keeping `"No active PI · No active Sprint"` as default.
    - Write unit tests in `tests/unit/organization-cadence.test.ts` covering:
      - Saturday/Sunday Iteration start or end rejected (`OD-1`).
      - No two shifted Sprints of one Team ever share a day (within a PI and across consecutive PIs in the same ART).
      - `-1` Team matched on the Friday before the PI's canonical Monday start, and `+1` Team matched on the Monday after the PI's canonical Friday end (`OD-2`).
      - Safety-net tie-break on crafted overlapping shifted Sprint data (`OD-2`).
      - Sprint label formatting: `2706` → `Sprint 2706`, `Sprint 5` → `Sprint 5`, `sprint 12` → `sprint 12` (`OD-5`).
      - `2026-12-31`/`2027-01-01` ISO `YYWW` boundaries, touching-date overlap vs gap allowance, cross-ART overlap allowance, and PI shrink rejection when a child Iteration falls outside.
  - **Constraints**: Pure TypeScript only; dates are never derived from names.
  - **Validation/test location**: `tests/unit/organization-cadence.test.ts` and `tests/unit/iso-week.test.ts` via `npm run test:run`.
  - **Out-of-scope files/components**: Capacity engine (`F004`), `NETWORKDAYS` with holidays (`F004`).

- [ ] **T004** `[P]` `[US4]` Implement pure active-context reconciliation and profile subtitle formatter with unit tests
  - **Target files/components**: `src/domain/organization/context.ts`, `tests/unit/organization-context.test.ts`
  - **Expected behavior**:
    - Export `reconcileActiveContext(tree, stored)` resolving valid `{ train, team, pi }` from active ARTs that have `>= 1` active Team (`OD-7`), with deterministic fallback when stored IDs are missing, archived, or deleted (returning nulls when no active Teams exist).
    - Export `formatProfileSubtitle(selected)` returning `"<Team> · <ART>"` or `"No ART or team configured"`.
    - Write unit tests covering empty org, ART with zero Teams omitted, valid stored selection, archived/deleted ART/Team/PI fallback, and subtitle formatting.
  - **Constraints**: Pure TypeScript; zero browser `localStorage` or React imports.
  - **Validation/test location**: `tests/unit/organization-context.test.ts` via `npm run test:run` and `npm run lint`.
  - **Out-of-scope files/components**: `OrganizationContext.tsx` (`T015`).

---

## Phase 02: Drizzle Schema (10 Tables), Migration `0001`, Idempotent Seeder & Golden Seed Tests

**Purpose**: Create the 10 physical Drizzle tables (including `member_team_assignments`), generate and commit SQL migration `0001_organization_cadence.sql`, share `APP_VERSION` across migrate and restore, implement the idempotent `date-holidays` seeder inside `runMigrations()`, and verify F001→F002 upgrade, frozen 2027 golden holiday fixtures, and backup/restore round-trip integrity.

- [ ] **T005** `[US1, US2, US3]` Define Drizzle schemas for all 10 organization/calendar tables and commit SQL migration `0001_organization_cadence.sql`
  - **Target files/components**: `src/persistence/schema/organization.ts`, `src/persistence/schema/calendar.ts`, `src/persistence/schema/index.ts`, `src/persistence/migrations/0001_organization_cadence.sql`, `src/persistence/migrations/meta/_journal.json`, `src/persistence/migrations/meta/0001_snapshot.json`
  - **Expected behavior**:
    - Define `trains`, `teams`, `members` (**without** `team_id`, per `OD-8`), `member_team_assignments` (`OD-4`, `OD-8`, `OD-9`), `pis` (with separate `lifecycle_status` and `record_status`, `F6`), `iterations` in `organization.ts`, and `locations` (with `record_status`, `seeded_years`, `library_seed_cutoff_date`, `OD-3`, `R2-1`), `holidays`, `absence_types`, `absences` in `calendar.ts`.
    - Spread `auditColumns()` on every table, use `ON DELETE RESTRICT` on all foreign keys, add case-insensitive `lower(trim(...))` unique indexes (`trains.name`, `(teams.train_id, teams.name)`, `(pis.train_id, pis.name)`, `(iterations.pi_id, iterations.name)`, `locations.code`, `absence_types.code`), partial unique index `member_team_assignments_member_open_unique` (`WHERE end_date IS NULL`), partial unique index `holidays_library_identity_unique` on `(location_id, date, name) WHERE source = 'library'` (`F3`), and SQL `CHECK` constraints matching `data-model.md`.
    - Re-export all tables from `src/persistence/schema/index.ts` without modifying `app_metadata`.
    - Generate and review `0001_organization_cadence.sql` and Drizzle journal/snapshot metadata via `drizzle-kit generate`.
  - **Constraints**: Zero `ON DELETE CASCADE`; zero `PlanVersion`/`PICommitment`/`SprintCommitment`/`Actuals`/`Category`/`Team.deduction_mode` tables or columns.
  - **Validation/test location**: `tests/integration/organization-migration-seed.test.ts` (`T007`).
  - **Out-of-scope files/components**: `src/persistence/schema/app-metadata.ts`, `src/persistence/lock.ts`.

- [ ] **T006** `[US3, US5]` Implement shared `APP_VERSION`, idempotent reference-data seeder (`seed.ts`), and wire into `runMigrations()` and `backup.ts`
  - **Target files/components**: `src/persistence/version.ts`, `src/persistence/seed.ts`, `src/persistence/migrate.ts`, `src/persistence/backup.ts`
  - **Expected behavior**:
    - Create `src/persistence/version.ts` exporting `APP_VERSION = '0.1.0'` (bumped to `'0.2.0'` in Phase 07 `T025`) and use it in both `src/persistence/migrate.ts` and `src/persistence/backup.ts` (replacing hardcoded `'0.1.0'` at `backup.ts:467`) so migration and restore markers stay synchronized (`F10`). Keep `foundation.init.schemaVersion = '0000_foundation_init'` intentionally (initial seed label).
    - In `seed.ts`, export `seedReferenceData(db, options?)` (accepting injectable `today?: string` per `R2-3`), `seedLocationHolidays(db, location, years, options?)`, and `reseedFutureLocationHolidays(db, location, todayIsoDate, years, options?)`:
      - Idempotently insert the 6 initial Locations (`PH`, `SG`, `AU-WA`, `IN`, `UK`, `US-TX` with calendar source `"Federal holidays, US · TX"`) if absent by case-insensitive `code` (never overwriting operator edits).
      - Verify `date-holidays` `IN`/`KA` subdivision support in the pinned library version; if `new Holidays('IN', 'KA')` returns no holidays/unsupported state, fall back cleanly to country-level `new Holidays('IN')`, change the seeded `IN` `calendar_source` label to `"Public holidays, IN"`, and record the verified behavior for ADR `0002`.
      - Check `locations.seeded_years` (`R2-1`): compute `missingYears = targetYears.filter(y => !location.seededYears.includes(y))`. If `missingYears.length === 0`, skip seeding and do **not** update `last_refreshed_at` (`F4`). Otherwise seed only `missingYears`, filtering out any holiday with `date < location.library_seed_cutoff_date` (when cutoff is set), with `source = 'library'`, `portion = 'full'`, `confirmed = !isEstimatedHolidayRule(rule)` using `onConflictDoNothing()` on `holidays_library_identity_unique`, merge `missingYears` into `seeded_years`, and update `last_refreshed_at`.
      - Idempotently insert the 6 initial `AbsenceType` records (`AL`, `SL`, `HD` with `affects_capacity: true`; `BT`, `WFH`, `ON_SITE` with `affects_capacity: false`) if absent by case-insensitive `code`.
    - Call `await seedReferenceData(db, { actor })` inside `runMigrations()` after `migrate()` and `'foundation.init'` upsert, and **before** writing `.azusa-last-healthy.json`.
  - **Constraints**: Never seed fake ARTs, Teams, Members, PIs, or Iterations (`Deviation D4`); never modify `app_metadata` keys.
  - **Validation/test location**: `tests/integration/organization-migration-seed.test.ts` (`T007`).
  - **Out-of-scope files/components**: UI holiday editing (`F005`).

- [ ] **T007** `[US3, US5]` Add integration tests for F001→F002 migration upgrade, frozen 2027 golden holiday fixtures, cutoff/rollover/override rules, and backup/restore round-trip
  - **Target files/components**: `tests/integration/organization-migration-seed.test.ts`
  - **Expected behavior**:
    - Test 1 (Upgrade & golden 2027 holiday fixtures, `F9`, `R2-3`): Pass fixed `today = '2026-11-23'`, apply `0000_foundation_init.sql` + insert `diagnostic.last_check`, then upgrade via `0001_organization_cadence.sql` + `seedReferenceData({ today })`; assert 100% of F001 `app_metadata` rows survive, all 6 Locations and 6 `AbsenceType` records exist, and assert the pinned `date-holidays` 2027 golden fixtures from Handoff §10 (`AU-WA`: Jan 26, Mar 1; `US-TX`: Jan 18, Feb 15; `SG`: Feb 8 confirmed, Mar 10 `confirmed = false`; `IN`: Jan 26; `PH`: Feb 25 — dropping/documenting any fixture the pinned library does not produce).
    - Test 2 (Idempotency, immutable `code`, `last_refreshed_at` stability & override preservation, `F3`, `F4`, `R2-2`): Insert a `company` holiday override and a `confirmed: false` manual holiday on a seeded Location, edit a seeded Location's display name (`code` stays immutable), re-run `seedReferenceData({ today })`; assert zero duplicate Locations or Holidays, `last_refreshed_at` did NOT change on no-op re-seed, operator Location edit preserved, and `company`/`manual` overrides untouched and supersede `library` rows via `resolveEffectiveLocationHolidays()`.
    - Test 3 (Region-change cutoff & year-rollover seeding, `R2-1`): Edit a Location's `country_code`/`subdivision_code` at `today = '2026-11-23'`, asserting `library_seed_cutoff_date === '2026-11-23'` and past library rows preserved; simulate restart (`seedReferenceData({ today: '2026-11-23' })`) and year rollover (`seedReferenceData({ today: '2027-01-10' })` adding `2029` to the seed window), asserting zero library rows are ever inserted before `'2026-11-23'`.
    - Test 4 (Backup/restore round-trip & synchronized `appVersion`, `F10`): Insert F002 records (ART, Team, Member + assignment, PI, Iteration, Absence), run `createManualBackup()` + `restoreBackup()` into a disjoint staging directory, and verify 100% of F002 rows recover intact, active DB is untouched, and restored `.azusa-last-healthy.json` records `APP_VERSION`.
  - **Constraints**: Isolated temp directories cleaned up on teardown; never touch `.azusa/data/`.
  - **Validation/test location**: `npm run test:run` and `npm run lint` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 03: Transactional Application Services & Integration Tests

**Purpose**: Implement transactional application services enforcing all F002 domain invariants, Member Team transfers (`member_team_assignments`), Location archiving & jurisdiction re-seeding, archive/reactivate/delete guards, and F004/F005 reference-data contracts, backed by comprehensive PGlite integration tests.

- [ ] **T008** `[P]` `[US1]` Implement typed organization errors and ART / Team / Member service (date-resolved membership, future moves, same-day correction, cancel pending move)
  - **Target files/components**: `src/application/organization/errors.ts`, `src/application/organization/organization-service.ts`
  - **Expected behavior**:
    - Define `OrganizationError` subclasses (`ValidationError` → `400`, `NotFoundError` → `404`, `ConflictError` → `409`) with consistent `{ code, message, details }` formatting.
    - All date-sensitive methods accept injectable `today?: string` (defaulting to server local `YYYY-MM-DD`, `R2-3`).
    - Implement `listTrains`, `createTrain`, `updateTrain`, `deleteTrain`, `listTeams`, `createTeam`, `updateTeam`, `deleteTeam`, `listMembers` (date-resolved by `asOf ?? today` from `member_team_assignments`, `OD-8`), `createMember`, `updateMember`, `cancelPendingMemberMove` (`OD-8`), `deleteMember`:
      - Reject creating a Team under an archived ART (`409`), creating a Member under an archived Team or archived Location (`409`), archiving a Team with pending incoming moves (`start_date > today`, `409`, `OD-8`), or reactivating a child whose parent ART/current Team is archived (`409`, `F7`); allow reactivating a Member whose Location is archived (they keep their archived Location).
      - `teams.train_id` is immutable after creation.
      - On `createMember`: insert Member and open initial `member_team_assignments` row (`start_date = today`, `end_date = null`) in the same transaction (`OD-8`).
      - On `updateMember` with `teamId` (`OD-8`, `OD-9`, `OD-11`): `effectiveDate = input.effectiveDate ?? today`:
        - `effectiveDate < today` → `400 VALIDATION_ERROR` (no backdating).
        - `latestRow.start_date > today && effectiveDate < latestRow.start_date` → `400 VALIDATION_ERROR` stating the pending move must be cancelled first.
        - **Unified cancel-pending-move check (before active-destination-Team check)**: if `latestRow.start_date > today`, `effectiveDate === latestRow.start_date`, and destination `teamId` equals the immediately preceding row's `team_id`, delegate to the exact same cancel-pending-move logic as `cancelPendingMemberMove` (delete pending row and reopen preceding row with `end_date = null`), succeeding even if the original Team has since been archived.
        - Otherwise verify destination Team is active (`409`; cross-ART and moving an archived Member allowed):
          - `effectiveDate === latestRow.start_date` (`OD-9` same-day or pending correction to another active Team) → update `latestRow.team_id` in place.
          - `effectiveDate > latestRow.start_date` → if `latestRow.start_date > today` (pending move already exists) reject `409 CONFLICT`; else close `latestRow` at `effectiveDate - 1 day` and insert new open row (`start_date = effectiveDate, end_date = null`).
      - On `cancelPendingMemberMove(memberId, { today, actor })`: delete the pending row (`start_date > today`, `404` if none) and reopen the immediately preceding row (`end_date = null`) atomically.
      - Hard delete guards: ART blocked if Teams/PIs exist (`409`); Team blocked if any `member_team_assignments` row (past, current, or pending) references it (`409`); Member blocked if `absences` exist (`409`), otherwise deletes its own `member_team_assignments` rows and Member in one transaction.
  - **Constraints**: All mutations run inside Drizzle transactions; zero React/HTTP imports.
  - **Validation/test location**: `tests/integration/organization-persistence.test.ts` (`T011`).
  - **Out-of-scope files/components**: HTTP Route Handlers (`T012`).

- [ ] **T009** `[P]` `[US2, US4]` Implement PI, Iteration, Team-schedule, and active context tree service
  - **Target files/components**: `src/application/organization/cadence-service.ts`
  - **Expected behavior**:
    - Implement `listPis`, `createPi`, `updatePi`, `deletePi`, `listIterations` (validating PI exists `404`, and when `teamId` supplied validating Team exists `404` and `team.trainId === pi.trainId` else `409`, `F7`), `createIteration`, `updateIteration`, `deleteIteration`, and `getOrganizationContextTree()` (returning only active ARTs with `>= 1` active Team, their active Teams, and their active PIs with canonical Iterations, `OD-7`).
    - Enforce inside transactions: Mon–Fri weekday Iteration dates (`400`, `OD-1`); active parent ART/PI required for create (`409`); active parent ART required on PI reactivation (`409`); PI non-overlap among active PIs within same ART (`409`); cross-ART overlap allowed; Iteration non-overlap and containment within `[pi.start_date, pi.end_date]` (`409`); PI date edits rejected if any child Iteration falls outside (`409`); PI hard delete blocked when Iterations exist (`409`); `pis.lifecycle_status` defaults to `'planning'` and is not mutated in F002 (`F6`).
  - **Constraints**: Never mutate canonical `Iteration` rows for Team offsets; never parse dates from names.
  - **Validation/test location**: `tests/integration/organization-persistence.test.ts` (`T011`).
  - **Out-of-scope files/components**: `Start PI` / `Start Sprint` commitments (`F012`/`F013`).

- [ ] **T010** `[P]` `[US3]` Implement Location (with immutable `code`, archive & cutoff jurisdiction re-seed), Holiday, AbsenceType, and Absence reference service
  - **Target files/components**: `src/application/organization/calendar-reference-service.ts`
  - **Expected behavior**:
    - Accept injectable `today?: string` (defaulting to server local `YYYY-MM-DD`, `R2-3`).
    - Implement `listLocations`, `createLocation` (validating unique case-insensitive `code`, ISO codes, IANA `timeZone`, seeding `date-holidays` for `getHolidaySeedYears(referenceYear)` if supported, setting `seeded_years` and `last_refreshed_at`), `updateLocation` (omitting immutable `code` per `R2-2`; supporting `recordStatus: 'active' | 'archived'` per `OD-3`; if `countryCode` or `subdivisionCode` changed, setting `library_seed_cutoff_date = today`, deleting future `date >= today` library rows, re-seeding future library rows across `targetYears`, updating `seeded_years` and `last_refreshed_at` while preserving historical library rows and all `company`/`manual` rows per `F3`/`R2-1`), `deleteLocation` (blocked `409` if referenced by Members or Holidays), `listLocationHolidays` (attaching effective override status), `createHoliday`, `listAbsenceTypes`, and `createAbsence` / `listMemberAbsences` / `updateAbsenceStatus` (enforcing required ISO `date`, applying active conflict checks **only** among `AbsenceType.affects_capacity = true` types per `OD-10`, returning `409` on capacity-reducing conflict).
  - **Constraints**: Preserve `Holiday.source` and `Holiday.confirmed`; attendance-only AbsenceTypes (`WFH`, `ON_SITE`, `BT`) never conflict.
  - **Validation/test location**: `tests/integration/organization-persistence.test.ts` (`T011`).
  - **Out-of-scope files/components**: Team Calendar UI (`F005`).

- [ ] **T011** `[US1, US2, US3, US5]` Add comprehensive PGlite integration tests for organization, cadence, future/same-day Team moves, Location archive/cutoff, and capacity-only Absence conflicts
  - **Target files/components**: `tests/integration/organization-persistence.test.ts`
  - **Expected behavior**:
    - Use explicit fixed `today` dates (`R2-3`) across all assertions.
    - Verify ART/Team/Member CRUD, case-insensitive uniqueness, >13 Members across multiple Locations, `PO`/`SM` `contributesToDevCapacity === false`, default `hours_per_day = 8.0`, immutable `trainId`, and invalid offset rejection (`-2`, `+2`).
    - Verify date-resolved Team moves (`OD-8`, `OD-9`, `OD-11`):
      - Future-dated move (`effectiveDate > today`) leaves current roster unchanged until `effectiveDate`, switches roster when queried `asOf = effectiveDate`.
      - **No backdating (`OD-11`)**: Member created on `2026-11-01`; on `today = '2026-11-23'`, submitting `effectiveDate = '2026-11-01'` (past correction) returns `400 VALIDATION_ERROR`, and submitting `effectiveDate = '2026-11-10'` (past split) returns `400 VALIDATION_ERROR`.
      - Move dated before an existing pending move (`today <= effectiveDate < pending.start_date`) returns `400 VALIDATION_ERROR` instructing to cancel the pending move first; second pending move (`effectiveDate > pending.start_date`) returns `409 CONFLICT`.
      - Cancelling pending move deletes future row and reopens prior row (`end_date = null`); correcting a pending move back to the original Team collapses/cancels the pending move (reopening prior row, leaving 1 row without consecutive same-Team rows); **archived original Team test**: schedule move Team A → Team B, archive Team A, and assert **both** `cancelPendingMemberMove` (`DELETE /pending-move`) and `updateMember` (`PATCH` redirecting pending move back to Team A) succeed identically, deleting the pending row and reopening Team A's assignment.
      - Same-day correction (`OD-9`): creating Member and correcting Team on same day (`effectiveDate === today`) leaves 1 history row; correcting pending move's destination to a third active Team updates pending row in place.
      - Archiving a Team with pending incoming move rejected (`409`); moving to archived Team rejected (`409`); old Team delete blocked by historical assignment (`409`); unreferenced Member delete removes its assignments cleanly.
    - Verify PI/Iteration rules (`OD-1`, `F6`, `F7`): weekend Iteration start/end returns `400`, `lifecycle_status = 'planning'` distinct from `record_status`, PI non-overlap within ART, cross-ART overlap accepted, Iteration non-overlap & PI containment, gaps allowed, custom Sprint naming without date change, cross-ART `teamId` on `listIterations` returns `409`, and `TeamIterationSchedule` `-1`/`0`/`+1` weekday shifts preserve canonical ART dates with zero shared days.
    - Verify archive/reactivate/delete guards (`OD-3`, `F7`): archiving parent never auto-archives children, child creation or reactivation under archived parent returns `409`, archived Location rejects new/moved Member (`409`) while existing Members keep it and a Member whose Location is archived **can** be reactivated, and jurisdiction edit sets `library_seed_cutoff_date = today` preserving past library & `company`/`manual` overrides (`R2-1`).
    - Verify capacity-only Absence conflicts (`OD-10`): `WFH full + HD pm` allowed; `ON_SITE full + SL pm` allowed; `AL full + SL full` rejected (`409`); `AL full + HD am` rejected (`409`); undated Absence rejected (`400`).
  - **Constraints**: Isolated temp DB per suite; clean up on teardown.
  - **Validation/test location**: `npm run test:run` and `npm run lint` exit `0`.
  - **Out-of-scope files/components**: Playwright browser tests (`T024`).

---

## Phase 04: Local HTTP API Route Handlers (`/api/organization/*`)

**Purpose**: Expose thin Next.js App Router Route Handlers wrapping Phase 03 services with strict path/query/body Zod validation, actor isolation, `Cache-Control: no-store`, and structured `400`/`404`/`409`/`503` error responses per `contracts/api.md`.

- [ ] **T012** `[P]` `[US1]` Implement ART, Team, and Member HTTP Route Handlers (including cancel pending move)
  - **Target files/components**: `src/app/api/organization/trains/route.ts`, `src/app/api/organization/trains/[id]/route.ts`, `src/app/api/organization/teams/route.ts`, `src/app/api/organization/teams/[id]/route.ts`, `src/app/api/organization/members/route.ts`, `src/app/api/organization/members/[id]/route.ts`, `src/app/api/organization/members/[id]/pending-move/route.ts`
  - **Expected behavior**: Implement `GET`/`POST`/`PATCH`/`DELETE` handlers per `contracts/api.md` §§2–4 (validating UUIDv4 path/query params, `?asOf=YYYY-MM-DD`, and strict JSON bodies; supporting Member `teamId`/`effectiveDate` future/same-day moves and `DELETE /api/organization/members/[id]/pending-move`; mapping `OrganizationError` and `FoundationError` (`503`) to structured JSON error envelopes; never reading actor fields from request bodies).
  - **Constraints**: Thin handlers only — all validation and business rules live in `src/domain/` and `src/application/`.
  - **Validation/test location**: `npm run typecheck`, `npm run lint`, and `npm run test:run`.
  - **Out-of-scope files/components**: UI components.

- [ ] **T013** `[P]` `[US2, US4]` Implement Context, PI, and Iteration HTTP Route Handlers (consistent `[id]` segment — `F1`)
  - **Target files/components**: `src/app/api/organization/context/route.ts`, `src/app/api/organization/pis/route.ts`, `src/app/api/organization/pis/[id]/route.ts`, `src/app/api/organization/pis/[id]/iterations/route.ts`, `src/app/api/organization/iterations/[id]/route.ts`
  - **Expected behavior**: Implement `GET /api/organization/context` (active ARTs with `>= 1` active Team) and PI/Iteration CRUD handlers per `contracts/api.md` §§1, 5, using the consistent `[id]` dynamic segment under `pis/[id]/iterations/route.ts` (`F1`) and validating `?teamId=<uuid>` (returning `400` on invalid UUID, `404` on missing PI/Team, `409` on cross-ART Team, `F7`).
  - **Constraints**: `Cache-Control: no-store` on all responses; strict Zod path/query/body parsing.
  - **Validation/test location**: `npm run typecheck`, `npm run lint`, and `npm run test:run`.
  - **Out-of-scope files/components**: UI components.

- [ ] **T014** `[P]` `[US3]` Implement Location and Holiday read HTTP Route Handlers
  - **Target files/components**: `src/app/api/organization/locations/route.ts`, `src/app/api/organization/locations/[id]/route.ts`, `src/app/api/organization/locations/[id]/holidays/route.ts`
  - **Expected behavior**: Implement Location `GET`/`POST`/`PATCH`/`DELETE` (supporting `includeArchived`, `recordStatus`, and jurisdiction re-seed on `PATCH`) and `GET /api/organization/locations/[id]/holidays?year=...` per `contracts/api.md` §6.
  - **Constraints**: Read-only holiday endpoint in F002 (operational holiday editing belongs to F005).
  - **Validation/test location**: `npm run typecheck`, `npm run lint`, and `npm run test:run`.
  - **Out-of-scope files/components**: Operational Absence HTTP endpoints (`F005`).

---

## Phase 05: Live Shell Context, `/organization` Header, Profile Menu, Today Widget & Visual Fidelity

**Purpose**: Wire `OrganizationContextProvider` into `AppShell`, implement the faithful `Main.dc.html` header context breadcrumb on primary routes, match `Settings.dc.html`'s uncluttered header on `/organization` (`OD-6`), update `ProfileMenu` and `TodayWidget`, and verify visual fidelity and backwards compatibility using the **Visual-Fidelity Task Pattern**.

- [ ] **T015** `[US4]` Implement `OrganizationContextProvider` with `localStorage` persistence and wire into `AppShell`
  - **Target files/components**: `src/ui/shell/OrganizationContext.tsx`, `src/ui/shell/AppShell.tsx`
  - **Expected behavior**:
    - Fetch `GET /api/organization/context` on mount, reconcile with `localStorage` key `azusa:active-context:v1` via `reconcileActiveContext()`, expose `{ trains, selected, setTeamId, setPiId, refresh, loading }` (selecting a Team automatically sets its parent ART and reconciles the PI for that ART per `OD-7`).
    - Wrap `AppShell` children + `FloatingHeader` in `OrganizationContextProvider` without SSR hydration warnings.
  - **Constraints**: Keep `app_metadata` untouched; when zero active Teams exist, keep exact F001 empty-state context.
  - **Validation/test location**: `npm run typecheck`, `npm run lint`, and `npm run test:run`.
  - **Out-of-scope files/components**: `/organization` panels (`Phase 06`).

- [ ] **T016** `[US4]` Implement `HeaderContextSelector` (`ART › Team › PI`) and route-aware `FloatingHeader` + `ExpandableSearch`
  - **Target files/components**: `src/ui/shell/HeaderContextSelector.tsx`, `src/ui/shell/FloatingHeader.tsx`, `src/ui/shell/ExpandableSearch.tsx`, `src/ui/shell/shell.module.css`
  - **Match**: `prototype/Main.dc.html#L35-L39` (`screenshots/01-team-pi-board.png`) on the 9 primary routes (`OD-7`: plain-text `<ART>` link to `/program-board`, `›`, Team dropdown listing active Teams grouped under ART headings, `›`, PI dropdown for that ART; omitted completely when zero active Teams exist), AND `prototype/Settings.dc.html#L24-L38` (`screenshots/07-settings-locations-holidays.png`) on `/organization` (`OD-6`: logo + search with placeholder `"Search organization…"` + profile only, omitting `HeaderContextSelector` and `TodayWidget`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: empty-org (hidden), primary-route populated collapsed, Team/PI picker open (mutually exclusive with logo menu, profile menu, and search), `/organization` header (no breadcrumb, no Today widget, `"Search organization…"`), keyboard `Enter`/`Space`/`ArrowDown`/`ArrowUp`/`Escape`, `:focus-visible`.
  - **Translation note**: Lift the `<nav aria-label="Context">` flex layout, plain-text `<a href="/program-board">` ART link (`#67635C`, `14px`, `600`), `›` separators (`#B9B2A8`), white `36px`-min-height `9px`-radius pill triggers, and `260px` white `14px`-radius dropdown panels (`#FCEFE2` selected tint + `#A65307` check icon, with uppercase `#67635C` ART group headings inside the Team menu) from `prototype/Main.dc.html#L35-L39`; apply `min-width: 0` + ellipsis truncation so `1024px` and `768px` never wrap or collide.
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L35-L39` and `prototype/Settings.dc.html#L24-L38`), with responsive `min-width: 0` truncation `recreated manually` (reason: prevent narrow-viewport header wrap/collision per Principle VII).
  - **Done when**: Tier-1 `npm run test:visual` geometry green at `1440px`, `1024px`, `768px` AND Tier-2 frozen-state screenshots reviewed against `screenshots/01-team-pi-board.png` and `screenshots/07-settings-locations-holidays.png`.
  - **Out-of-scope files/components**: Primary 9-destination `NavigationMenu.tsx` (unchanged).

- [ ] **T017** `[US4]` Update `ProfileMenu` with dynamic `Team · ART` subtitle and enabled `Organization` link above disabled `Settings`
  - **Target files/components**: `src/ui/shell/ProfileMenu.tsx`, `src/ui/shell/shell.module.css`
  - **Match**: `prototype/Main.dc.html#L51` (`screenshots/01-team-pi-board.png`) incorporating approved Deviation `D1` (add enabled **`Organization`** link navigating to `/organization` using Kumiko `members` `18px` icon, while retaining disabled non-navigating **`Settings`** with `aria-disabled="true"` and `aria-describedby="settings-help"`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: empty-org (`"No ART or team configured"`), populated (`"<Team> · <ART>"` on both primary routes and `/organization`), active route `/organization` (`aria-current="page"` with `#FCEFE2` tint / `#A65307` icon), keyboard navigation (`ArrowDown`/`ArrowUp`/`Home`/`End`/`Escape`).
  - **Translation note**: Preserve the `250px` white `16px`-radius panel, identity header (`36px` `#1A1B22` avatar, `"Scrum Master"`, dynamic `formatProfileSubtitle(selected)`), and item row geometry (`9px 10px` padding, `8px` radius, `14px` font, `18px` Kumiko icons) from `prototype/Main.dc.html#L51`.
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L51`).
  - **Done when**: Tier-1 `npm run test:visual` green at all breakpoints AND Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: Enabling `Settings` or creating `/settings`.

- [ ] **T018** `[US4]` Update `TodayWidget` to display `<PI> · Sprint <name>` matched against Team-shifted Sprint dates
  - **Target files/components**: `src/ui/shell/TodayWidget.tsx`
  - **Match**: `prototype/Main.dc.html#L41-L48` (`screenshots/01-team-pi-board.png`) incorporating approved Deviation `D3` (keep single viewer-local clock `HHMMh ZONE` in `#A65307` from F001 `CF1`; derive `<piSprintText>` via `resolveTodayCadenceStatus()` from viewer-local `YYYY-MM-DD`, selected PI, and `computeTeamIterationSchedule()` for the selected Team's offset — rendering `<PI> · Sprint <name>` skipping `Sprint ` if already prefixed, matching Team-shifted dates including days just outside canonical PI bounds, never implying formal commitment; omitted on `/organization` per `OD-6`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: unconfigured (`"No active PI · No active Sprint"`), active PI + matching Team-shifted Sprint (`"<PI> · Sprint 2706"` / `"<PI> · Sprint 5"`), active PI + gap (`"<PI> · No active Sprint"`), hidden via `visibility: hidden` when expanded search overlaps `< 1100px`.
  - **Translation note**: Retain F001's exact `TodayWidget` DOM structure (`role="timer"`, Line 1 `date · CWww.d | piSprintText`, Line 2 single viewer-local clock, `align-items: flex-end`, `tabular-nums`) and SSR placeholder geometry.
  - **Provenance**: `lifted from prototype CSS` (`prototype/Main.dc.html#L41-L48`, continuing F001 `shell.module.css`).
  - **Done when**: Tier-1 `npm run test:visual` green at all breakpoints AND Tier-2 screenshot reviewed against `screenshots/01-team-pi-board.png`.
  - **Out-of-scope files/components**: Multi-team clocks, commitment badges (`F012`/`F013`).

- [ ] **T019** `[US4]` Update Tier-1 visual-fidelity suite and F001 smoke assertions for populated header context, `/organization` header, and profile menu `Organization` entry
  - **Target files/components**: `tests/visual/shell-fidelity.spec.ts`, `tests/e2e/foundation-smoke.spec.ts`
  - **Expected behavior**:
    - Update profile-dropdown assertions in `shell-fidelity.spec.ts` / `foundation-smoke.spec.ts` to expect the enabled **`Organization`** link above the disabled **`Settings`** placeholder.
    - Add Tier-1 visual geometry & non-overlap assertions for the populated primary-route header (plain-text ART link + grouped Team dropdown + PI dropdown + live `TodayWidget` + expanded search `< 1100px` hiding) and for the `/organization` header (confirming `TodayWidget` and `HeaderContextSelector` are absent and search placeholder is `"Search organization…"`), at `1440px`, `1024px`, and `768px`, plus Tier-2 frozen-state screenshot capture.
  - **Constraints**: Keep empty-org visual checks passing cleanly; run isolated on port `3100`.
  - **Validation/test location**: `npm run test:visual` and `npm run test:e2e` exit `0`.
  - **Out-of-scope files/components**: `/organization` CRUD tests (`T024`).

---

## Phase 06: `/organization` Workspace UI & E2E / Accessibility Suite

**Purpose**: Deliver the dedicated `/organization` route with Kumiko-styled management panels for ARTs & PI Cadence, Teams & Members (including Team moves), and Locations (including archive/reactivate and read-only seeded Holiday inspection), and verify all user stories end-to-end with `@axe-core/playwright`.

- [ ] **T020** `[P]` `[US1, US2]` Implement `TrainsAndCadencePanel` (ART CRUD + PI & weekday Iteration cadence editor)
  - **Target files/components**: `src/ui/organization/TrainsAndCadencePanel.tsx`
  - **Expected behavior**:
    - List ARTs (with `"Show archived"` toggle), create/edit ART name, archive/reactivate, and delete unreferenced ART with inline validation/conflict errors.
    - For the selected ART, list PIs (with `"Show archived"` toggle and read-only `lifecycleStatus` badge), create/edit PI (`name`, explicit `startDate`, `endDate`), archive/reactivate, and delete unreferenced PI.
    - For the selected PI, list canonical Iterations (`name`, `kind: development | ip`, `startDate`, `endDate`), add/edit/delete Iterations (surfacing weekday validation errors inline), provide a one-click **`Suggest YYWW`** button calling `suggestYywwName(endDate)` (never modifying dates when name is edited), and show an optional Team-offset schedule preview selector demonstrating canonical vs Team-adjusted dates.
    - Call `onMutated()` after successful writes so the global header context updates immediately.
  - **Constraints**: Use Kumiko design tokens, custom accessible controls, and visible `:focus-visible` outlines; never hardcode quarter boundaries or parse dates from names.
  - **Validation/test location**: `tests/e2e/organization-cadence.spec.ts` (`T024`).
  - **Out-of-scope files/components**: `Start PI` button (`F012`), work categories (`F003`).

- [ ] **T021** `[P]` `[US1]` Implement `TeamsAndMembersPanel` (Team CRUD with offset + unlimited Member roster & Team move)
  - **Target files/components**: `src/ui/organization/TeamsAndMembersPanel.tsx`
  - **Expected behavior**:
    - Filter/select ART; list Teams (with `"Show archived"` toggle), create/edit Team (`name`, `sprintOffsetWorkdays` picker restricted to `-1`, `0`, `+1` with clear working-day explanation, read-only `8.0 h/day` default indicator), archive/reactivate, and delete unreferenced Team.
    - For the selected Team, display unlimited date-resolved Member roster (with `"Show archived"` toggle), create/edit Member (`fullName`, `nickname`, `initials`, `role` picker for the 5 roles, `fteFactor` default `1.0`, active-only `locationId` picker from shared Locations, `avatarColor` picker), support moving a Member to another active Team (current, future-dated, or same-day correction; even across ARTs) with optional `effectiveDate` and a **Cancel pending move** action when a future move is scheduled (`OD-8`, `OD-9`), display a clear non-color badge/label when role is `PO`/`SM` (`"Excluded from dev capacity"`), archive/reactivate, and delete unreferenced Member.
    - Call `onMutated()` after successful writes.
  - **Constraints**: No fixed 13-member cap; hide archived Locations from the Member Location picker (`OD-3`); no workday-hours editing, `deduction_mode`, or capacity calculation; no `Business Owner` role.
  - **Validation/test location**: `tests/e2e/organization-cadence.spec.ts` (`T024`).
  - **Out-of-scope files/components**: Capacity Planner (`F004`), Team Calendar (`F005`).

- [ ] **T022** `[P]` `[US3]` Implement `LocationsPanel` (Location registry CRUD, archive/reactivate & read-only Holiday inspection)
  - **Target files/components**: `src/ui/organization/LocationsPanel.tsx`
  - **Match**: `prototype/Settings.dc.html#L64-L81` (`screenshots/07-settings-locations-holidays.png`) incorporating approved Deviation `D2` (keep the white `14px`-radius card, uppercase `#FAF8F5` header row, `Code` badge pill, `Location`, `Calendar source`, `Time zone`, `Members`, `Holidays`, and `Last refreshed` columns; omit `Hours / day` input and operational holiday-editing/refresh buttons).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: 6 seeded Locations list, `"Show archived"` toggle (`OD-3`), create/edit Location form (`code` editable on create, immutable/read-only on edit per `R2-2`), archive/reactivate/delete actions, read-only Holiday inspection drawer/table showing `date`, `name`, `portion`, `source`, and `confirmed` (`est.` badge for `confirmed === false`).
  - **Translation note**: Lift the Locations section card, header bar, dark code badge styling, and tabular row grid from `prototype/Settings.dc.html#L64-L81`; add accessible create/edit/archive Location controls and read-only Holiday inspection drawer.
  - **Provenance**: `lifted from prototype CSS` (`prototype/Settings.dc.html#L64-L81`), with create/edit/archive form and read-only Holiday drawer `recreated manually` (reason: Brief §3/Q1/OD-3 require editable & archivable Locations with read-only holiday inspection without full F005 holiday grid).
  - **Done when**: Tier-1 `npm run test:visual` green at all breakpoints AND Tier-2 screenshot reviewed against `screenshots/07-settings-locations-holidays.png`.
  - **Out-of-scope files/components**: Operational Holiday CRUD/refresh or Absence entry UI (`F005`).

- [ ] **T023** `[US1, US2, US3, US4]` Assemble `/organization` page route and Kumiko workspace shell
  - **Target files/components**: `src/app/organization/page.tsx`, `src/ui/organization/OrganizationWorkspace.tsx`, `src/ui/organization/organization.module.css`
  - **Expected behavior**:
    - Render `/organization` inside the root `AppShell` with `Zen Kaku Gothic New` `28px` title (`Organization`), underline section tabs (`ARTs & PI Cadence`, `Teams & Members`, `Locations`) with `role="tablist"` / `role="tab"` / `role="tabpanel"` keyboard support, empty/loading/error states, and `OrganizationContext.refresh()` synchronization on mutations.
    - Confirm zero primary navigation items are marked `aria-current="page"` while on `/organization`, and `TodayWidget` / `HeaderContextSelector` are absent (`OD-6`).
  - **Constraints**: Consistent with Azusa v2 design tokens (`#F4F1EC`, `#FFFFFF`, `#1A1B22`, `#E07F24`, `#A65307`, `2px solid #E07F24` `:focus-visible`).
  - **Validation/test location**: `npm run build`, `npm run lint`, and `tests/e2e/organization-cadence.spec.ts` (`T024`).
  - **Out-of-scope files/components**: Any `/settings` route.

- [ ] **T024** `[US1, US2, US3, US4]` Add end-to-end Playwright and `@axe-core/playwright` accessibility suite for F002
  - **Target files/components**: `tests/e2e/organization-cadence.spec.ts`
  - **Expected behavior**:
    - Walk US1–US4 against isolated port `3100` with zero external network requests:
      - Open profile dropdown → click **`Organization`** → `/organization`; verify `Settings` stays disabled, logo nav highlights nothing, `TodayWidget` and `HeaderContextSelector` are **absent** (`OD-6`, `F12`), and search placeholder is `"Search organization…"`.
      - Verify 6 seeded Locations and read-only holiday inspection; create, **edit**, reload to verify persistence (`F8`), archive (confirm hidden from Member picker & visible behind `"Show archived"`), and reactivate a Location (`OD-3`).
      - Create 2 ARTs, **edit** one ART name and reload to verify persistence (`F8`); create PIs, **edit** a PI and reload to verify persistence (`F8`), verify same-ART overlap rejection & cross-ART overlap acceptance; create Mon–Fri development + IP Iterations (verify Sat/Sun rejection `400`, `YYWW` helper, arbitrary rename followed by **reload asserting the new name and unchanged dates** per `R2-4`, containment/overlap rejection).
      - Create Teams (leaving one ART with zero Teams to verify `OD-7`), **edit** a Team name/offset and reload to verify persistence (`F8`), verify `-1` Team-scheduled Sprint dates vs canonical ART dates; add >13 multi-location Members including `PO`/`SM`, **edit** a Member and reload to verify persistence (`F8`), schedule a future Member Team move and cancel the pending move (`OD-8`), test same-day Team correction (`OD-9`), archive/reactivate without cascading child archive, verify referenced delete blocked & empty mistake ART delete succeeds.
      - Navigate to `/`: verify ART with zero Teams does not appear in header (`OD-7`), verify plain-text `<ART>` links to `/program-board`, switch Team from grouped Team dropdown and PI from PI dropdown, verify profile subtitle updates to `<Team> · <ART>` (on both `/` and `/organization`), verify Today widget displays `<PI> · Sprint <name>` using Team-shifted dates without implying commitment (`OD-2`, `OD-5`), and verify context persists across reload.
      - Run `@axe-core/playwright` zero-violation scans on `/organization` (all 3 tabs + `/organization` header) and populated `/` floating header across `1440px`, `1024px`, and `768px`.
  - **Constraints**: Clean isolated `.azusa/test-playwright/` state; deterministic frozen clock.
  - **Validation/test location**: `npm run test:e2e`, `npm run test:visual`, `npm run test:run`, `npm run lint`, `npm run typecheck`, `npm run build` all exit `0`.
  - **Out-of-scope files/components**: Production `.azusa/data/`.

---

## Phase 07: Release Prep (MANDATORY)

**Purpose**: Synchronize application version across manifest, lockfile, migration, and restore markers (`F10`), and update all affected Constitution Principle VI living documentation before the final Browser Smoke Test.

- [ ] **T025** `[US5]` Bump application version (`0.1.0` → `0.2.0`)
  - **Target files/components**: `package.json`, `package-lock.json`, `src/persistence/version.ts`
  - **Expected behavior**: Bump root `version` to `"0.2.0"` in `package.json` and `package-lock.json` (both top-level and `packages[""]`), and update `APP_VERSION = '0.2.0'` in `src/persistence/version.ts` (consumed by both `src/persistence/migrate.ts` and `src/persistence/backup.ts`, `F10`). Keep `foundation.init.schemaVersion = '0000_foundation_init'`.
  - **Constraints**: Keep existing `'foundation.init'` records intact on upgrade; assert `appVersion === '0.2.0'` in `tests/integration/organization-migration-seed.test.ts`.
  - **Validation/test location**: `npm run test:run` and `npm run build`.
  - **Out-of-scope files/components**: Feature UI code.

- [ ] **T026** `[P]` `[US5]` Update `CHANGELOG.md`, `README.md`, and `docs/operations/database-and-recovery.md` (`F10`)
  - **Target files/components**: `CHANGELOG.md`, `README.md`, `docs/operations/database-and-recovery.md`
  - **Expected behavior**:
    - Add `0.2.0` entry to `CHANGELOG.md` summarizing F002 additions/changes.
    - Update `README.md` with `/organization` user-facing surface, reference-data seeding behavior, and `date-holidays` dependency note.
    - Update `docs/operations/database-and-recovery.md` to reflect `F002 / 0.2.0`, migration `0001_organization_cadence.sql`, idempotent reference-data seeding during `runMigrations()`, and synchronized `APP_VERSION` on restore markers.
  - **Constraints**: Keep concise and factual; no duplicated specification prose.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` and `npm run format:check`.
  - **Out-of-scope files/components**: `specs/`.

- [ ] **T027** `[P]` `[US5]` Update `docs/REPO_MAP.md` and `docs/architecture/overview.md` (`F10`)
  - **Target files/components**: `docs/REPO_MAP.md`, `docs/architecture/overview.md`
  - **Expected behavior**: Document all new F002 directories, schemas, migration `0001`, seeder, `version.ts`, domain/application modules, `/api/organization/*` endpoints, `/organization` route, and shell context components in `docs/REPO_MAP.md` and update the system/data-flow overview in `docs/architecture/overview.md`.
  - **Constraints**: Reflect actual implemented paths accurately.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T028** `[P]` `[US5]` Update `docs/architecture/domain-model.md` and `docs/architecture/data-dictionary.md`
  - **Target files/components**: `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`
  - **Expected behavior**:
    - Update `domain-model.md` implementation-status banner to reflect F002 organizational, team-assignment, and calendar entities now implemented (while keeping F003–F019 conceptual).
    - Update `data-dictionary.md` (`0.2.0`) with all 10 implemented F002 tables, columns, `record_status` vs `lifecycle_status`, `CHECK`/case-insensitive unique/partial unique/FK `RESTRICT` constraints, ISO calendar date conventions, derived `TeamIterationSchedule`, holiday override/Hijri rules, `IN`/`KA` fallback result, and idempotent seeding rules.
  - **Constraints**: Keep Data Model v0.6 invariants intact.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T029** `[P]` `[US5]` Add ADR `0002-organization-cadence-and-holiday-seeding.md`
  - **Target files/components**: `docs/architecture/decisions/0002-organization-cadence-and-holiday-seeding.md`
  - **Expected behavior**: Record key F002 architectural decisions, rationale, and deferred improvements:
    - ISO `YYYY-MM-DD` calendar dates and Mon–Fri weekday Sprint boundaries + **OD-1's no-overlap guarantee** (non-overlapping weekday Sprints shifted ±1 weekday strictly preserve order and never share a day, including across consecutive PIs in the same ART).
    - **OD-2's future RBAC behavior** (post-RBAC, Today widget shows the signed-in user's own Team's current Sprint, and an SM handling several offset Teams follows the canonical schedule).
    - **OD-3's Location archiving rationale** (later features may recalculate capacity live from holidays, so historical holiday data must survive via soft-archive rather than deletion).
    - **OD-4 / OD-8 / OD-9's `member_team_assignments` sole-source-of-truth design** (no `members.team_id`; date-resolved membership; future moves, same-day correction, cancel pending move; **F004 MUST use date-aware membership lookups — no longer deferred**; only editing/backdating past history and a history UI remain deferred).
    - Holiday seed identity (`holidays_library_identity_unique`), `seeded_years` (marking years seeded even when library returns empty; refresh belongs to `F005`) + `library_seed_cutoff_date` (`R2-1`), immutable Location `code` (`R2-2`), override precedence, Islamic/Hijri `confirmed = false` rule, verified `IN`/`KA` behavior (and `Public holidays, IN` label update if falling back), `OD-10` capacity-only Absence conflicts, `OD-11` no backdating on Team moves, `record_status` vs `pis.lifecycle_status`, and `localStorage`-backed header context keeping `app_metadata` strictly infrastructure-owned (`foundation.init.schemaVersion` intentionally stays `'0000_foundation_init'`).
  - **Constraints**: Match existing ADR style in `0001-local-first-nextjs-pglite-foundation.md`.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T030** `[US5]` Run docs sanity check and full quality-gate suite
  - **Target files/components**: `tests/unit/docs-completeness.test.ts` (update if needed for new ADR/version)
  - **Expected behavior**: Verify zero stale references or `TBD`/`TODO` markers across `docs/` and run all 7 quality gates (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`), confirming every command exits `0`.
  - **Constraints**: Leave `F002` unchecked in `docs/feature-roadmap.md` until Phase 08 UAT acceptance.
  - **Validation/test location**: All 7 npm quality-gate commands exit `0`.
  - **Out-of-scope files/components**: `docs/feature-roadmap.md` (`T035`).

---

## Phase 08: Browser Smoke Test & Post-UAT Roadmap Acceptance (MANDATORY)

**Purpose**: Walk every user story's **Independent Test** in a real browser against the to-be-merged state (after Release Prep), confirm accessibility and error/empty states, and update `docs/feature-roadmap.md` only after conformance review and explicit operator UAT acceptance.

- [ ] **T031** `[US1]` Walk US1 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification against `/organization` (ARTs, Teams, ±1 offsets, >13 multi-location Members, Member Team moves, `PO`/`SM` capacity metadata, archive/reactivate/delete guards, post-edit reload persistence)
  - **Expected behavior**: Confirm every step of US1's Independent Test passes on the to-be-merged build; record pass/fail evidence.
  - **Constraints**: Test against `127.0.0.1` local build with zero external network requests.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T032** `[US2]` Walk US2 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification against `/organization` (independent ARTs, non-overlapping active PIs, weekday-only configurable dev + IP Iterations, `YYWW` helper + custom rename, `-1`/`0`/`+1` Mon–Fri Team schedule preview leaving canonical ART dates unchanged)
  - **Expected behavior**: Confirm every step of US2's Independent Test passes; record evidence.
  - **Constraints**: Confirm dates are never derived from Sprint/PI names and Sat/Sun Sprint boundaries are rejected.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T033** `[US3]` Walk US3 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification against `/organization` → **Locations** (6 seeded Locations, IANA timezones, read-only seeded `date-holidays` inspection with confirmed CNY vs est. Hari Raya, create/edit/archive/reactivate Location, persistence across reload)
  - **Expected behavior**: Confirm every step of US3's Independent Test passes; record evidence.
  - **Constraints**: Confirm no F005 operational holiday/absence editor or per-location workday-hours input is exposed.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T034** `[US4]` Walk US4 Independent Test in a real browser; confirm empty/loading/error states, keyboard operation, and non-color status cues
  - **Target files/components**: Runtime verification across `/`, `/organization`, and primary routes (profile menu `Organization` link + disabled `Settings`, `/organization` Settings-style header without Today widget or context breadcrumb, primary-route plain-text ART link + grouped Team dropdown + PI dropdown, dynamic profile subtitle, live Today widget `<PI> · Sprint <name>` using Team-shifted dates without commitment wording, empty/error states, keyboard navigation, `1440px`/`1024px`/`768px` layout)
  - **Expected behavior**: Confirm every step of US4's Independent Test passes with zero console/hydration errors and zero `@axe-core/playwright` violations; record evidence.
  - **Constraints**: Confirm no primary navigation destination is highlighted on `/organization`.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T035** `[US5]` Post-UAT roadmap update
  - **Target files/components**: `docs/feature-roadmap.md`
  - **Expected behavior**: Only after conformance review and explicit operator UAT acceptance, tick `- [x] **F002 — Organization & PI Cadence**` and update the roadmap progress summary (`2 / 19`).
  - **Constraints**: Do not tick `F002` before operator UAT acceptance.
  - **Validation/test location**: `docs/feature-roadmap.md` + `npm run test:run` (`docs-completeness.test.ts`).
