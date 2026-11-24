# Feature Specification: Work Categories & Allocation

**Feature Branch**: `003-work-categories-allocation`  
**Created**: 2026-11-24  
**Updated**: 2026-11-24 (Review Pass 2 — active-Team/PI drift guard, reorder/error-order/semanticRole-null refinements)  
**Status**: Draft  
**Input**: `docs/features/003-work-categories-allocation.md` (v0.1, 2026-11-24)  
**Design Reference**: `docs/handoffs/azusa-handoff-v2.zip` (`AZUSA_HANDOFF.md` §9; `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §1, §20–§21; `docs/azusa-data-model.md` v0.6 §§1–2, §4; `docs/azusa-sprint-planning-decisions.md` Overhead & Buffers; `prototype/Settings.dc.html`; `screenshots/03-capacity-planner.png`)

---

## Clarifications

### Session 2026-11-24

- **Q1 (Bug-eligible category & F007 story-layout semantics)**: *How should the domain identify the Bug-eligible category (and optionally Full vs Light Story layout for F007) independently of mutable display names?*  
  → **A1**: Add a stable **semantic role** on `development` categories (`semantic_role`), independent of the category's editable full name or short label (`overhead` categories have no semantic role / `null`):
  - `feature` — Feature development; supports the Full Story layout in F007.
  - `maintenance_bugs` — Bugs and maintenance work (including support work).
  - `standard` — Other development categories (e.g., Enablers, Estimations, Technical debt), generally using the Light Story layout in F007.
  - **Rules**:
    1. Each ART may have **at most one active `maintenance_bugs` category**.
    2. Bug work items (in F007+) must use that category.
    3. Work-item type remains independent of category semantic role (a Bug is never modeled as a Story).
    4. Renaming a category must not change its semantic behavior.
    5. F007 may use semantic roles to determine Story layouts, while Bug-specific presentation must be based on work-item type.
    6. Keep semantic roles extensible without introducing arbitrary configurable UI layout rules in F003.

- **Q2 (Category lifecycle — archive, deletion, `kind` & `semantic_role` mutability)** *(refined by D-2 and D-4 below)*: *How should category retirement (archiving/deletion) and changing a category's `kind` (`development` vs `overhead`) behave?*  
  → **A2**: Follow F002's lifecycle pattern:
  - Soft-archive categories using `record_status: 'active' | 'archived'`.
  - Permit hard deletion **only** for completely unreferenced categories (no `team_category_allocations` or future downstream references), regardless of `default_pct` (`D-2`).
  - Allow changing `kind` (`development` ↔ `overhead`) **only** while the category is completely unreferenced; once referenced by allocations, work items, or historical records, `kind` becomes immutable.
  - `semantic_role` remains editable in F003 even when `team_category_allocations` exist, subject to the single active `maintenance_bugs` per ART rule; F007 adds the immutability/reference block once work items reference a category (`D-4`).
  - Archived categories are excluded from new active allocations and active 100% totals, while remaining available for historical inspection.
  - Allow archiving with `default_pct > 0` and reactivation subject to active parent ART and `maintenance_bugs` uniqueness; when archiving, deleting, reactivating, or switching `kind` leaves the ART total `!== 100%`, **flag** the ART total as invalid/not configured without rejecting or redistributing (`D-2`).

- **Q3 (ART default changes vs inheriting Team/PI allocations)** *(refined by D-1 below)*: *When ART default percentages change, how should uncommitted Team/PI allocations that inherit ART defaults behave?*  
  → **A3**: Allow ART default percentage changes whenever the ART's own active development defaults total **100%**. For uncommitted Team/PI working plans:
  - Inherited percentages dynamically resolve against the updated ART defaults (`team_override ?? art_default`) for all PIs.
  - Explicit Team overrides remain unchanged.
  - Flag any **current or future PI** (`pi.end_date >= today`, using injectable `today`) whose resulting effective total `!== 100%` with an explicit validation/drift warning, requiring correction before the allocation is accepted as valid for commitment (`D-1`).
  - Never automatically redistribute percentages or convert inherited entries into explicit overrides.
  - Previously captured Plan Versions and PI/Sprint Commitments (in F012+) must remain immutable and retain their original allocation values.

- **Q4 (Percentage precision & validation)**: *What percentage precision should F003 support for ART defaults and Team/PI overrides?*  
  → **A4**: **Whole-number integer percentages (`0` to `100`, step `1%`)**.
  - Store percentages as integers.
  - Validate development allocation totals using exact integer arithmetic (`sum === 100`).
  - Preserve the distinction between an unset override (`null` = inherit ART default) and an explicit `0` (`0%`).
  - Do not introduce decimal precision without an actual planning requirement.

- **Q5 (Initial category catalog & UI placement)**: *How should initial categories be populated for a new ART, and is a new tab inside `/organization` the right UI placement?*  
  → **A5**: New ARTs start with an **empty category catalog** and offer an optional, operator-initiated **"Apply sample catalog"** starter action populating the handoff's 7 sample categories (5 development + 2 overhead, with their colours, short labels, semantic roles, and default percentages).
  - Applying the template is explicitly initiated by the operator, never automatic.
  - All populated categories remain fully configurable subject to domain invariants.
  - Prevent duplicate or unintended category creation when applying the template to an ART that already has categories.
  - Do not treat the starter categories as mandatory for every ART.
  - Host the category and allocation management UI under a new **`Categories & Allocation`** tab inside `/organization`. Do **not** activate a standalone `/settings` page.

### Session 2026-11-24 (review)

- **D-1 (Which PIs get drift warnings)**: Inherited ART defaults still update live for all PIs, but drift/invalid-allocation warnings are flagged **only for current and future PIs** (`pi.end_date >= today`, using injectable `OrganizationOptions.today` defaulting to server local `today`). Past PIs (`pi.end_date < today`) are excluded from drift lists. It is accepted that inherited history from before F012 may not be reconstructable; no early snapshot is added.
- **D-2 (Archiving and deleting categories — remove "default % must be 0" rule)**:
  - A category can be hard-deleted whenever nothing references it, whatever its `default_pct`.
  - A category can be archived with `default_pct > 0`.
  - Reactivating an archived category validates active parent ART and single active `maintenance_bugs` per ART (`409` if violated), and **flags** the ART total if it is no longer `100%` (never rejects reactivation solely because of the total).
  - Any ART total that becomes invalid (`!== 100%`) is flagged and never redistributed, and cannot count as a valid commitment.
  - An empty catalog (`0` active development categories) is a valid **"not configured"** state.
  - Deleting an ART stays restricted when Teams, PIs, or Categories reference it, as in F002.
- **D-3 (Deviation D4 accepted)**: The sample catalog uses `Feature development` with short label `Feature dev.` and semantic role `feature`. Resolved and operator-accepted; overrides `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §21 item 7.
- **D-4 (`semantic_role` editable in F003)**: `semantic_role` stays editable in F003 even when `team_category_allocations` exist, subject to the single active `maintenance_bugs` per ART rule. F007 adds the reference block once work items reference a category. `kind` keeps its stricter rule (immutable once referenced by `team_category_allocations`).

---

## Problem Statement

Before Azusa can calculate development-category Story Point budgets in the Capacity Engine (`F004`), classify Stories and Bugs by work category (`F007`), reserve Overhead hours (`F005`/`F009`/`F013`), or snapshot effective PI allocations in Plan Versions and PI Commitments (`F012`), each ART needs an authoritative, configurable registry of **development** and **overhead** work categories, ART-wide default development allocation percentages totalling 100%, and **PI-scoped Team percentage overrides** with explicit inheritance semantics (clearly distinguishing unset/inherit from an explicit `0%`). Without domain-enforced category ownership, semantic classification independent of mutable display labels, integer 100% validation, and cross-ART/historical integrity, downstream features would hardcode sample categories, conflate Bug type with category names, or corrupt historical commitments when configuration changes.

---

## Scope

### In Scope

1. **ART-Owned Work Category Registry (`Category`)**:
   - Create, view, edit, reorder (within each `kind` group), archive/reactivate (`record_status: 'active' | 'archived'`), and safely hard-delete (whenever completely unreferenced, regardless of `default_pct`, per `D-2`) work categories scoped to a **single ART** (`train_id` immutable after creation). Different ARTs maintain independent catalogs.
   - Store a stable UUIDv4 identity (`id`), F001 audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`), trimmed case-insensitively unique **full name** (within the ART), **short label**, hex **colour**, **kind** (`development` | `overhead`), **semantic role** (`feature` | `maintenance_bugs` | `standard` for `development` categories; `null` for `overhead` categories), **ART default allocation percentage** (integer `0–100` for `development` categories, always initialized to `0` on individual creation; `null` for `overhead` categories), **presentation order** (`sort_order`, scoped per `(train_id, kind)`), and `record_status` (`active` | `archived`).
   - Enforce **at most one active `maintenance_bugs` category per ART** so downstream `F007` can restrict Bug work items to the ART's Bugs/maintenance category without relying on mutable display text, while keeping Bug as a separate work-item type and allowing support work in the maintenance category.
   - Allow changing `kind` (`development` ↔ `overhead`) **only** while a category is completely unreferenced; once referenced by any `team_category_allocations` row (or future downstream work/snapshot record), `kind` becomes immutable. Keep `semantic_role` editable in F003 even when `team_category_allocations` exist, subject to the single active `maintenance_bugs` per ART rule (`D-4`; F007 adds the work-item reference block).
   - Provide an optional, operator-initiated **"Apply sample catalog"** action for an ART with an empty catalog, populating the handoff's 5 development + 2 overhead sample categories (`49 / 20 / 14 / 10 / 7` + `General work` / `Training`). Reject the action (`409 CONFLICT`) if the ART already has any categories (active or archived) to prevent duplicates.
2. **Development vs. Overhead Separation**:
   - `development` categories participate in the 100% post-overhead development allocation.
   - `overhead` categories classify time-based activities only (e.g., General work, Training, Retrospective): they have **no** `default_pct` (`null`), **no** `semantic_role` (`null`), cannot receive `TeamCategoryAllocation` percentage overrides, never receive Story Points or velocity credit, and do not store legacy fixed days-per-Sprint defaults.
3. **ART-Level Default Development Allocation (100% Validation)**:
   - Newly created `development` categories always start at `default_pct = 0`; ART default percentages change **only** through the atomic ART default allocation save (`PUT /api/categories/defaults`).
   - Require the exact integer sum of active `development` category defaults to equal **100%** before accepting an ART default allocation save; reject invalid totals (e.g., `95%` or `105%`) with `400 VALIDATION_ERROR`, clearly reporting the current total and unmet rule without silently normalizing or redistributing percentages.
   - An empty catalog (`0` active development categories) is a valid **"not configured"** state; an ART whose active development defaults diverge from `100%` (e.g., after archiving, deleting, reactivating, or switching `kind`) is flagged as invalid until saved to `100%` (`D-2`).
4. **Team Overrides by PI (`TeamCategoryAllocation`)**:
   - Inspect and edit a Team's development-category allocation for a selected **PI** (both Team and PI must belong to the same ART as the categories; no per-Sprint allocations).
   - Override **percentage values only** (Teams cannot create, rename, recolour, or reorder ART categories).
   - Distinguish **unset (`null` = Inherit ART default)** from an **explicit `0` (`0%`)** in both persistence and UI.
   - Resolve effective allocation via `effective_pct = team_override ?? art_default` using exact integer arithmetic across the ART's active `development` categories.
   - Require every active `development` category in the ART to be included in a Team/PI allocation save, and require the exact resulting effective total for that Team/PI to equal **100%** (`400 VALIDATION_ERROR` otherwise, zero silent normalization).
   - Support resetting an individual override back to `Inherit` (`null`) or resetting all active-category overrides for a Team/PI back to ART defaults (preserving any historical override rows on archived categories; allowed even when ART defaults are currently invalid, flagging the resulting split per `D-2`).
   - Flag **every** active Team × active **current or future PI** (`pi.end_date >= today`, per `D-1`) whose effective active development total `!== 100%` (whether due to ART default edits affecting partial overrides, fully inheriting an invalid ART total, or category archive/reactivation) with an explicit validation/drift warning, without mutating explicit overrides or historical snapshots.
5. **F012 Snapshot-Ready Domain & Service Boundary**:
   - Expose a clean, deterministic domain/service read contract returning a Team/PI's resolved active development allocation set (category `id`, `name`, `short_label`, `color`, `semantic_role`, `sort_order`, `art_default_pct`, `override_pct`, `effective_pct`, `source: 'inherit' | 'override'`, `art_default_total_pct`, `art_defaults_valid`, `effective_total_pct`, `is_valid`, `has_drift_warning`) so `F004` (Capacity Engine) and `F012` (Plan Versions / PI Commitments) can consume and snapshot effective allocations without modifying F003's model.
6. **`Categories & Allocation` Tab inside `/organization`**:
   - Add a **`Categories & Allocation`** underline tab to `/organization` alongside the existing F002 tabs (`ARTs & PI Cadence`, `Teams & Members`, `Locations`) without activating `/settings` or creating a second organization hierarchy.
   - **ART Work Categories** section: select an ART; view grouped **Development** and **Overhead** categories ordered by `sort_order` within each group; create/edit category metadata (full name, short label, colour, kind, semantic role for development); reorder active categories within each group via up/down controls; archive/reactivate/delete (unreferenced only); apply optional sample catalog on empty ARTs; edit ART default percentages with a live total indicator (`Not configured`, `100% ✓`, or warning + current total when invalid) and atomic save; `"Show archived"` toggle; advisory list of any invalid/drifted active Team × current/future PI allocations.
   - **Team PI Allocation** section: select a Team and PI within the ART (with an optional `"Show archived Teams/PIs"` toggle for read-only inspection); handle empty (no active development categories) and invalid-ART-default states clearly; inspect each active development category's ART default, Team override input, explicit **Inherit** vs **Override** indicator, per-row reset to Inherit vs explicit `0%`, live resolved effective split and total (`100% ✓` or drifted/invalid warning), atomic save, and `"Reset all to ART defaults"`.
7. **Automated Verification & Living Documentation**:
   - Deterministic Vitest unit and integration tests covering category CRUD, `development`/`overhead` separation, `semantic_role` uniqueness (`maintenance_bugs`) and F003 editability, `kind` immutability when referenced, archive/delete/reactivation without `default_pct === 0` lock, integer 100% validation, full-set Team/PI saves, inheritance vs explicit `0%`, reset-all preserving archived-category overrides, PI scoping, current/future-PI-only drift warnings, cross-ART isolation, F002 delete conflict messages, sample catalog duplicate protection, migration upgrade from F002, and CLI `db:backup`/`db:restore` round-trip.
   - Separate HTTP route contract tests (`tests/integration/categories-routes.test.ts`), visual geometry tests (`tests/visual/categories-allocation.spec.ts`), and Playwright E2E + `@axe-core/playwright` accessibility tests (`tests/e2e/categories-allocation.spec.ts`) across `1440px`, `1024px`, and `768px`, including reload persistence for create, edit, archive, reactivate, and delete.
   - Update `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/operations/database-and-recovery.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `README.md`, and ADR `0003`.

### Non-Goals (Out of Scope)

1. **No Standalone Settings Application**: Do not enable the profile-menu `Settings` item or create a `/settings` route.
2. **No Capacity Calculations, Forecast SP, or Category SP Budgets (`F004`)**: Do not compute working days, available hours/days, velocity, forecast SP, category SP budgets, load percentages, or render the Capacity Planner screen.
3. **No Team Calendar, Holidays, Absences, Ceremonies, or Meetings (`F005`)**: Do not add operational calendar editing or dated events.
4. **No Overhead Reserves, Overhead Tickets, or Actual Overhead Time (`F005`/`F009`/`F013`)**: Do not create `OverheadReserve`, `OverheadTicket`, `UnplannedDeduction`, or legacy fixed days-per-Sprint overhead defaults.
5. **No Work Items, Story/Bug Creation, Type Conversion, or Category-Driven Layouts (`F007`)**: Do not create Stories, Bugs, Tasks, work-item forms, or configurable layout rules. F003 establishes `semantic_role` only.
6. **No Buffers, Buffer Draws, or Board Category Visualizations (`F009`/`F013`/`F014`)**: Do not implement `Buffer`, `BufferDraw`, or planning board load/category gauges.
7. **No Plan Versions, Start PI, PI Commitments, or Historical Snapshots (`F012`)**: Do not create `PlanVersion`, `PICommitment`, `Start PI`, or early pre-F012 snapshots; F003 exposes snapshot-ready operational configuration only.
8. **No Per-Sprint Percentage Allocations**: Allocations are PI-scoped only; all Sprints in a PI share the PI's effective split.
9. **No Decimal Percentages or Auto-Normalization**: Integer `0–100` percentages only; never auto-scale or auto-redistribute user entries.
10. **No Authentication, Multi-User Accounts, RBAC Enforcement, or Hosted Services**: Retain F001/F002 single-user local-first provenance (`created_by`/`updated_by = 'local:sm'`).

---

## Visual & Interaction Target (Constitution Principle II)

No dedicated final prototype screen exists for F003's category and allocation administration workflow (`docs/features/003-work-categories-allocation.md` §3). The new **`Categories & Allocation`** tab inside `/organization` follows Azusa's established warm-light Kumiko/Asanoha visual system (`#F4F1EC` canvas, `#FFFFFF` flat rounded cards, `#1A1B22` ink, `#E07F24` / `#A65307` orange accents, `Zen Kaku Gothic New` / `IBM Plex Sans` / `IBM Plex Mono` tabular numerals for percentages and totals, 42-icon Kumiko set, underline section tabs, and `:focus-visible` `2px solid #E07F24` outlines), consistent with F002's `/organization` workspace.

Reference touchpoints from `azusa-handoff-v2.zip`:
- `prototype/Settings.dc.html` (`screenshots/07-settings-locations-holidays.png`): `/organization` floating header layout (unchanged from F002: logo, search, profile only) and clean tabular configuration rows.
- `AZUSA_HANDOFF.md` §9 & `screenshots/03-capacity-planner.png`: sample category colours (`#2E8B57`, `#C93A3A`, `#E8890C`, `#7A4CC2`, `#3F4148`, `#A39C93`, `#5C7A1F`), `"100% ✓"` valid-total badge convention, and distinct visual distinction between inherited defaults and explicit overrides.

Prototype fidelity applies at `1440px` baseline width; `1024px` and `768px` must remain usable, collision-free, and accessible under Constitution Principle VII.

### Intentional, Justified Deviations from Prototype References in F003

| Area | Prototype v2 Reference | F003 Specified Behavior | Justification |
|---|---|---|---|
| **D1 — Configuration placement under `/organization`** | Prototype places category/organization settings under a multi-section `/settings` app (`Settings.dc.html`). | Hosted as a **`Categories & Allocation`** tab inside `/organization`; profile-menu `Settings` remains disabled. | Required by Feature Brief §3, §6, Roadmap v0.2 distributed-Settings decision, and Clarification Q5 (`2026-11-24`). |
| **D2 — No automatic sample catalog seeding** | Prototype pre-populates Payments ART with 5 dev + 2 overhead categories. | New ARTs start empty ("not configured") and offer an explicit **"Apply sample catalog"** starter button. | Prevents imposing Dyson's sample catalog as a global default (Brief §2.4, §7.5; Clarification Q5). |
| **D3 — Percentages only (no SP budgets or overhead days/Sprint)** | `Capacity.dc.html` displays SP budgets alongside percentages; `AZUSA_HANDOFF.md` §9 lists `1 day / member / sprint` and `0.5 day / member / sprint` for sample overhead. | F003 displays percentages and totals only (no SP budgets) and stores no days-per-Sprint defaults on overhead categories. | SP budgets belong to F004 (Brief §3, §6); v0.6 replaced fixed overhead days/Sprint with per-member/per-Sprint `OverheadReserve` hours in F005/F009/F013 (Brief §2.2). |
| **D4 — Sample Feature category short label** *(operator-accepted, D-3)* | `AZUSA_HANDOFF.md` §9 lists `"Feature"` as the short label on cards. | Sample catalog uses `Feature development` with short label `"Feature dev."` and semantic role `feature` (fully editable). | Operator-accepted (`D-3`, `2026-11-24`); resolves and overrides `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §21 item 7 to avoid confusion with the `Feature` work-item entity (Brief §2.1). |

---

## User Behavior

### User Story 1 — ART Work Category Registry & Development/Overhead Separation (Priority: P1)

As the local Azusa operator, I want to create, view, edit, reorder within each group, archive/reactivate, and safely delete (whenever unreferenced) development and overhead work categories for each ART—or optionally apply the Payments ART sample catalog to an empty ART—with stable identities, semantic roles, full names, short labels, and colours, so each ART maintains its own accurate catalog independent of other ARTs.

**Why this priority**: The ART-owned category catalog and `development` vs. `overhead` separation are the foundation for all allocation rules (`F003`), capacity budgets (`F004`), and Story/Bug classification (`F007`) (AC01, AC02, AC07, AC08, AC10).

**Independent Test**: On `/organization`, create two ARTs (`Payments ART` and `Core Platform ART`), open the **`Categories & Allocation`** tab, select `Payments ART`, verify its catalog starts empty ("Not configured"), click **"Apply sample catalog"**, and confirm 5 development categories (`Feature development` [`Feature dev.`, `feature`, `49%`], `SW maintenance (bugs)` [`SW maint.`, `maintenance_bugs`, `20%`], `Enablers` [`Enabler`, `standard`, `14%`], `Estimations` [`Estimation`, `standard`, `10%`], `Technical debt` [`Tech debt`, `standard`, `7%`]) and 2 overhead categories (`General work`, `Training`, neither having a development percentage or semantic role) appear and persist across reload; verify **"Apply sample catalog"** is no longer permitted on the non-empty ART; edit `SW maintenance (bugs)` to rename it to `Bugs & Support` and change its colour, reload, and confirm its `id` and `maintenance_bugs` semantic role are preserved; attempt to create a second active `maintenance_bugs` category in `Payments ART` and confirm rejection (`409 CONFLICT`); switch to `Core Platform ART`, create a distinct minimal catalog (`Product delivery` [`feature`, starts at `0%` → set to `100%` via ART defaults] and `Retrospective` [`overhead`]), confirming total cross-ART independence; reorder two categories within the Development group and verify persisted order across reload; archive a category, reload to confirm it is hidden behind `"Show archived"`, reactivate it and reload; verify hard-deleting an unreferenced category succeeds (even with `default_pct > 0`, per `D-2`) while changing `kind` on an unreferenced category is allowed and blocked (`409`) once referenced.

**Acceptance Scenarios**:

1. **Given** a newly created ART, **When** the operator opens `/organization` → **`Categories & Allocation`** and selects that ART, **Then** its category catalog starts empty (valid `"Not configured"` state) and displays an explicit **"Apply sample catalog"** action.
2. **Given** an ART with an empty category catalog, **When** the operator clicks **"Apply sample catalog"**, **Then** the 5 development categories (`49 / 20 / 14 / 10 / 7 = 100%`) and 2 overhead categories (`General work`, `Training`) are created in order with their handoff colours, short labels (`Feature dev.`, etc.), and semantic roles; attempting to apply the sample catalog to an ART that already has any category (active or archived) is rejected (`409 CONFLICT`).
3. **Given** an active ART, **When** the operator creates a `development` category with a trimmed case-insensitively unique `name` (within the ART), `short_label`, valid hex `color`, and `semantic_role` ∈ `{'feature', 'maintenance_bugs', 'standard'}`, **Then** the category persists with a stable UUIDv4 `id`, `default_pct = 0`, F001 audit fields, and `record_status = 'active'`; creating or updating a second active category in the same ART with `semantic_role = 'maintenance_bugs'` is rejected (`409 CONFLICT`).
4. **Given** an active ART, **When** the operator creates or edits an `overhead` category, **Then** it persists with `default_pct = null` and `semantic_role = null`, does not appear in the 100% development allocation total, and accepts no development percentage or Story Point budget; submitting a non-null `default_pct` or `semantic_role` for an `overhead` category is rejected (`400 VALIDATION_ERROR`).
5. **Given** an existing `maintenance_bugs` category, **When** the operator edits its `name`, `short_label`, or `color`, **Then** its stable `id` and `semantic_role = 'maintenance_bugs'` remain unchanged (display text never alters Bug eligibility). Changing `semantic_role` on a development category remains allowed in F003 even when Team/PI overrides exist, provided at most one active `maintenance_bugs` category exists in the ART (`D-4`).
6. **Given** two ARTs (`ART A` and `ART B`), **When** the operator defines categories in `ART A`, **Then** `ART B`'s catalog is unaffected and may reuse the same category names and its own independent `maintenance_bugs` category.
7. **Given** an unreferenced category, **When** the operator changes its `kind` (`development` ↔ `overhead`, clearing `default_pct`/`semantic_role` when switching to `overhead`, or requiring a valid `semantic_role` and initializing `default_pct = 0` when switching to `development`) or hard-deletes it (regardless of its `default_pct`, per `D-2`), **Then** the operation succeeds and any resulting non-100% ART total is flagged without redistribution; once referenced by any `TeamCategoryAllocation` record, changing `kind` or hard-deleting is rejected (`409 CONFLICT`).

---

### User Story 2 — ART Default Development Allocation & Exact 100% Validation (Priority: P1)

As the local Azusa operator, I want to configure and save an ART's integer default development percentages with live total feedback and strict 100% validation, so every ART maintains a valid baseline split for its Teams without silent normalization.

**Why this priority**: ART defaults are the fallback baseline for all Teams in the ART and must be mathematically exact before capacity budgets are derived (AC03, AC09, Q4, D-2).

**Independent Test**: Under `Payments ART` with the 5 sample development categories (`49 / 20 / 14 / 10 / 7`), verify the live total indicator displays **`100% ✓`**; edit `Feature development` from `49` to `44` (bringing the total to `95%`), confirm the UI clearly shows `95%` and the unmet 100% rule, attempt to save, and verify rejection (`400 VALIDATION_ERROR`) with zero silent redistribution and unchanged persisted defaults on reload; adjust `Technical debt` from `7` to `12` (bringing the total back to `100%`), save, reload, and confirm `44 / 20 / 14 / 10 / 12 = 100%` persists; archive `Technical debt` (while its `default_pct` is `12%`, per `D-2`), confirm archive succeeds and the ART total is flagged as **`88%` (invalid)** without redistribution, reactivate `Technical debt` and confirm `100% ✓` restores; verify non-integer (`12.5`), negative (`-5`), and `> 100` values are rejected (`400 VALIDATION_ERROR`).

**Acceptance Scenarios**:

1. **Given** an ART with active `development` categories whose integer defaults sum to `100` (e.g., `49 + 20 + 14 + 10 + 7`), **When** the operator saves the ART default allocation via the atomic defaults editor, **Then** the system accepts and persists the defaults and displays **`100% ✓` (valid)**; overhead and archived categories are excluded from the sum.
2. **Given** an ART default allocation edit whose integer values sum to anything other than `100` (e.g., `95%` or `105%`), **When** the operator attempts to save, **Then** the domain/API rejects the request (`400 VALIDATION_ERROR`) reporting the exact current sum and the unmet 100% rule, does **not** normalize or redistribute values, and leaves previously saved defaults intact.
3. **Given** an ART default input containing a negative number, a value `> 100`, or a non-integer decimal (e.g., `12.5`), **When** submitted to the domain/API, **Then** it is rejected with `400 VALIDATION_ERROR`.
4. **Given** a `development` category with `default_pct > 0`, **When** the operator archives it (or hard-deletes it if unreferenced) (`D-2`), **Then** the action succeeds without requiring `default_pct = 0` first and without auto-redistributing percentages; if the remaining active development defaults no longer total `100%`, the ART total is flagged as invalid (or `"Not configured"` if empty) and cannot count as a valid commitment until rebalanced via the atomic defaults save. Reactivating an archived category validates active parent ART and `maintenance_bugs` uniqueness (`409` if violated) and flags any resulting non-100% total without rejecting reactivation (`D-2`).

---

### User Story 3 — Team PI-Scoped Percentage Overrides, Inheritance vs. Explicit Zero & Drift Warnings (Priority: P1)

As the local Azusa operator, I want to select a Team and PI, inspect its active development categories alongside ART defaults, override selected percentages (including explicit `0%`) or clear overrides back to `Inherit`, and see clear drift warnings on current and future PIs if ART defaults or category status later change, so each Team has an accurate, PI-scoped allocation without overwriting other PIs or historical commitments.

**Why this priority**: Per-Team, per-PI overrides with unambiguous `Inherit` vs. `0%` semantics and PI isolation are the core planning behavior consumed by F004 and snapshotted by F012 (AC04, AC05, AC06, AC07, AC09, AC10, Q3, D-1, D-2).

**Independent Test**: Under `Payments ART` (defaults `49 / 20 / 14 / 10 / 7`) with Team `Palawan`, Team `Cebu`, a current/future PI (`end_date >= today`, e.g., `PI-2027.1`), a second future PI (e.g., `PI-2027.2`), and a past PI (`end_date < today`, e.g., `PI-2025.1`; adjust years relative to the UAT date if run after early 2027):
1. Select `Palawan` + `PI-2027.1`; confirm all 5 categories show **Inherit** (`49 / 20 / 14 / 10 / 7 = 100%`).
2. Override `Feature development` to `56`, `SW maintenance (bugs)` to `15`, and `Estimations` to `8`, leaving `Enablers` (`14`) and `Technical debt` (`7`) as **Inherit**; save, reload, and confirm the effective split is **`56 / 15 / 14 / 8 / 7 = 100%`** with explicit **Override** vs **Inherit** indicators.
3. Override `Technical debt` to an explicit **`0%`** and raise `Feature development` to `63%` (`63 / 15 / 14 / 8 / 0 = 100%`), save, reload, and confirm `Technical debt` displays **`0%` (Override)** and does **not** revert to ART default `7%`; then clear `Technical debt`'s override back to **Inherit** and lower `Feature development` to `56%`, save, and confirm `Technical debt` restores `7%` (**Inherit**).
4. Switch to `Palawan` + `PI-2027.2` and `Cebu` + `PI-2027.1` and confirm both remain unaffected (`49 / 20 / 14 / 10 / 7`, all **Inherit**).
5. Edit `Payments ART` defaults from `49 / 20 / 14 / 10 / 7` to `45 / 20 / 18 / 10 / 7` (`= 100%`); return to `Palawan` + `PI-2027.1` and verify `Enablers` dynamically resolves to `18%` (Inherit), `Palawan`'s explicit overrides (`56 / 15 / 8`) remain untouched, the effective total displays **`104%`** with an explicit validation warning/drift badge (invalid for commitment until adjusted), `Cebu` + `PI-2027.1` (all Inherit) stays valid at `100%`, and past `PI-2025.1` (`end_date < today`) is **not** listed in drift warnings (`D-1`).
6. Archive a category with `default_pct > 0` (leaving ART total invalid) and verify both fully inheriting and partially/fully overridden current/future Team/PIs whose effective total is `!== 100%` are flagged; click **"Reset all to ART defaults"** and verify active-category overrides clear (preserving archived-category override rows) even when ART defaults are invalid.
7. Verify via API/integration tests that submitting a partial override payload (omitting active development categories) returns `400 VALIDATION_ERROR`, unknown `categoryId` returns `404 NOT_FOUND`, and targeting an overhead category, archived category, foreign-ART category, or foreign-ART PI returns `409 CONFLICT`.

**Acceptance Scenarios**:

1. **Given** an ART with valid defaults `49 / 20 / 14 / 10 / 7`, a Team in that ART, and a PI in that ART with no saved overrides, **When** the operator inspects that Team/PI allocation, **Then** every active development category shows **Inherit** with its ART default and an effective total of **`100%`**.
2. **Given** `Palawan` in `PI-2027.1` under defaults `49 / 20 / 14 / 10 / 7`, **When** the operator sets overrides `56`, `15`, and `8` on the first, second, and fourth categories while leaving the third and fifth unset (`null`), **Then** the system computes `effective_pct = override_pct ?? art_default_pct` yielding `56 / 15 / 14 / 8 / 7 = 100%`, persists the overrides, and clearly labels **Override** vs **Inherit**.
3. **Given** a development category with a nonzero ART default (e.g., `7%`), **When** the operator saves an explicit `0%` override (with other categories adjusted so effective total = `100%`), **Then** `override_pct = 0` persists as explicit zero (**Override**) and does not fall back to `7%`; clearing the override (`null`) restores the inherited default (`7%`, **Inherit**).
4. **Given** a Team/PI allocation save payload that omits an active development category or whose resolved effective total does not equal `100%`, **When** submitted, **Then** the system rejects the save (`400 VALIDATION_ERROR`) with exact details and zero mutations.
5. **Given** overrides saved for `Team A` in `PI-1`, **When** inspecting `Team A` in `PI-2` or `Team B` in `PI-1`, **Then** neither is modified; allocations are strictly scoped to `(team_id, pi_id)` with no per-Sprint split.
6. **Given** active Teams and active **current or future PIs** (`pi.end_date >= today`, per `D-1`) in an ART, **When** ART defaults change (e.g., `49/20/14/10/7 → 45/20/18/10/7`) or a category is archived/deleted/reactivated so any in-scope Team/PI's effective active total `!== 100%` (whether partially overridden, fully inheriting an invalid ART total, or fully overridden), **Then** explicit overrides remain untouched, inherited values resolve live, and every invalid current/future Team/PI split is flagged (`is_valid = false`, `has_drift_warning = true`) until corrected; past PIs (`pi.end_date < today`) still live-resolve inherited values but are excluded from drift warnings.
7. **Given** a Team in `ART A`, **When** an allocation request references an unknown `categoryId` (`404 NOT_FOUND`), or references a category from `ART B`, a PI from `ART B`, an `overhead` category, or an `archived` category (`409 CONFLICT`), **Then** the domain/API rejects the request with zero records written.

---

### User Story 4 — Integrated `/organization` UX, Domain Invariants, Verification & Living Documentation (Priority: P2)

As the local Azusa operator and developer, I want category and allocation management cleanly integrated into `/organization` (without a standalone `/settings` app), all invariants enforced in pure domain/application logic, F002→F003 database migrations and CLI backup/restore verified, and living documentation kept up to date so F004, F007, and F012 can consume F003 cleanly.

**Why this priority**: Enforces Constitution Principles II, III, IV, V, VI, and VII and guarantees downstream readiness for F004/F007/F012 (AC09, AC10, AC11).

**Independent Test**: Navigate to `/organization`, verify the header still omits `TodayWidget` and `ART › Team › PI`, switch to the **`Categories & Allocation`** tab, complete keyboard-only navigation and `@axe-core/playwright` zero-violation checks across `1440px`, `1024px`, and `768px`, confirm `Settings` in the profile menu remains disabled; run `lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, and `test:e2e` (all exiting `0`); run `db:migrate` on an existing F002 database (confirming 100% of F001/F002 records survive upgrade) and run CLI `db:backup` and `db:restore` into a separate destination directory on a database containing F003 categories and Team/PI overrides (confirming 100% round-trip record counts and synchronized `APP_VERSION = '0.3.0'`); inspect `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/operations/database-and-recovery.md`, `docs/REPO_MAP.md`, ADR `0003`, `README.md`, and `CHANGELOG.md` for full alignment.

**Acceptance Scenarios**:

1. **Given** the operator is on `/organization`, **When** they open the **`Categories & Allocation`** tab, **Then** they can manage ART categories, ART defaults, and Team/PI allocations within the existing organization workspace (including empty/invalid-ART-default states and read-only inspection of archived Teams/PIs), while `/settings` remains non-existent and the profile menu's `Settings` item remains disabled (`aria-disabled="true"`).
2. **Given** all F003 business rules (ART scoping, case-insensitive name uniqueness, `development`/`overhead` separation, single active `maintenance_bugs` per ART, `semantic_role` editability in F003, `kind` immutability when referenced, archive/delete/reactivation flagging without `default_pct === 0` lock, integer `0–100` arithmetic, exact `100%` saves, full-set Team/PI saves, `null` vs `0` inheritance, reset-all scope, PI scoping, current/future-PI drift detection, cross-ART isolation, F002 delete conflict messages, and sample catalog duplicate protection), **When** tested directly via Vitest unit and integration tests bypassing the UI, **Then** every invariant is enforced in `src/domain/` and `src/application/` with deterministic fixtures.
3. **Given** an existing F002 PGlite database containing ARTs, Teams, Members, PIs, Iterations, Locations, Holidays, and Absences, **When** F003 Drizzle migrations run, **Then** the database upgrades cleanly preserving 100% of existing F001/F002 records, and CLI `db:backup` / `db:restore` preserve 100% of F003 records with synchronized `APP_VERSION = '0.3.0'`.
4. **Given** `/organization` → **`Categories & Allocation`** is rendered at `1440px`, `1024px`, and `768px`, **When** inspected via Playwright visual geometry checks (`tests/visual/categories-allocation.spec.ts`) and `@axe-core/playwright`, **Then** all interactive controls are keyboard-accessible with visible focus rings, layout is collision-free, and zero accessibility violations are reported.
5. **Given** F003 implementation is complete, **When** living documentation is inspected, **Then** `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/operations/database-and-recovery.md`, `docs/REPO_MAP.md`, ADR `0003`, `README.md`, and `CHANGELOG.md` accurately reflect F003 (while `docs/feature-roadmap.md` keeps `F003` unchecked until conformance review and operator UAT acceptance).

---

## Acceptance Criteria

### Mapping to Feature Brief Acceptance Criteria (AC01–AC11)

| Brief AC | Requirement Summary | Verified by User Story |
|---|---|---|
| **AC01 — ART category registry** | Create, edit, reorder (within `kind` group), archive/reactivate, hard-delete (unreferenced), and inspect `development` and `overhead` categories (full name, short label, colour, semantic role) per ART; distinct ARTs maintain independent catalogs; optional sample catalog starter on empty ARTs. | US1 |
| **AC02 — Development and overhead separation** | `development` categories participate in 100% integer allocation; `overhead` categories have `default_pct = null`, `semantic_role = null`, no Team percentage overrides, no SP/velocity credit, and no legacy fixed days/Sprint defaults. | US1, US2 |
| **AC03 — Default allocation validity** | ART defaults `49 + 20 + 14 + 10 + 7 = 100%` display as valid and save cleanly; invalid totals (e.g., `95%`) are rejected with clear feedback and zero silent normalization; empty catalog is valid `"not configured"`. | US2 |
| **AC04 — Team-specific overrides** | Given ART defaults `49 / 20 / 14 / 10 / 7`, overriding 1st/2nd/4th to `56 / 15 / 8` and inheriting `14 / 7` resolves to `56 / 15 / 14 / 8 / 7 = 100%` with explicit Override/Inherit indicators. | US3 |
| **AC05 — Inheritance versus zero** | Clearing a Team override (`null`) restores the inherited ART default; saving an explicit `0%` persists as `0` (Override) and does not revert to the ART default, accepted only when effective total = `100%`. | US3 |
| **AC06 — PI scoping** | Editing a Team's overrides for one PI does not affect another PI or another Team; no per-Sprint percentage allocations exist. | US3 |
| **AC07 — Cross-ART isolation** | Allocations for a Team in ART A cannot reference categories or PIs from ART B; ART catalogs and defaults are independent. | US1, US3 |
| **AC08 — Bug classification readiness** | `semantic_role` (`feature` \| `maintenance_bugs` \| `standard`) identifies the single active `maintenance_bugs` category per ART independently of mutable display names, keeping Bug work-item type distinct from category labels. | US1 |
| **AC09 — Configuration UI** | Accessible under `/organization` → **`Categories & Allocation`** tab; clearly distinguishes defaults vs. overrides, empty/invalid-ART states, read-only archived Teams/PIs, and live totals/drift warnings without activating `/settings` or building F004 Capacity Planner. | US1, US2, US3, US4 |
| **AC10 — Historical safety and data integrity** | Soft-archive (`active` \| `archived`), unreferenced-only hard delete (regardless of `default_pct`), `kind` reference-integrity guard, no silent redistribution, preserved archived-category overrides, accurate F002 delete conflict messages, and clean resolved-allocation read contract ready for F012 snapshots without implementing snapshots in F003. | US1, US2, US3, US4 |
| **AC11 — Documentation and tests** | Unit, integration, HTTP route, visual, E2E, and accessibility tests cover all invariants and workflows; living documentation (overview, domain model, data dictionary, operations, repo map, ADR `0003`, README, changelog) is updated. | US4 |

### Functional Requirements

- **FR-001**: System MUST provide CRUD, within-group reordering (`sort_order` per `(train_id, kind)`), archive/reactivate (`record_status: 'active' | 'archived'`), and unreferenced-only hard delete for ART-owned **Categories** (`categories`), each belonging to **exactly one ART** (`train_id` immutable after creation), with UUIDv4 `id`, F001 audit columns (`created_at`, `updated_at`, `created_by`, `updated_by`), trimmed non-empty `name` (case-insensitively unique within the ART), trimmed non-empty `short_label`, valid 6-digit hex `color` (`#RRGGBB`), `kind` ∈ `{'development', 'overhead'}`, nullable `semantic_role`, nullable integer `default_pct`, and non-negative integer `sort_order`.
- **FR-002**: For `kind = 'development'`, `semantic_role` MUST be non-null (`'feature' | 'maintenance_bugs' | 'standard'`) and `default_pct` MUST be a non-null integer in `0..100`, **always initialized to `0`** on individual `POST /api/categories` creation (`defaultPct` is not accepted on create; percentages change only via `PUT /api/categories/defaults` or `POST /api/categories/sample`). For `kind = 'overhead'`, `semantic_role` MUST be `null` and `default_pct` MUST be `null`; submitting non-null values for either on an `overhead` category MUST be rejected (`400 VALIDATION_ERROR`).
- **FR-003**: Each ART MUST have **at most one active (`record_status = 'active'`) category with `semantic_role = 'maintenance_bugs'`**, enforced in both domain logic and database partial unique index. Renaming `name` or `short_label` MUST never alter `semantic_role` or `id`.
- **FR-004**: System MUST provide an explicit, operator-initiated **"Apply sample catalog"** operation for an active ART that creates the 7 handoff sample categories (5 `development` totalling `100%` with `Feature dev.` per `D-3` + 2 `overhead`) in a single transaction. If the ART is archived or already has any category (active or archived), the operation MUST be rejected (`409 CONFLICT`) to prevent duplicates or unintended mutations.
- **FR-005**: System MUST provide an atomic **ART default allocation update** accepting `{ categoryId, defaultPct }[]` covering every active `development` category of an active ART exactly once. Every `defaultPct` MUST be an integer in `0..100`, and the exact integer sum across all active `development` categories MUST equal `100`; otherwise reject with `400 VALIDATION_ERROR` including `{ currentTotal, requiredTotal: 100 }`, with zero automatic normalization. An empty ART catalog (`0` active development categories) is a valid `"not configured"` state (`artConfigStatus: 'not_configured'`).
- **FR-006**: Changing a category's `kind` (`development` ↔ `overhead`) MUST be permitted **only** when the category has zero references (`team_category_allocations` or future downstream references). Switching `development → overhead` clears `default_pct = null` and `semantic_role = null`; switching `overhead → development` requires a valid `semantic_role` and sets `default_pct = 0`; any resulting non-100% ART total is flagged without rejecting or redistributing (`D-2`). Once referenced, changing `kind` MUST be rejected (`409 CONFLICT`). `semantic_role` remains editable in F003 even when `team_category_allocations` exist, subject to the single active `maintenance_bugs` per ART rule (`D-4`; F007 adds the work-item reference block).
- **FR-007**: Archiving (`record_status = 'archived'`) a `development` category MUST succeed regardless of its `default_pct` (`D-2`) and MUST NOT auto-redistribute percentages. Archived categories are excluded from active 100% totals and new Team/PI overrides, and remain inspectable behind `"Show archived"` (keeping their `default_pct` and any historical `team_category_allocations` rows intact). Reactivating (`archived` → `active`) MUST verify the parent ART is active (`409`) and `maintenance_bugs` uniqueness (`409`), and MUST **flag** any resulting non-100% ART or current/future Team/PI total without rejecting reactivation (`D-2`). Hard deletion MUST be permitted whenever zero `team_category_allocations` (or future downstream records) reference the category, regardless of `default_pct` (`D-2`), and MUST be blocked (`409 CONFLICT`) whenever referenced. F002's `deleteTrain`, `deleteTeam`, and `deletePi` MUST return `409 CONFLICT` with accurate messages naming Categories / category allocations when F003 rows reference them.
- **FR-008**: System MUST persist **Team PI overrides** (`team_category_allocations`) keyed uniquely by `(team_id, pi_id, category_id)` with non-null integer `override_pct` in `0..100` (where absence of a row represents **Inherit** / `null`, while a stored row with `override_pct = 0` represents an **explicit `0%`**). Team, PI, and Category MUST all belong to the **same ART** (`409 CONFLICT` on mismatch); Category MUST exist (`404 NOT_FOUND` if unknown) and have `kind = 'development'` and `record_status = 'active'` (`409 CONFLICT` otherwise); ART, Team, and PI MUST be `active` when writing overrides (`409 CONFLICT` if archived).
- **FR-009**: Domain layer (`src/domain/categories/`) MUST provide an authoritative, pure resolution function computing each active development category's `effective_pct = override_pct ?? art_default_pct`, `source: 'override' | 'inherit'`, `art_default_total_pct`, `art_defaults_valid`, `effective_total_pct`, `is_valid: effective_total_pct === 100`, and `has_drift_warning: isTeamActive && isPiActive && isCurrentOrFuturePi && activeDevCategories.length > 0 && !is_valid` (matching the exact active-Team, active-PI, and `pi.end_date >= today` predicate used by `driftedAllocations[]`, per `D-1`, so read-only views of archived Teams or archived PIs never emit drift warnings). Saving a Team/PI allocation update MUST require **every** active development category of the ART in `overrides[]` (`400 VALIDATION_ERROR` on missing or duplicate IDs) and MUST reject any submission whose exact resolved `effective_total_pct !== 100` (`400 VALIDATION_ERROR`, zero silent normalization). Resetting all overrides (`DELETE /api/categories/allocations`) MUST validate active ART, active Team, active PI, and same ART (`409` otherwise), delete only override rows for **active** development categories (preserving archived-category override rows), and succeed even when ART defaults are invalid (flagging the resulting split per `D-2`).
- **FR-010**: Updating ART defaults (when the new ART defaults total `100%`) or changing category archive/delete/reactivate/kind status MUST NOT auto-redistribute or convert inherited entries into explicit overrides. Whenever an ART has `>= 1` active development category, the system MUST list **every** active Team × active **current or future PI** (`pi.end_date >= today`, per `D-1`) whose effective active total `!== 100%` (whether partially overridden, fully inheriting an invalid ART total, or fully overridden) in `driftedAllocations[]` and surface `has_drift_warning = true` on that Team/PI until corrected. Past PIs (`pi.end_date < today`) still live-resolve inherited values but are excluded from drift warnings.
- **FR-011**: System MUST expose a read contract returning resolved Team/PI allocations (`TeamPiAllocationView`) suitable for `F004` capacity budgets and `F012` immutable Plan Version / PI Commitment snapshots, without implementing snapshots or commitments in F003.
- **FR-012**: System MUST add a **`Categories & Allocation`** tab to `/organization` (preserving F002's header without `TodayWidget` or `ART › Team › PI`, and keeping profile-menu `Settings` disabled) supporting ART category management, within-group reordering, optional sample catalog application, ART default allocation editing with live total indicator, and Team/PI override editing with explicit `Inherit` vs `Override` indicators, empty/invalid-ART-default states, read-only archived Team/PI inspection, and drift warnings.
- **FR-013**: All F003 domain rules, UUID path/query parameters, and request payloads MUST be validated in `src/domain/` and `src/application/` with strict Zod schemas (rejecting unknown fields and never accepting actor identifiers from HTTP bodies). F003 Drizzle migrations MUST upgrade F002 databases without data loss, preserve CLI `db:backup`/`db:restore` compatibility with synchronized `APP_VERSION = '0.3.0'`, and update all affected Constitution Principle VI documentation.

### Measurable Success Criteria

- **SC-001**: 100% of domain invariants (ART scoping, case-insensitive name uniqueness, `development`/`overhead` separation, single active `maintenance_bugs` per ART, `semantic_role` editability in F003, `kind` immutability when referenced, archive/delete/reactivation flagging per `D-2`, integer `0–100` exact arithmetic, full-set Team/PI saves, `null` vs `0` inheritance, reset-all scope, PI scoping, current/future-PI-only drift detection per `D-1`, cross-ART isolation, F002 delete conflict messages, sample catalog duplicate protection) are verified by passing Vitest unit and integration tests.
- **SC-002**: Upgrading an existing F002 database with F003 migrations preserves 100% of existing F001/F002 records, and CLI `db:backup` → `db:restore` into a separate destination recovers 100% of F003 categories and Team/PI overrides intact with synchronized `APP_VERSION = '0.3.0'`.
- **SC-003**: Managing ART categories (including applying the sample catalog, creating, editing, reordering, archiving, reactivating, and hard-deleting with reload persistence), saving ART defaults (rejecting `95%`, accepting `100%`), and managing Team/PI overrides (`56 / 15 / 14 / 8 / 7`, explicit `0%` vs `Inherit`, reset-all, PI isolation, and current/future-PI drift warnings) all pass end-to-end in Playwright with reload persistence and zero external network requests.
- **SC-004**: `/organization` → **`Categories & Allocation`** passes visual geometry checks (`tests/visual/categories-allocation.spec.ts`) and is keyboard-operable across `1440px`, `1024px`, and `768px` with zero `@axe-core/playwright` violations.
- **SC-005**: All quality gates (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`) exit `0`, and all affected living documentation files are updated.

---

## Edge Cases

- **Empty ART catalog & incremental creation (`D-2`)**:
  - A newly created ART has 0 categories (`artConfigStatus: 'not_configured'`, `artDefaultsValid: false`).
  - Newly created `development` categories via `POST /api/categories` **always** start at `default_pct = 0` so adding categories incrementally can never accidentally push a valid `100%` catalog to `110%`. Percentages are set atomically via `PUT /api/categories/defaults` (requiring `sum === 100`).
  - Applying **"Apply sample catalog"** on an ART that already has even one category (active or archived) is rejected (`409 CONFLICT`).
- **Archiving, deleting & reactivating development categories (`D-2`)**:
  - Archiving or hard-deleting (when unreferenced) a `development` category with `default_pct > 0` succeeds without silent redistribution; if the remaining active development defaults total `!== 100%` (or `0` if empty), the ART total is flagged (`artDefaultsValid: false`, `artConfigStatus: 'invalid' | 'not_configured'`) and every invalid current/future Team/PI split is flagged until corrected.
  - Because `default_pct = 0` is no longer required before delete, an operator can remove the last development category of an unreferenced ART and subsequently delete the ART cleanly.
  - Archiving a category preserves its `default_pct` and any existing `team_category_allocations` rows for historical inspection (excluded from active totals while archived).
  - Reactivating an archived `development` category checks active parent ART (`409`) and `maintenance_bugs` uniqueness (`409`), restores its stored `default_pct` and any kept Team/PI override rows into active resolution, and flags any resulting non-100% ART or current/future Team/PI total without rejecting reactivation.
- **Drift warnings & PI date scope (`D-1`, `D-2`)**:
  - Inherited ART defaults live-resolve for all PIs, but drift warnings (`driftedAllocations[]`, `hasDriftWarning`) apply **only** to active Teams × active **current and future PIs** (`pi.end_date >= today`, using injectable `OrganizationOptions.today`). Past PIs (`pi.end_date < today`) are never flagged.
  - Every invalid in-scope Team/PI split (`effectiveTotalPct !== 100`) is flagged — including partially overridden Teams after ART default edits (`104%`), fully inheriting Teams when ART defaults become invalid after archive/delete/reactivate (`88%`), and fully overridden Teams when a category they overrode is archived or a previously overridden category is reactivated.
- **Explicit `0%` vs. `Inherit` (`null`) & Reset-all**:
  - `0` is a valid explicit override (stored as a row with `override_pct = 0`), never coerced to `null`/falsy.
  - Clearing an override (`overridePct: null` in `PUT /api/categories/allocations`) deletes that row, restoring live inheritance of `art_default_pct`.
  - `PUT /api/categories/allocations` requires every active development category in the ART (`400 VALIDATION_ERROR` on partial payloads) and validates `sum === 100` on the exact state being saved.
  - `DELETE /api/categories/allocations` (Reset-all) requires active ART, active Team, and active PI (`409` otherwise), deletes override rows for **active** development categories only (preserving archived-category override rows), and succeeds even when ART defaults are invalid (returning the resulting flagged `TeamPiAllocationView`).
- **Kind & semantic-role mutability (`D-4`)**:
  - Unreferenced category: `kind` can switch `development ↔ overhead` (clearing `default_pct`/`semantic_role` when switching to `overhead`, or requiring valid `semantic_role` and setting `default_pct = 0` when switching to `development`, flagging any resulting non-100% ART total).
  - Referenced category (has any `team_category_allocations` row): `kind` change and hard delete are rejected (`409 CONFLICT`), while `semantic_role` remains editable in F003 subject to single active `maintenance_bugs` per ART (`D-4`).
- **Within-group reordering**:
  - `sort_order` is maintained independently per `(train_id, kind)` (`development` and `overhead`). Reordering via `POST /api/categories/reorder` accepts `{ trainId, kind, orderedIds }` covering all **active** categories of that `kind`, assigns `sort_order = 0..k-1` to `orderedIds`, places any archived categories of that `kind` after them at `>= k` preserving their relative order, and leaves the other `kind` group untouched.
- **Archived ART / Team / PI & cross-ART guards**:
  - Creating/editing/reordering categories or saving ART defaults under an archived ART is rejected (`409 CONFLICT`); read-only historical inspection remains allowed.
  - Saving or resetting Team/PI overrides for an archived ART, archived Team, or archived PI is rejected (`409 CONFLICT`); archived Teams/PIs can be inspected read-only via an optional `"Show archived Teams/PIs"` toggle in the UI.
  - Referencing an unknown `categoryId` returns `404 NOT_FOUND`; referencing a foreign-ART Team/PI/Category, an `overhead` category, or an `archived` category in allocation writes returns `409 CONFLICT`.
- **Integer-only percentage validation**:
  - Decimals (`12.5`), negative numbers (`-1`), numbers `> 100`, `NaN`, or non-numeric strings are rejected (`400 VALIDATION_ERROR`).
- **Name uniqueness & display safety**:
  - Trimmed `name` is case-insensitively unique within an ART (`"Feature development"` and `" feature development "` conflict with `409 CONFLICT`); two different ARTs may share identical category names. Archived categories retain their name uniqueness within the ART.

---

## Data Considerations

### 1. Persistence Conventions & Constitution Principle III

- All new tables live in local PGlite storage managed by Drizzle ORM migrations (`src/persistence/migrations/0002_work_categories_allocation.sql`), using F001's `auditColumns()` convention: UUIDv4 primary keys (`text`, `crypto.randomUUID()`), UTC `created_at` / `updated_at`, and `created_by` / `updated_by` defaulting to `"local:sm"` (never accepted from HTTP bodies).
- Archive status uses `record_status` (`'active' | 'archived'`), consistent with F002's `trains`, `teams`, `members`, `pis`, and `locations`.
- Percentages are stored as `integer` columns with explicit `IS NOT NULL` and `BETWEEN 0 AND 100` SQL `CHECK` constraints — zero floating-point storage or comparisons.
- **Constitution Principle III compliance**: F003 introduces **only** operational category configuration (`categories`) and working Team/PI override configuration (`team_category_allocations`). It creates **zero** `PlanVersion`, `PICommitment`, `SprintCommitment`, `SprintClosure`/`Actuals`, or `StateChange` records. `ON DELETE RESTRICT` + soft-archive (`record_status`) + reference-integrity guards ensure historical integrity and allow `F012` to snapshot resolved PI allocations immutably.

### 2. Core Entities (Aligned with Data Model v0.6)

| Conceptual Entity | Key Fields | Key Invariants |
|---|---|---|
| **Category (`categories`)** | `id`, `train_id` (FK → `trains.id`, immutable, `ON DELETE RESTRICT`), `name`, `short_label`, `color` (`#RRGGBB`), `kind` (`development` \| `overhead`), `semantic_role` (`feature` \| `maintenance_bugs` \| `standard` \| `null`), `default_pct` (nullable integer `0..100`), `sort_order` (integer `>= 0`, per `(train_id, kind)`), `record_status` (`active` \| `archived`), audit columns | ART-owned; case-insensitively unique trimmed `name` per ART; `kind = 'development'` requires `semantic_role IS NOT NULL` (`'feature' \| 'maintenance_bugs' \| 'standard'`) AND `default_pct IS NOT NULL` (`0..100`); `kind = 'overhead'` requires `semantic_role IS NULL AND default_pct IS NULL`; partial unique index enforcing at most one `active` `maintenance_bugs` category per ART; `kind` immutable once referenced; cannot hard-delete if referenced. |
| **TeamCategoryAllocation (`team_category_allocations`)** | `id`, `team_id` (FK → `teams.id`, `ON DELETE RESTRICT`), `pi_id` (FK → `pis.id`, `ON DELETE RESTRICT`), `category_id` (FK → `categories.id`, `ON DELETE RESTRICT`), `override_pct` (non-null integer `0..100`), audit columns | Unique `(team_id, pi_id, category_id)`; Team, PI, and Category must share the same `train_id` (immutable on `teams` and `pis` per F002); Category must be `development` and `active` when written; row absence = `Inherit` (`null`), row with `override_pct = 0` = explicit `0%`; full-set save across active development categories must sum to `100`. |
| **ART / Team / PI (`trains`, `teams`, `pis`)** | Existing F002 tables (unmodified schema) | Referenced via `ON DELETE RESTRICT`; `deleteTrain`, `deleteTeam`, and `deletePi` return `409 CONFLICT` with accurate messages naming Categories / category allocations when F003 rows reference them. |

### 3. Optional Sample Catalog Template (Payments ART — Operator-Initiated Only)

Applied **only** when the operator explicitly clicks **"Apply sample catalog"** on an ART with zero existing categories (`AZUSA_HANDOFF.md` §9; `Feature dev.` short label operator-accepted per `D-3`):

| Group | Order | Full Name | Short Label | Colour | Kind | Semantic Role | Default % |
|---|---|---|---|---|---|---|---|
| Development | 0 | `Feature development` | `Feature dev.` | `#2E8B57` | `development` | `feature` | `49` |
| Development | 1 | `SW maintenance (bugs)` | `SW maint.` | `#C93A3A` | `development` | `maintenance_bugs` | `20` |
| Development | 2 | `Enablers` | `Enabler` | `#E8890C` | `development` | `standard` | `14` |
| Development | 3 | `Estimations` | `Estimation` | `#7A4CC2` | `development` | `standard` | `10` |
| Development | 4 | `Technical debt` | `Tech debt` | `#3F4148` | `development` | `standard` | `7` |
| Overhead | 0 | `General work` | `General work` | `#A39C93` | `overhead` | `null` | `null` |
| Overhead | 1 | `Training` | `Training` | `#5C7A1F` | `overhead` | `null` | `null` |
