# Pre-Implementation Plan Review Checklist: Work Categories & Allocation (F003)

**Gate result**: PASS (2026-11-24)

**Purpose**: Pre-implementation review gate verifying spec/plan scope alignment, architecture soundness, data-model integrity, contract completeness, test strategy, and constitution compliance **before any code is written**.  
**Created**: 2026-11-24  
**Updated**: 2026-11-24 (Review Pass 3 — aligned plan test strategy & research reorder wording, defined `orderedIds: []` → `400 VALIDATION_ERROR` + route test, added stop-server note in quickstart, and clarified relative manual UAT PI dates; ready for re-verification)  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [research.md](../research.md) · [data-model.md](../data-model.md) · [contracts/api.md](../contracts/api.md) · [quickstart.md](../quickstart.md) · [tasks.md](../tasks.md)

---

## 1. Spec & Plan Scope Alignment

- [x] **CHK001**: Every in-scope requirement and acceptance criterion (`AC01`–`AC11`, `FR-001`–`FR-013`, `SC-001`–`SC-005`) in `spec.md` is mapped to concrete domain modules, tables, API endpoints, UI controls, and tests in `plan.md`, `data-model.md`, `contracts/api.md`, and `tasks.md`.
- [x] **CHK002**: Every non-goal in `spec.md` (no `/settings` route or enabled `Settings` item, no F004 capacity/SP budgets, no F005 calendar/holidays/absences, no F005/F009/F013 `OverheadReserve`/`OverheadTicket`/fixed overhead days-per-Sprint, no F007 work-item creation/layouts, no F009/F013/F014 buffers, no F012 snapshots/commitments, no per-Sprint allocations, no decimal percentages or auto-normalization, no auth/RBAC) is explicitly excluded in `plan.md`'s `Affected Areas`.
- [x] **CHK003**: All operator clarifications (`Session 2026-11-24` Q1–Q5 and `Session 2026-11-24 (review)` D-1..D-4) are reflected consistently across `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, and `tasks.md` with zero contradictions.

## 2. Prototype Fidelity & UX Compliance (Constitution Principles II & VII)

- [x] **CHK004**: `plan.md` declares `Visual-Fidelity Mode: Mixed`, references `docs/handoffs/azusa-handoff-v2.zip` (`AZUSA_HANDOFF.md` §9, `AZUSA_HANDOFF_UPDATE_2026-11-20.md`, `Settings.dc.html`, `screenshots/03-capacity-planner.png`), and justifies all 4 planned deviations (`D1`–`D4`, with `D4` operator-accepted per `D-3`).
- [x] **CHK005**: Category and allocation management is hosted as the 4th underline tab (`Categories & Allocation`) inside `/organization`, preserving F002's uncluttered `/organization` header and keeping profile-menu `Settings` disabled (`aria-disabled="true"`).
- [x] **CHK006**: UI contract distinguishes `Inherit` vs `Override` (including explicit `0%`), `100% ✓` vs `Not configured` / invalid / drifted totals, and read-only archived Teams/PIs via explicit text badges (not color alone), uses tabular numerals, keyboard-operable controls, `:focus-visible` outlines, and plans Playwright visual + `@axe-core/playwright` checks across `1440px`, `1024px`, and `768px`.

## 3. Architecture & Layer Boundaries (Constitution Principle IV)

- [x] **CHK007**: Module boundaries cleanly separate `src/domain/categories/` (pure TS + Zod, zero framework/DB/FS imports), `src/application/categories/category-service.ts` (transactional service reusing `src/application/organization/errors.ts`), `src/persistence/` (Drizzle schema `categories.ts`, additive migration `0002_work_categories_allocation.sql`, synchronized `APP_VERSION = '0.3.0'`), and `src/app/api/categories/` + `src/ui/organization/`.
- [x] **CHK008**: Zero new external dependencies are introduced; all existing local-first constraints (`127.0.0.1`, PGlite, `proper-lockfile`, no paid/external APIs) remain intact.

## 4. Data Model, Domain Integrity & Recovery Safety (Constitution Principles III & IV)

- [x] **CHK009**: `categories` and `team_category_allocations` inherit F001's `auditColumns()`, use `ON DELETE RESTRICT` foreign keys (never `ON DELETE CASCADE`), store percentages as `integer` (`0..100`) with SQL `CHECK` constraints, enforce ART-scoped case-insensitive `name` uniqueness, and enforce at most one `active` `maintenance_bugs` category per ART via partial unique index.
- [x] **CHK010**: `development` vs `overhead` separation is enforced at both domain and SQL `CHECK` levels (`development` requires explicit `semantic_role IS NOT NULL` and `default_pct IS NOT NULL`; `overhead` requires `semantic_role IS NULL AND default_pct IS NULL`; `team_category_allocations` only accepts active `development` categories from the same ART; `POST /api/categories` always initializes `development` to `0%`).
- [x] **CHK011**: Lifecycle and reference-integrity rules are sound per `D-2` and `D-4`: `kind` is immutable once referenced; `semantic_role` stays editable in F003 (subject to single active `maintenance_bugs`); archive and unreferenced hard delete succeed regardless of `default_pct`; reactivation validates active parent ART and `maintenance_bugs` uniqueness and flags any non-100% total without rejecting; empty catalog is valid `"not configured"`; F002 `deleteTrain`/`deleteTeam`/`deletePi` return `409` with accurate messages naming Categories / category allocations.
- [x] **CHK012**: `team_category_allocations` sparse row design unambiguously separates `Inherit` (absent row / `null`) from explicit `0%` (`override_pct = 0`); `PUT /api/categories/allocations` requires every active development category; `DELETE /api/categories/allocations` enforces active ART/Team/PI, clears active-category overrides only (preserving archived-category override rows), and succeeds even when ART defaults are invalid; drift warnings cover every invalid active Team × active current/future PI (`pi.end_date >= today`, `D-1`) split without mutating explicit overrides or historical snapshots; zero `PlanVersion`/`PICommitment`/`SprintCommitment`/`Actuals` tables are introduced while exposing a snapshot-ready `TeamPiAllocationView` for F004/F012.

## 5. Contracts, Testing Strategy & Documentation (Constitution Principles V & VI)

- [x] **CHK013**: All HTTP routes under `/api/categories/*` use conflict-free Next.js dynamic segments, strict Zod validation (rejecting unknown keys, decimals, actor injection), `Cache-Control: no-store`, and exact `400`/`404`/`409`/`503` error envelopes (including `404` on unknown `categoryId`).
- [x] **CHK014**: Validation plan covers deterministic unit tests (`rules.ts`, `schemas.ts`, `sample-catalog.ts`), real PGlite integration tests (`categories-persistence.test.ts` + dedicated `categories-routes.test.ts`), direct SQL `CHECK` tests (NULL `semantic_role`/`default_pct`), F002→F003 migration upgrade, CLI `db:backup`/`db:restore` round-trip (`APP_VERSION = '0.3.0'`), Playwright visual geometry tests (`tests/visual/categories-allocation.spec.ts`), and Playwright E2E (including archive/reactivate/delete with reload persistence) + `@axe-core/playwright` flows across `1440px`/`1024px`/`768px`.
- [x] **CHK015**: All affected release and Constitution Principle VI artifacts (`package.json`, `package-lock.json`, `src/persistence/version.ts`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/0003-work-categories-and-allocation.md`, `docs/operations/database-and-recovery.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `README.md`) are listed in `plan.md`'s `Affected Areas` and `tasks.md` Phase 06, with `docs/feature-roadmap.md` `F003` remaining unchecked until conformance review and operator UAT.
