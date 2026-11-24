# Azusa — Feature Brief 003: Work Categories & Allocation

**Milestone:** M0 — Foundations  
**Feature ID:** F003  
**Version:** 0.1 — Draft for SDD  
**Date:** November 24, 2026  
**Dependency:** F002 — Organization & PI Cadence (and the F001 application foundation)

**Canonical references:**
- `AZUSA_ROADMAP_v2.md` — F003 and distributed-Settings decision
- `AZUSA_HANDOFF.md` — §9 Work categories and allocation, with November 20 updates taking precedence
- `AZUSA_HANDOFF_UPDATE_2026-11-20.md` — category, overhead, buffer and work-item clarifications
- `docs/azusa-data-model.md` — v0.6, especially Capacity and activities
- `docs/azusa-sprint-planning-decisions.md` — Overhead reserve/tickets and Buffer classification
- Azusa Constitution — SDD, domain integrity, documentation and testing requirements

## 1. Objective

Enable an ART to define **what kinds of work its Teams allocate capacity to**, set an ART-wide default development-work split, and let each Team establish a **PI-specific percentage allocation** through explicit overrides or inheritance.

F003 defines **categories and allocation rules**, not available capacity. F004 will use the effective allocations and calculated forecast Story Points (SP) to produce category budgets and load indicators; later features will classify Stories, Bugs, Buffers and overhead activities against these categories.

**User outcome:** As the local Azusa operator, I can configure an ART's development and overhead categories, maintain meaningful names and colours, set development allocation defaults totalling 100%, override selected percentages for a Team and PI, and see the resolved split without confusing an inherited default with an explicit zero.

## 2. Functional scope

### 2.1 ART-owned work category registry

- Create, view and edit work categories **within a selected ART**. Different ARTs may have different category catalogs.
- Each category has a stable identity and editable **full name**, **short label**, **colour** and **kind** (`development` or `overhead`).
- Categories use full names in configuration and wherever a shortened label could be confused with a work-item entity: e.g., **Feature development** rather than just **Feature**.
- The ART owns category definitions; a Team may **not** create a separate catalog or rename/recolour ART categories for itself.
- Category order should be consistent for lists, legends and downstream category breakdowns. A user-controlled order is desirable if supported by the agreed model, but must not require implementing future board screens in F003.
- Keep category identifiers stable through display-name changes so later links and historical records do not depend on matching category names.

### 2.2 Development versus overhead categories

**Development categories** classify point-bearing work and participate in the **100% post-overhead development allocation**. Examples in the prototype are Feature development, SW maintenance (bugs/support), Enablers, Estimations and Technical debt. An ART may configure a different set.

**Overhead categories** classify **time-based activities**, such as General Work, Training and Retrospective activities. They do **not** receive part of the development-category percentage allocation; their time is deducted before development capacity and forecast SP are calculated.

- No overhead category has a development allocation percentage.
- Do not create Story Points, point-bearing overhead Stories or velocity credit for overhead.
- F003 defines overhead category identity/appearance only. The **per-member/per-Sprint hour reservations** (`OverheadReserve`), tickets (`OverheadTicket`), dated ceremonies and meetings, and actual time deductions belong to F005/F009/F013 and the F004 capacity engine as assigned by the roadmap.
- Avoid reproducing the superseded model that treats a fixed general-work/training number of *days per Sprint* as the canonical category configuration; v0.6 uses **hours reserved by member and Sprint**.

### 2.3 Bugs category and work-item type boundaries

- **Bug is a separate work-item type**, not a Story whose type is inferred from category.
- The conceptual data model restricts Bug work items to the **Bugs** development category. The prototype's **SW maintenance (bugs)** is a sample display name; changing the label does not change a Bug into a Story.
- Preserve an unambiguous way for downstream F007 to identify which development category is eligible for Bug records **without relying solely on mutable display text**. A semantic classification or equivalent mapping may be defined during Specify; do not choose a physical schema in the brief.
- The handoff also treats support work as SW maintenance. Do not prematurely forbid non-Bug support work from the maintenance category; clarify its exact work-item classification in F007.
- F003 does **not** implement work-item type conversion, Story/Bug creation or category-specific work-item layouts. Those belong to F007.

### 2.4 ART-level default development allocation

- Every development category may have an ART-level default allocation percentage.
- The **effective set of development-category defaults must total exactly 100%** before it is accepted as a valid configured allocation.
- Allow different organizations to define different splits, rather than imposing Dyson's sample percentages as universal defaults.
- Default percentages belong to the ART catalog and are available as the fallback for Teams that have not supplied a PI-specific override.
- Overhead categories are excluded from the 100% calculation.
- For an incomplete or invalid edit, clearly show the current total and which validation rule is unmet; do not silently normalize or redistribute percentages.

### 2.5 Team overrides by PI

- Select an ART, Team and PI to inspect the Team's effective development-category allocation.
- A Team can override **percentage values only** for the ART-defined development categories, scoped to that Team and PI.
- **Unset override = inherit ART default**. An explicit `0%` is not the same as unset and must remain distinguishable in the data and UI.
- Show both the ART default and Team value, with an explicit indicator for **Inherit** versus **Override**.
- Calculate the effective Team allocation as `team_override ?? art_default`, where `0` is a valid specified override.
- The resulting effective development percentages for that Team/PI must total **100%** for the allocation to be accepted as valid.
- Team allocations are defined at **PI level**, not individually per Sprint. All Sprints in the PI use the same effective percentage split for that version of the plan.
- Distinct Teams may choose different valid effective allocations in the same ART and PI.

### 2.6 Future planning history integration

- F003 persists current category definitions, ART defaults and Team/PI overrides as operational configuration.
- **F012** records the effective allocation as part of the relevant full Plan Versions and PI Commitment. Later edits must not retroactively rewrite previously committed allocations.
- F003 should expose category/allocation data in a form suitable for those snapshots; it must **not** implement Plan Version creation or **Start PI**.
- Any post-commitment editing policy or replanning behavior must respect the separate versioning and commitment lifecycle; do not solve this by overwriting committed history.

## 3. UI scope and placement

No dedicated final prototype screen exists for the complete F003 administration workflow. Follow the supplied Azusa design system and the decision to distribute configuration across its owning features.

**Minimum usable experience:**

1. **ART work categories:** View development and overhead groups; create/edit category name, short label, colour and kind; set ART default percentages for development categories; see a live development-total indicator.
2. **Team PI allocation:** Select a Team and PI, inspect defaults, set/reset selected percentage overrides, distinguish `Inherit` from `0%`, and review the resolved percentage total.
3. **Validation feedback:** Clearly identify missing/invalid values and prevent saving an allocation set that violates required constraints.

Make this capability accessible from F002's organization management surface (for example, an ART Categories area and a Team/PI Allocation view). **Do not activate a monolithic `/settings` application solely for F003**, and do not create a second organization hierarchy.

The F004 Capacity Planner will provide the richer SP-budget split visualization using actual forecast SP. F003 may show percentages without pretending that forecast capacity is already computed.

## 4. Domain model and invariants

**Entities introduced or extended:**

| Entity | Relevant conceptual fields | Rules |
|---|---|---|
| `Category` | ART, name, short label, colour, kind, development default percentage, presentation order | Category catalog is ART-owned; overhead does not share development percentages |
| `TeamCategoryAllocation` | Team, PI, Category, nullable override percentage | Overrides only the percentage; unset inherits ART default |
| `ART` / `Team` / `PI` | References established in F002 | Team and PI must belong to the same ART as the referenced Category |

**Required invariants:**

1. Category definitions are scoped to a single ART; Team-specific category catalogs are not supported.
2. Team/PI overrides may reference only development categories belonging to the Team's ART; no cross-ART allocations.
3. The effective development-category distribution must total 100% for a valid saved configuration.
4. Percentages are nonnegative and cannot exceed 100% individually. Define suitable decimal precision in Specify; calculations should not depend on binary floating-point equality for validation.
5. An unset override means inheritance; an explicitly saved `0%` means zero.
6. Overhead categories use time, not SP or a share of the 100% development allocation.
7. A category's display name/short label is not a work-item type discriminator.
8. Referenced categories must not be deleted or mutated in a way that silently invalidates existing allocation records or historical work. Define archive/retirement behavior before introducing destructive actions.
9. No category change may rewrite an existing immutable PI or Sprint Commitment.

## 5. Acceptance criteria

**AC01 — ART category registry**  
Given an ART created in F002, the operator can define, edit and inspect its development and overhead categories, including full name, short label and colour. A different ART can maintain a different category catalog.

**AC02 — Development and overhead separation**  
Development categories participate in percentage allocation; overhead categories do not. No overhead Story Points or development percentage budget is created.

**AC03 — Default allocation validity**  
Given ART defaults `49 + 20 + 14 + 10 + 7`, the development total is displayed as **100%** and is valid. An attempted saved configuration totalling `95%` is rejected with clear feedback. This is a configurable sample, not a mandatory catalog.

**AC04 — Team-specific overrides**  
Given ART defaults `49 / 20 / 14 / 10 / 7`, a Team/PI can override the first, second and fourth allocations to `56 / 15 / 8`, inheriting `14` and `7` for the others; the effective split is **56 / 15 / 14 / 8 / 7 = 100%**.

**AC05 — Inheritance versus zero**  
Given an ART development category with a nonzero default, clearing the Team override restores the inherited default. Setting an explicit `0%` persists as zero and does not revert to the ART default; it is accepted only when the full effective allocation remains valid.

**AC06 — PI scoping**  
Changing a Team's overrides for one PI does not change its overrides for another PI. No separate per-Sprint percentage allocations are introduced.

**AC07 — Cross-ART isolation**  
An allocation for a Team in ART A cannot reference categories from ART B; distinct ART category definitions and defaults remain independent.

**AC08 — Bug classification readiness**  
The model keeps Bug work-item type distinct from category label and supports a reliable future restriction of Bugs to the applicable maintenance/Bugs category. Renaming the category must not remove that classification.

**AC09 — Configuration UI**  
The operator can access category configuration from the organization context, distinguish defaults/overrides, and see totals/validation without needing a standalone Settings page or the F004 Capacity Planner.

**AC10 — Historical safety and data integrity**  
Category changes and deletions cannot silently break existing allocation references. The implemented data model and service boundary allow F012 to snapshot effective PI allocations without building snapshot functionality in F003.

**AC11 — Documentation and tests**  
Unit/integration tests cover category kind, ART scoping, percentage validation, inheritance including explicit zero, PI scoping, and reference integrity. Update the domain model, data dictionary, repository map, changelog and relevant architecture decisions alongside implementation.

## 6. Out of scope

- Computing member working days, available hours/days, velocity, forecast SP, category SP budgets or load percentages — **F004**.
- Operational Team Calendar, leave, holidays, ceremonies, meetings, planned overtime and associated editing — **F005**.
- Per-member/per-Sprint OverheadReserve hours, OverheadTickets and actual activity time — **F005/F009/F013**, according to their ownership in the roadmap.
- Creating Stories, Bugs, category-derived full/light/Bug forms, tasks, and work-item workflows — **F007** and later.
- PI-planned Buffers, BufferDraw and board visualization of category load — **F009/F013/F014**.
- Full Plan Versions, Start PI, PI Commitments or historical comparisons — **F012**.
- Authentication, RBAC enforcement, hosted services, or a centralized Settings application.

## 7. Specify/Plan decisions to settle

These are not grounds to expand F003's scope, but must be explicit before implementing the affected behavior:

1. **Bug-eligible category semantics:** How does the domain designate the category usable for Bug work items if its display name is configurable? Ensure the solution also respects the handoff's classification of support work as maintenance.
2. **Category lifecycle:** For a referenced category, is retirement handled by archive/inactive status, or another restriction? Should changing `kind` be prohibited after the category has been used?
3. **Default changes and effective PI allocations:** If ART defaults change while a Team/PI is inheriting them, confirm how the current working plan updates versus historical versions/commitments. Do not let a default change mutate immutable snapshots.
4. **Percentage input:** Choose decimal precision/rounding and validation rules; retain exact or deterministic totals that reliably evaluate to 100%.
5. **Initial category catalog:** Is the Payments ART example an optional starter template/fixture, or should a new ART initially receive a minimal configurable set? The handoff describes sample defaults, not a required global catalog.

## 8. Feature exit criteria

F003 is complete when:

- An ART can maintain a meaningful category catalog without a separate Settings application.
- Development allocations resolve correctly from ART defaults and Team/PI overrides, with explicit inheritance and 100% validation.
- Overhead categories remain time-based classifications and do not introduce duplicate capacity deductions.
- Categories are safe for downstream Story/Bug classification, F004 capacity budgets, and F012 historical commitment snapshots.
- Automated tests and repository documentation are updated.

**Next dependency:** F004 — Capacity Engine & Capacity Planner.