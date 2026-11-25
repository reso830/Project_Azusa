# Technical Research & Decisions: Work Categories & Allocation (F003)

**Branch**: `003-work-categories-allocation` | **Date**: 2026-11-24 (Updated for Review Pass 1 — D-1..D-4) | **Spec**: [spec.md](./spec.md)

---

## 1. Semantic Role vs. Mutable Display Name (`Q1`, `D-4`)

- **Decision**: Add a constrained `semantic_role` column (`'feature' | 'maintenance_bugs' | 'standard'`, nullable for `overhead`) on `categories`, backed by a partial unique index `categories_train_active_bugs_unique` enforcing at most one active `maintenance_bugs` category per ART. Per `D-4`, `semantic_role` remains editable in F003 even when `team_category_allocations` exist (subject to single active `maintenance_bugs` per ART); F007 will add the reference block once work items reference a category.
- **Rationale**: Data Model v0.6 requires Bug work items (`F007`) to belong to the ART's Bugs/maintenance category while keeping Bug a distinct work-item type and allowing the operator to freely rename categories. Storing `semantic_role` also lets `F007` derive Full Story (`feature`) vs. Light Story (`standard`) layouts without brittle string matching.
- **Alternatives Considered**:
  - *Single boolean `is_bug_category`*: Solves Bug restriction but forces `F007` to either match `"Feature development"` by name or add another migration immediately for Full vs. Light Story derivation.
  - *Blocking `semantic_role` changes on `team_category_allocations`*: Overly restrictive in F003 since percentage overrides do not depend on `semantic_role`; work-item classification safety belongs to F007 (`D-4`).

## 2. Category Lifecycle, `kind` Mutability & Archive/Delete Without `0%` Lock (`Q2`, `D-2`)

- **Decision**: Reuse F002's `record_status: 'active' | 'archived'` pattern with `ON DELETE RESTRICT` foreign keys, without any `default_pct === 0` lock (`D-2`):
  - Hard-delete is permitted whenever zero `team_category_allocations` rows (and no future downstream records) reference the category, regardless of `default_pct`. This guarantees an ART's last development category can always be removed so an unreferenced ART can be emptied and deleted.
  - Archiving is permitted with `default_pct > 0` (preserving `default_pct` and any historical `team_category_allocations` rows).
  - Reactivating validates active parent ART (`409`) and `maintenance_bugs` uniqueness (`409`), and **flags** any resulting non-100% ART or current/future Team/PI total without rejecting reactivation.
  - Changing `kind` (`development` ↔ `overhead`) is permitted only while completely unreferenced (`409` once `team_category_allocations` exist).
  - Newly created `development` categories always start at `default_pct = 0`; percentages change only through `PUT /api/categories/defaults` (requiring `sum === 100`). An empty catalog (`0` active dev categories) is a valid `"not configured"` state.
- **Rationale**: Prevents deadlocks when removing the last category, preserves Constitution Principle III historical integrity, and avoids silent percentage redistribution.

## 3. ART Default Edits, Current/Future-PI Drift Scope & Reset-All (`Q3`, `D-1`, `D-2`)

- **Decision**:
  - Inherited ART defaults live-resolve for all PIs, but drift warnings (`driftedAllocations[]`, `hasDriftWarning`) apply **only to active Teams × active current and future PIs** (`pi.end_date >= today`, using injectable `OrganizationOptions.today`, per `D-1`). Past PIs (`pi.end_date < today`) are excluded; no early pre-F012 snapshot is added.
  - Whenever an ART has `>= 1` active development category, **every** invalid in-scope Team/PI split (`effectiveTotalPct !== 100`) is flagged — whether partially overridden, fully inheriting an invalid ART total (after `D-2` archive/delete/reactivate), or fully overridden (when a category is archived or reactivated with a kept override).
  - `DELETE /api/categories/allocations` (Reset-all) validates active ART, active Team, active PI, and same ART, deletes override rows for **active** development categories only (preserving archived-category override rows), and succeeds even when ART defaults are invalid (flagging the resulting split).
- **Rationale**: Preserves genuine inheritance, keeps all invalid current/future working plans visible before F012 commitment, and protects historical override records on archived categories.

## 4. Exact Integer Percentage Arithmetic & Full-Set Saves (`Q4`)

- **Decision**: Store `default_pct` and `override_pct` as PostgreSQL `integer` columns constrained by explicit `IS NOT NULL` and `BETWEEN 0 AND 100` `CHECK` clauses, validate exact `sum === 100` using integer addition in `src/domain/categories/rules.ts`, and require **every** active development category in both `PUT /api/categories/defaults` and `PUT /api/categories/allocations`.
- **Rationale**: Eliminates IEEE-754 floating-point equality issues and guarantees the `100%` check always validates the exact state persisted to the database.

## 5. Sparse Row Storage for `Inherit` vs. Explicit `0%` & Immutable `train_id` (`AC05`)

- **Decision**: In `team_category_allocations`, store a row **only** for explicit overrides (`override_pct INTEGER NOT NULL CHECK (override_pct BETWEEN 0 AND 100)`). Absence of a row represents **Inherit** (`overridePct: null`); presence of a row with `override_pct = 0` represents an **explicit `0%`**. Note also that F002 makes `teams.train_id` and `pis.train_id` immutable after creation, so once a `team_category_allocations` row passes cross-ART validation on write, it can never drift across ARTs later.
- **Rationale**: Makes the schema self-enforcing and guarantees `0` can never be confused with `null`.

## 6. Empty ART Default, Optional Sample Catalog (`Feature dev.`) & Within-Group Reordering (`Q5`, `D-3`)

- **Decision**:
  - Do not auto-seed categories when an ART is created. Provide `POST /api/categories/sample` inserting the 7 Payments ART sample categories (using `Feature development` / `Feature dev.` / `feature` per operator-accepted `D-3`) only when the ART has zero existing categories (`409` otherwise).
  - Scope `sort_order` per `(train_id, kind)` so `POST /api/categories/reorder` reorders active categories (`0..k-1`) within `development` or `overhead`, places archived categories of that `kind` after them (`>= k`) in their existing relative order, and leaves the other `kind` group untouched.
- **Rationale**: Respects Brief §2.4, resolves handoff update §21 item 7 (`D-3`), and keeps UI up/down reordering 100% aligned with the API contract.

## 7. Zero New Dependencies & F002 Reuse

- **Decision**: Add zero new npm dependencies. Reuse `src/application/organization/errors.ts`, `src/app/api/organization/http.ts`, `src/persistence/schema/common.ts`, and `src/ui/organization/OrganizationWorkspace.tsx` (adding a 4th underline tab `Categories & Allocation`). Update F002's `deleteTrain`, `deleteTeam`, and `deletePi` `409 CONFLICT` messages to accurately name Categories / category allocations.
- **Rationale**: Simplest viable architecture under Constitution Principle IV with accurate user-facing error diagnostics.
