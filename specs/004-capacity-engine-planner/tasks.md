# Tasks: Capacity Engine & Capacity Planner (F004)

**Branch**: `004-capacity-engine-planner` | **Date**: 2026-11-26 (Review Pass 4 — atomic cross-ART header sync via `setSelection`, clamped breakdown formula throughout, invalid deep-link fallback; Review Pass 3 — percent bulk >744h atomic 400, breakdown clamp, archived-Member past-iteration rule)  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/api.md](./contracts/api.md)

## Conventions

- **Status legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel marker**: `[P]` indicates tasks touching distinct files with no shared edits that can run in parallel within the same phase
- **Phase dependencies**: `01 → 02 → 03 → 04 → 05 → 06 → 07` (every phase is additive and leaves the test suite and linter green)
- **Verification commands**: `npm run test:run` · `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run build` · `npm run test:visual` · `npm run test:e2e`

## Phase Summary

| Phase | Focus | Task IDs | User Stories |
|---|---|---|---|
| **Phase 01** | Pure Capacity Engine, Role Alignment, Golden Fixture & Unit Tests | `T001–T005` | `US1, US2, US3` |
| **Phase 02** | Drizzle Schema Extensions, Migration `0003` & Upgrade/CLI-Backup Tests | `T006–T007` | `US1, US2, US3, US5` |
| **Phase 03** | Transactional Capacity Service, F002/F003 Guards & Persistence Tests | `T008–T009` | `US1, US2, US3, US5` |
| **Phase 04** | Local HTTP API Route Handlers (`/api/capacity/*`) & Route Tests | `T010–T012` | `US1, US2, US3` |
| **Phase 05** | `/capacity` Planner UI (Visual-Fidelity), Visual Suite & E2E/A11y Suite | `T013–T019` | `US2, US3, US4, US5` |
| **Phase 06** | Release Prep (Version Sync & Living Documentation) | `T020–T025` | `US5` |
| **Phase 07** | Browser Smoke Test & Post-UAT Roadmap Acceptance | `T026–T031` | `US1, US2, US3, US4, US5` |

---

## Phase 01: Pure Capacity Engine, Role Alignment, Golden Fixture & Unit Tests

**Purpose**: Establish the authoritative, pure TypeScript capacity calculation engine (`src/domain/capacity/`), tighten `contributesToDevCapacity` (`A4`), build the single canonical `Palawan` / `PI-2027.1` golden fixture (Baseline & Adjusted scenarios with `GW = 8h`, `Tr = 4h` and pinned category budgets), and verify every domain invariant and boundary condition with Vitest before touching persistence or UI.

- [x] **T001** `[P]` `[US1]` Tighten `contributesToDevCapacity` to `Team member` only, define capacity domain types, and index F004 brief in `README.md`
  - **Target files/components**: `src/domain/organization/roles.ts`, `src/domain/capacity/types.ts`, `tests/unit/organization-roles-schemas.test.ts`, `tests/integration/organization-persistence.test.ts`, `README.md`
  - **Expected behavior**:
    - Update `contributesToDevCapacity(role)` in `src/domain/organization/roles.ts` to `return role === 'Team member';` (`A4`), and update the existing F002 test assertions in `tests/unit/organization-roles-schemas.test.ts` and `tests/integration/organization-persistence.test.ts` to match. *(Do not touch `src/domain/organization/schemas.ts`, which does not expose `hoursPerDay`, per `m12`.)*
    - Define pure TypeScript input/output/breakdown types in `src/domain/capacity/types.ts`: `DeductionMode`, `OverheadDeductionSource`, `VelocitySource`, `ResolvedVelocity`, `LoadThresholds`, `LoadBand`, `LoadResult`, `CompletedSprintHistoryEntry`, `CapacityEngineInput` (including optional future F005 hooks for ceremonies/meetings/overtime defaulting to empty/`0`), `MemberIterationBreakdown`, `IterationCapacitySummary`, `OverheadCategorySummary` (stored pre-FTE hours & days per `R8`), `CategoryBudgetRow`, and `TeamPiCapacityView`.
    - Index `docs/features/004-capacity-engine-planner.md` in `README.md` so `tests/unit/docs-completeness.test.ts` remains green in Phase 01.
  - **Constraints**: Pure TypeScript only; zero imports from `next/*`, `react`, `drizzle-orm`, `@electric-sql/pglite`, or `node:*`.
  - **Validation/test location**: `npm run test:run` (`tests/unit/organization-roles-schemas.test.ts`, `tests/integration/organization-persistence.test.ts`, `tests/unit/docs-completeness.test.ts`).
  - **Out-of-scope files/components**: `src/domain/organization/schemas.ts`, persistence schemas (`Phase 02`), UI components (`Phase 05`).

- [x] **T002** `[P]` `[US2, US3]` Define strict Zod v4 schemas for F004 capacity queries and mutations (`0.25h` steps & safe upper bounds)
  - **Target files/components**: `src/domain/capacity/schemas.ts`
  - **Expected behavior**:
    - Define strict `.strict()` Zod v4 schemas (rejecting unknown keys and actor fields) matching `specs/004-capacity-engine-planner/contracts/api.md`:
      - `CapacityViewQuerySchema` (`teamId`, `piId` UUIDv4).
      - `UpdateTeamCapacitySettingsSchema` (`teamId` UUIDv4, optional `deductionMode`, optional `hoursPerDay` in `[1.0, 24.0]` step `0.5`, optional `seedNormalizedVelocity` finite in `[0, 1000] | null`; refine requiring at least one editable field).
      - `SetTeamPiVelocityOverrideSchema` (`teamId`, `piId`, `velocity` finite in `[0, 1000]`).
      - `DeleteTeamPiVelocityOverrideQuerySchema` (`teamId`, `piId`).
      - `BulkApplyOverheadDeductionsSchema` (`teamId`, `piId`, `mode: 'fixed_days' | 'percent'`, non-empty unique `entries: [{ categoryId, value }]`, enforcing `0 <= value <= 31` in `fixed_days` and `0 <= value <= 100` in `percent` per `m4`, `R6`).
      - `UpsertOverheadDeductionSchema` (`teamId`, `memberId`, `iterationId`, `categoryId`, `deductedHours` finite in `[0, 744]` with `Number.isInteger(deductedHours * 4)` per `R6`).
  - **Constraints**: Pure TypeScript + `zod` only; reject `NaN`, `Infinity`, off-step `hoursPerDay` (`0.001`, `7.25`), off-step `deductedHours` (`0.1`), out-of-bounds values (`> 744h`, `> 31d`, `> 100%`), duplicate `categoryId`s, and unknown fields.
  - **Validation/test location**: `tests/unit/capacity-engine.test.ts` (`T005`).
  - **Out-of-scope files/components**: API Route Handlers (`Phase 04`).

- [x] **T003** `[P]` `[US3]` Implement pure Normalized Velocity resolution, Exact Integer Largest-Remainder Category Budgeting, and reusable Load Calculation modules
  - **Target files/components**: `src/domain/capacity/velocity.ts`, `src/domain/capacity/budgets.ts`, `src/domain/capacity/load.ts`
  - **Expected behavior**:
    - `velocity.ts`: Export `resolveNormalizedVelocity({ sprintOverride, piOverride, completedSprints, seedValue })` implementing `Sprint override → PI override → Rolling 4-Sprint ratio of sums (incl. development & ip iterations) → Team seed` (`A3`). Fall back to `seedValue` on `0` completed Sprints or `Σ actualDevelopmentDays <= 0`; return genuine `0.0` NV when `Σ actualDevelopmentDays > 0` and `Σ completedDevelopmentSp === 0`.
    - `budgets.ts`: Export `calculateSprintCategoryBudgets(forecastSpDisplay, forecastSpRaw, allocation)` computing full-precision `budgetSpRaw` and presentation-rounded `budgetSpDisplay` via **exact integer largest-remainder rounding** (`numerator = forecastSpDisplay * effectivePct`, `floor = Math.floor(numerator / 100)`, `remainder = numerator % 100`), breaking equal remainders deterministically by **`sortOrder` ascending, then `categoryId` ascending** (`m2`), and `aggregatePiCategoryBudgets` summing Sprint display budgets (`A5`). Return `null` display split when `!allocation.isValid` or `forecastSpDisplay === null`.
    - `load.ts`: Export `DEFAULT_LOAD_THRESHOLDS = { underMax: 85, overMin: 115 }` and `calculateLoad(plannedSp, forecastSp, thresholds?)` returning `{ plannedSp, forecastSp, loadPct, band }` (`< 85%` `'amber'`, `85–115%` `'green'`, `> 115%` `'red'`; `forecastSp === 0 && plannedSp === 0` → `loadPct: null, band: 'none'`; `forecastSp === 0 && plannedSp > 0` → `loadPct: null, band: 'red'`).
  - **Constraints**: Pure TypeScript only; zero floating-point epsilon comparisons in largest-remainder; zero DB/UI/I/O imports.
  - **Validation/test location**: `tests/unit/capacity-engine.test.ts` & `tests/unit/capacity-golden.test.ts` (`T005`).
  - **Out-of-scope files/components**: Persistence, UI components.

- [x] **T004** `[US1, US2, US3]` Implement pure Capacity Calculation Engine (`src/domain/capacity/engine.ts`)
  - **Target files/components**: `src/domain/capacity/engine.ts`
  - **Expected behavior**:
    - Reuse `computeTeamIterationSchedule`, `isWeekday` (`src/domain/organization/cadence.ts`), `resolveEffectiveLocationHolidays` (`src/domain/organization/holidays.ts`), `contributesToDevCapacity` (`src/domain/organization/roles.ts`), and `TeamPiAllocationView` (`src/domain/categories/rules.ts`).
    - Export single conversion helpers used everywhere: `getWorkdayMinutes(hoursPerDay)`, `snapToQuarterHour(hours)` (`Math.floor(hours * 4 + 0.5) / 4`), `hoursToMinutes(hours)`, and `hoursToDays(hours, hoursPerDay)` (`R6`, `M2`).
    - Implement `calculateMemberIterationAvailability(...)` and `calculateTeamPiCapacity(input)`:
      - Intersect each Iteration's Team-scheduled Mon–Fri weekdays with each Member's dated `member_team_assignments` for that Team.
      - Evaluate per-weekday effective holidays (company/manual over library, weekend holidays ignored, `confirmed === false` deducted immediately with `isEstimated: true`) and active capacity-affecting absences tracking `full`, `am`, and `pm` independently (duplicate `am` or duplicate `pm` counts once as `0.5`, `am + pm = 1.0`, per `m3`), capping combined unavailable time per weekday at `1.0` day (`A4`).
      - Deduct Team-scoped per-`(member, team, iteration, overheadCategory)` `deductedHours` (`overheadMinutes = Σ Math.round(deductedHours * 60)`) before FTE; compute `preFteMinutes = Math.max(0, availableMinutes - overheadMinutes)` (emitting `'over_deducted'` if clamped); compute authoritative full-precision `devDaysRaw = (preFteMinutes * fteFactor) / workdayMinutes` and derived `devHours = devDaysRaw * hoursPerDay` & `devMinutes = Math.round(devDaysRaw * workdayMinutes)` (`M2`, `R6`).
      - Compute per-Iteration `eligibleFte` and PI-level scheduled-weekday-weighted average `eligibleFte` (`m8`), `teamDevDaysRaw` / `teamDevDaysDisplay` (rounded raw sum `291.3`), per-Sprint `forecastSpRaw` / `forecastSpDisplay` (`Math.round`), PI `forecastSpDisplay` (sum of Sprint display forecasts), Category Budgets, Deducted-first stored pre-FTE overhead totals (`R8`), Sprint `holidayLocations` summaries, and `excludedMembers`.
      - Export `computeBulkOverheadDeductionHours(...)` prorating `fixed_days` by `assignedWeekdays / sprintScheduledWeekdays` and snapping independently per Team to `0.25h` halves-up (`R2`, `R6`), and computing one-off `percent` against `availableHours` snapped to `0.25h` halves-up (`m5`, `R6`).
  - **Constraints**: Pure TypeScript only; zero imports from persistence, Next.js, React, or `node:*`; overtime calculation deferred to F005 (`m9`, open hook defaulting to `0`).
  - **Validation/test location**: `tests/unit/capacity-golden.test.ts` & `tests/unit/capacity-engine.test.ts` (`T005`).
  - **Out-of-scope files/components**: Database queries, HTTP routes, UI components.

- [x] **T005** `[US1, US2, US3]` Create canonical `Palawan` / `PI-2027.1` golden fixture (Baseline + Adjusted) and comprehensive Vitest unit test suites
  - **Target files/components**: `tests/support/capacity-golden-fixture.ts`, `tests/unit/capacity-golden.test.ts`, `tests/unit/capacity-engine.test.ts`
  - **Expected behavior**:
    - `tests/support/capacity-golden-fixture.ts`: Export the canonical `Palawan` / `PI-2027.1` dataset (`GW = 8h`, `Tr = 4h` at `8h/day`) with exact dated weekday holidays (incl. unconfirmed `2027-03-10` Hari Raya Puasa `est.`) and exact dated active absences matching `spec.md` §Data Considerations #3 (`m1`, `R6`).
    - `tests/unit/capacity-golden.test.ts`: Assert **two separate golden scenarios** (`m1`, `m2`, `R6`, `R8`):
      1. **Baseline**: Sprint dev days (`60.75`, `55.75`, `59.75`, `56.25`, `58.75`; PI `291.25` → `291.3`), Forecast SP (`56`, `51`, `55`, `52`, `54`; PI `268`, raw `267.95`), Hana `0.5 FTE` = `4.25` full-sprint dev days, `2702` stored pre-FTE GW total = `64h` (`8` days), and exact pinned Category Budgets (`2702: 31/8/8/5/4`, `2704: 28/8/7/4/4`, `2706: 31/8/8/4/4`, `2708: 29/8/7/4/4`, `2710: 30/8/8/4/4`; PI `149 / 40 / 38 / 21 / 20 = 268`).
      2. **Adjusted** (Carlo `2706` `GW = 4h`): Sprint `2706` dev days = `60.25` (`60.3`), PI total = `291.75` (`291.8`), Forecast SP `268` (raw `268.41`).
    - `tests/unit/capacity-engine.test.ts`: Assert every boundary/failure case: `±1` Team Sprint offsets, dated assignments & mid-Sprint Team transfer proration with independent `0.25h` snapping (`4/10 × 8h = 3.2h → 3.25h`, `6/10 × 8h = 4.8h → 4.75h`, `R2`, `R6`), `snapToQuarterHour` halves-up (`0.1d × 8h = 0.8h → 0.75h`, `0.125h → 0.25h`), `hours_per_day` change `8h → 7.5h` keeping `deducted_hours` fixed (`8h` GW stays `8h`) and changing dev days predictably (`R6`), archived Member counted **only** in past Iterations (`scheduledEndDate < today`) and excluded with `exclusionReason: 'archived'` in current (`scheduledStartDate <= today <= scheduledEndDate`) and future (`scheduledStartDate > today`) Iterations, weighted-average PI `eligibleFte` (`m8`), multi-location holiday isolation, unconfirmed `est.` holiday deduction, weekend holidays (`0`), half-day holidays, duplicate `am`, duplicate `pm`, `am + pm`, and each combined with a half holiday (`m3`), cancelled & `affects_capacity = false` absences (`0`), `Admin`/`RTE`/`SM`/`PO` exclusion, `fteFactor = 0.33` single-formula verification (`M2`), `hours_per_day` boundaries (`1.0`, `7.5`, `8.0`, `24.0`; rejecting `0.001` & `7.25`), negative clamping + `'over_deducted'`, full NV chain (4-Sprint ratio of sums incl. IP, `< 4` partial, zero-denominator fallback, genuine `0.0`, PI/Sprint override, unset), exact integer largest-remainder tie-breaking (`sortOrder`, then `categoryId`), invalid/unconfigured F003 allocation, `calculateLoad` bands + `forecastSp = 0`, and all strict Zod schemas (`0..744` step `0.25`, `0..31` days, `0..100` %, `0..1000` velocity).
  - **Constraints**: Deterministic pure unit tests with zero DB or network I/O.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: PGlite integration tests (`Phase 02`–`03`).

---

## Phase 02: Drizzle Schema Extensions, Migration `0003` & Upgrade/CLI-Backup Tests

**Purpose**: Extend `teams` (`deduction_mode`, `seed_normalized_velocity`, tightened `hours_per_day` CHECK), add Team-scoped `overhead_deductions` (`R2`, `R5`, `R6`) and `team_pi_velocity_overrides` in Drizzle with `ON DELETE RESTRICT` foreign keys and SQL `CHECK` constraints, commit additive migration `0003_capacity_engine_planner.sql` with journal/snapshot metadata, and verify F003→F004 upgrade and CLI `db:backup`/`db:restore` round-trip safety.

- [x] **T006** `[US1, US2, US3]` Extend `teams` schema, add Team-scoped `overhead_deductions` & `team_pi_velocity_overrides`, and commit migration `0003_capacity_engine_planner.sql`
  - **Target files/components**: `src/persistence/schema/organization.ts`, `src/persistence/schema/capacity.ts`, `src/persistence/schema/index.ts`, `src/persistence/migrations/0003_capacity_engine_planner.sql`, `src/persistence/migrations/meta/_journal.json`, `src/persistence/migrations/meta/0003_snapshot.json`
  - **Expected behavior**:
    - In `src/persistence/schema/organization.ts`, tighten `teams_hours_per_day_valid` (`hours_per_day >= 1 and hours_per_day <= 24 and (hours_per_day * 2) = floor(hours_per_day * 2)`), add `deductionMode` (`'fixed_days' | 'percent'`, default `'fixed_days'`), and add `seedNormalizedVelocity` (`doublePrecision`, nullable, `0..1000`).
    - In `src/persistence/schema/capacity.ts`, define `overheadDeductions` (table `overhead_deductions`, `teamId` FK → `teams.id`, `ON DELETE RESTRICT`, `deductedHours` `doublePrecision` NOT NULL with `CHECK (deducted_hours >= 0 AND deducted_hours <= 744 AND deducted_hours * 4 = floor(deducted_hours * 4))`, `CHECK (source IN ('pi_plan', 'sprint_adjusted'))`, unique index `overhead_deductions_member_team_iter_cat_unique` on `(member_id, team_id, iteration_id, category_id)`, lookup indexes `overhead_deductions_team_iter_idx`, `overhead_deductions_iteration_idx`, `overhead_deductions_category_idx`) and `teamPiVelocityOverrides` (`CHECK (velocity >= 0 AND velocity <= 1000)`, unique `(team_id, pi_id)`, lookup index `team_pi_velocity_override_pi_idx`) matching `specs/004-capacity-engine-planner/data-model.md`.
    - Re-export `./capacity` from `src/persistence/schema/index.ts`.
    - Generate and review `0003_capacity_engine_planner.sql`, `meta/_journal.json`, and `meta/0003_snapshot.json`, ensuring the SQL snaps any legacy F002 `teams.hours_per_day` rows to `[1.0, 24.0]` step `0.5` as a safety net before adding the tightened `teams_hours_per_day_valid` constraint (`m12`).
  - **Constraints**: Zero `ON DELETE CASCADE`; zero team-level overhead-category default tables; zero `PlanVersion`/`PICommitment`/`SprintCommitment`/`Actuals`/`OverheadTicket` tables; never modify `0000`–`0002` SQL migrations.
  - **Validation/test location**: `tests/integration/capacity-migration-backup.test.ts` (`T007`).
  - **Out-of-scope files/components**: `src/persistence/seed.ts`, `src/persistence/lock.ts`.

- [x] **T007** `[US5]` Add integration tests for F003→F004 migration upgrade, direct SQL constraints, and CLI `db:backup`/`db:restore` round-trip
  - **Target files/components**: `tests/integration/capacity-migration-backup.test.ts`, `tests/integration/migration-upgrade.test.ts` (update only if journal entry count is asserted)
  - **Expected behavior**:
    - Test 1 (F003→F004 upgrade): Apply `0000`–`0002`, insert F001–F003 rows including a legacy F002 Team with `hours_per_day = 7.25`, then run `runMigrations()` applying `0003_capacity_engine_planner.sql`; assert 100% of F001–F003 rows survive intact, existing Teams receive `deduction_mode = 'fixed_days'` and `seed_normalized_velocity = null`, and `7.25` snaps cleanly to `7.5`.
    - Test 2 (Direct SQL constraints): Verify PostgreSQL rejects off-step `hours_per_day` (`0.001`, `7.25`), invalid `deduction_mode`, negative/`> 1000` `seed_normalized_velocity` or `velocity`, negative/`> 744`/off-step (`0.1`) `deducted_hours`, invalid `source`, duplicate `(member_id, team_id, iteration_id, category_id)` (while allowing same Member/Iteration/Category on a **different** `team_id` per `R2`), duplicate `(team_id, pi_id)`, and `ON DELETE RESTRICT` when deleting a referenced Member/Team/Iteration/Category/PI.
    - Test 3 (CLI `db:backup` & `db:restore` round-trip): Populate F004 `teams` settings (`percent`, `seed = 0.92`), Team-scoped `overhead_deductions` (`8.0h`, `4.0h`, `3.25h`), and `team_pi_velocity_overrides` (`1.05`), invoke CLI backup & restore (`scripts/db/backup.ts` and `scripts/db/restore.ts --from ... --to ...`), and verify exit `0`, 100% restored record counts and exact field values, active DB untouched, and restored `.azusa-last-healthy.json` records `APP_VERSION`.
  - **Constraints**: Isolated temp directories cleaned up on teardown; never touch `.azusa/data/`.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 03: Transactional Capacity Service, F002/F003 Guards & Persistence Tests

**Purpose**: Implement `src/application/capacity/capacity-service.ts` orchestrating reads and Team-scoped transactional mutations on top of the pure engine, update F002/F003 delete and `kind`-switch guards (`FR-014`, `R2`, `R5`), and verify every persistence invariant against real PGlite.

- [x] **T008** `[US1, US2, US3]` Implement transactional `capacity-service.ts` and update F002/F003 delete & `kind`-switch guards
  - **Target files/components**: `src/application/capacity/capacity-service.ts`, `src/application/organization/organization-service.ts`, `src/application/organization/cadence-service.ts`, `src/application/categories/category-service.ts`
  - **Expected behavior**:
    - Reuse `ValidationError`, `ConflictError`, `NotFoundError`, `validate`, `requireRecord`, `requireActive`, `OrganizationOptions`, and `writeOrganization` from `src/application/organization/errors.ts`, `getServerTodayIsoDate()` from `src/domain/calendar/iso-week.ts`, and `resolveActor()` from `src/domain/audit/actor.ts`.
    - Implement in `src/application/capacity/capacity-service.ts`:
      - `getTeamPiCapacity(db, { teamId, piId }, opts)`: validates Team & PI exist (`404`) and share `trainId` (`409`); loads Team, ART, PI, Iterations, overlapping `member_team_assignments` for `teamId`, Members (including archived Members with overlapping assignments), Locations, Holidays, Absences + AbsenceTypes, ART Categories + F003 `resolveTeamPiAllocation()`, Team-scoped `overhead_deductions` (`WHERE team_id = teamId`), and `team_pi_velocity_overrides`; delegates calculation to `calculateTeamPiCapacity()` and sets `readOnly: train.recordStatus === 'archived' || team.recordStatus === 'archived' || pi.recordStatus === 'archived'` (`m7`).
      - `updateTeamCapacitySettings(db, input, opts)`: validates active ART & active Team (`404`/`409`), updates `deduction_mode`, `hours_per_day` (without modifying stored `deducted_hours`, `R6`), and/or `seed_normalized_velocity`.
      - `setTeamPiVelocityOverride(db, input, opts)` & `clearTeamPiVelocityOverride(db, { teamId, piId }, opts)`: validates active ART/Team/PI, same `trainId` (`404`/`409`), upserts or deletes `team_pi_velocity_overrides`.
      - `bulkApplyOverheadDeductions(db, input, opts)`: validates active ART/Team/PI, same `trainId`, **`mode === team.deductionMode`** (`409` on mismatch, `m6`), every `categoryId` exists (`404`) and is active `overhead` in the Team's ART (`409`); applies across all Iterations of the PI for active eligible `Team member`s assigned to `teamId` using `computeBulkOverheadDeductionHours()` (`fixed_days` prorated by `assignedWeekdays / sprintScheduledWeekdays` and snapped independently per Team to `0.25h` halves-up per `R2`/`R6`; `percent` one-off against assigned available hours snapped to `0.25h` halves-up per `m5`/`R6`); **validates every computed row `<= 744h` before writing** and atomically rejects the whole request with `400 VALIDATION_ERROR` naming `{ memberId, memberName, iterationId, iterationName, categoryId, computedHours, maxHours: 744 }` if any exceeds `744h` (leaving existing deductions untouched); otherwise transactionally upserts non-zero rows (`source = 'pi_plan'`) and deletes `pi_plan` rows whose computed value is `0` strictly for `teamId`, leaving unlisted categories and other Teams' rows untouched.
      - `upsertOverheadDeduction(db, input, opts)`: validates active ART/Team/PI/Member, Iteration in Team's ART (`409`), active `overhead` Category in Team's ART (`404`/`409`), Member has `role === 'Team member'` and dated assignment on `teamId` overlapping that Iteration's scheduled window (`409`); upserts `(memberId, teamId, iterationId, categoryId)` with `deductedHours` and `source = 'pi_plan'` (or deletes `pi_plan` row when `deductedHours === 0`).
    - Update F002/F003 guards (`FR-014`, `R2`, `R5`):
      - `organization-service.ts` (`deleteTeam`, `deleteMember`) and `cadence-service.ts` (`deletePi`, `deleteIteration`): detect `overhead_deductions` (including `team_id`) and `team_pi_velocity_overrides` with accurate `409 CONFLICT` messages. *(Do not modify F002 `updateTeam` per `m12`.)*
      - `category-service.ts` (`listCategories` `isReferenced`, `deleteCategory`, and `updateCategory` `kind`-switch guard): check `overhead_deductions` references in addition to `team_category_allocations` (`409 CONFLICT`).
  - **Constraints**: All writes inside `writeOrganization(db, tx => ...)`; zero React/HTTP imports; zero formula duplication outside `src/domain/capacity/`.
  - **Validation/test location**: `tests/integration/capacity-persistence.test.ts` (`T009`).
  - **Out-of-scope files/components**: HTTP Route Handlers (`Phase 04`), UI components (`Phase 05`).

- [x] **T009** `[US1, US2, US3, US5]` Add comprehensive real-PGlite integration tests for `capacity-service.ts`, cross-Team isolation, and updated F002/F003 guards
  - **Target files/components**: `tests/integration/capacity-persistence.test.ts`, `tests/integration/organization-persistence.test.ts` (update only if exact delete conflict strings are asserted)
  - **Expected behavior**:
    - Seed real F002/F003 records matching the canonical `Palawan` / `PI-2027.1` Baseline dataset (`GW = 8h`, `Tr = 4h`) in PGlite and verify `getTeamPiCapacity` returns exact golden numbers (`291.25` dev days, `268 SP`, pinned category budgets `149/40/38/21/20`, `2702` stored GW total = `64h` / `8d`, `plannedSp: null`, `excludedMembers`).
    - Test `hours_per_day` change (`R6`): update `hours_per_day` `8.0 → 7.5` via `updateTeamCapacitySettings`, asserting stored `deducted_hours` remain untouched (`8h` GW stays `8h`, `4h` Tr stays `4h`) while derived day equivalents (`8/7.5`, `4/7.5`), dev days, and Forecast SP recalculate predictably.
    - Test mid-Sprint transfer Team isolation (`R2`, `R6`): Member assigned `4/10` weekdays to Team A and `6/10` to Team B; bulk-apply `1.0d` at `8h/day` on Team A writes `3.25h` for Team A only; bulk-apply `1.0d` on Team B writes `4.75h` for Team B only; clearing Team A (`0`) leaves Team B untouched.
    - Test bulk-apply edge rules (`m4`, `m5`, `m6`): `mode !== team.deductionMode` returns `409`; unlisted overhead categories stay untouched; rejected out-of-bounds bulk request writes zero rows; **percent bulk apply where a Member × Iteration exceeds `744h`** (e.g., 32 available weekdays at `24h/day` × `100%` = `768h`) atomically returns `400 VALIDATION_ERROR` naming the Member and Iteration and leaves existing deductions untouched; percent bulk-apply persists fixed `0.25h`-snapped `deducted_hours` that do not auto-recompute after a subsequent absence is added.
    - Test `setTeamPiVelocityOverride` / `clearTeamPiVelocityOverride` (Team & PI isolation), `upsertOverheadDeduction` single-cell edit & `0` clear, archived ART/Team/PI `readOnly: true` & `409` writes (`m7`), **archived Member across past (`scheduledEndDate < today`, counted), current (`scheduledStartDate <= today <= scheduledEndDate`, excluded as `Archived`), and future (`scheduledStartDate > today`, excluded as `Archived`) Iterations** while write returns `409`, and updated F002/F003 `deleteTeam` (with `overhead_deductions`), `deleteMember`, `deletePi`, `deleteIteration`, `deleteCategory`, and `kind`-switch `409` guards.
  - **Constraints**: Isolated temp PGlite databases cleaned up on teardown.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 04: Local HTTP API Route Handlers (`/api/capacity/*`) & Route Tests

**Purpose**: Expose thin, strict Zod-validated Next.js App Router Route Handlers for all F004 operations matching `contracts/api.md`, verified by dedicated `tests/integration/capacity-routes.test.ts`.

- [x] **T010** `[P]` `[US1, US3]` Implement `GET /api/capacity`, `PATCH /api/capacity/team-settings`, and `PUT`/`DELETE /api/capacity/velocity-override` Route Handlers
  - **Target files/components**: `src/app/api/capacity/route.ts`, `src/app/api/capacity/team-settings/route.ts`, `src/app/api/capacity/velocity-override/route.ts`
  - **Expected behavior**:
    - `GET /api/capacity?teamId=<uuid>&piId=<uuid>` → `getTeamPiCapacity` (`200`).
    - `PATCH /api/capacity/team-settings` → `updateTeamCapacitySettings` (`200`).
    - `PUT /api/capacity/velocity-override` → `setTeamPiVelocityOverride` (`200`).
    - `DELETE /api/capacity/velocity-override?teamId=<uuid>&piId=<uuid>` → `clearTeamPiVelocityOverride` (`200`).
    - Reuse `readQuery`, `readBody`, `organizationDb`, and `organizationResponse` from `src/app/api/organization/http.ts` (`Cache-Control: no-store`, uniform error envelopes).
  - **Constraints**: Thin HTTP adapters only; no calculation logic in route handlers; reject unknown keys and actor fields.
  - **Validation/test location**: `tests/integration/capacity-routes.test.ts` (`T012`).
  - **Out-of-scope files/components**: Existing `/api/organization/*` and `/api/categories/*` routes.

- [x] **T011** `[P]` `[US2]` Implement `POST /api/capacity/overhead-deductions/bulk` and `PUT /api/capacity/overhead-deductions` Route Handlers
  - **Target files/components**: `src/app/api/capacity/overhead-deductions/bulk/route.ts`, `src/app/api/capacity/overhead-deductions/route.ts`
  - **Expected behavior**:
    - `POST /api/capacity/overhead-deductions/bulk` → `bulkApplyOverheadDeductions` (`200`).
    - `PUT /api/capacity/overhead-deductions` → `upsertOverheadDeduction` (`200`).
    - Reuse `readBody`, `organizationDb`, and `organizationResponse` from `src/app/api/organization/http.ts` (`Cache-Control: no-store`, strict Zod validation).
  - **Constraints**: Thin HTTP adapters only; no business logic in route handlers.
  - **Validation/test location**: `tests/integration/capacity-routes.test.ts` (`T012`).
  - **Out-of-scope files/components**: Existing `/api/organization/*` and `/api/categories/*` routes.

- [x] **T012** `[US1, US2, US3]` Add dedicated HTTP Route Handler contract tests (`capacity-routes.test.ts`)
  - **Target files/components**: `tests/integration/capacity-routes.test.ts`
  - **Expected behavior**:
    - Exercise every `/api/capacity/*` route against a real PGlite test context, verifying:
      - `200` happy paths and `Cache-Control: no-store` header on every endpoint.
      - Exact `400 VALIDATION_ERROR` on unknown fields, actor injection (`createdBy`), duplicate query parameters, invalid UUIDs, empty `PATCH /api/capacity/team-settings`, invalid/off-step `hoursPerDay` (`0.001`, `7.25`, `25`), negative/`> 1000` `seedNormalizedVelocity` or `velocity`, negative/`> 744`/off-step (`0.1`) `deductedHours`, `value > 31` in `fixed_days` bulk, `value > 100` in `percent` bulk, a `percent` bulk request whose computed deduction exceeds `744h` (confirming `details` names the Member and Iteration and zero existing deductions are altered), and empty/duplicate `entries`.
      - Exact `404 NOT_FOUND` on unknown `teamId`, `piId`, `memberId`, `iterationId`, `categoryId`.
      - Exact `409 CONFLICT` on `mode !== team.deductionMode` in bulk apply, cross-ART mismatches, archived ART/Team/PI/Member writes, targeting `development` or `archived` category for overhead deductions, or targeting non-`Team member` / member not assigned to `teamId`.
  - **Constraints**: Separate file from `capacity-persistence.test.ts`; zero external network requests.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 05: `/capacity` Planner UI (Visual-Fidelity), Visual Suite & E2E/A11y Suite

**Purpose**: Replace the `/capacity` placeholder with the transparent Capacity Planner matching `prototype/Capacity.dc.html` (`screenshots/03-capacity-planner.png`) under `Visual-Fidelity Mode: Visual-fidelity` at `1440px` baseline (subject to operator-accepted deviations `D1`–`D8`), add Tier-1 visual geometry tests (`tests/visual/capacity-planner.spec.ts`), and add full Playwright E2E + `@axe-core/playwright` coverage across `1440px`, `1024px`, and `768px`.

*(Note: `T013–T017` share `src/ui/capacity/capacity.module.css` and are ordered sequentially without `[P]`.)*

- [x] **T013** `[US4]` Build `/capacity` page entry, title row & controls (plus atomic `setSelection` in `OrganizationContext`) in `src/app/capacity/page.tsx`, `src/ui/shell/OrganizationContext.tsx`, `src/ui/capacity/CapacityPlannerWorkspace.tsx`, and `src/ui/capacity/capacity.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/Capacity.dc.html#L53-L67` & `screenshots/03-capacity-planner.png` (page padding `24px 28px 32px`, `18px` vertical stack, `Zen Kaku Gothic New` `28px` bold title `"Capacity planner"`, right-aligned `"Deduction mode"` label + segmented pill toggle `Fixed days` / `% of available` on `#FFFFFF` with `#1A1B22` active pill; applying Deviations `D2` [navigation link to `/calendar` `"Team calendar"` in place of `+ Day off`] and `D5` [`Hours per day` numeric input `1.0–24.0` step `0.5` beside Deduction mode]).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px`; states: loading, DB-unavailable/error alert with Retry, no Team/PI selected empty state (linking to `/organization`), zero-Iteration PI empty state, URL-only archived ART/Team/PI read-only banner (`"Viewing archived <Team> · <PI> (read-only)"` + `"Return to active selection"` button clearing URL params, `m13`), and populated active state.
  - **Translation note**: Add an atomic `setSelection({ teamId, piId })` action to `src/ui/shell/OrganizationContext.tsx` that resolves the target Team's `trainId` and validates `piId` against that target Train in a single state update (preventing cross-ART `piId` drops). Check URL search params `?teamId=&piId=` first: if valid UUIDs point to an **active** ART, Team, and PI, call `setSelection({ teamId, piId })` and **immediately clear the URL params** (`router.replace('/capacity')`) once synced so subsequent manual header changes are never pulled back; if they point to an **archived** ART, Team, or PI, URL params take precedence while the header keeps its active selection (`m13`). When the user changes Team or PI in the floating header, clear any remaining URL params (`router.replace('/capacity')`). If the URL params are incomplete (only one of `teamId` / `piId`), are not valid UUIDs, reference an unknown Team or PI, or name a Team and PI from different ARTs, `/capacity` ignores them, clears them (`router.replace('/capacity')`), keeps the floating header's current selection, and shows a dismissible notice (`"Link could not be opened — showing current selection"`). Lift prototype spacing, radii (`10px`, `7px`), and colour tokens (`#1A1B22`, `#FFFFFF`, `#67635C`) directly into `capacity.module.css`.
  - **Provenance**: Title row & deduction-mode toggle `lifted from prototype CSS` (`Capacity.dc.html#L53-L67`); `Hours per day` input, `/calendar` link, and empty/read-only banners `recreated manually` (reason: Deviations `D2`, `D5`, `m13`, and Principle VII empty/error states).
  - **Done when**: Tier 1 (`npm run test:visual` including `tests/visual/capacity-planner.spec.ts` in `T018`) green at `1440px`, `1024px`, `768px` AND Tier 2 frozen-state screenshots reviewed against `screenshots/03-capacity-planner.png`.
  - **Out-of-scope files/components**: `src/ui/shell/FloatingHeader.tsx`, `/calendar` implementation (`F005`).

- [x] **T014** `[US3, US4]` Build Five KPI Tiles strip & Velocity Seed / PI Override editor in `src/ui/capacity/CapacityKpiStrip.tsx` and `src/ui/capacity/capacity.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/Capacity.dc.html#L69-L75` & `screenshots/03-capacity-planner.png` (`grid-template-columns: minmax(0, 4fr) repeat(4, minmax(0, 3fr))`, `min-height: 100px`, `gap: 12px`, `border-radius: 12px`, `padding: 14px 16px`; Tile 1 dark `#1A1B22` **`Planned SP`**; Tiles 2–5 `#FFFFFF` **`Development capacity`**, **`Normalized velocity`** [lowercase `"v"`, value in `#A65307`], **`Forecast SP`**, **`Team FTE`** per `R7`/`D8`; `32px` bold `tabular-nums` values; applying Deviations `D1` [`Planned SP` displays `—` and `"Not yet available"` instead of mock `242 / 268 SP` or `0`] and `D5` [explicit NV source badge + accessible inline/popover editor for Team seed NV and Team PI velocity override with reset]).
  - **Breakpoints/checkpoints**: `1440px` (5-column grid matching prototype), `1024px`, `768px` (responsive wrap without text collision); states: seeded NV, PI-overridden NV (with reset button), unset NV (`—` with prompt to set seed), zero-member team (`0.0 FTE`), and read-only archived ART/Team/PI.
  - **Translation note**: Replicate the exact 5-tile DOM structure and typography hierarchy from `Capacity.dc.html#L69-L75` using exact `R7` labels; keep the Velocity editor keyboard-accessible (`Escape` closes, `:focus-visible` `2px solid #E07F24`) and never show `0` in `Planned SP`.
  - **Provenance**: 5-tile grid & card typography `lifted from prototype CSS` (`Capacity.dc.html#L69-L75`); `Planned SP` placeholder copy, `R7` labels, and NV source/override controls `recreated manually` (reason: Deviations `D1`, `D5`, `D8`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 frozen-state screenshots reviewed against `screenshots/03-capacity-planner.png`.
  - **Out-of-scope files/components**: Sprint velocity override UI (`F013`), real Planned SP queries (`F009`).

- [x] **T015** `[US3, US4]` Build Team Allocation matrix & Deducted-first overhead summary in `src/ui/capacity/TeamAllocationMatrix.tsx` and `src/ui/capacity/capacity.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/Capacity.dc.html#L77-L112` & `screenshots/03-capacity-planner.png` (`20px` `Zen Kaku Gothic New` `"Team allocation"` heading, `#FFFFFF` `14px`-radius card with `overflow-x: auto`, `#1A1B22` header bar with `Category` + `PI` + Iteration columns and `#E07F24` top inset bar on current Sprint, `#FFF8F1` `Forecast SP · 100%` row with `#A65307` totals, category rows with `4px` full-height colour bar, full name, `"Train X%"` / `"Inherits train X%"` sub-line, effective `%` pill [`#FCEFE2`/`#8A4505` for override, muted for inherit], `Total 100% ✓` green pill `#E7F3EA`/`#256B3B` in footer; applying Deviations `D1` [planned SP shown as `—` beside `/ <budget>`], `D3` [read-only `%` pills + `"Manage in Organization →"` link to `/organization` instead of inline `%` editing], and `D4` [separate **Deducted first** overhead summary showing each active ART overhead category's stored PI and per-Iteration deducted hours & days]).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px` (table scrolls horizontally inside card, zero page overflow); states: valid `100% ✓` allocation with overrides + inherits, invalid/drifted allocation (`!== 100%` explicit warning banner + link to `/organization`, never showing `100% ✓`), empty/unconfigured ART (`0` dev categories), unset NV (`—` budgets), and `0` vs. multiple overhead categories in **Deducted first**.
  - **Translation note**: Lift header/row grid template (`300px` label column + PI + Sprint columns), hairlines (`#F3EFE9`, `#EFEAE3`), and chip colours wholesale from `Capacity.dc.html#L77-L112`. Do **not** add a donut chart or charting library.
  - **Provenance**: Allocation matrix styling & row anatomy `lifted from prototype CSS` (`Capacity.dc.html#L77-L112`); `/organization` link, invalid-allocation banner, and **Deducted first** overhead summary `recreated manually` (reason: Deviations `D1`, `D3`, `D4`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 frozen-state screenshots reviewed against `screenshots/03-capacity-planner.png`.
  - **Out-of-scope files/components**: F003 allocation mutation calls, charting libraries (`F016`).

- [x] **T016** `[US2, US4]` Build Expandable Pre-FTE Member Capacity table & Bulk-Apply overhead bar in `src/ui/capacity/MemberCapacityTable.tsx` and `src/ui/capacity/capacity.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/Capacity.dc.html#L114-L192` & `screenshots/03-capacity-planner.png` (`20px` `"Member capacity"` heading, `#FFFFFF` `14px`-radius card with `overflow-x: auto`, `#1A1B22` header with clickable PI and Sprint expand/collapse `▸`/`◂` buttons, Sprint date range + holiday-location count summary, coloured sub-column headers when expanded [`Days`, `#FFD966` `Leaves`, per-overhead-category tinted headers, `#C2367E` `Dev` — no extra `× FTE` column per `R8`], `#FAF8F5` overhead summary rows, Member rows with `30px` coloured avatar circle, name, role & FTE subline [`Team member · 0.5 FTE`], `#1A1B22` Location pill, collapsed cells with dev days + `#244FA3` blue leave chip + `#9A6A00` sand/amber holiday chip [`est.` badge when unconfirmed] + over-deducted warning badge [no adjusted corner triangle per `R4`/`D7`], expanded cells showing **stored pre-FTE values** [`Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25` for Hana per `R8`] with inline day inputs editing stored pre-FTE deductions and displaying the `0.25h`-snapped day value, plus stored pre-FTE footer overhead totals [`2702` GW = `8` days], `Team dev days`, and `#FFF8F1` `Forecast SP × NV` footer rows; applying Deviations `D4`, `D6`, `D7`, `D8`).
  - **Breakpoints/checkpoints**: `1440px` (collapsed and one-Sprint-expanded states matching `03-capacity-planner.png`), `1024px`, `768px`; states: collapsed all, one Sprint expanded (showing inline day edit → `0.25h` snap → persistence), PI column expanded, member with unconfirmed `est.` holiday, member with overlapping holiday + absence, member clamped at `0` with over-deducted warning, excluded non-dev roles disclosure (`PO`/`SM`/`Admin`/`RTE`), empty roster (`0` eligible `Team member`s), and read-only archived ART/Team/PI.
  - **Translation note**: Replicate `Capacity.dc.html#L114-L192` grid expansion (`minmax(0, 2.8fr)` expanded column, `minmax(0, 1fr)` collapsed columns) and dynamically size the expanded sub-grid to `3 + overheadCategories.length` columns. Convert typed day input via `snapToQuarterHour(days * hoursPerDay)` before calling `PUT /api/capacity/overhead-deductions`, and display the snapped day value (`deductedHours / hoursPerDay`, e.g., `0.1d` at `8h` → `0.75h` → `0.09d`).
  - **Provenance**: Table shell, expandable header, sub-column tinting, avatar/location pills, leave/holiday markers, and footer rows `lifted from prototype CSS` (`Capacity.dc.html#L114-L192`); Bulk-Apply overhead bar, `est.`/over-deducted badges, pre-FTE display, and excluded-roles disclosure `recreated manually` (reason: Deviations `D4`, `D6`, `D7`, `D8`, and Brief §3.6).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 frozen-state screenshots reviewed against `screenshots/03-capacity-planner.png`.
  - **Out-of-scope files/components**: Days-off editor grid (`F005`), inline working-days override (`D6`), adjusted corner triangle (`D7`), extra `× FTE` column (`R8`).

- [x] **T017** `[US4]` Build inspectable Calculation Breakdown popover (`src/ui/capacity/BreakdownPopover.tsx`)
  - **Target files/components**: `src/ui/capacity/BreakdownPopover.tsx`, `src/ui/capacity/capacity.module.css`
  - **Match**: Azusa Kumiko card/popover visual language (`#FFFFFF` surface, `14px`–`16px` radius, `0 16px 40px rgba(26,27,34,.16)` elevation, `IBM Plex Mono` tabular numerals, `#E07F24` focus outline) fulfilling Brief §3.6 & `R8`.
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: Member × Iteration breakdown (scheduled Sprint dates + offset, assigned weekdays, named Location holidays with `est.` flag, named active absences + portions, per-category stored overhead deductions in hours & days, explicit **`max(0, Days − Leaves − deductions) × FTE = Dev`** equation line with explicit `→ clamped to 0` step alongside the `'over_deducted'` warning when `Days − Leaves − deductions < 0` per `R8`, resulting dev days & dev hours) and Sprint/PI Forecast breakdown (Team dev days, resolved NV + source/history counts, raw vs. displayed Forecast SP, and link to `/calendar`).
  - **Translation note**: Triggered by an accessible button on Member × Iteration cells and Forecast cells; supports `Escape` and click-outside dismissal and returns focus to trigger on close.
  - **Provenance**: `recreated manually` using Azusa Kumiko popover tokens (reason: Brief §3.6 and `R8` require inspectable, keyboard-accessible calculation explanations including the explicit FTE multiplication step).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshot of open breakdown popover reviewed.
  - **Out-of-scope files/components**: Mutation forms inside the read-only breakdown popover.

- [x] **T018** `[US4, US5]` Add Playwright visual geometry tests (`tests/visual/capacity-planner.spec.ts`) and update F001 placeholder expectations for `/capacity`
  - **Target files/components**: `tests/visual/capacity-planner.spec.ts`, `tests/e2e/foundation-smoke.spec.ts`, `tests/visual/shell-fidelity.spec.ts`
  - **Expected behavior**:
    - `tests/visual/capacity-planner.spec.ts`: Seed a deterministic Team + PI + multi-location Members + Holidays + F003 sample catalog + overhead deductions + seed NV via local API, navigate to `/capacity`, and assert at `1440px`, `1024px`, and `768px`:
      - Floating header shows `ART › Team › PI` + `TodayWidget` + search + profile; navigation menu highlights `Capacity planner`.
      - 5 KPI tiles geometry & exact `R7` labels (`Planned SP`, `Development capacity`, `Normalized velocity`, `Forecast SP`, `Team FTE`) — single 5-column row at `1440px`, zero overlap/clipping at `1024px` and `768px`.
      - Team Allocation matrix + Deducted-first summary + expandable pre-FTE Member Capacity table (collapsed and one-Sprint-expanded states) have zero page-level horizontal overflow (`documentElement.scrollWidth <= innerWidth`) and collision-free geometry.
    - Update `tests/e2e/foundation-smoke.spec.ts` and `tests/visual/shell-fidelity.spec.ts` (`m10`) so `/capacity` asserts the live Capacity Planner heading instead of the F001 placeholder badge.
  - **Constraints**: Isolated `.azusa/test-playwright/` storage; port `3100`; zero external network requests.
  - **Validation/test location**: `npm run test:visual` and `npm run test:e2e` exit `0`.
  - **Out-of-scope files/components**: Other placeholder routes (`/calendar`, `/backlog`, `/sprint-planning`, `/iteration`, `/dashboard`, `/`, `/program-board`, `/pi-brief`).

- [x] **T019** `[US1, US2, US3, US4, US5]` Add Playwright E2E and `@axe-core/playwright` accessibility test suite for F004
  - **Target files/components**: `tests/e2e/capacity-planner.spec.ts`
  - **Expected behavior**:
    - Walk US1–US5 end-to-end against isolated port `3100` with zero external network requests:
      - Seed `Payments ART`, Team `Palawan` (plus Team `Cebu`), `PI-2027.1` (with 5 Sprints incl. IP) & `PI-2027.2`, multi-location Members (incl. `1.0` FTE, `0.5` FTE, and excluded `SM`/`PO`), Holidays (incl. an unconfirmed `est.` holiday), Absences (active `AL`, `HD`, cancelled, `BT`), and F003 sample catalog (`56/15/14/8/7` overrides).
      - Navigate to `/capacity`, verify 5 KPI tiles with exact `R7` labels (`Planned SP` showing `—` / `Not yet available`, `Development capacity`, `Normalized velocity`, `Forecast SP`, `Team FTE` excluding `SM`/`PO`), set `seed_normalized_velocity = 0.92`, reload, and verify `Manual seed` badge, Forecast SP, and Category Budgets (`Total 100% ✓`).
      - Bulk-apply `1.0` day `General work` and `0.5` day `Training` in `Fixed days` mode, reload, verify **Deducted first** summary, pre-FTE expanded cells (`Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25` for Hana) and pre-FTE footer overhead totals (`R8`); expand Sprint `2706`, edit one Member's `General work` deduction to `0.5` day (and verify `0.1` day snaps to `0.09` day / `0.75h`), reload, and verify updated dev days & Forecast SP (with no adjusted corner marker per `R4`).
      - Edit `Hours per day` (`8.0 → 7.5`), reload, and verify stored `deducted_hours` remained fixed (`8h` GW stays `8h`) and dev days / Forecast SP updated predictably (`R6`).
      - Switch `Deduction mode` to `% of available` and bulk-apply `10%` / `5%`; verify recalculated `0.25h`-snapped deductions persist.
      - Set Team PI velocity override `1.05`, verify `PI override` badge & updated Forecast SP without affecting `PI-2027.2` or `Cebu`; clear override and verify fallback to `0.92`.
      - Open a Member × Sprint calculation breakdown popover and verify scheduled dates, named holidays (`est.`), active absences, stored overhead deductions in hours & days, explicit `max(0, Days − Leaves − deductions) × FTE = Dev` step (`R8`), and dev days/hours; also verify an **over-deducted Member's** breakdown popover displays the `→ clamped to 0` step alongside the `'over_deducted'` warning (never showing a negative subtotal unexplained next to `Dev = 0`); close with `Escape`.
      - Invalidate F003 allocation (archive a dev category with `default_pct > 0`) and verify `/capacity` shows the invalid/drift warning banner and omits `Total 100% ✓`.
      - Verify `/calendar` and `/organization` links navigate cleanly; open `/capacity?teamId=<otherArtTeamId>&piId=<otherArtPiId>` pointing to an active Team + PI in a **different ART**, confirm the floating header atomically syncs to that exact ART/Team/PI and clears the URL params, then manually switch Team/PI in the header and confirm the page follows the header without pulling back; open `/capacity?teamId=<archivedTeamId>&piId=<piId>` and verify URL precedence, read-only banner with `"Return to active selection"`, disabled mutations, and header-change clearing URL params (`m13`); open `/capacity?teamId=<unknownUuid>&piId=<piId>`, `/capacity?teamId=<teamId>` (missing `piId`), and `/capacity?teamId=<artATeamId>&piId=<artBPiId>` and verify each keeps the header selection, clears the URL params, and shows the `"Link could not be opened — showing current selection"` notice; verify empty states (no iterations, unset NV).
      - Run `@axe-core/playwright` zero-violation scans on `/capacity` (collapsed, expanded, and breakdown-open states) across `1440px`, `1024px`, and `768px`.
  - **Constraints**: Isolated `.azusa/test-playwright/` state; zero external network requests.
  - **Validation/test location**: `npm run test:e2e`, `npm run test:visual`, `npm run test:run`, `npm run lint`, `npm run typecheck`, `npm run build` all exit `0`.
  - **Out-of-scope files/components**: Production `.azusa/data/`.

---

## Phase 06: Release Prep (MANDATORY)

**Purpose**: Synchronize application version (`0.3.0` → `0.4.0`) across manifest, lockfile, migration, and restore markers, and update all affected Constitution Principle VI living documentation before the final Browser Smoke Test.

- [x] **T020** `[US5]` Bump application version (`0.3.0` → `0.4.0`)
  - **Target files/components**: `package.json`, `package-lock.json`, `src/persistence/version.ts`
  - **Expected behavior**: Bump root `version` to `"0.4.0"` in `package.json` and `package-lock.json` (both top-level and `packages[""]`), and update `APP_VERSION = '0.4.0'` in `src/persistence/version.ts` so migration and restore markers stay synchronized.
  - **Constraints**: Preserve existing `'foundation.init'` records on upgrade; assert `appVersion === '0.4.0'` in `tests/integration/capacity-migration-backup.test.ts`.
  - **Validation/test location**: `npm run test:run` and `npm run build`.
  - **Out-of-scope files/components**: Feature UI code.

- [x] **T021** `[P]` `[US5]` Update `CHANGELOG.md`, `README.md`, and `docs/operations/database-and-recovery.md`
  - **Target files/components**: `CHANGELOG.md`, `README.md`, `docs/operations/database-and-recovery.md`
  - **Expected behavior**:
    - Add `0.4.0` entry to `CHANGELOG.md` summarizing F004 Capacity Engine & Capacity Planner additions and changes, explicitly noting that restricting development capacity to `Team member` only also displays the `"Excluded from dev capacity"` badge for `Admin` and `RTE` on `/organization`, and that `teams.hours_per_day` is now constrained to `[1.0, 24.0]` step `0.5`.
    - Update `README.md` for `/capacity` user-facing surface and `0.4.0` feature summary.
    - Update `docs/operations/database-and-recovery.md` to reflect `F004 / 0.4.0` and additive migration `0003_capacity_engine_planner.sql`.
  - **Constraints**: Concise and factual; no duplicated specification prose.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` and `npm run format:check`.
  - **Out-of-scope files/components**: `specs/`.

- [x] **T022** `[P]` `[US5]` Update `docs/REPO_MAP.md` and `docs/architecture/overview.md`
  - **Target files/components**: `docs/REPO_MAP.md`, `docs/architecture/overview.md`
  - **Expected behavior**: Document all new F004 modules (`src/domain/capacity/`, `src/application/capacity/`, `src/persistence/schema/capacity.ts`, `0003_capacity_engine_planner.sql`, `src/app/api/capacity/*`, `src/app/capacity/page.tsx`, `src/ui/capacity/*`) and update the system/data-flow overview.
  - **Constraints**: Reflect actual implemented paths accurately.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [x] **T023** `[P]` `[US5]` Update `docs/architecture/domain-model.md` and `docs/architecture/data-dictionary.md`
  - **Target files/components**: `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`
  - **Expected behavior**:
    - Update `domain-model.md` implementation-status banner to reflect F004 Capacity Engine, Team-scoped `OverheadDeduction` (renamed from v0.6 `OverheadReserve`), `TeamPiVelocityOverride`, and `/capacity` now implemented (while keeping F005–F019 conceptual), note `Team member`-only development-capacity eligibility (`A4`), and note `R9` forward impact on F013 overhead tickets.
    - Update `data-dictionary.md` (`0.4.0`) with extended `teams` columns (`deduction_mode`, `seed_normalized_velocity`, tightened `hours_per_day` step `0.5`), new Team-scoped `overhead_deductions` (`team_id`, `deducted_hours` `0..744` step `0.25`) and `team_pi_velocity_overrides` tables, `CHECK` constraints, `ON DELETE RESTRICT` FKs, and the `TeamPiCapacityView` derived read model.
  - **Constraints**: Preserve Data Model v0.6 invariants while documenting F004 refinements (`R2`, `R5`, `R6`, `R9`).
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [x] **T024** `[P]` `[US5]` Add ADR `0004-capacity-engine-and-planner.md`
  - **Target files/components**: `docs/architecture/decisions/0004-capacity-engine-and-planner.md`
  - **Expected behavior**: Record key F004 architectural decisions, rationale, and operator clarifications (`A1`–`A5`, `R1`–`R9`):
    - Pure TypeScript capacity engine with `hours_per_day` ∈ `[1.0, 24.0]` step `0.5` (`workdayMinutes` ∈ `[60, 1440]` step `30`), single authoritative full-precision `devDaysRaw` formula, and derived integer `devMinutes` (`M2`).
    - **Rename from v0.6 `OverheadReserve` to Team-scoped `OverheadDeduction`** (`overhead_deductions`, unique `(member_id, team_id, iteration_id, category_id)`) — explicitly recording both the rename (`R5`, keeping "reserve" wording exclusively for Buffers) and the `team_id` departure from v0.6 (`R2`), prorated fixed-day bulk apply, one-off percent bulk apply (`m5`), and no separate team-level overhead-category default table (`A2`).
    - **Fixed-hour `0.25h`-step storage (`R6`)**: `deducted_hours` (`0..744`, step `0.25`) replaces `R3` rescaling; changing `hours_per_day` leaves `deducted_hours` untouched and updates derived day values & Forecast SP predictably; `0.25h` halves-up snapping per Team on proration (`3.25h` / `4.75h`).
    - **No "drawing against" overhead (`R9`)**: supersedes `A2.6` and records the forward rework note for F013 overhead tickets.
    - Full v0.6 Normalized Velocity resolution chain (`Sprint override → PI override → Rolling 4-Sprint ratio of sums incl. IP → Team seed`), Team-specific `team_pi_velocity_overrides`, and zero-denominator fallback vs. genuine `0.0` NV (`A3`).
    - `Team member`-only role eligibility (`roles.ts`), independent `am`/`pm` half-day absence tracking (`m3`), per-weekday holiday/absence overlap capping, immediate deduction of unconfirmed `est.` holidays, dated `member_team_assignments` intersection (noting historical capacity uses current role, FTE, and Location — only Team assignment is dated), and `0`-clamping warnings (`A4`).
    - Presentation-only rounding (PI dev days rounded from raw sum `291.3`; per-Sprint Forecast SP rounded & summed for PI `268`; exact integer largest-remainder Category Budgets tie-broken by `sort_order`, then `categoryId` & summed for PI) (`A5`, `m2`), deferred overtime (`m9`), and `/capacity` v2 prototype deviations `D1`–`D8` (`A1`, `R1`, `R4`, `R7`, `R8`).
  - **Constraints**: Match existing ADR style in `0001`–`0003`.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [x] **T025** `[US5]` Run docs sanity check and full quality-gate suite
  - **Target files/components**: `tests/unit/docs-completeness.test.ts` (update if needed for ADR `0004` / version)
  - **Expected behavior**: Verify zero stale references or `TBD`/`TODO` markers across `docs/` and run all 7 quality gates (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`), confirming every command exits `0`.
  - **Constraints**: Leave `F004` unchecked in `docs/feature-roadmap.md` until Phase 07 operator UAT acceptance.
  - **Validation/test location**: All 7 npm quality-gate commands exit `0`.
  - **Out-of-scope files/components**: `docs/feature-roadmap.md` (`T031`).

**Phase 06 verification (2026-11-27)** — Lint, typecheck, production build, Vitest (166 tests), Playwright visual (13 tests), and Playwright E2E (9 tests) passed. The Windows checkout passed Prettier with `--end-of-line auto`. The default format gate passed on a temporary LF copy after the checkout's existing CRLF files triggered warnings. Release documentation links resolved and the placeholder scan passed. Historical briefs and the deferred roadmap retain pre-F004 terminology. F004 visual conformance and operator UAT are Phase 07 tasks.

**Visual gate follow-up (T018 and T025)** — After an intermittent parallel timeout was reported in Categories & Allocation, the visual project was set to one worker for its shared Next.js dev server. Three consecutive default `npm run test:visual` runs each passed all 13 tests. A three-worker comparison also passed on this checkout, leaving the reload trigger unconfirmed.

---

## Phase 07: Browser Smoke Test & Post-UAT Roadmap Acceptance (MANDATORY)

**Purpose**: Walk every user story's **Independent Test** in a real browser against the to-be-merged production build (after Release Prep), confirm visual fidelity, accessibility, and empty/loading/error states, and update `docs/feature-roadmap.md` only after conformance review and explicit operator UAT acceptance.

- [x] **T026** `[US1]` Verify US1 Independent Test (pure engine & canonical golden calculations); record verification result
  - **Target files/components**: Runtime verification via `tests/unit/capacity-golden.test.ts` & `tests/unit/capacity-engine.test.ts` plus live `/capacity` display check of `Palawan` / `PI-2027.1` Baseline (`291.3` dev days, `268 SP`, pinned category budgets `149/40/38/21/20`) and Adjusted (`60.25` / `291.8`) values, multi-location holidays incl. `est.`, `±1` offset, `Team member`-only eligibility, dated assignments, non-double-deduction, and `0`-clamping warning
  - **Expected behavior**: Confirm every step of US1's Independent Test passes on the to-be-merged build; record pass/fail evidence in `tasks.md`.
  - **Constraints**: Verify zero external network requests.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [x] **T027** `[US2]` Walk US2 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification on `/capacity` (`Deduction mode` toggle `Fixed days` ↔ `% of available`, bulk-applying `General work` `1.0d` & `Training` `0.5d` in `Fixed days`, mid-Sprint transfer Team isolation `3.25h` / `4.75h` per `R2`/`R6`, expanding Sprint `2706` to adjust one Member's `General work` to `0.5d` and verifying `0.1d → 0.09d` snapping with no adjusted corner marker per `R4`, updating `Hours per day` `8.0 → 7.5` verifying `deducted_hours` stay fixed and dev days change predictably per `R6`, bulk-applying `10%` / `5%` in `% of available`, reload persistence, and API `409`/`400` guards)
  - **Expected behavior**: Confirm every step of US2's Independent Test passes on the to-be-merged build; record evidence in `tasks.md`.
  - **Constraints**: Confirm zero separate team-default table drift and zero SP/velocity credit for overhead.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [x] **T028** `[US3]` Walk US3 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification on `/capacity` (setting Team seed NV `0.92` with `Manual seed` badge, setting Team PI override `1.05` with `PI override` badge & PI/Team isolation, clearing override back to `0.92`, verifying Sprint-to-PI Forecast SP sum & pinned integer largest-remainder Category Budgets, invalidating F003 allocation so `/capacity` displays the warning banner instead of `Total 100% ✓`)
  - **Expected behavior**: Confirm every step of US3's Independent Test passes; record evidence in `tasks.md`.
  - **Constraints**: Confirm full-precision internals and deterministic tie-breaking.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [x] **T029** `[US4]` Walk US4 Independent Test in a real browser; confirm prototype fidelity, calculation explanations, navigation & states
  - **Target files/components**: Runtime verification on `/capacity` (header `ART › Team › PI` switching, 5 KPI tiles with exact `R7` labels & `Planned SP` showing `—` / `Not yet available`, Team Allocation matrix + Deducted-first summary + `/organization` link, expandable pre-FTE Member Capacity table with stored footer totals per `R8` + `/calendar` link, leave/holiday/`est.` badges, inspectable Calculation Breakdown popover showing `max(0, Days − Leaves − deductions) × FTE = Dev` (with `→ clamped to 0` when over-deducted), URL-only archived ART/Team/PI read-only view & header clearing per `m13`, empty/loading/error states)
  - **Expected behavior**: Confirm every step of US4's Independent Test passes with zero console/hydration errors and zero `@axe-core/playwright` violations across `1440px`, `1024px`, and `768px`; record evidence in `tasks.md`.
  - **Constraints**: Confirm `1440px` matches `screenshots/03-capacity-planner.png` subject to `D1`–`D8`.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [x] **T030** `[US5]` Verify US5 Independent Test (migrations, CLI backup/restore & living documentation); record verification result
  - **Target files/components**: Runtime verification of F003→F004 migration upgrade, CLI `db:backup` / `db:restore` (`--from` / `--to`, `APP_VERSION = '0.4.0'`), all 7 quality gates, and living documentation (`overview.md`, `domain-model.md`, `data-dictionary.md`, `decisions/0004-capacity-engine-and-planner.md`, `database-and-recovery.md`, `REPO_MAP.md`, `CHANGELOG.md`, `README.md`)
  - **Expected behavior**: Confirm every step of US5's Independent Test passes; record evidence in `tasks.md`.
  - **Constraints**: Confirm `docs/feature-roadmap.md` keeps `F004` unchecked until `T031`.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T031** `[US5]` Post-UAT roadmap update
  - **Target files/components**: `docs/feature-roadmap.md`
  - **Expected behavior**: Only after conformance review and explicit operator UAT acceptance, tick `- [x] **F004 — Capacity Engine & Capacity Planner**` and update the roadmap progress summary (`4 / 19`).
  - **Constraints**: Do not tick `F004` before operator UAT acceptance.
  - **Validation/test location**: `docs/feature-roadmap.md` + `npm run test:run` (`docs-completeness.test.ts`).

**Phase 07 browser walkthrough (2026-11-27, agent-run)**: T026–T030 were walked by the agent, not the operator, with a scripted real Chromium session (Playwright, `en-US`, real clock) against the production build (`npm run build`, then `next start` on `127.0.0.1:3200`) and a fresh isolated database in git-ignored `.azusa/uat-f004/`, seeded with `seedCapacityBrowserFixture` plus `prepareCapacityCatalog` (overrides 56 / 15 / Inherit / 8 / Inherit). All 27 walk checks and the separate transfer check passed. The session made zero external requests and logged zero console, hydration, or page errors; the only HTTP errors were the intentional `404` and `409` from the invalid-link checks. T031 stays open for operator UAT.

- **T026 / US1**: `capacity-golden.test.ts` and `capacity-engine.test.ts` pass. With the stock seed, live 2710 showed `56.25` dev days instead of `58.75`: the startup seed adds PH "End of Ramadan (Eid al-Fitr) (est.)" on `2027-03-09`, which the golden fixture omits, so Andrea, Ben, and Hana (`0.5` FTE) lose `2.5` days. With only that holiday removed, `/capacity` showed the golden Baseline exactly: Sprint dev days `60.75 / 55.75 / 59.75 / 56.25 / 58.75`, KPI `291.3` days and `268 SP`, Sprint forecasts `56 / 51 / 55 / 52 / 54`, and PI budgets `149 / 40 / 38 / 21 / 20`. After Carlo's 2706 General work was set to `0.5` day (`4h`; his hours read `8 / 8 / 4 / 8 / 8`), 2706 showed `60.25` (`60.3`) and the PI showed `291.8` days. Eligibility showed `7.5 FTE` and 8 Members, with Maya Santos (SM) and Pat Reyes (PO) listed under "Excluded members (2)". Cells showed `−n leave`, `−n holiday`, and `holiday · est.` markers, and the Carlo 2710 breakdown listed "Hari Raya Puasa (est.)" and the active half day. Carlo 2710 at `200h` displayed `0` with "Over-deducted → clamped to 0". The `±1` offset is covered by the engine unit tests only; the fixture Team uses offset `0`.
- **T027 / US2**: The `Fixed days` ↔ `% of available` toggle persisted across reloads. Bulk `1.0` day General work and `0.5` day Training stored `8h` / `4h` (`64h` General work per Sprint); Hana 2706 showed `Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25`. Typing `0.1` day snapped to `0.75h` and displayed `0.09`, focus stayed on the input after Enter, and the reloaded row showed no Adjusted marker. Changing hours per day from `8` to `7.5` kept the stored General work and Training totals of `312.75h` and `160h`, lowered dev days from `292.16` to `288.47`, and lowered forecast from `269` to `265 SP`. Bulk `10%` / `5%` in `% of available` mode cut the stored General work total from `312.75h` to `298.25h`, and every stored deduction was a `0.25h` multiple (Carlo 2710 at 9 available days stored `7.25h` / `3.5h`). For the mid-Sprint transfer, Faye Tan was split in the database (Palawan 4–7 Jan, Cebu from 8 Jan; the Members API treats the fixture's future-dated assignments as a pending move). A UI bulk apply on Palawan stored `3.25h` for her 4/10 weekdays and left Cebu at `0h`; a UI bulk apply on Cebu then stored `4.75h` for her 6/10 weekdays and left Palawan at `3.25h`. The API rejected a development category (`409`), `0.1h`, `−1h`, and `745h` (`400`), a mismatched `mode` (`409`), and `32` days (`400`), and stored rows were unchanged.
- **T028 / US3**: Seed `0.92` showed the "Manual seed" badge and persisted across reload. A PI-2027.1 override of `1.05` showed "PI override" and raised the forecast from `269` to `308 SP`; the Sprint forecasts summed to the PI forecast, each Sprint's category budgets summed to its forecast, PI-2027.2 stayed `manual_seed`, and Cebu stayed `unset`. Clearing the override returned the velocity to "Manual seed". Archiving Feature development showed "Invalid allocation" and no "Total 100% ✓".
- **T029 / US4**: A valid Palawan link updated the header and cleared the URL. All five KPI labels matched `R7`, with Planned SP showing "—" / "Not yet available"; the allocation matrix showed "Inherits train", override chips, "— / budget", "Total 100% ✓", the Deducted-first table, and "Manage in Organization →". Sprint headers showed holiday-location counts. The Carlo 2710 breakdown listed the scheduled Sprint and offset, holidays, absences, "General work · 8h", and the `max(0, Days − Leaves − deductions) × FTE = Dev` equation, and Escape returned focus to its trigger. The `/calendar` and `/organization` links navigated correctly. An archived Team link showed the read-only banner with Hours per day and Edit velocity disabled; "Return to active selection" cleared the URL, and a header change also cleared it. Unknown, incomplete, and cross-PI links showed "Link could not be opened — showing current selection". Empty states were covered: no selection, Delivery ART (no eligible members, no Iterations, velocity "Unset"), and PI-2027.2 (no Iterations). Axe found zero violations at 1440, 1024, and 768 px, collapsed, expanded, and with the breakdown open. At 1440 px the Adjusted state with 2706 expanded matches `screenshots/03-capacity-planner.png` value for value (KPIs `291.8` / `0.92` / `268` / `7.5`, Sprint budgets, Member PI totals, Team dev days `291.8 / 60.8 / 55.8 / 60.3 / 56.3 / 58.8`). Operator feedback identified further layout differences. At 768 px the tables scroll inside focusable regions.
- **T030 / US5**: The F003 code at `main` (`0.3.0`) built a database with Teams at `hours_per_day` 8, 7.3, and 0.4. Running this branch's `npm run db:migrate` kept every F001–F003 row count, added `overhead_deductions` and `team_pi_velocity_overrides` (empty), defaulted `deduction_mode` to `fixed_days` and `seed_normalized_velocity` to `null`, and snapped 7.3 → 7.5 and 0.4 → 1.0. On the walked database (85 overhead deductions, 1 velocity override), `npm run db:backup`, then `npm run db:restore -- --from <backup> --to <dir>`, reproduced all 15 tables' row counts exactly with `appVersion` `0.4.0`. Gates: `lint`, `typecheck`, `build`, `test:visual` (13), and `test:e2e` (9) exit `0`. `format:check` exits `1` on this CRLF checkout and `0` with `--end-of-line auto`. `test:run` passed 166/166 at 10:59; a 13:04 rerun failed only `docs-completeness.test.ts`, because an untracked `docs/features/005-team-calendar-availability.md` (not part of F004) appeared during the run and is not yet indexed in `README.md`. The living documentation was reviewed in the Phase 06 conformance review, and `docs/feature-roadmap.md` keeps F004 unchecked.

**Phase 07 review follow-up (2026-11-27)** — The isolated browser fixture now uses the canonical handoff holidays for the golden PI. The production browser regression verified the Baseline and Adjusted KPI, Sprint, and category budget values with the fixture as seeded. The new browser transfer case schedules a Member move through the Organization API, verifies `3.25h` and `4.75h` on the two Teams, and inspects both −1 and +1 Sprint offsets. The planner retains keyboard focus through saves, shows empty bulk input guidance, and presents save errors once. All 13 tests in the standard visual gate and the focused production geometry checks passed. PI writes preserve Sprint-adjusted rows. The default formatter now passes on the Windows checkout, and the F005 brief is indexed. The full Vitest and E2E attempts encountered local timeouts. Across focused verification, 58 Vitest cases passed, including all three F004 migration and restore cases, and all ten E2E cases passed across the full attempt and focused retries. T031 remains pending operator UAT.

**Phase 07 visual fidelity follow-up** — Grouped the workday controls, kept the calendar action in the title row, collapsed bulk overhead inputs by default, and integrated the Deducted first summary into the allocation card. Both tables use shared column boundaries, and expanded Member rows and Team totals align with the same subcolumns. The excluded-Member disclosure sits inside the Member card and lists Sprint names for partial exclusions. Chromium captured the adjusted handoff scenario at 1440px and passed visual checks at 768px, 1024px, 1440px, and 2240px. The full visual suite passed 13 tests and the Capacity Planner E2E suite passed both tests. T031 remains open for operator UAT.

**Member header and layout refinement** — Chromium measured the Member header at 80px when collapsed, Sprint-expanded, and PI-expanded. The 27px subheader band is flush with the bottom of the header at 768px, 1024px, 1440px, and 2240px. Removed the duplicate Member overhead rows and redundant Calendar links. Bulk overhead and Organization open from their table headers, and Deducted first opens on demand. The focused visual test and both Capacity Planner E2E tests passed. Operator visual acceptance remains open.

**Prototype content cleanup** — The normal view reuses the workday field, velocity source, Category header, overhead row labels, and FTE value for required actions. One labelled set of overhead rows shows stored deductions in the Member grid. Removed separate action labels, the extra overhead card and disclosure row, the excluded-members footer, and visible holiday counts. The Sprint date headers expose holiday counts by description. Chromium verified the 80px Member header and 27px band at four widths. The planner workflow and accessibility checks passed. Operator visual acceptance remains open.

**Workday placement and typography** — The Hours per day editor now opens from the Development capacity value. The title row shows the prototype controls with the approved Team calendar link. Compared the planner typography with the handoff and aligned smaller captions, table values, location badges, and marker colors. Chromium passed the computed-style checks and verified workday persistence with Enter and on blur. The focused accessibility checks passed. Operator visual acceptance remains open.
