# Tasks: Work Categories & Allocation (F003)

**Branch**: `003-work-categories-allocation` | **Date**: 2026-11-24 (Updated for Review Pass 2 — active-Team/PI drift guard, reorder/error-order/semanticRole-null & E2E relative-date refinements)  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/api.md](./contracts/api.md)

## Conventions

- **Status legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel marker**: `[P]` indicates tasks touching distinct files with no shared edits that can run in parallel within the same phase
- **Phase dependencies**: `01 → 02 → 03 → 04 → 05 → 06 → 07` (every phase is additive and leaves the test suite and linter green)
- **Verification commands**: `npm run test:run` · `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run build` · `npm run test:visual` · `npm run test:e2e`

## Phase Summary

| Phase | Focus | Task IDs | User Stories |
|---|---|---|---|
| **Phase 01** | Pure Categories & Allocation Domain + Unit Tests | `T001–T003` | `US1, US2, US3, US4` |
| **Phase 02** | Drizzle Schema (2 Tables), Migration `0002` & Upgrade/CLI-Backup Tests | `T004–T005` | `US1, US2, US3, US4` |
| **Phase 03** | Transactional Application Service, F002 Delete Messages & Persistence Tests | `T006–T007` | `US1, US2, US3, US4` |
| **Phase 04** | Local HTTP API Route Handlers (`/api/categories/*`) & Route Tests | `T008–T010` | `US1, US2, US3` |
| **Phase 05** | `/organization` → `Categories & Allocation` Tab UI, Visual Suite & E2E/A11y Suite | `T011–T014` | `US1, US2, US3, US4` |
| **Phase 06** | Release Prep (Version Sync & Living Documentation) | `T015–T020` | `US4` |
| **Phase 07** | Browser Smoke Test & Post-UAT Roadmap Acceptance | `T021–T025` | `US1, US2, US3, US4` |

---

## Phase 01: Pure Categories & Allocation Domain + Unit Tests

**Purpose**: Implement all pure TypeScript domain rules (exact integer 100% validation, `not_configured` / `valid` / `invalid` ART status, `Inherit` vs. explicit `0%` resolution, current/future-PI drift detection per `D-1`, semantic roles, Payments ART sample catalog with `Feature dev.` per `D-3`) and strict Zod v4 schemas with deterministic Vitest unit tests before touching persistence or UI.

- [ ] **T001** `[P]` `[US1, US2, US3]` Implement pure category & allocation domain rules and sample catalog template (plus index F003 brief in `README.md`)
  - **Target files/components**: `src/domain/categories/rules.ts`, `src/domain/categories/sample-catalog.ts`, `README.md`
  - **Expected behavior**:
    - In `rules.ts`, export:
      - `CATEGORY_KINDS = ['development', 'overhead'] as const`
      - `CATEGORY_SEMANTIC_ROLES = ['feature', 'maintenance_bugs', 'standard'] as const`
      - `validateArtDefaultTotals(categories)` computing exact integer `activeDevelopmentTotalPct` across `kind === 'development' && recordStatus === 'active'` categories (excluding `overhead` and `archived`), returning `{ artConfigStatus: 'not_configured' | 'valid' | 'invalid', activeDevelopmentTotalPct, artDefaultsValid: activeDevCount > 0 && activeDevelopmentTotalPct === 100 }` (`D-2`).
      - `resolveTeamPiAllocation({ trainId, teamId, piId, teamRecordStatus, piRecordStatus, piEndDate, today, activeDevCategories, overridesByCategoryId })` resolving each active development category in `sortOrder` via `effectivePct = overridePct ?? artDefaultPct` (preserving explicit `0` as `source: 'override'` and `null`/absent as `source: 'inherit'`), computing `isCurrentOrFuturePi = piEndDate >= today` (`D-1`), `artConfigStatus`, `artDefaultTotalPct`, `artDefaultsValid`, `effectiveTotalPct`, `isValid: activeDevCategories.length > 0 && effectiveTotalPct === 100`, and `hasDriftWarning: teamRecordStatus === 'active' && piRecordStatus === 'active' && isCurrentOrFuturePi && activeDevCategories.length > 0 && !isValid` (using the exact same active-Team, active-PI, and `piEndDate >= today` rule as `driftedAllocations[]`, so archived Teams, archived PIs, and past PIs never emit drift warnings).
      - `validateTeamPiAllocationSave(activeDevCategories, submittedOverrides)` requiring every active development category in `submittedOverrides` and verifying exact integer sum `effectiveTotalPct === 100` with zero silent normalization, returning structured validation details (`{ currentTotal, requiredTotal: 100 }`) on failure.
    - In `sample-catalog.ts`, export `SAMPLE_CATEGORY_CATALOG` containing the 7 Payments ART starter categories (`Feature development` [`Feature dev.` per `D-3`, `#2E8B57`, `development`, `feature`, `49`, `sortOrder: 0`], `SW maintenance (bugs)` [`SW maint.`, `#C93A3A`, `development`, `maintenance_bugs`, `20`, `sortOrder: 1`], `Enablers` [`Enabler`, `#E8890C`, `development`, `standard`, `14`, `sortOrder: 2`], `Estimations` [`Estimation`, `#7A4CC2`, `development`, `standard`, `10`, `sortOrder: 3`], `Technical debt` [`Tech debt`, `#3F4148`, `development`, `standard`, `7`, `sortOrder: 4`], `General work` [`General work`, `#A39C93`, `overhead`, `null`, `null`, `sortOrder: 0`], `Training` [`Training`, `#5C7A1F`, `overhead`, `null`, `null`, `sortOrder: 1`]).
    - Index `docs/features/003-work-categories-allocation.md` in `README.md` so `tests/unit/docs-completeness.test.ts` stays green in Phase 01.
  - **Constraints**: Pure TypeScript only; zero imports from `next/*`, `react`, `drizzle-orm`, `@electric-sql/pglite`, or `node:*`; exact integer arithmetic only (no floating-point division or auto-normalization).
  - **Validation/test location**: `tests/unit/categories-rules-schemas.test.ts` (`T003`).
  - **Out-of-scope files/components**: Persistence schemas, F004 capacity/SP calculations.

- [ ] **T002** `[P]` `[US1, US2, US3]` Define strict Zod v4 schemas for F003 categories, ART defaults, and Team/PI overrides
  - **Target files/components**: `src/domain/categories/schemas.ts`
  - **Expected behavior**:
    - Define strict Zod v4 schemas (`.strict()` rejecting unknown keys and any `actor`/`createdBy`/`updatedBy` fields) for:
      - Query schemas: `ListCategoriesQuerySchema` (`trainId` UUIDv4, optional `includeArchived` `'true' | 'false'`), `TeamPiAllocationQuerySchema` (`teamId` UUIDv4, `piId` UUIDv4).
      - Mutation schemas: `CreateCategorySchema` (omits `defaultPct` completely — new `development` categories always start at `0%` and `overhead` at `null`; `kind === 'development'` requires `semanticRole`, while `kind === 'overhead'` rejects any non-null `semanticRole`), `UpdateCategorySchema` (partial strict update excluding immutable `trainId` and bulk `defaultPct`), `ReorderCategoriesSchema` (`trainId`, `kind: 'development' | 'overhead'`, non-empty unique `orderedIds[]`), `ApplySampleCatalogSchema` (`trainId`), `SaveArtDefaultsSchema` (`trainId`, `allocations: [{ categoryId, defaultPct: int 0..100 }]`), `SaveTeamPiAllocationSchema` (`teamId`, `piId`, `overrides: [{ categoryId, overridePct: int 0..100 | null }]`).
    - Enforce trimmed non-empty `name` and `shortLabel`, 6-digit hex `color` (`/^#[0-9A-Fa-f]{6}$/`), and integer-only percentages (`z.number().int().min(0).max(100)`).
  - **Constraints**: Pure TypeScript + `zod` only; reject `defaultPct` on `POST /api/categories`, decimals (`12.5`), negatives (`-1`), `> 100`, and unknown fields.
  - **Validation/test location**: `tests/unit/categories-rules-schemas.test.ts` (`T003`).
  - **Out-of-scope files/components**: API Route Handlers (`Phase 04`).

- [ ] **T003** `[US1, US2, US3, US4]` Add deterministic Vitest unit tests for domain rules, sample catalog, and Zod schemas
  - **Target files/components**: `tests/unit/categories-rules-schemas.test.ts`
  - **Expected behavior**:
    - Test `validateArtDefaultTotals`: `49+20+14+10+7 = 100` (`valid`), `95` and `105` (`invalid`), empty catalog (`not_configured`, `artDefaultsValid: false`), overhead and archived categories excluded.
    - Test `resolveTeamPiAllocation` & `validateTeamPiAllocationSave`: pure inherit (`49/20/14/10/7`), partial override (`56/15/inherit(14)/8/inherit(7) = 100`), explicit `0%` override (`63/15/14/8/0 = 100` with `source: 'override'`), clearing back to `null` restores `7%` (`source: 'inherit'`), missing active category in save payload rejected, invalid sum rejected with exact `currentTotal`, active Team × active current/future PI (`piEndDate >= today`) flagged on **both** partial-override drift (`104%`) and fully inheriting an invalid ART total (`88%`), and past PI (`piEndDate < today`), **archived Team**, and **archived PI** all live-resolve with `hasDriftWarning: false` (`D-1`).
    - Test `SAMPLE_CATEGORY_CATALOG`: 5 development categories summing to `100` (`Feature dev.` per `D-3`, 1 `feature`, 1 `maintenance_bugs`, 3 `standard`, `sortOrder 0..4`) + 2 overhead categories with `null` `defaultPct` and `semanticRole` (`sortOrder 0..1`).
    - Test all strict Zod schemas: valid payloads, `defaultPct` rejected on `CreateCategorySchema`, decimal rejection (`12.5`), negative/`> 100` rejection, non-null `semanticRole` on `overhead` rejected, invalid hex colour, empty name/short label, unknown keys, actor injection, malformed UUIDs.
  - **Constraints**: Deterministic pure unit tests with zero DB or network I/O.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: PGlite integration tests (`Phase 02`–`03`).

---

## Phase 02: Drizzle Schema (2 Tables), Migration `0002` & Upgrade/CLI-Backup Tests

**Purpose**: Define `categories` and `team_category_allocations` in Drizzle with explicit `IS NOT NULL` `CHECK` constraints, commit additive SQL migration `0002_work_categories_allocation.sql` with journal/snapshot metadata, and verify F002→F003 upgrade, direct SQL constraints, and CLI `db:backup`/`db:restore` round-trip integrity.

- [ ] **T004** `[US1, US2, US3]` Define Drizzle schema for `categories` and `team_category_allocations` and commit migration `0002_work_categories_allocation.sql`
  - **Target files/components**: `src/persistence/schema/categories.ts`, `src/persistence/schema/index.ts`, `src/persistence/migrations/0002_work_categories_allocation.sql`, `src/persistence/migrations/meta/_journal.json`, `src/persistence/migrations/meta/0002_snapshot.json`
  - **Expected behavior**:
    - Define `categories` and `team_category_allocations` in `src/persistence/schema/categories.ts` matching `specs/003-work-categories-allocation/data-model.md`:
      - Spread `auditColumns()` on both tables.
      - Use `ON DELETE RESTRICT` on all foreign keys (`categories.train_id → trains.id`, `team_category_allocations.team_id → teams.id`, `pi_id → pis.id`, `category_id → categories.id`).
      - Add all SQL `CHECK` constraints, including explicit `IS NOT NULL` guards on `categories_kind_fields_valid` (`(kind = 'development' AND semantic_role IS NOT NULL AND semantic_role IN ('feature', 'maintenance_bugs', 'standard') AND default_pct IS NOT NULL AND default_pct BETWEEN 0 AND 100) OR (kind = 'overhead' AND semantic_role IS NULL AND default_pct IS NULL)`).
      - Add indexes: `categories_train_name_ci_unique` (`(train_id, lower(trim(name)))`), `categories_train_active_bugs_unique` (`(train_id) WHERE record_status = 'active' AND semantic_role = 'maintenance_bugs'`), `categories_train_kind_sort_idx` (`(train_id, kind, sort_order)`), `team_cat_alloc_unique` (`(team_id, pi_id, category_id)`), `team_cat_alloc_team_pi_idx`, `team_cat_alloc_category_idx`.
    - Re-export `./categories` from `src/persistence/schema/index.ts`.
    - Generate and review `0002_work_categories_allocation.sql`, `meta/_journal.json`, and `meta/0002_snapshot.json` via `drizzle-kit generate`.
  - **Constraints**: Zero `ON DELETE CASCADE`; zero `PlanVersion`/`PICommitment`/`SprintCommitment`/`Actuals`/`Buffer`/`OverheadReserve` tables; do not modify `0000_foundation_init.sql` or `0001_organization_cadence.sql`; do not seed sample categories in `src/persistence/seed.ts`.
  - **Validation/test location**: `tests/integration/categories-migration-backup.test.ts` (`T005`).
  - **Out-of-scope files/components**: `src/persistence/seed.ts`, `src/persistence/lock.ts`.

- [ ] **T005** `[US4]` Add integration tests for F002→F003 migration upgrade, direct SQL `CHECK` constraints, and CLI `db:backup`/`db:restore` round-trip
  - **Target files/components**: `tests/integration/categories-migration-backup.test.ts`
  - **Expected behavior**:
    - Test 1 (F002→F003 upgrade): Apply `0000_foundation_init.sql` + `0001_organization_cadence.sql` + insert F001 `app_metadata` and F002 ART/Team/PI rows, then run `runMigrations()` applying `0002_work_categories_allocation.sql`; assert 100% of F001/F002 rows survive intact and `categories`/`team_category_allocations` tables exist.
    - Test 2 (Direct SQL-level constraints): Verify PostgreSQL rejects:
      - `development` row with `semantic_role = NULL` (must fail `categories_kind_fields_valid`),
      - `development` row with `default_pct = NULL` (must fail `categories_kind_fields_valid`),
      - `overhead` row with non-null `semantic_role` or non-null `default_pct`,
      - invalid `color`, `override_pct < 0` or `> 100`, duplicate case-insensitive `name` within same ART, second active `maintenance_bugs` within same ART, and `ON DELETE RESTRICT` when deleting a referenced ART/Team/PI/Category.
    - Test 3 (CLI `db:backup` & `db:restore` round-trip): Populate F003 categories (including `maintenance_bugs` and `overhead`) and `team_category_allocations` (including explicit `0%` alongside an inherited category), invoke the CLI backup and restore commands (`scripts/db/backup.ts` and `scripts/db/restore.ts --from <backupPath> --to <emptyDestDir>`), and verify exit code `0`, restored record counts **and exact restored field values** (every category's `name`, `short_label`, `color`, `kind`, `semantic_role`, `default_pct`, `sort_order`, `record_status`, plus explicit `override_pct === 0` vs absent inherited category row), active DB untouched, and restored `.azusa-last-healthy.json` records `APP_VERSION`.
  - **Constraints**: Isolated temp directories cleaned up on teardown; never touch `.azusa/data/`.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 03: Transactional Application Service, F002 Delete Messages & Persistence Tests

**Purpose**: Implement transactional application services enforcing all F003 business rules (`D-1`–`D-4`), update F002 `deleteTrain`/`deleteTeam`/`deletePi` conflict messages to name Categories / category allocations, and verify every invariant against real PGlite.

- [ ] **T006** `[US1, US2, US3]` Implement transactional category & Team/PI allocation service (`category-service.ts`) and update F002 delete conflict messages
  - **Target files/components**: `src/application/categories/category-service.ts`, `src/application/organization/organization-service.ts`, `src/application/organization/cadence-service.ts`
  - **Expected behavior**:
    - Reuse `ValidationError`, `ConflictError`, `NotFoundError`, `validate`, `requireRecord`, `requireActive`, `OrganizationOptions`, and `writeOrganization` from `src/application/organization/errors.ts`, `getServerTodayIsoDate()` from `src/domain/calendar/iso-week.ts`, and `resolveActor()` from `src/domain/audit/actor.ts`.
    - Update F002 `409 CONFLICT` messages:
      - `organization-service.ts` `deleteTrain`: `"Remove the ART’s Teams, PIs, and Categories before deleting it."`
      - `organization-service.ts` `deleteTeam`: `"This Team has Member assignments or category allocations."`
      - `cadence-service.ts` `deletePi`: `"Remove the PI’s Iterations and category allocations before deleting it."`
    - Implement in `category-service.ts` (accepting injectable `OrganizationOptions.today` wherever drift/current-future PI status is computed):
      - `listCategories(db, { trainId, includeArchived }, opts)` returning ordered categories (`kind, sort_order, name`, with `isReferenced: boolean`), `totalCategoryCount`, `artConfigStatus`, `activeDevelopmentTotalPct`, `artDefaultsValid`, and `driftedAllocations[]` covering **every** active Team × active PI (`pi.end_date >= today`, per `D-1`) whose effective active total `!== 100` (empty when `artConfigStatus === 'not_configured'`).
      - `createCategory(db, input, opts)` enforcing active ART (`404`/`409`), case-insensitive `name` uniqueness (`409`), single active `maintenance_bugs` per ART (`409`), initializing `development` with `default_pct = 0` and `overhead` with `default_pct = null, semantic_role = null`, and assigning next `sortOrder` within `(train_id, kind)`.
      - `updateCategory(db, id, input, opts)` enforcing active parent ART (`404`/`409`), `kind` immutability once referenced by `team_category_allocations` (`409`), `semanticRole` editability in F003 subject to single active `maintenance_bugs` per ART (`409`, `D-4`) while rejecting `semanticRole: null` on a `development` category with `400 VALIDATION_ERROR` (unless switching `kind` to `'overhead'`), archiving with any `default_pct` (`D-2`), and reactivating subject to active ART (`409`) and `maintenance_bugs` uniqueness (`409`) without rejecting non-100% totals (`D-2`).
      - `deleteCategory(db, id)` hard-deleting whenever zero `team_category_allocations` reference it regardless of `default_pct` (`D-2`; `404` if missing, `409` if archived ART or referenced).
      - `reorderCategories(db, input, opts)` validating active ART (`404`/`409`), exact permutation of all **active** categories of `(trainId, kind)` (`404` on unknown ID, `409` on wrong ART/kind/archived, `400` on duplicates/missing active IDs), updating `sort_order = 0..k-1` while preserving archived categories at `>= k`.
      - `applySampleCatalog(db, input, opts)` inserting all 7 `SAMPLE_CATEGORY_CATALOG` rows in one transaction only when the active ART has zero existing categories (`404`/`409`).
      - `saveArtDefaultAllocations(db, input, opts)` atomically validating active ART (`404`/`409`), full coverage of all active `development` categories (`404` on unknown `categoryId`, `409` on wrong ART/overhead/archived, `400` on missing/duplicate IDs or sum `!== 100`), updating `default_pct`, and returning updated `listCategories` payload with `driftedAllocations[]`.
      - `getTeamPiAllocation(db, { teamId, piId }, opts)` validating Team & PI exist (`404`) and share `trainId` (`409`), returning snapshot-ready `TeamPiAllocationView` with `isCurrentOrFuturePi` and `hasDriftWarning`.
      - `saveTeamPiAllocation(db, input, opts)` atomically validating active ART, active Team, active PI, same `trainId` (`404`/`409`), **full coverage of all active `development` categories** (`404` on unknown `categoryId`, `409` on wrong ART/overhead/archived, `400` on missing/duplicate IDs or resolved sum `!== 100`), upserting rows where `overridePct !== null` (preserving explicit `0`) and deleting rows where `overridePct === null` (restoring `Inherit`).
      - `resetTeamPiAllocation(db, { teamId, piId }, opts)` validating active ART, active Team, active PI, and same `trainId` (`404`/`409`), deleting override rows for **active** development categories only (preserving archived-category override rows), and succeeding even when ART defaults are invalid (`D-2`).
      - Follow the deterministic error precedence order in `contracts/api.md` (1: schema/shape/duplicates `400` → 2: entity & `categoryId` existence `404` → 3: active/ownership/kind/conflict `409` → 4: full-set completeness, role-for-kind, and `sum === 100` `400`).
  - **Constraints**: All multi-row reads/writes inside `writeOrganization(db, tx => ...)`; zero React/HTTP imports; never auto-redistribute percentages or mutate explicit overrides when ART defaults change.
  - **Validation/test location**: `tests/integration/categories-persistence.test.ts` (`T007`) and `tests/integration/organization-persistence.test.ts` (update exact delete-message assertions if needed).
  - **Out-of-scope files/components**: HTTP Route Handlers (`Phase 04`), F004 capacity engine, F012 snapshots.

- [ ] **T007** `[US1, US2, US3, US4]` Add comprehensive real-PGlite integration tests for all F003 service invariants and F002 delete conflict messages
  - **Target files/components**: `tests/integration/categories-persistence.test.ts`, `tests/integration/organization-persistence.test.ts` (only if existing delete-message assertions need updating)
  - **Expected behavior**:
    - Use fixed injectable `today` (`OrganizationOptions.today`) across all drift tests and verify every invariant against real PGlite:
      - Empty ART (`artConfigStatus: 'not_configured'`); `applySampleCatalog` creates 7 categories (`49/20/14/10/7` with `Feature dev.` + 2 overhead); second call or non-empty ART returns `409`.
      - `createCategory` always initializes `development` to `0%` and `overhead` to `null`; case-insensitive name uniqueness per ART; cross-ART name reuse; within-group reordering (`development` vs `overhead`) assigning `0..k-1` to active categories, placing archived categories of that `kind` after them at `>= k` in their relative order, and leaving the other `kind` group untouched.
      - Single active `maintenance_bugs` per ART (`409` on second active; allowed in second ART); renaming preserves `id` & `semantic_role`; `semantic_role` remains editable in F003 even when `team_category_allocations` exist (`D-4`); clearing `semanticRole: null` on a `development` category without switching to `overhead` returns `400 VALIDATION_ERROR` (not `500`).
      - `kind` change allowed when unreferenced (even if `default_pct > 0`, flagging resulting ART total per `D-2`) and rejected (`409`) once referenced.
      - `D-2` archive/delete/reactivate: archiving with `default_pct > 0` succeeds and flags ART total (`88%`) without redistribution; hard-deleting an unreferenced category with `default_pct > 0` (including the last development category → `not_configured`) succeeds and allows deleting the ART afterward; reactivating succeeds (validating active ART & `maintenance_bugs` uniqueness) and flags any non-100% total.
      - Atomic ART defaults save: `49+20+14+10+7 = 100` succeeds; `95%` rejected (`400`) with zero mutation.
      - Full-set Team/PI overrides: `56 / 15 / Inherit(14) / 8 / Inherit(7) = 100%`; **partial override payload submitted against a Team/PI that already has overrides is rejected (`400 VALIDATION_ERROR`) with zero mutations**; explicit `0%` (`63/15/14/8/0`) persists as `0` (`source: 'override'`); clearing back to `null` restores `7%` (`source: 'inherit'`); PI scoping (`PI-2` unaffected); Team isolation.
      - `D-1` & `D-2` drift coverage:
        - Partial-override drift after ART default edit (`45/20/18/10/7` → `Palawan / PI-2027.1` flagged at `104%`); past PI (`end_date < today`), **archived Team** (read via `getTeamPiAllocation`), and **archived PI** (read via `getTeamPiAllocation`) all live-resolve their invalid splits with `isValid: false` while remaining **excluded** from `driftedAllocations` and returning `hasDriftWarning: false`.
        - Fully-inheriting Team/PI flagged when ART defaults become invalid after archiving/deleting a category with `default_pct > 0`.
        - Drift after archiving a category and after reactivating a category with a kept override — including a Team/PI that explicitly overrides **every** category.
      - `resetTeamPiAllocation`: rejects archived ART/Team/PI (`409`), deletes override rows for **active** development categories only while **preserving** archived-category override rows, and succeeds while flagging the resulting split when ART defaults are invalid.
      - Cross-ART isolation (`409`) and unknown `categoryId` (`404`).
      - F002 delete guards: `deleteTrain`, `deleteTeam`, and `deletePi` return `409 CONFLICT` with the exact updated messages naming Categories / category allocations when referenced by F003 rows.
  - **Constraints**: Isolated temp PGlite databases cleaned up on teardown.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 04: Local HTTP API Route Handlers (`/api/categories/*`) & Route Tests

**Purpose**: Expose thin, strict Zod-validated Next.js App Router Route Handlers for all F003 operations matching `contracts/api.md`, verified by a dedicated `categories-routes.test.ts` file (matching F002's `organization-routes.test.ts`).

- [ ] **T008** `[P]` `[US1]` Implement category CRUD, within-group reorder, and sample-catalog Route Handlers
  - **Target files/components**: `src/app/api/categories/route.ts`, `src/app/api/categories/[id]/route.ts`, `src/app/api/categories/reorder/route.ts`, `src/app/api/categories/sample/route.ts`
  - **Expected behavior**:
    - `GET /api/categories?trainId=<uuid>&includeArchived=true|false` → `listCategories` (`200`).
    - `POST /api/categories` → `createCategory` (`201`).
    - `PATCH /api/categories/[id]` → `updateCategory` (`200`).
    - `DELETE /api/categories/[id]` → `deleteCategory` (`200`).
    - `POST /api/categories/reorder` → `reorderCategories` (`200`).
    - `POST /api/categories/sample` → `applySampleCatalog` (`201`).
    - Reuse `readQuery`, `readBody`, `readId`, `requireNoQuery`, `organizationDb`, and `organizationResponse` from `src/app/api/organization/http.ts` (`Cache-Control: no-store`, uniform error envelopes).
  - **Constraints**: Thin HTTP adapters only; no business logic in route handlers; reject unknown keys and actor fields.
  - **Validation/test location**: `tests/integration/categories-routes.test.ts` (`T010`).
  - **Out-of-scope files/components**: Existing `/api/organization/*` routes.

- [ ] **T009** `[P]` `[US2, US3]` Implement ART default allocation and Team/PI allocation Route Handlers
  - **Target files/components**: `src/app/api/categories/defaults/route.ts`, `src/app/api/categories/allocations/route.ts`
  - **Expected behavior**:
    - `PUT /api/categories/defaults` → `saveArtDefaultAllocations` (`200`).
    - `GET /api/categories/allocations?teamId=<uuid>&piId=<uuid>` → `getTeamPiAllocation` (`200`).
    - `PUT /api/categories/allocations` → `saveTeamPiAllocation` (`200`).
    - `DELETE /api/categories/allocations?teamId=<uuid>&piId=<uuid>` → `resetTeamPiAllocation` (`200`).
  - **Constraints**: Thin HTTP adapters reusing `src/app/api/organization/http.ts`; `Cache-Control: no-store`; strict query/body validation.
  - **Validation/test location**: `tests/integration/categories-routes.test.ts` (`T010`).
  - **Out-of-scope files/components**: Existing `/api/organization/*` routes.

- [ ] **T010** `[US1, US2, US3]` Add dedicated HTTP Route Handler contract tests (`categories-routes.test.ts`)
  - **Target files/components**: `tests/integration/categories-routes.test.ts`
  - **Expected behavior**:
    - Exercise every `/api/categories/*` Route Handler against a real PGlite test context, verifying:
      - `200`/`201` happy paths and `Cache-Control: no-store` header on every endpoint.
      - Exact `400 VALIDATION_ERROR` on unknown fields, `defaultPct` in `POST /api/categories`, `semanticRole: null` on a `development` category in `PATCH /api/categories/[id]` (without switching to `overhead`), actor injection (`createdBy`), decimal percentages, invalid UUIDs, invalid `includeArchived`, partial `overrides` or `allocations` payloads, empty `orderedIds: []` (even when the group has zero active categories) or incomplete/duplicate `orderedIds`, and non-100% sums (with `{ currentTotal, requiredTotal: 100 }`).
      - Exact `404 NOT_FOUND` on nonexistent `trainId`, `teamId`, `piId`, path `[id]`, **unknown `categoryId`** in `reorder`, `defaults`, and `allocations`, and a combined payload with both an unknown `categoryId` and missing active categories (verifying deterministic `404` precedence over `400` completeness).
      - Exact `409 CONFLICT` on duplicate name, second active `maintenance_bugs`, non-empty sample catalog apply, cross-ART Team/PI/Category mismatch, targeting an `overhead` or `archived` category in `defaults`/`allocations`, targeting a category from the **other `kind` group** or an `archived` category in `reorder` (while reordering `overhead` categories succeeds), archived ART/Team/PI writes (including `DELETE /api/categories/allocations`), and referenced delete or `kind` change.
  - **Constraints**: Separate file from `categories-persistence.test.ts` (matching F002's `organization-routes.test.ts`); zero external network requests.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 05: `/organization` → `Categories & Allocation` Tab UI, Visual Suite & E2E/A11y Suite

**Purpose**: Build the `Categories & Allocation` tab inside `/organization` matching Azusa's Kumiko design system and F002's workspace conventions (`Visual-Fidelity Mode: Mixed`), add dedicated visual geometry checks in `tests/visual/categories-allocation.spec.ts`, and add full Playwright E2E + `@axe-core/playwright` coverage across `1440px`, `1024px`, and `768px`.

- [ ] **T011** `[US1, US2]` Implement ART Work Categories & Default Allocation section in `src/ui/organization/CategoriesAndAllocationPanel.tsx` and `src/ui/organization/organization.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `AZUSA_HANDOFF.md` §9 (category colours `#2E8B57`, `#C93A3A`, `#E8890C`, `#7A4CC2`, `#3F4148`, `#A39C93`, `#5C7A1F`; `"100% ✓"` valid-total badge) and F002's `src/ui/organization/organization.module.css` Kumiko card/table tokens (no dedicated final F003 prototype screen exists — Deviations `D1`–`D4` in `plan.md`).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px`; states: empty ART (`"Not configured"` + `"Apply sample catalog"` button), populated Development + Overhead grouped lists, create/edit inline form (new dev categories start at `0%`), within-group up/down reorder controls, `"Show archived"` toggle, archive/reactivate/delete actions, invalid ART default total (`95%` / `88%` warning + rejected save without silent normalization), valid ART default total (`100% ✓`), drifted current/future Team/PI advisory banner, loading & inline error alert states.
  - **Translation note**: Reuse existing Kumiko CSS custom properties (`#F4F1EC`, `#FFFFFF`, `#1A1B22`, `#E07F24`, `#A65307`, `IBM Plex Mono` tabular numerals for percentages/totals) and `src/ui/organization/controls.tsx` without introducing a standalone `/settings` route or SP-budget visualizations.
  - **Provenance**: `recreated manually` using F001/F002 Kumiko design tokens (reason: no dedicated F003 prototype screen exists per Feature Brief §3).
  - **Done when**: Tier 1 (`npm run test:visual` including `tests/visual/categories-allocation.spec.ts` in `T013`) green at `1440px`, `1024px`, `768px`; Tier 2 screenshots reviewed for Kumiko consistency, non-color status badges, and collision-free layout.
  - **Out-of-scope files/components**: `/settings`, F004 Capacity Planner, F005 Team Calendar.

- [ ] **T012** `[US3]` Implement Team PI Allocation section (Inherit vs. Explicit `0%` Override, Empty/Invalid/Read-Only States & Drift Warnings) in `src/ui/organization/CategoriesAndAllocationPanel.tsx` and `src/ui/organization/organization.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `AZUSA_HANDOFF.md` §9 & `screenshots/03-capacity-planner.png` (percentage split table, explicit `Inherit` vs. `Override` distinction, `"100% ✓"` badge; SP budget columns intentionally omitted per Deviation `D3`).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px`; states:
    - No Teams/PIs empty state;
    - ART has `0` active development categories (`"Not configured"` empty state with Save/Reset disabled);
    - ART defaults currently invalid (`!== 100%`, showing clear banner, live resolved percentages, Save requiring `100%`, Reset-all allowed & flagging resulting split);
    - Optional `"Show archived Teams/PIs"` toggle enabling **read-only** inspection of archived Teams/PIs (`"Archived — read-only"` badge, disabled inputs/Save/Reset);
    - Pure-Inherit state (`100% ✓`), partial-override state (`56 / 15 / 14 / 8 / 7 = 100% ✓`), explicit `0%` override (`0` + **`Override`** badge, distinct from blank **`Inherit`**), per-row `"Reset"` to `Inherit`, `"Reset all to ART defaults"`, invalid save feedback, and current/future-PI drift warning banner (`104%` / `88%`).
  - **Translation note**: Treat empty input `""` strictly as `null` (`Inherit`) and `"0"` strictly as integer `0` (`Override`); render explicit text badges (`Inherit` / `Override` / `100% ✓` / `Not configured` / `Archived — read-only` / `Drift warning`) so status is never conveyed by color alone.
  - **Provenance**: `recreated manually` using F001/F002 Kumiko design tokens (reason: no dedicated F003 prototype screen exists per Feature Brief §3).
  - **Done when**: Tier 1 (`npm run test:visual` including `tests/visual/categories-allocation.spec.ts` in `T013`) green at `1440px`, `1024px`, `768px`; Tier 2 screenshots reviewed.
  - **Out-of-scope files/components**: Per-Sprint allocations, F004 SP budgets, F012 Plan Versions / Start PI.

- [ ] **T013** `[US4]` Mount `Categories & Allocation` as the 4th tab in `src/ui/organization/OrganizationWorkspace.tsx` and add visual geometry tests (`tests/visual/categories-allocation.spec.ts`)
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/Settings.dc.html#L24-L38` (uncluttered `/organization` header: logo + `"Search organization…"` search + profile menu only; no `TodayWidget`, no `ART › Team › PI`, `Settings` remains disabled in profile dropdown, no primary nav item active).
  - **Target files/components**: `src/ui/organization/OrganizationWorkspace.tsx`, `tests/visual/categories-allocation.spec.ts`
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: all 4 `/organization` underline tabs keyboard-navigable (`ArrowLeft`/`ArrowRight`/`Home`/`End`), `Categories & Allocation` tab active (empty & populated states), collision-free geometry and zero horizontal page overflow.
  - **Translation note**: Append `{ id: 'categories', name: 'Categories & Allocation', Panel: CategoriesAndAllocationPanel }` to `tabs` in `OrganizationWorkspace.tsx` without altering `FloatingHeader.tsx`, `ProfileMenu.tsx`, or `NavigationMenu.tsx`. Add `tests/visual/categories-allocation.spec.ts` so `npm run test:visual` actively exercises `/organization` → `Categories & Allocation` at all 3 breakpoints.
  - **Provenance**: `lifted from F002 OrganizationWorkspace` (which already matches `Settings.dc.html#L24-L38`).
  - **Done when**: Tier 1 (`npm run test:visual`) passes at all breakpoints (`1440px`, `1024px`, `768px`) with zero regressions on F001/F002 visual checks; Tier 2 screenshot of `/organization` → `Categories & Allocation` reviewed.
  - **Out-of-scope files/components**: `src/ui/shell/FloatingHeader.tsx`, `src/ui/shell/ProfileMenu.tsx`.

- [ ] **T014** `[US1, US2, US3, US4]` Add Playwright E2E and `@axe-core/playwright` accessibility test suite for F003
  - **Target files/components**: `tests/e2e/categories-allocation.spec.ts`
  - **Expected behavior**:
    - Walk US1–US4 against isolated port `3100` with zero external network requests:
      - Create `Payments ART` with PI dates computed **relative to the server's current date** (a past PI ending `today - 30d`, a current/future PI ending `today + 60d`, and a second future PI ending `today + 150d`, so the test never expires after 2027), plus Teams `Palawan` and `Cebu`, and `Core Platform ART`.
      - Open **`Categories & Allocation`** tab; confirm `Payments ART` starts empty (`"Not configured"`); click **"Apply sample catalog"**; reload and confirm 5 development (`Feature dev.`) + 2 overhead categories persist and sample action is no longer available.
      - Create a new category, edit/rename `SW maintenance (bugs)` to `Bugs & Support` and change colour, reload and confirm `maintenance_bugs` role persists; verify creating a second active `maintenance_bugs` category is rejected.
      - Reorder categories within the Development group and confirm persisted order across reload; verify `Core Platform ART` maintains an independent catalog.
      - **Archive** a category (including with `default_pct > 0` per `D-2`), reload to confirm it is hidden behind `"Show archived"` and the ART total is flagged without redistribution; **reactivate** it and reload to confirm restoration; **hard-delete** an unreferenced category and reload to confirm deletion persists (`SC-003`).
      - Edit ART default to total `95%`, attempt save, confirm clear validation error and unchanged persisted values; adjust to `100%` and confirm persistence.
      - Select `Palawan` + `PI-2027.1`, override to `56 / 15 / Inherit(14) / 8 / Inherit(7) = 100%`, save and reload confirming `Override` vs `Inherit` badges.
      - Override `Technical debt` to explicit **`0%`** (`63 / 15 / 14 / 8 / 0 = 100%`), save, reload, confirm `0%` stays **`Override`**; clear back to **`Inherit`** and confirm `7%` restores.
      - Switch to `Palawan` + `PI-2027.2` and `Cebu` + `PI-2027.1`, confirming both remain unaffected (`49 / 20 / 14 / 10 / 7`, all `Inherit`).
      - Also apply the same partial overrides (`56 / 15 / Inherit(14) / 8 / Inherit(7) = 100%`) to `Palawan` on the **past PI** before editing ART defaults, then update `Payments ART` defaults to `45 / 20 / 18 / 10 / 7 = 100%`, verifying: (a) the current/future PI for `Palawan` displays a drift warning (`104%`) without mutating explicit overrides, and (b) the **past PI** live-resolves to `104%` on read but is **excluded** from drift warnings (`D-1`); test `"Reset all to ART defaults"`.
      - Verify empty-ART (no dev categories) state, invalid-ART-default state, and `"Show archived Teams/PIs"` read-only mode; verify profile-menu `Settings` stays disabled and `/organization` header omits `TodayWidget` and `ART › Team › PI`.
      - Run `@axe-core/playwright` zero-violation scans on `/organization` → `Categories & Allocation` across `1440px`, `1024px`, and `768px`, verifying keyboard operability and zero horizontal overflow.
  - **Constraints**: Isolated `.azusa/test-playwright/` state; zero external network requests.
  - **Validation/test location**: `npm run test:e2e`, `npm run test:visual`, `npm run test:run`, `npm run lint`, `npm run typecheck`, `npm run build` all exit `0`.
  - **Out-of-scope files/components**: Production `.azusa/data/`.

---

## Phase 06: Release Prep (MANDATORY)

**Purpose**: Synchronize application version across manifest, lockfile, migration, and restore markers, and update all affected Constitution Principle VI living documentation before the final Browser Smoke Test.

- [ ] **T015** `[US4]` Bump application version (`0.2.0` → `0.3.0`)
  - **Target files/components**: `package.json`, `package-lock.json`, `src/persistence/version.ts`, `tests/integration/organization-migration-seed.test.ts` (update version assertion only if hardcoded to `'0.2.0'` instead of importing `APP_VERSION`)
  - **Expected behavior**: Bump root `version` to `"0.3.0"` in `package.json` and `package-lock.json` (both top-level and `packages[""]`), and update `APP_VERSION = '0.3.0'` in `src/persistence/version.ts` so migration and restore markers stay synchronized.
  - **Constraints**: Preserve existing `'foundation.init'` records on upgrade; assert `appVersion === '0.3.0'` in `tests/integration/categories-migration-backup.test.ts`.
  - **Validation/test location**: `npm run test:run` and `npm run build`.
  - **Out-of-scope files/components**: Feature UI code.

- [ ] **T016** `[P]` `[US4]` Update `CHANGELOG.md`, `README.md`, and `docs/operations/database-and-recovery.md`
  - **Target files/components**: `CHANGELOG.md`, `README.md`, `docs/operations/database-and-recovery.md`
  - **Expected behavior**:
    - Add `0.3.0` entry to `CHANGELOG.md` summarizing F003 additions and changes.
    - Update `README.md` for `/organization` → `Categories & Allocation` user-facing surface and `0.3.0` version/feature summary.
    - Update `docs/operations/database-and-recovery.md` to reflect `F003 / 0.3.0` and additive migration `0002_work_categories_allocation.sql`.
  - **Constraints**: Concise and factual; no duplicated specification prose.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` and `npm run format:check`.
  - **Out-of-scope files/components**: `specs/`.

- [ ] **T017** `[P]` `[US4]` Update `docs/REPO_MAP.md` and `docs/architecture/overview.md`
  - **Target files/components**: `docs/REPO_MAP.md`, `docs/architecture/overview.md`
  - **Expected behavior**: Document all new F003 modules (`src/domain/categories/`, `src/application/categories/`, `src/persistence/schema/categories.ts`, `0002_work_categories_allocation.sql`, `src/app/api/categories/*`, `CategoriesAndAllocationPanel.tsx`) and update the system/data-flow overview.
  - **Constraints**: Reflect actual implemented paths accurately.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T018** `[P]` `[US4]` Update `docs/architecture/domain-model.md` and `docs/architecture/data-dictionary.md`
  - **Target files/components**: `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`
  - **Expected behavior**:
    - Update `domain-model.md` implementation-status banner to reflect F003 `Category` and `TeamCategoryAllocation` now implemented (while keeping F004–F019 conceptual).
    - Update `data-dictionary.md` (`0.3.0`) with `categories` and `team_category_allocations` tables, columns, explicit `IS NOT NULL` `CHECK` constraints, partial unique `maintenance_bugs` index, `ON DELETE RESTRICT` FKs, sparse `Inherit` vs. explicit `0%` storage, and the `TeamPiAllocationView` derived read model.
  - **Constraints**: Preserve Data Model v0.6 invariants.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T019** `[P]` `[US4]` Add ADR `0003-work-categories-and-allocation.md`
  - **Target files/components**: `docs/architecture/decisions/0003-work-categories-and-allocation.md`
  - **Expected behavior**: Record key F003 architectural decisions, rationale, and operator decisions `D-1`–`D-4`:
    - Stable `semantic_role` (`feature` | `maintenance_bugs` | `standard`) on `development` categories with partial unique index enforcing at most one active `maintenance_bugs` per ART, remaining editable in F003 until F007 adds work-item reference checks (`D-4`).
    - Sample catalog `Feature dev.` short label accepted by operator (`D-3`), resolving and overriding `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §21 item 7.
    - Lifecycle without a `default_pct === 0` lock (`D-2`): archive/delete/reactivate/kind-switch never redistribute percentages and instead flag invalid ART totals (with empty catalog as valid `"not configured"`), while `kind` stays immutable once referenced and new dev categories always start at `0%`.
    - Exact integer `0–100` percentage storage/arithmetic, full-set Team/PI saves, sparse `team_category_allocations` row design (`Inherit` vs explicit `0%`), and active-only reset-all preserving archived-category override rows.
    - Current/future-PI-only drift warnings (`pi.end_date >= today`, `D-1`) covering every invalid in-scope Team/PI split without early pre-F012 snapshots.
    - Within-group `(train_id, kind)` ordering, empty default ART catalog with explicit `"Apply sample catalog"`, and `/organization` → `Categories & Allocation` placement (no `/settings`).
  - **Constraints**: Match existing ADR style in `0001` and `0002`.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T020** `[US4]` Run docs sanity check and full quality-gate suite
  - **Target files/components**: `tests/unit/docs-completeness.test.ts` (update if needed for ADR `0003` / version)
  - **Expected behavior**: Verify zero stale references or `TBD`/`TODO` markers across `docs/` and run all 7 quality gates (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`), confirming every command exits `0`.
  - **Constraints**: Leave `F003` unchecked in `docs/feature-roadmap.md` until Phase 07 operator UAT acceptance.
  - **Validation/test location**: All 7 npm quality-gate commands exit `0`.
  - **Out-of-scope files/components**: `docs/feature-roadmap.md` (`T025`).

---

## Phase 07: Browser Smoke Test & Post-UAT Roadmap Acceptance (MANDATORY)

**Purpose**: Walk every user story's **Independent Test** in a real browser against the to-be-merged production build (after Release Prep), confirm accessibility and empty/loading/error states, and update `docs/feature-roadmap.md` only after conformance review and explicit operator UAT acceptance.

- [ ] **T021** `[US1]` Walk US1 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification against `/organization` → `Categories & Allocation` (empty ART catalog, optional `"Apply sample catalog"` + duplicate protection, renaming `SW maintenance (bugs)` preserving `maintenance_bugs`, single active `maintenance_bugs` rejection, cross-ART independent catalog, within-group reordering, archive/reactivate/hard-delete with reload persistence, unreferenced `kind` switch)
  - **Expected behavior**: Confirm every step of US1's Independent Test passes on the to-be-merged build; record pass/fail evidence in `tasks.md`.
  - **Constraints**: Test against `127.0.0.1` production build with zero external network requests.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T022** `[US2]` Walk US2 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification against `/organization` → `Categories & Allocation` (`49+20+14+10+7 = 100% ✓`, `95%` rejected without silent normalization, valid `100%` edit persisted across reload, decimal/negative/`> 100` rejection, archiving a category with `default_pct > 0` flagging `88%` without redistribution, reactivating restoring `100% ✓` per `D-2`)
  - **Expected behavior**: Confirm every step of US2's Independent Test passes; record evidence in `tasks.md`.
  - **Constraints**: Confirm zero automatic percentage redistribution.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T023** `[US3]` Walk US3 Independent Test in a real browser; record verification result
  - **Target files/components**: Runtime verification against `/organization` → `Categories & Allocation` (`Palawan` / current-or-future PI e.g. `PI-2027.1` `56 / 15 / Inherit(14) / 8 / Inherit(7) = 100%`, explicit `0%` override vs `Inherit` persistence across reload, second future PI e.g. `PI-2027.2` and `Cebu` isolation, ART default change triggering `104%` drift warning on the current/future PI while excluding the past PI e.g. `PI-2025.1` per `D-1` — adjusting PI dates relative to the UAT date if run after early 2027 — archiving a category flagging invalid splits, reset-all preserving archived-category overrides and allowed when ART defaults are invalid)
  - **Expected behavior**: Confirm every step of US3's Independent Test passes; record evidence in `tasks.md`.
  - **Constraints**: Confirm no per-Sprint allocations or SP budgets are exposed.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T024** `[US4]` Walk US4 Independent Test in a real browser; confirm empty/loading/error states, keyboard operation, and non-color status cues
  - **Target files/components**: Runtime verification on `/organization` → `Categories & Allocation` (uncluttered header without `TodayWidget` or `ART › Team › PI`, disabled `Settings` in profile menu, empty/not-configured/invalid-ART/read-only-archived Team-PI/loading/error states, keyboard tab/form navigation, non-color text badges `Inherit`/`Override`/`100% ✓`/`Not configured`/`Archived — read-only`/drift warning, `1440px`/`1024px`/`768px` layout, zero `@axe-core/playwright` violations)
  - **Expected behavior**: Confirm every step of US4's Independent Test passes with zero console/hydration errors and zero accessibility violations; record evidence in `tasks.md`.
  - **Constraints**: Confirm `/settings` does not exist and no primary navigation item is highlighted on `/organization`.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T025** `[US4]` Post-UAT roadmap update
  - **Target files/components**: `docs/feature-roadmap.md`
  - **Expected behavior**: Only after conformance review and explicit operator UAT acceptance, tick `- [x] **F003 — Work Categories & Allocation**` and update the roadmap progress summary (`3 / 19`).
  - **Constraints**: Do not tick `F003` before operator UAT acceptance.
  - **Validation/test location**: `docs/feature-roadmap.md` + `npm run test:run` (`docs-completeness.test.ts`).
