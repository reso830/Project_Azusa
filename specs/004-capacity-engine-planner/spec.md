# Feature Specification: Capacity Engine & Capacity Planner

**Feature Branch**: `004-capacity-engine-planner`  
**Created**: 2026-11-26  
**Updated**: 2026-11-26 (Review Pass 4 — atomic cross-ART header sync via `setSelection`, clamped breakdown formula throughout, invalid deep-link fallback; Review Pass 3 — percent bulk >744h atomic 400 rejection, breakdown zero-clamp display, archived-Member scheduledEndDate < today rule)  
**Status**: Ready for Re-Review  
**Input**: `docs/features/004-capacity-engine-planner.md` (v0.1, 2026-11-26)  
**Design Reference**: `docs/handoffs/azusa-handoff-v2.zip` (`AZUSA_HANDOFF.md` §8, §8.1, §13.3; `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §1; `docs/azusa-data-model.md` v0.6 §2, §4; `docs/azusa-sprint-planning-decisions.md` Capacity & Overhead; `prototype/Capacity.dc.html`; `screenshots/03-capacity-planner.png`)

---

## Clarifications

### Session 2026-11-26

- **Q1 (Capacity Planner UI target — v2 prototype vs. Feature Brief §3)** *(KPI labels finalized in R7 below)*: *How should `/capacity` reconcile the v2 prototype (`Capacity.dc.html` / `03-capacity-planner.png`) with Brief §3 and F003/F005/F009 feature boundaries?*  
  → **A1**: Match the **v2 prototype layout** as the visual target, with the following boundary-respecting adjustments:
  1. **Five KPI tiles**: Retain `Planned SP`, `Development capacity`, `Normalized velocity`, `Forecast SP`, and `Team FTE` (`R7`).
  2. **Team allocation matrix**: Retain the Category × (PI + Sprints) allocation matrix instead of a donut visualization; it conveys ART defaults, Team overrides, effective percentages, and per-Sprint/PI SP budgets more clearly.
  3. **Expandable Member capacity table**: Retain expandable PI and Sprint columns to manage information density while exposing per-member calculation breakdowns.
  4. **Planned SP before F009**: Display `—` / `Not yet available` (never `0`, which could be misread as an actual planning total) until Story/StorySlice allocation lands in F009.
  5. **Day-off management**: Link to `/calendar` (Team Calendar, F005) instead of implementing `+ Day off` or duplicating absence editing in F004.
  6. **Category allocation editing**: Link to `/organization` (`Categories & Allocation`, F003) instead of implementing inline percentage editing in F004; F003 remains the sole authority for category allocations.

- **Q2 (Overhead persistence, deduction modes & FTE ordering — Brief §8 #1, #2, #10)** *(refined by R2, R4, R5, R6, R8, R9 below)*: *How should F004 persist overhead deduction configuration and per-member deductions, and how does FTE apply?*  
  → **A2**: Follow Data Model v0.6's direct per-member persistence while retaining `deduction_mode` on `Team`:
  1. Persist `OverheadDeduction` *(renamed from v0.6 `OverheadReserve` per `R5`)* directly per `(member_id, team_id, iteration_id, category_id)` (`R2`) for `overhead` categories.
  2. Store deducted durations in **hours (`deducted_hours`) in `0.25h` steps** (`R6`, replacing integer-minute storage and `R3` rescaling).
  3. Retain `source` (`'pi_plan' | 'sprint_adjusted'`) to distinguish initial PI Planning deductions from later Sprint Planning adjustments (F013).
  4. Persist `deduction_mode` (`'fixed_days' | 'percent'`) on `teams` to govern the bulk-input method (fixed days per member per full Sprint vs. percentage of available days). Do **not** introduce a separate persistent team-level overhead-category default table that could drift from `OverheadDeduction`.
  5. Support a bulk-apply action during PI Planning to populate initial `OverheadDeduction` values across eligible members/Sprints, followed by individual Member × Iteration adjustments.
  6. ~~Overhead tickets (F013) draw against the Member's reserve with an over-reserve warning.~~ *(Superseded by `R9`: there is no "drawing against" overhead; overhead is a deduction taken before FTE, and the only warning is planning beyond available capacity.)*
  7. Apply `fte_factor` **after** planned overhead deductions (`dev_days = fte_factor × (available_days − planned_overhead)`), matching the v0.6 formula.
  8. Deduct overhead once only; overhead never generates Story Points or velocity credit. Sprint Commitment (F013) will snapshot the resulting capacity totals and overhead deductions.

- **Q3 (Normalized velocity seed, PI override, IP iterations & zero-history rules — Brief §8 #7, #8)**: *How should manual seed NV, PI velocity overrides, IP iterations, and zero-history/zero-denominator cases behave?*  
  → **A3**: Implement the full v0.6 velocity resolution chain and Team-scoped seed/PI override:
  1. Store `seed_normalized_velocity` on `teams` as the fallback when no usable rolling history exists.
  2. Include **both `development` and `ip` iterations** in the rolling 4-completed-Sprints window; use available completed history when fewer than 4 completed Sprints exist.
  3. Compute rolling NV as a **ratio of sums** (`Σ completed_development_SP / Σ actual_development_days`), never an average of per-Sprint ratios.
  4. Fall back to `seed_normalized_velocity` when there are 0 completed Sprints or `Σ actual_development_days === 0`.
  5. When `Σ actual_development_days > 0` and `Σ completed_development_SP === 0`, return a genuine **`0.0` NV** (do not fall back to seed).
  6. Persist a **Team-specific PI velocity override** in F004 (keyed by `(team_id, pi_id)`, never on the shared ART-level `pis` row).
  7. Preserve the full resolution chain: `Sprint override → PI override → Rolling NV → Team seed`. Sprint-level override UI belongs to F013, while the pure engine supports the full chain now so Sprint Commitment can snapshot both resolved value and source.

- **Q4 (Calendar, role eligibility & boundary edge cases — Brief §8 #3, #4, #5, #6)**: *How should unconfirmed holidays, member roles, overlapping absences/holidays, negative capacity, and dated team assignments be handled?*  
  → **A4**: Enforce the following engine rules and cover them with golden tests:
  1. **Unconfirmed holidays (`confirmed = false`)** immediately reduce forecast capacity and carry an `est.` provisional indicator; subsequent cancellation or edits recalculate capacity live.
  2. **Role eligibility**: Only Members with role **`Team member`** contribute to development capacity. `Admin`, `RTE`, `SM`, and `PO` are excluded.
  3. **No double deduction**: Evaluate effective unavailable time per weekday so overlapping absences, Location holidays, and weekends never exceed 1.0 working day on any date. Weekend holidays have zero capacity impact; absences with `affects_capacity = false` or `status = 'cancelled'` have zero impact.
  4. **Negative clamping**: Clamp negative member development days to `0` and emit an advisory capacity warning when deductions exceed available time.
  5. **Dated Team assignments**: Intersect Sprint weekdays with the Member's `member_team_assignments` (`start_date`..`end_date`) so only weekdays assigned to that Team contribute capacity, and historical capacity reflects membership at that time rather than current membership.

- **Q5 (PI forecast aggregation & category budget rounding — Brief §8 #9)**: *How should display rounding reconcile Sprint and PI Forecast SP and Category Budgets?*  
  → **A5**: Retain full precision internally and apply rounding strictly at presentation:
  - Round each Sprint's displayed `Forecast SP` to the nearest integer (`Math.round`).
  - Derive displayed `PI Forecast SP` by summing the displayed per-Sprint rounded `Forecast SP` values.
  - Compute each Sprint's displayed `Category Budget SP` independently using the **largest-remainder method** (in exact integer arithmetic: `forecastSpDisplay × effectivePct` divmod `100`) so active development category budgets sum exactly to that Sprint's displayed `Forecast SP`, resolving equal remainders deterministically by `sort_order` ascending, then `categoryId` ascending.
  - Derive displayed `PI Category Budgets` by summing the corresponding displayed per-Sprint category budgets.
  - Never persist rounded display values as underlying capacity or forecast truth.

### Session 2026-11-26 (review)

- **R1 (Deviations D4, D5, D6 accepted)**: Operator accepted **D4** (dynamic ART overhead categories + Deducted-first summary), **D5** (`Hours per day` input + Team seed NV / PI velocity override editor on `/capacity`), and **D6** (read-only derived `Days` in expanded Sprint columns).
- **R2 (Deductions are owned by a Team)**:
  - `overhead_deductions` adds `team_id` (FK → `teams.id`, `ON DELETE RESTRICT`) and uses unique key `(member_id, team_id, iteration_id, category_id)` with a `(team_id, iteration_id)` lookup index. `deleteTeam` must also detect `overhead_deductions` references.
  - A deduction applies only to weekdays inside that Team's dated `member_team_assignments` within the Iteration.
  - **Fixed days bulk apply**: the entered value is per full Sprint and is **prorated by assigned weekdays** (`assignedWeekdays / sprintScheduledWeekdays`, e.g., `4/10` on Team A, `6/10` on Team B), snapped independently per Team to `0.25h` (`R6`).
  - **Percent bulk apply**: calculated against that Team's assigned available capacity, snapped to `0.25h` (`R6`).
  - Mid-Sprint transfers stay allowed (F002 unchanged). All reads, writes, bulk apply, and clears are strictly Team-scoped so one Team never mutates another Team's rows.
  - ADR `0004` notes this departure from v0.6's `OverheadReserve` entity (which had no `team_id`).
- **R3** *(Replaced by `R6` below — deductions are stored in fixed hours, not rescaled days.)*
- **R4 (No "Adjusted" marker in F004 — Deviation D7)**: Remove the prototype's adjusted corner triangle / indicator from F004. Add no flag and no derived heuristic; both bulk and individual edits persist `source = 'pi_plan'`. Record **D7** (accepted per R4): the prototype's adjusted marker is deferred to F013, where `source = 'sprint_adjusted'` gives it meaning.

### Session 2026-11-26 (review pass 2)

- **R5 (No "reserve" wording for overhead)**: Overhead time is a **deduction**, removed first before the FTE multiplier; "reserve" wording is kept exclusively for Buffers (F009/F013). Rename everywhere: `OverheadReserve` → `OverheadDeduction`, `overhead_reserves` → `overhead_deductions`, `reserved_minutes` → `deducted_hours`, `/api/capacity/overhead-reserves` (+ `/bulk`) → `/api/capacity/overhead-deductions` (+ `/bulk`), request field `reservedMinutes` → `deductedHours`, and all `*Reserve*` types, functions, and tests. Keep `source` (`'pi_plan' | 'sprint_adjusted'`) and the `"Deducted first"` heading. ADR `0004` records the rename from v0.6's `OverheadReserve` alongside the `team_id` departure.
- **R6 (Deductions stored in hours, in `0.25h` steps — replaces R3)**:
  - Persist `deducted_hours double precision NOT NULL` with `CHECK (deducted_hours >= 0 AND deducted_hours <= 744 AND deducted_hours * 4 = floor(deducted_hours * 4))` (`744h = 31 days × 24h`; multiples of `0.25` are exact IEEE-754 doubles).
  - Day value is derived on read: `days = deducted_hours / teams.hours_per_day`.
  - **Hours are fixed, not days.** Changing `teams.hours_per_day` leaves `deducted_hours` unchanged (no rescaling) and changes each deduction's day equivalent, dev days, and Forecast SP predictably.
  - **Snapping to `0.25h`** (nearest `0.25h`, halves rounded up: `Math.floor(hours * 4 + 0.5) / 4`):
    - Fixed-days bulk: `days × hours_per_day × (assignedWeekdays / sprintScheduledWeekdays)` snapped to `0.25h` (each Team's prorated share rounded independently, e.g., `4/10 × 8h = 3.2h → 3.25h`; `6/10 × 8h = 4.8h → 4.75h`).
    - Percent bulk: `availableHours × pct / 100` snapped to `0.25h`.
    - Inline edits: typed in days, converted to `days × hours_per_day`, snapped to `0.25h`, and the cell displays the snapped day value (e.g., `0.1d` at `8h` → `0.75h` → `0.09d`).
  - Engine accepts deductions in hours (`hours × 60` is always an exact multiple of `15` integer minutes internally). `hours_per_day` stays `[1.0, 24.0]` step `0.5` so half-days stay on the `0.25h` / `15`-minute grid.
- **R7 (P1 resolved — KPI tile labels)**: Use exact labels: **`Planned SP`**, **`Development capacity`**, **`Normalized velocity`** (lowercase `"v"`), **`Forecast SP`**, **`Team FTE`**.
- **R8 (P2 resolved — FTE display in Member Capacity table)**:
  - Expanded Sprint cells, footers, and inline inputs all display **stored values, before FTE** (e.g., Hana at `0.5` FTE reads `Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25`).
  - Inline inputs edit the stored pre-FTE deduction.
  - Footer overhead totals are the sum of stored deductions (e.g., `2702` GW = `8` days, not `7.5`).
  - **No extra `× FTE` column.** The member subline (`Team member · 0.5 FTE`) shows the multiplier, and the calculation breakdown popover shows `max(0, Days − Leaves − deductions) × FTE = Dev` (explicitly displaying the `→ clamped to 0` step alongside the `'over_deducted'` warning whenever `Days − Leaves − deductions < 0`).
- **R9 (A2.6 superseded — no "drawing against" overhead)**: Overhead is a deduction taken before FTE, not an allowance that tickets draw down. The only warning is planning beyond available capacity (`over_deducted`). The system must never say a plan "draws from" or "exceeds" a Member's overhead allowance. **Forward note for F013**: F013's overhead-ticket design (v0.6 / handoff 2026-11-19 "reserve + tickets", "Tickets exceed reserve") must be reworked to fit `R9`.

---

## Problem Statement

Before Azusa can drive Team Calendar availability management (`F005`), Team PI Board load gauges (`F009`), Team PI Briefs (`F011`), immutable PI Commitments (`F012`), Sprint Planning hour budgets (`F013`), or Metrics dashboards (`F016`), it needs an authoritative, pure TypeScript **Capacity Calculation Engine** and a transparent **Capacity Planner** (`/capacity`). Without a single deterministic engine that reconciles Team Sprint offsets, dated Team memberships, per-Location holidays, capacity-affecting absences, Team-scoped `OverheadDeduction` records, FTE scaling, normalized velocity resolution, F003 category allocations, and reusable load indicators, downstream views would duplicate formulas, introduce floating-point drift, or present opaque capacity totals that a Scrum Master cannot audit or trust.

---

## Scope

### In Scope

1. **Pure TypeScript Capacity Calculation Engine (`src/domain/capacity/`)**:
   - Implemented as pure TypeScript modules with **zero** database, filesystem, network, Next.js, or React dependencies.
   - Accepts explicit organizational, calendar, availability, Team-scoped `OverheadDeduction` hours, velocity history/override/seed, F003 resolved allocation, optional planned-SP inputs, and open extension hooks for future F005 ceremonies/meetings/overtime (defaulting to empty/`0` in F004); returns full-precision calculated values, presentation-rounded display values, and granular breakdowns explaining every number.
   - Uses exact integer minutes internally (`workdayMinutes = Math.round(hoursPerDay * 60)`, where `hoursPerDay` ∈ `[1.0, 24.0]` step `0.5` → `workdayMinutes` ∈ `[60, 1440]` step `30`; half-day = `workdayMinutes / 2` exact integer; `deductedHours * 60` always an exact multiple of `15` minutes).
   - Evaluates capacity at two levels: **Member × Iteration** and **Team × Iteration** with **PI-level aggregation**.
   - Reusable without modification by `/capacity` (`F004`), Team Calendar (`F005`), Team PI Board (`F009`), Team PI Brief (`F011`), Sprint Planning (`F013`), Metrics (`F016`), and ART Program Board (`F019`).

2. **Working Days, Dated Team Assignments, Multi-Location Holidays & Absences**:
   - Computes each Member × Iteration window using the Team's scheduled Sprint boundaries from F002 (`start_date`..`end_date` shifted by `teams.sprint_offset_workdays` ∈ `{-1, 0, +1}` weekdays).
   - Counts Monday–Friday weekdays **intersected** with the Member's `member_team_assignments` (`start_date`..`end_date`) for that Team, ensuring mid-Sprint joins/departures/transfers and historical PIs reflect membership at the time (note: role, FTE, and Location use the Member's current record; only Team assignment is dated).
   - Applies each Member's own Location effective holiday calendar (F002 precedence: company/manual rows suppress library rows on the same `(location_id, date)`; full holiday = `1.0` day, half holiday = `0.5` day; weekend holidays = `0`). A holiday in one Location never shifts the Team's Sprint schedule or reduces another Location's Members.
   - Applies **unconfirmed holidays (`confirmed = false`)** immediately to forecast capacity while flagging them with an `est.` provisional indicator in the breakdown.
   - Deducts active absences (`status = 'active'`) whose `AbsenceType.affects_capacity === true` (`full` = `1.0` day, `am` = `0.5` day, `pm` = `0.5` day). Cancelled absences and non-capacity-affecting types (`BT`, `WFH`, `ON_SITE`, or any configured `affects_capacity = false`) have zero deduction.
   - Tracks `full`, `am`, and `pm` halves independently per weekday so duplicate `am` or duplicate `pm` absences only count once (`0.5` day), `am` + `pm` count as `1.0` day, and overlapping holidays + absences never exceed `1.0` working day on any single date (`effectiveAbsence = min(rawAbsence, 1.0 − holidayDeduction)`).
   - Operational planned overtime (`extra_hours`) calculation is deferred to **F005** alongside Team Calendar overtime management (Brief §6); the engine preserves an optional future input hook defaulting to `0`.

3. **Member Eligibility, FTE & Hours Conversion**:
   - Counts **only** Members with `role = 'Team member'` toward development capacity; excludes `Admin`, `RTE`, `SM`, and `PO` (updating F002's `contributesToDevCapacity` in `src/domain/organization/roles.ts`).
   - Applies `fte_factor` **after** availability and overhead deductions using one single authoritative formula:
     - `overheadMinutes = Σ Math.round(deductedHours × 60)` (exact multiple of `15` minutes).
     - `preFteMinutes = max(0, availableMinutes − overheadMinutes)` (exact integer; emits `'over_deducted'` warning if `overheadMinutes > availableMinutes`).
     - Authoritative full-precision Member dev days: `devDaysRaw = (preFteMinutes × fteFactor) / workdayMinutes`.
     - Derived Member dev hours & integer minutes: `devHours = devDaysRaw × hoursPerDay` and `devMinutes = Math.round(devDaysRaw × workdayMinutes)`.
     - Authoritative Team dev days & Forecast SP: `teamDevDaysRaw = Σ member.devDaysRaw`, `forecastSpRaw = teamDevDaysRaw × resolvedNv`.
   - Clamps negative development capacity to `0` and emits an explicit advisory warning (`over_deducted`) identifying the Member and Iteration.
   - Preserves distinct counts for total Team membership (during the PI), eligible development Members, per-Iteration eligible FTE, and PI-level weighted-average eligible FTE (`Σ (member.fteFactor × member.assignedWeekdaysInPi) / totalPiScheduledWeekdays`, or sum of currently assigned eligible FTE when PI has `0` Iterations).
   - Exposes `devHours` via `teams.hours_per_day` (default `8.0`, Team-level override in `[1.0, 24.0]` step `0.5`, editable on `/capacity` only). Story Points are never converted directly into hours.

4. **Team-Scoped Overhead Deductions & Deduction Modes (`teams.deduction_mode` + `overhead_deductions`)**:
   - Adds `deduction_mode` (`'fixed_days' | 'percent'`, default `'fixed_days'`) to `teams`.
   - Persists authoritative per-`(member_id, team_id, iteration_id, category_id)` **`overhead_deductions`** (`R2`, `R5`) in **hours (`deducted_hours`, `0..744` in `0.25h` steps)** (`R6`) with `source` (`'pi_plan' | 'sprint_adjusted'`, default `'pi_plan'`), referencing an active `overhead` category belonging to the Team's ART.
   - Does **not** create a separate persistent team-level overhead-category default table.
   - **Hours are fixed (`R6`)**: Changing `teams.hours_per_day` leaves `deducted_hours` untouched (no rescaling), changing derived day values (`deducted_hours / hours_per_day`), dev days, and Forecast SP predictably.
   - Supports **bulk-applying** initial PI Planning overhead deductions across all Iterations of the selected PI for active eligible `Team member`s assigned to that Team (`mode` must match `teams.deduction_mode`; categories omitted from `entries` and rows belonging to other Teams are left untouched):
     - `fixed_days`: entered value (`0..31` days per full Sprint) is prorated per Team by `assignedWeekdays / sprintScheduledWeekdays`, converted to hours (`days × hoursPerDay × ratio`), and snapped independently per Team to the nearest `0.25h` with halves rounded up (`Math.floor(hours * 4 + 0.5) / 4`, e.g., `4/10 × 8h = 3.2h → 3.25h`, `6/10 × 8h = 4.8h → 4.75h`, `R2`, `R6`).
     - `percent`: entered percentage (`0..100`) is a **one-off conversion** computed against that Member's assigned available hours on that Team (`availableHours × pct / 100`), snapped to the nearest `0.25h` (halves up), and persisted as fixed `deducted_hours` (`m5`, `R6`); subsequent calendar edits do not auto-recompute persisted deductions.
   - Supports individual per-Member × Team × Iteration × Overhead Category edits directly in the expanded Sprint columns (typed in days, converted to hours and snapped to `0.25h`, displaying the snapped day value, persisting `source = 'pi_plan'` with no "Adjusted" corner indicator per `R4`/`D7`).
   - Deducts overhead once before development capacity is computed; overhead never earns Story Points or velocity credit and dynamically renders all active F003 `overhead` categories for the ART.

5. **Normalized Velocity Resolution, Manual Seed & Team PI Override**:
   - Adds `seed_normalized_velocity` (nullable non-negative float, `0..1000`) to `teams` as the manual fallback when no usable rolling history exists.
   - Adds `team_pi_velocity_overrides` keyed uniquely by `(team_id, pi_id)` storing a Team-specific PI velocity override (`0..1000`, same ART, active Team/PI on write).
   - Implements the full v0.6 resolution chain in the pure engine:
     `Sprint override → PI override → Rolling 4-Sprint NV → Team seed`
   - Rolling NV computes `Σ completed_development_SP / Σ actual_development_days` across the last **4 completed Sprints** (including both `development` and `ip` iterations; using available history when `< 4` exist; anchor date for historical Sprints to be finalized in F015).
   - Falls back to `seed_normalized_velocity` when there are `0` completed Sprints or `Σ actual_development_days === 0`; returns genuine `0.0` NV when `Σ actual_development_days > 0` and `Σ completed_development_SP === 0`.
   - Returns explicit NV metadata (`value`, `source`: `'sprint_override' | 'pi_override' | 'rolling_4_sprint' | 'rolling_partial' | 'manual_seed' | 'unset'`, `sprintCountUsed`, `totalCompletedSp`, `totalActualDevDays`).

6. **Forecast SP, Development Category Budgets & Reusable Load Calculation**:
   - Computes per-Iteration `forecast_sp_raw = team_dev_days × resolved_nv` and PI `forecast_sp_raw = Σ iteration_forecast_sp_raw` at full precision.
   - Computes presentation-rounded `forecast_sp_display = Math.round(forecast_sp_raw)` per Iteration and `pi_forecast_sp_display = Σ iteration_forecast_sp_display` (`A5`). Note: PI dev days display as the rounded raw sum (`291.25 → 291.3`), matching the handoff even when displayed 1-decimal Sprint dev days sum slightly differently (`291.5`).
   - Consumes F003's resolved `TeamPiAllocationView`:
     - When `isValid === true` (active development percentages total `100%`), computes raw `category_budget_raw = forecast_sp_raw × effective_pct / 100` and presentation-rounded per-Iteration `category_budget_display` via **exact integer largest-remainder rounding** (`numerator = forecast_sp_display × effective_pct`, `floor = floor(numerator / 100)`, `remainder = numerator % 100`, ties broken deterministically by `sort_order` ascending then `categoryId` ascending) summing exactly to `forecast_sp_display`, with PI category budgets equal to the sum of Sprint category budgets.
     - When `isValid === false` (invalid or unconfigured F003 allocation), surfaces the validation/drift status explicitly and does **not** present the category split as a valid 100% allocation.
   - Exposes reusable pure `calculateLoad(plannedSp, forecastSp, thresholds?)` computing `load_pct = (plannedSp / forecastSp) × 100` (handling `forecastSp === 0` safely) and indicator band using configurable thresholds defaulting to `< 85%` (`amber`), `85–115%` (`green`), `> 115%` (`red`).

7. **Capacity Planner UI (`/capacity`)**:
   - Replaces the F001 placeholder at `/capacity` (accessible from the **Capacity** navigation group).
   - Uses the floating header's existing `ART › Team › PI` context selector for active Teams/PIs, and also accepts **URL-only** query parameters `/capacity?teamId=<uuid>&piId=<uuid>` (`m7`, `m13`):
     - When valid `teamId` and `piId` URL params point to an **active** ART, Team, and PI, `/capacity` atomically syncs the floating header's ART + Team + PI selection via `OrganizationContext.setSelection({ teamId, piId })` (avoiding cross-ART `piId` drops) and **immediately clears the URL params** (`router.replace('/capacity')`) once synced so subsequent manual header changes are never pulled back by a leftover URL.
     - When valid `teamId` and `piId` URL params point to an **archived** ART, Team, or PI, they take precedence over the header selector; the floating header retains its active selection unchanged while `/capacity` displays a prominent read-only banner (`"Viewing archived <Team> · <PI> (read-only)"`) with a `"Return to active selection"` button that clears the URL params.
     - Changing the Team or PI in the floating header clears any remaining URL params (`router.replace('/capacity')`) so the header selection immediately takes effect.
     - If the URL params are incomplete (only one of `teamId` / `piId`), are not valid UUIDs, reference an unknown Team or PI, or name a Team and PI from different ARTs, `/capacity` ignores them, clears them (`router.replace('/capacity')`), keeps the floating header's current selection, and shows a dismissible notice (`"Link could not be opened — showing current selection"`).
   - Renders the warm-light Azusa/Kumiko visual system matching `Capacity.dc.html` / `03-capacity-planner.png` at `1440px` baseline with the approved deviations (`D1`–`D7`):
     - **Page title row**: `Capacity planner` heading, `Deduction mode` segmented toggle (`Fixed days` | `% of available`), and a navigation link/button to `/calendar` (`Team calendar`).
     - **Five KPI tiles (`R7`)**:
       1. Dark **`Planned SP`** tile displaying `—` / `Not yet available`.
       2. **`Development capacity`** (PI total Team dev days, 1 decimal). Activate the value to edit the Team's `Hours per day` (`1.0–24.0`, step `0.5`).
       3. **`Normalized velocity`** (current resolved NV in `SP / day`, explicit source badge, plus inline edit/popover for Team manual seed NV and Team PI velocity override with reset).
       4. **`Forecast SP`** (PI displayed Forecast SP).
       5. **`Team FTE`** (PI weighted-average eligible `Team member` FTE, with tooltip/sub-detail noting excluded non-dev roles and member count).
     - **Team allocation section**:
       - Category × (`PI` + `Iterations`) matrix showing `Forecast SP · 100%`, each active F003 development category (colour bar, full name, ART default vs. Team override badge, effective `%`, per-Sprint and PI budget SP, with planned SP shown as `—` until F009), `Total 100% ✓` (or explicit invalid/drift warning banner when F003 allocation is invalid/unconfigured), and a clear link to `/organization` (`Manage in Organization →`) for editing allocations.
       - Separate **Deducted first** overhead summary showing each active overhead category's total stored deducted days/hours across the PI and per Iteration (distinct from the 100% development SP split).
     - **Member capacity section (`R8`)**:
       - Bulk-apply overhead deductions control (respecting active `deduction_mode`: fixed days prorated by assigned weekdays, or one-off `%` of available hours, snapped to `0.25h`).
       - Member × (`PI` + `Iterations`) table with expandable PI and Sprint columns:
         - Header shows Iteration name, Team-scheduled date range, `NOW` indicator if current, and location-holiday count summary (e.g., `2 locations off`) with tooltip listing affected Locations and holidays.
         - Member rows show avatar/initials, full name, role & FTE (`Team member · 1.0 FTE` / `Team member · 0.5 FTE` — no extra `× FTE` column per `R8`), and Location badge (`PH`, `SG`, etc.). Excluded non-dev roles (`PO`, `SM`, `Admin`, `RTE`) appear in a clear excluded-roles disclosure/footer.
         - Collapsed Sprint cell shows resulting dev days plus visually distinct **leave** (blue `−N`), **holiday** (sand/amber `−N`, with `est.` badge when unconfirmed), and over-deducted warning indicator if clamped at `0` (no "Adjusted" corner triangle in F004 per `R4`/`D7`).
         - Expanded Sprint cell displays **stored pre-FTE values** (`Days`, `Leaves`, one editable day-input column per active ART overhead category editing the stored pre-FTE deduction and showing the `0.25h`-snapped day value, and resulting post-FTE `Dev` days — e.g. Hana reads `Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25` per `R8`).
         - Footer rows: total stored overhead deductions per category (`2702` GW = `8` days, per `R8`), **Team dev days**, and **Forecast SP × NV** (orange), plus PI totals.
       - **Calculation explanations**: Clicking/activating any Member × Iteration cell or Forecast cell opens an inspectable breakdown popover showing scheduled Sprint window + offset, assigned weekdays, named Location holidays (`est.` if unconfirmed), named active absences, per-category stored overhead deductions in hours & days, explicit `max(0, Days − Leaves − deductions) × FTE = Dev` (with an explicit `→ clamped to 0` step alongside `'over_deducted'` when over-deducted) step (`R8`), clamping warning if any, NV source, and forecast derivation.

8. **Canonical Golden Dataset, Verification & Living Documentation**:
   - Single canonical fixture (`tests/support/capacity-golden-fixture.ts`) with exact dated holidays & absences (`GW = 8h`, `Tr = 4h` at `8h/day`) reproducing both the **Baseline** (`291.25` dev days → `56 + 51 + 55 + 52 + 54 = 268 SP`; pinned category budgets `149 / 40 / 38 / 21 / 20`) and **Adjusted** (Carlo `2706` GW = `4h` → `60.25` / `291.75` dev days) scenarios, plus all boundary cases.
   - Vitest unit & integration tests, HTTP route contract tests, F003→F004 migration upgrade & CLI `db:backup`/`db:restore` round-trip (`APP_VERSION = '0.4.0'`), Playwright visual geometry + E2E + `@axe-core/playwright` across `1440px`, `1024px`, and `768px`.
   - Living documentation updates: `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/operations/database-and-recovery.md`, `docs/REPO_MAP.md`, ADR `0004`, `README.md`, and `CHANGELOG.md`.

### Non-Goals (Out of Scope)

1. **No Organization, Team, Member, PI, or Iteration Management (`F002`)**: Do not duplicate ART/Team/Member/PI/Iteration creation or editing on `/capacity` (except `teams.deduction_mode`, `teams.hours_per_day`, and `teams.seed_normalized_velocity` capacity settings).
2. **No Category or Allocation Editing (`F003`)**: Do not implement inline category `%` editing or category CRUD on `/capacity`; link to `/organization` (`Categories & Allocation`).
3. **No Team Calendar, Days-Off Editor, Ceremonies, Meetings, Milestones, or Overtime Calculation/Entry (`F005`)**: Do not implement `+ Day off`, a days-off grid, `SprintCeremony`, `Meeting`, `Milestone`, planned overtime calculation/entry, or holiday refresh UI on `/capacity`; link to `/calendar`.
4. **No Separate Persistent Team-Level Overhead-Category Default Table**: `OverheadDeduction` per `(member, team, iteration, category)` is the sole persisted overhead deduction truth (`A2`, `R2`, `R5`).
5. **No "Adjusted" Deduction Marker in F004 (`R4`, `D7`)**: Deferred to F013 where `source = 'sprint_adjusted'` gives it meaning.
6. **No Work Items, StorySlices, Buffers, or Real Planned SP (`F006`–`F009`)**: Do not create Projects, Features, Stories, Bugs, StorySlices, or Buffers; `Planned SP` displays `—` / `Not yet available` until F009 (`A1`).
7. **No Plan Versions, Start PI, or PI Commitments (`F012`)**: Do not create `PlanVersion` or `PICommitment` snapshots in F004.
8. **No Sprint Planning, Overhead Tickets, Sprint Velocity Override UI, or Task-Hour Allocation (`F013`)**: Do not create `OverheadTicket`, Sprint Planning screens, or `Start Sprint` / `SprintCommitment`; the pure engine accepts a `sprintOverrideVelocity` parameter for F013 readiness without adding Sprint override UI in F004. *(Forward note per `R9`: F013's overhead-ticket design must be reworked so tickets do not "draw from" or warn on "exceeding" an overhead allowance.)*
9. **No Execution Tracking, Unplanned Deductions, or Sprint Closure / Actuals (`F014`/`F015`)**: Do not create `UnplannedDeduction` entry UI, `SprintClosure`, or finalized Actuals tables in F004; the pure engine accepts completed-Sprint history inputs for F015 readiness.
10. **No Metrics Dashboards, ART Reporting, or Charting Library Selection (`F016`–`F019`)**: Do not add a charting library or donut chart; charting evaluation belongs to M3 (`F016`).
11. **No Per-Location Workday Hours, Self-Service Absences, Auth/RBAC, or Standalone `/settings`**: Retain F001–F003 single-user local-first provenance (`local:sm`) and disabled profile-menu `Settings`.

---

## Visual & Interaction Target (Constitution Principle II)

The approved visual and interaction target for `/capacity` is `prototype/Capacity.dc.html` (`screenshots/03-capacity-planner.png`) in `docs/handoffs/azusa-handoff-v2.zip`, using Azusa's warm-light Kumiko/Asanoha visual system (`#F4F1EC` canvas, `#FFFFFF` flat rounded cards, `#1A1B22` ink headers/dark tile, `#E07F24` / `#A65307` orange accents, `#FFF8F1` forecast row tint, `Zen Kaku Gothic New` / `IBM Plex Sans` / `IBM Plex Mono` tabular numerals, 42-icon Kumiko set, and `:focus-visible` `2px solid #E07F24` outlines).

Prototype fidelity applies at the `1440px` baseline width; `1024px` and `768px` must remain usable, collision-free, and accessible under Constitution Principle VII (horizontal scroll within table containers where needed).

### Intentional, Justified Deviations from Prototype v2 in F004

| Area | Prototype v2 Reference (`Capacity.dc.html`) | F004 Specified Behavior | Justification & Acceptance |
|---|---|---|---|
| **D1 — Planned SP placeholder until F009** | Shows mock `242 / 268 SP` (`90%`), progress bar, and per-category planned SP from mock Stories. | Retains the dark `Planned SP` KPI tile and planned/budget columns, displaying `—` (`Not yet available`) rather than `0` or mock numbers. | Stories/StorySlices belong to F007/F009 (`A1`, accepted `2026-11-26`). |
| **D2 — Link to `/calendar` instead of `+ Day off`** | Title row includes a primary `+ Day off` button. | Replaces `+ Day off` with a navigation link/button to `/calendar` (`Team calendar`). | Team Calendar (F005) owns availability editing (`A1`, accepted `2026-11-26`). |
| **D3 — Link to `/organization` instead of inline category `%` editing** | Team Allocation rows allow clicking `%` pills to edit overrides inline. | Renders read-only effective `%`, ART default vs. override badges, and links to `/organization` (`Categories & Allocation`) for edits. | F003 owns category/allocation editing (`A1`, accepted `2026-11-26`). |
| **D4 — Dynamic ART overhead categories + Deducted first summary** | Hardcodes `GW` (General work) and `Tr` (Training) columns and top rows. | Dynamically renders all active F003 `overhead` categories for the Team's ART plus a dedicated **Deducted first** overhead summary. | Categories are ART-configurable (`Brief §2.5`, §3.4; accepted per `R1`, `2026-11-26`). |
| **D5 — Hours per day & Velocity seed/PI override controls** | Hardcodes `0.92` NV and omits `Hours per day` control on `/capacity`. | Exposes `Hours per day` (`1.0–24.0`, step `0.5`) through the Development capacity value and editable Team seed NV + Team PI velocity override through the explicit NV source badge. | Required by Brief §3.1–3.2 and v0.6 velocity override chain (`A3`; accepted per `R1`, `2026-11-26`). Workday control placement was refined during the visual walkthrough. |
| **D6 — Derived working days (no inline `Days` override)** | Expanded Sprint columns make `Days` an editable text input. | `Days` is read-only and derived authoritatively from Team Sprint schedule, dated assignments, and Location holidays; only `OverheadDeduction` inputs are editable. | Capacity derives from calendar + assignments (`A2`, `A4`; accepted per `R1`, `2026-11-26`). |
| **D7 — No "Adjusted" corner marker in F004** | Shows an orange corner triangle (`Capacity.dc.html#L156`) when a cell's deduction is edited. | Omits the adjusted corner triangle in F004; bulk and individual edits both persist `source = 'pi_plan'` with no flag or heuristic. | Deferred to F013 where `source = 'sprint_adjusted'` gives it meaning (`R4`, accepted `2026-11-26`). |
| **D8 — KPI labels & Pre-FTE Member table display** | Prototype labels tiles `Forecast commitment` / `Team size` and displays FTE-scaled expanded cells (`5 | 0.5 | 0.25 → 4.25`). | Uses operator-confirmed KPI labels (`Planned SP`, `Development capacity`, `Normalized velocity`, `Forecast SP`, `Team FTE`) and displays stored pre-FTE values in expanded cells, inputs, and footers (`10 | 0 | 1 | 0.5 → 4.25`) with `max(0, Days − Leaves − deductions) × FTE = Dev` (with an explicit `→ clamped to 0` step alongside `'over_deducted'` when over-deducted) in the breakdown popover. | Operator-confirmed (`R7`, `R8`, `2026-11-26`). |

---

## User Behavior

### User Story 1 — Pure Deterministic Capacity Engine & Canonical Golden Calculations (Priority: P1)

As a Scrum Master and downstream feature consumer, I want a pure TypeScript capacity calculation engine that deterministically calculates Member × Iteration and Team × Iteration development days and hours from Team Sprint schedules, dated Team memberships, Location-specific holidays, active capacity-affecting absences, Team-scoped `OverheadDeduction` hours, and FTE factors, so every screen in Azusa derives identical, auditable numbers.

**Why this priority**: The pure engine is the mathematical core of F004 and a shared dependency for F005, F009, F011, F013, F016, and F019 (AC01–AC06, AC08, AC14).

**Independent Test**: Run the Vitest capacity engine test suite (`tests/unit/capacity-engine.test.ts` and `tests/unit/capacity-golden.test.ts`) with zero database or React imports and verify: (1) the canonical `Palawan` / `PI-2027.1` **Baseline** golden fixture (`GW = 8h`, `Tr = 4h` at `8h/day`) reproduces exact per-Sprint dev days (`60.75`, `55.75`, `59.75`, `56.25`, `58.75`, PI total `291.25` → `291.3`), displayed Forecast SP (`56`, `51`, `55`, `52`, `54`, PI total `268`), and exact pinned Category Budgets (`149 / 40 / 38 / 21 / 20`); (2) the **Adjusted** golden fixture (Carlo `2706` `GW = 4h`) reproduces `2706 = 60.25` and PI `291.75` (`291.8`); (3) a Team with `sprint_offset_workdays = -1` or `+1` uses shifted Mon–Fri Sprint boundaries; (4) multi-location Members only lose days for their own Location's holidays without shifting the Team schedule; (5) unconfirmed holidays (`confirmed = false`) reduce capacity immediately and include `est.` metadata; (6) weekend holidays, cancelled absences, and `affects_capacity = false` absences (`BT`, `WFH`, `ON_SITE`) produce zero deduction; (7) duplicate `am` or duplicate `pm` absences count once (`0.5` day), `am + pm` = `1.0` day, and overlapping holiday + absence on the same weekday never double-deducts beyond `1.0` day; (8) `PO`, `SM`, `Admin`, and `RTE` Members contribute `0` dev days and `0` eligible FTE; (9) dated `member_team_assignments` clip working days to assigned weekdays only, including mid-Sprint Team transfers with independently `0.25h`-snapped prorated fixed-day deductions (`4/10 × 8h → 3.25h`, `6/10 × 8h → 4.75h`); (10) excess deductions clamp member dev days to `0` with an `over_deducted` warning; (11) `hours_per_day` (`1.0`–`24.0`, step `0.5`) converts fixed `deducted_hours` to derived days (`deducted_hours / hours_per_day`) and `devHours` (`devDaysRaw × hours_per_day`) — verifying `8h → 7.5h` leaves `8h` GW untouched and updates dev days predictably (`R6`) — and `fteFactor = 0.33` obeys the single authoritative full-precision `devDaysRaw` rule.

**Acceptance Scenarios**:

1. **Given** valid organizational, calendar, assignment, absence, Team-scoped overhead deduction, velocity, and allocation inputs, **When** the capacity engine runs, **Then** it produces deterministic results without any database, network, filesystem, or UI access, retaining full precision internally.
2. **Given** a Team with `sprint_offset_workdays` ∈ `{-1, 0, +1}` and Members across multiple Locations, **When** working days are calculated for an Iteration, **Then** each Member's working days equal the Mon–Fri weekdays inside the Team's offset-adjusted Sprint window intersected with that Member's dated `member_team_assignments` for that Team, minus full (`1.0`) and half (`0.5`) weekday holidays for that Member's Location only (weekend holidays ignored; unconfirmed holidays deducted immediately and marked provisional `est.`).
3. **Given** active absences for a Member during an Iteration, **When** availability is computed per weekday, **Then** `full` deducts `1.0` day and `am`/`pm` are tracked independently (`0.5` each; duplicate `am` or duplicate `pm` counts once) only when `AbsenceType.affects_capacity === true` and `status === 'active'`; overlapping holidays and absences on the same weekday cap total unavailable time at `1.0` day (zero double deduction).
4. **Given** a Team roster containing `Team member`s (at `1.0`, `0.5`, `0.33` FTE) alongside `PO`, `SM`, `Admin`, and `RTE` Members, **When** Team development capacity is computed, **Then** only `Team member` roles contribute to `team_dev_days` and `eligible_fte`, with `preFteMinutes = max(0, availableMinutes − overheadMinutes)`, authoritative `devDaysRaw = (preFteMinutes × fteFactor) / workdayMinutes`, and derived `devMinutes = Math.round(devDaysRaw × workdayMinutes)`, emitting `'over_deducted'` if clamped to `0`.
5. **Given** a Team with `hours_per_day = 8.0` and stored overhead deductions (`GW = 8h`, `Tr = 4h`), **When** `hours_per_day` changes to `7.5`, **Then** `deducted_hours` remain unchanged (`8h`, `4h`), their derived day values become `8 / 7.5` and `4 / 7.5`, and dev days / Forecast SP recalculate predictably without rescaling (`R6`) and without SP↔hours conversion.

---

### User Story 2 — Team-Scoped Overhead Deductions, Deduction Modes & Bulk/Individual Adjustments (Priority: P1)

As a Scrum Master, I want to choose a Team's overhead deduction mode (`Fixed days` or `% of available`), bulk-apply initial PI overhead deductions across eligible Members and Iterations (prorated for partial Sprint assignments in `Fixed days`, or one-off `%` of assigned available hours in `% of available`, snapped to `0.25h`), and fine-tune individual Member × Iteration `OverheadDeduction` records per overhead category, so overhead time is deducted accurately once before development capacity without maintaining duplicate default tables or colliding across Teams.

**Why this priority**: Overhead deductions directly shape available development capacity and must enforce Team-scoped `OverheadDeduction` persistence in `0.25h` hour steps (`AC07`, `A2`, `R2`, `R4`, `R5`, `R6`).

**Independent Test**: On `/capacity` for an active Team (`Team A`) and PI under an ART with `General work` and `Training` overhead categories: (1) switch `Deduction mode` between `Fixed days` and `% of available`, reload, and verify persistence on the Team; (2) in `Fixed days` mode, bulk-apply `1.0` day for `General work` and `0.5` day for `Training` across the PI, reload, and verify `overhead_deductions` rows persist in hours (`8.0` h and `4.0` h at `8h/day`, `source = 'pi_plan'`) and reduce each Member's dev days with FTE applied after overhead (e.g., `1.0` FTE full sprint = `8.5` dev days; `0.5` FTE = `4.25` dev days); (3) for a Member transferring mid-Sprint (`4` of `10` weekdays on `Team A`, `6` of `10` on `Team B`), verify `Team A` bulk-apply creates `3.25h` (`4/10 × 8h` snapped to `0.25h`) for `Team A` without touching `Team B`, and `Team B` bulk-apply creates `4.75h` (`6/10 × 8h` snapped to `0.25h`) for `Team B` without touching `Team A`; (4) expand a Sprint column (e.g., `2706`), adjust one Member's `General work` deduction to `0.5` day (and verify typing `0.1` day snaps to `0.75h` / displays `0.09` day), reload, and verify only that `(member, team, iteration, category)` row updated (`4.0h`) with updated Team dev days + Forecast SP (and no "Adjusted" corner indicator per `R4`); (5) update `hours_per_day` from `8.0` to `7.5`, reload, and verify `deducted_hours` stay unchanged (`8.0h` stays `8.0h`) and dev days / Forecast SP recalculate predictably (`R6`); (6) switch to `% of available` mode and bulk-apply `10%` `General work` and `5%` `Training`, verifying each Member × Sprint's deduction is computed once from that Member's assigned available hours on that Team, snapped to `0.25h`, and persisted as fixed `deducted_hours`; (7) verify via API/integration tests that targeting a `development` category, archived category, foreign-ART category, or mismatched `mode` is rejected (`409 CONFLICT`), and negative, off-step (`0.1h`), or out-of-bounds values (`> 31` days, `> 100%`, `> 744h`) are rejected (`400 VALIDATION_ERROR`) with zero rows written.

**Acceptance Scenarios**:

1. **Given** an active Team, **When** the operator switches `deduction_mode` between `'fixed_days'` and `'percent'` or updates `hours_per_day` (`1.0–24.0`, step `0.5`), **Then** the Team setting persists, stored `deducted_hours` remain fixed (`R6`), and derived day values, dev days, and Forecast SP recalculate immediately.
2. **Given** an active Team and PI with active F003 `overhead` categories, **When** the operator bulk-applies PI overhead deductions matching `teams.deduction_mode` (`fixed_days` prorated by `assignedWeekdays / sprintScheduledWeekdays`, or one-off `percent` of assigned available hours, both snapped to nearest `0.25h` with halves up), **Then** `overhead_deductions` rows persist scoped to `team_id` with `source = 'pi_plan'` across all Iterations of the PI, leaving other Teams' rows and unlisted categories untouched.
3. **Given** an expanded Iteration column on `/capacity`, **When** the operator edits an individual Member's stored pre-FTE overhead deduction in days (converted to hours and snapped to `0.25h`), **Then** only that `(member_id, team_id, iteration_id, category_id)` row updates (or deletes when set to `0`), the cell displays the snapped day value, dev days / Forecast SP / Category Budgets recalculate immediately, and persistence survives reload with `source = 'pi_plan'`.
4. **Given** an overhead deduction write referencing a `development` category, an `archived` category, a foreign-ART category, an archived ART/Team/PI/Member, a mismatched bulk `mode`, or negative/off-step/out-of-bounds values, **When** submitted to the domain/API, **Then** the request is rejected (`400 VALIDATION_ERROR` for invalid values/steps/bounds, `409 CONFLICT` for domain/scope violations) with zero partial mutations.
5. **Given** an ART with custom overhead categories (e.g., `Retrospective` only, or `0` overhead categories), **When** `/capacity` loads for a Team in that ART, **Then** the UI and engine dynamically adapt to the ART's active overhead categories without assuming `General work` and `Training` exist.

---

### User Story 3 — Normalized Velocity Resolution, Forecast SP, Category Budgets & Load Calculation (Priority: P1)

As a Scrum Master, I want the engine and Capacity Planner to resolve Normalized Velocity through the v0.6 override chain (`Sprint override → PI override → Rolling 4-Sprint NV → Team seed`), forecast Story Points with clear Sprint-to-PI reconciliation, derive development-category SP budgets from F003 allocations (flagging invalid allocations), and expose reusable Load % calculations, so PI forecasting is transparent and consistent.

**Why this priority**: Normalized velocity and category budgets bridge time capacity to Story Point planning and feed F009, F011, F013, and F016 (`AC09`–`AC12`, `A3`, `A5`).

**Independent Test**: (1) Via Vitest unit tests on the pure engine, verify: (a) 4 completed Sprints (including an IP Sprint) compute NV as `Σ completed_dev_sp / Σ actual_dev_days` (ratio of sums, not average of ratios); (b) 2 completed Sprints use available history (`source = 'rolling_partial'`); (c) 0 completed Sprints or `Σ actual_dev_days === 0` falls back to `seed_normalized_velocity` (`source = 'manual_seed'`); (d) `Σ actual_dev_days > 0` with `Σ completed_dev_sp === 0` returns genuine `0.0` NV (does not fall back to seed); (e) PI override supersedes rolling NV (`source = 'pi_override'`), and Sprint override supersedes PI override (`source = 'sprint_override'`); (f) per-Sprint Forecast SP rounds to nearest integer and sums to PI Forecast SP; (g) per-Sprint Category Budgets use exact integer largest-remainder rounding (`forecastSpDisplay × effectivePct` divmod `100`, ties broken by `sort_order` ascending then `categoryId` ascending) summing exactly to Sprint Forecast SP, and PI Category Budgets sum the Sprint budgets (`149 / 40 / 38 / 21 / 20` on the golden dataset); (h) `calculateLoad` returns exact `%` and default bands (`< 85%` amber, `85–115%` green, `> 115%` red) while handling `forecastSp = 0` safely. (2) In the browser on `/capacity`, set Team seed NV to `0.92`, verify Forecast SP and Category Budgets update and persist across reload with `Manual seed` source badge; set a Team PI velocity override of `1.05` for `PI-2027.1`, verify `PI override` badge appears and forecasts update without changing `PI-2027.2`; clear the PI override and confirm fallback to `0.92`; invalidate F003 allocation (e.g., archive a development category so total ≠ `100%`) and verify `/capacity` displays an explicit validation warning rather than a valid `100% ✓` split.

**Acceptance Scenarios**:

1. **Given** a Team with completed Sprint history (both `development` and `ip` iterations), **When** Normalized Velocity is resolved without overrides, **Then** the engine computes `Σ completed_development_SP / Σ actual_development_days` over up to the last 4 completed Sprints; if `0` completed Sprints or `Σ actual_development_days === 0`, it falls back to `teams.seed_normalized_velocity`; if `Σ actual_development_days > 0` and `Σ completed_development_SP === 0`, it returns genuine `0.0` NV.
2. **Given** a Team and PI where the operator sets a Team-specific PI velocity override (`team_pi_velocity_overrides`), **When** capacity is calculated for that Team × PI, **Then** the PI override supersedes rolling NV and seed NV (`source = 'pi_override'`) without affecting other Teams in the same ART or other PIs of the same Team; clearing the override restores rolling/seed resolution.
3. **Given** Team development days per Iteration and resolved NV, **When** Forecast SP and Development Category Budgets are calculated for a valid `100%` F003 allocation, **Then** full-precision values are preserved internally, each Sprint's displayed Forecast SP is `Math.round(sprint_dev_days × nv)`, PI Forecast SP equals the sum of displayed Sprint Forecast SPs, each Sprint's displayed Category Budgets use exact integer largest-remainder rounding (tie-broken by `sort_order`, then `categoryId`) summing exactly to that Sprint's Forecast SP, and PI Category Budgets equal the sum of Sprint Category Budgets.
4. **Given** a Team × PI whose effective F003 development allocation is unconfigured (`0` categories) or invalid (effective total `!== 100%`), **When** `/capacity` renders, **Then** it displays an explicit validation/drift warning with a link to `/organization` (`Categories & Allocation`) and does **not** display `Total 100% ✓` or present the breakdown as a valid 100% split.
5. **Given** planned StorySlice SP (including Stretch allocations) and Forecast SP, **When** `calculateLoad` runs, **Then** it computes `planned_sp / forecast_sp × 100` (excluding overhead work) and classifies `< 85%` as amber, `85–115%` as green, and `> 115%` as red using configurable threshold inputs.

---

### User Story 4 — Transparent Capacity Planner UI (`/capacity`) & Calculation Explanations (Priority: P1)

As a Scrum Master, I want to navigate to `/capacity`, select a Team and PI, inspect the 5 KPI tiles, Team Allocation matrix, Deducted-first overhead summary, and expandable Member Capacity table, and inspect the exact calculation breakdown behind every displayed number, so the Capacity Planner is never a black box.

**Why this priority**: Delivers the primary user-facing workflow of F004 with prototype fidelity (`Capacity.dc.html` / `03-capacity-planner.png`) and full transparency (`AC13`, `A1`, `R7`, `R8`).

**Independent Test**: Navigate to `/capacity` via the Capacity navigation group with a seeded ART, Team, PI (with Iterations), multi-location Members (including `Team member` at `1.0` and `0.5` FTE and excluded `SM`/`PO`), Holidays (including an unconfirmed `est.` holiday), Absences, F003 categories/allocations, and seed NV: (1) confirm the header `ART › Team › PI` context selector switches the displayed Team/PI cleanly; (2) verify the 5 KPI tiles render with exact labels **`Planned SP`** (`—` / `Not yet available`), **`Development capacity`**, **`Normalized velocity`** (with source badge), **`Forecast SP`**, and **`Team FTE`** (`R7`); (3) verify the **Team allocation** matrix shows ART defaults, Team override chips vs. `Inherits train`, per-Sprint and PI budget SP, `Total 100% ✓`, a link to `/organization`, and a separate **Deducted first** overhead summary; (4) verify the **Member capacity** table shows avatars, role & FTE subline (`Team member · 0.5 FTE`, no extra `× FTE` column), Location badges, visually distinct leave (blue) vs. holiday (sand/amber + `est.`) chips, Sprint header holiday-location counts, and expandable PI/Sprint columns displaying stored pre-FTE values (`Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25` for Hana) and stored pre-FTE footer overhead totals (`2702` GW = `8` days, `R8`); (5) click/inspect a Member × Sprint cell breakdown popover and verify it names the scheduled Sprint dates, working days, specific holidays (`est.` if unconfirmed), specific active absences, per-category overhead deductions in hours & days, explicit `max(0, Days − Leaves − deductions) × FTE = Dev` (with an explicit `→ clamped to 0` step alongside `'over_deducted'` when over-deducted) step (`R8`), and resulting dev days/hours; (6) click the `/calendar` link and confirm navigation to `/calendar`, and click the `/organization` link and confirm navigation to `/organization`; (7) open `/capacity?teamId=<archivedTeamId>&piId=<piId>` (URL-only archived view per `m13`) and confirm URL precedence, read-only banner (`"Return to active selection"` clears URL params), disabled mutations, and changing the header selector clears URL params; (8) verify empty states (no Team/PI selected, Team with 0 eligible `Team member`s, PI with 0 Iterations, unset seed NV) render clear, actionable guidance without crashing.

**Acceptance Scenarios**:

1. **Given** the operator opens `/capacity` from the Capacity navigation group, **When** a Team and PI are selected in the floating header context selector, **Then** the screen renders the title row (`Deduction mode` and link to `/calendar`), 5 KPI tiles (`Planned SP`, `Development capacity` with a workday editor, `Normalized velocity`, `Forecast SP`, `Team FTE`), **Team allocation** matrix + **Deducted first** overhead summary + link to `/organization`, and **Member capacity** table.
2. **Given** a Team with multi-location Holidays (including an unconfirmed `est.` holiday) and active Absences, **When** the operator views the **Member capacity** table, **Then** leaves and holidays are visually distinct, unconfirmed holidays carry an `est.` indicator, Sprint headers summarize how many Locations have holidays during that Sprint, and expanding any Sprint or PI column reveals stored pre-FTE `Days | Leaves | <Overhead categories>` alongside post-FTE `Dev` days and stored pre-FTE footer overhead totals (`R8`).
3. **Given** any Member × Iteration cell or Forecast SP value on `/capacity`, **When** the operator inspects its calculation explanation (via accessible breakdown popover), **Then** the UI clearly shows every contributing input and formula step (scheduled Sprint dates + offset, assigned weekdays, named holidays with `est.` flag, named active absences, per-category stored overhead deductions in hours & days, explicit `max(0, Days − Leaves − deductions) × FTE = Dev` step with explicit `→ clamped to 0` step alongside `'over_deducted'` when over-deducted, NV source & history counts, and forecast SP derivation).
4. **Given** an archived ART, archived Team, or archived PI opened via URL `/capacity?teamId=<uuid>&piId=<uuid>` (`m13`), **When** `/capacity` renders, **Then** URL params take precedence over the header selector, the floating header preserves its active selection, `/capacity` renders a read-only banner with a `"Return to active selection"` action and all mutation controls disabled, and changing the header selector clears the URL params.

---

### User Story 5 — Migrations, Data Safety, Accessibility & Living Documentation (Priority: P2)

As the local Azusa operator and developer, I want F004's schema changes (`teams` capacity columns, `overhead_deductions`, `team_pi_velocity_overrides`) to upgrade cleanly from F003 with tested CLI backup/restore, `/capacity` to pass visual geometry and accessibility checks across `1440px`, `1024px`, and `768px`, and all affected living documentation to stay current.

**Why this priority**: Enforces Constitution Principles II, IV, V, VI, and VII and ensures safe upgrades and downstream readiness (`AC14`, `AC15`).

**Independent Test**: Run `lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, and `test:e2e` (all exiting `0`); run `db:migrate` on an existing F003 PGlite database (confirming 100% of F001–F003 records survive upgrade with default `deduction_mode = 'fixed_days'`, `seed_normalized_velocity = null`, and any out-of-step F002 `hours_per_day` snapped cleanly to `[1.0, 24.0]` step `0.5`); run CLI `db:backup` and `db:restore` (`--from` / `--to`) into a separate destination directory on a database containing F004 `overhead_deductions` and `team_pi_velocity_overrides` (confirming 100% round-trip record counts and synchronized `APP_VERSION = '0.4.0'`); verify Playwright visual geometry (`tests/visual/capacity-planner.spec.ts`) and `@axe-core/playwright` zero-violation checks on `/capacity` across `1440px`, `1024px`, and `768px`; inspect `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/operations/database-and-recovery.md`, `docs/REPO_MAP.md`, ADR `0004`, `README.md`, and `CHANGELOG.md`.

**Acceptance Scenarios**:

1. **Given** an existing F003 PGlite database containing ARTs, Teams, Members, PIs, Iterations, Locations, Holidays, Absences, Categories, and TeamCategoryAllocations, **When** F004 Drizzle migrations run, **Then** 100% of existing records survive intact and CLI `db:backup`/`db:restore` round-trip 100% of F004 records with `APP_VERSION = '0.4.0'`.
2. **Given** `/capacity` rendered at `1440px`, `1024px`, and `768px`, **When** verified via Playwright visual geometry checks and `@axe-core/playwright`, **Then** `1440px` matches the approved prototype layout (subject to `D1`–`D8`), all viewports are collision-free and keyboard-operable with visible focus rings, and zero accessibility violations are reported.
3. **Given** F004 implementation is complete, **When** living documentation is inspected, **Then** `overview.md`, `domain-model.md`, `data-dictionary.md`, `database-and-recovery.md`, `REPO_MAP.md`, ADR `0004`, `README.md`, and `CHANGELOG.md` accurately describe F004 (while `docs/feature-roadmap.md` keeps `F004` unchecked until conformance review and operator UAT acceptance).

---

## Acceptance Criteria

### Mapping to Feature Brief Acceptance Criteria (AC01–AC15)

| Brief AC | Requirement Summary | Verified by User Story |
|---|---|---|
| **AC01 — Pure calculation engine** | Pure TypeScript module producing deterministic Member × Iteration and Team × Iteration/PI results without DB, filesystem, network, or UI dependencies. | US1 |
| **AC02 — Member working days** | Excludes weekends and applicable Location holidays (full `1.0`, half `0.5`, unconfirmed `est.` deducted immediately, weekend holidays ignored) within Team-scheduled Sprint boundaries intersected with dated Team assignments. | US1 |
| **AC03 — Absence deductions** | Deducts active full (`1.0`) and independent `am`/`pm` (`0.5` each, duplicates counted once) absences per `AbsenceType.affects_capacity`; ignores cancelled and non-capacity-affecting records; never double-deducts overlapping holiday/absence/weekend. | US1 |
| **AC04 — Multi-location Teams** | Each Member uses their own Location holiday calendar; one Location's holiday never shifts the Team's Sprint schedule or reduces another Location's Members. | US1, US4 |
| **AC05 — Team schedule offsets** | Uses F002 Team-specific Sprint boundaries (`-1`, `0`, `+1` weekday offset). | US1 |
| **AC06 — Member eligibility and FTE** | Counts only `Team member` role (excluding `PO`, `SM`, `Admin`, `RTE`); applies `fte_factor` after availability and overhead deductions via single authoritative formula; clamps negative dev days to `0` with warning. | US1, US2 |
| **AC07 — Overhead deduction modes** | Supports `fixed_days` (prorated by assigned weekdays) and `percent` (one-off % of assigned available hours) Team deduction modes, bulk-applying and individually adjusting Team-scoped per-`(member, team, iteration, overhead_category)` `OverheadDeduction` records in `0.25h` steps. | US2 |
| **AC08 — Hours per day** | Default `8.0` h/day with Team-level override (`1.0–24.0`, step `0.5`) on `/capacity`; stored `deducted_hours` stay fixed when `hours_per_day` changes (`R6`) and `dev_hours = devDaysRaw × hours_per_day` without SP↔hours conversion. | US1, US2, US4 |
| **AC09 — Normalized velocity** | Full v0.6 resolution chain (`Sprint override → PI override → Rolling 4-Sprint ratio of sums incl. IP → Team seed`); partial history when `< 4` Sprints; fallback to seed on `0` Sprints or `0` dev days; genuine `0.0` NV on `0` SP with `> 0` dev days. | US3 |
| **AC10 — Forecast SP** | Computes full-precision per-Iteration and PI Forecast SP (`team_dev_days × nv`); displays per-Sprint nearest-integer Forecast SP summed for PI total. | US1, US3 |
| **AC11 — Category budgets** | Consumes F003 effective Team/PI allocation; computes full-precision budgets and exact integer largest-remainder per-Sprint display budgets (tie-broken by `sort_order`, then `categoryId`) summed for PI totals; excludes overhead categories. | US3, US4 |
| **AC12 — Invalid category allocation** | Displays explicit validation/drift warning and link to `/organization` when F003 allocation is invalid or unconfigured; never represents it as a valid 100% split. | US3, US4 |
| **AC13 — Capacity Planner** | `/capacity` screen matching v2 prototype layout (with approved deviations `D1`–`D8`): Team/PI selection (+ URL-only `?teamId=&piId=` for archived read-only), 5 KPI tiles (`R7`), Team Allocation matrix + Deducted-first overhead summary, expandable pre-FTE Member Capacity table (`R8`), `/calendar` & `/organization` links, and inspectable calculation breakdowns. | US2, US3, US4 |
| **AC14 — Golden tests** | Deterministic Vitest golden tests reproducing both the canonical `Palawan` / `PI-2027.1` Baseline and Adjusted worked examples (with pinned category budgets) and all boundary/edge cases. | US1, US3, US5 |
| **AC15 — Documentation** | Updates `overview.md`, `domain-model.md`, `data-dictionary.md`, `database-and-recovery.md`, `REPO_MAP.md`, ADR `0004`, `README.md`, and `CHANGELOG.md`. | US5 |

### Functional Requirements

- **FR-001**: Pure capacity engine (`src/domain/capacity/`) MUST have zero imports from persistence, Next.js, React, or I/O modules, and MUST derive `workdayMinutes = Math.round(hoursPerDay * 60)` from `hoursPerDay` ∈ `[1.0, 24.0]` step `0.5` (`workdayMinutes` ∈ `[60, 1440]`, step `30`; half-day = `workdayMinutes / 2` exact integer) and `overheadMinutes = Σ Math.round(deductedHours * 60)` (exact multiple of `15` minutes for `0.25h`-step inputs).
- **FR-002**: For each Member × Iteration, the engine MUST derive Team-scheduled Sprint boundaries using F002's `sprint_offset_workdays` (`-1`, `0`, `+1` weekdays), intersect Mon–Fri weekdays with the Member's `member_team_assignments` (`start_date`..`end_date`) for that Team, resolve effective Location holidays (company/manual overriding library on the same `(location_id, date)`), and ignore weekend holidays.
- **FR-003**: Unconfirmed holidays (`confirmed = false`) MUST reduce working days immediately (`full` = `1.0` day, `half` = `0.5` day) and be surfaced with an `est.` provisional flag in the calculation breakdown.
- **FR-004**: Active absences (`status = 'active'`) whose `AbsenceType.affects_capacity === true` MUST evaluate `full`, `am`, and `pm` independently per weekday (`full = 1.0`, `am = 0.5`, `pm = 0.5`, so duplicate `am` or duplicate `pm` counts once). Cancelled absences and `affects_capacity = false` records MUST deduct `0`. Combined holiday + absence unavailable time per weekday MUST be capped at `1.0` day (`effectiveAbsence = min(rawAbsence, 1.0 − holidayDeduction)`).
- **FR-005**: Only Members with `role === 'Team member'` MUST contribute to `team_dev_days`, `team_dev_hours`, and `eligible_fte`. `Admin`, `RTE`, `SM`, and `PO` MUST be excluded from development capacity while remaining distinguishable in team roster metadata.
- **FR-006**: Member development capacity MUST use one single authoritative calculation:
  - `preFteMinutes = max(0, availableMinutes − overheadMinutes)` (exact integer; emits `'over_deducted'` warning if `overheadMinutes > availableMinutes`).
  - Authoritative full-precision Member dev days: `devDaysRaw = (preFteMinutes × fteFactor) / workdayMinutes`.
  - Derived Member dev hours & integer minutes: `devHours = devDaysRaw × hoursPerDay` and `devMinutes = Math.round(devDaysRaw × workdayMinutes)`.
  - Authoritative Team dev days: `teamDevDaysRaw = Σ member.devDaysRaw`, `forecastSpRaw = teamDevDaysRaw × resolvedNv`.
- **FR-007**: System MUST persist `deduction_mode` (`'fixed_days' | 'percent'`, default `'fixed_days'`) and `seed_normalized_velocity` (nullable double `0..1000`) on `teams`, constrain `teams.hours_per_day` to `[1.0, 24.0]` step `0.5`, and persist Team-scoped `overhead_deductions` keyed uniquely by `(member_id, team_id, iteration_id, category_id)` (`R2`, `R5`) with `deducted_hours` (`0..744` in `0.25h` steps, `R6`) and `source` (`'pi_plan' | 'sprint_adjusted'`, default `'pi_plan'`). No separate team-level overhead-category default table may be created. Updating `teams.hours_per_day` MUST leave `deducted_hours` untouched (`R6`).
- **FR-008**: System MUST support both Team-scoped bulk-applying PI overhead deductions across all Iterations of the selected PI (`mode` MUST match `teams.deduction_mode`, `409` otherwise; unlisted categories left untouched; `fixed_days` `0..31` prorated by `assignedWeekdays / sprintScheduledWeekdays` and snapped independently per Team to `0.25h` halves-up; `percent` `0..100` one-off conversion against assigned available hours snapped to `0.25h` halves-up) and editing individual `(member_id, team_id, iteration_id, category_id)` deductions (`deductedHours` `0..744` step `0.25`). In `percent` bulk mode, if any Member × Iteration's snapped computed `deductedHours` exceeds `744h`, the system MUST validate before writing and atomically reject the entire request (`400 VALIDATION_ERROR`, naming the Member and Iteration in `details`) with zero rows written and existing deductions untouched. Writes MUST reject non-overhead categories, archived categories, foreign-ART categories, archived ART/Team/PI/Member (`409 CONFLICT`), and invalid/off-step/out-of-bounds values (`400 VALIDATION_ERROR`) with zero partial mutations.
- **FR-009**: System MUST persist Team-specific PI velocity overrides in `team_pi_velocity_overrides` keyed uniquely by `(team_id, pi_id)` with `velocity` (`0..1000`), validating same-ART membership and active ART/Team/PI on write (`409 CONFLICT` otherwise).
- **FR-010**: Velocity resolution in the pure engine MUST follow `sprint_override ?? pi_override ?? rolling_nv ?? team_seed`:
  - `rolling_nv` sums completed development SP divided by sum of actual development days over the last 4 completed Sprints (including both `development` and `ip` iterations; using `< 4` if fewer exist).
  - If `0` completed Sprints or `Σ actual_dev_days === 0`, fall back to `team_seed`.
  - If `Σ actual_dev_days > 0` and `Σ completed_dev_sp === 0`, return `0.0` (never fall back to `team_seed`).
  - Output MUST include explicit provenance (`source`, `value`, `sprintCountUsed`, `totalCompletedSp`, `totalActualDevDays`).
- **FR-011**: Forecast SP and Category Budget presentation MUST follow `A5`: per-Iteration `forecast_sp_display = Math.round(team_dev_days × resolved_nv)`; `pi_forecast_sp_display = Σ iteration_forecast_sp_display`; per-Iteration `category_budget_display` computed via exact integer largest-remainder rounding (`forecast_sp_display × effective_pct` divmod `100`, ties broken by `sort_order` ascending then `categoryId` ascending) summing to `forecast_sp_display`; `pi_category_budget_display = Σ iteration_category_budget_display`. Full-precision raw values MUST remain available on the engine output.
- **FR-012**: Pure engine MUST expose `calculateLoad(plannedSp, forecastSp, thresholds?)` computing `plannedSp / forecastSp × 100` (with safe handling when `forecastSp === 0`) and classifying against configurable thresholds defaulting to `< 85%` (`amber`), `85–115%` (`green`), and `> 115%` (`red`).
- **FR-013**: `/capacity` MUST implement the v2 prototype layout (`Capacity.dc.html` / `03-capacity-planner.png`) at `1440px` baseline with approved deviations `D1`–`D8`, exact KPI labels (`R7`), pre-FTE expanded cells/inputs/footers (`R8`), and URL-only `?teamId=<uuid>&piId=<uuid>` support for archived ART/Team/PI read-only inspection (`readOnly = trainArchived || teamArchived || piArchived`, `m13`).
- **FR-014**: F002 delete guards (`deleteTeam`, `deleteMember`, `deletePi`, `deleteIteration`) and F003 `listCategories`/`deleteCategory`/`updateCategory` (`kind`-change) guards MUST accurately detect references in `overhead_deductions` (including `team_id`) and `team_pi_velocity_overrides` and return `409 CONFLICT` with clear messages naming the referencing capacity records.
- **FR-015**: All F004 API inputs, query params, and payloads MUST be validated via strict Zod schemas (rejecting unknown fields and never accepting actor identifiers from HTTP bodies). F004 Drizzle migration (`0003_capacity_engine_planner.sql`) MUST snap any non-conforming F002 `hours_per_day` rows safely, upgrade F003 databases cleanly with `APP_VERSION = '0.4.0'`, and preserve CLI `db:backup`/`db:restore` round-trips.

### Measurable Success Criteria

- **SC-001**: 100% of capacity domain invariants and golden test scenarios (canonical `Palawan` / `PI-2027.1` Baseline and Adjusted worked examples with `GW = 8h`, `Tr = 4h` and pinned category budgets `149 / 40 / 38 / 21 / 20`, ±1 offsets, multi-location holidays, unconfirmed `est.` holidays, duplicate AM/PM & holiday overlap non-double-counting, dated assignments & mid-Sprint Team transfers with independently `0.25h`-snapped prorated deductions `3.25h` / `4.75h`, `Team member`-only eligibility, FTE-after-overhead including `0.33` FTE, `hours_per_day` change leaving `deducted_hours` fixed, negative clamping, `fixed_days` & `percent` bulk/individual deductions, full NV resolution chain, zero-denominator vs. genuine `0.0` NV, integer largest-remainder tie-breaking, invalid F003 allocation, and load bands) pass in Vitest unit and integration suites.
- **SC-002**: Upgrading an existing F003 database with F004 migrations preserves 100% of existing F001–F003 records, and CLI `db:backup` → `db:restore` (`--from` / `--to`) into a separate destination recovers 100% of F004 `overhead_deductions`, `team_pi_velocity_overrides`, and `teams` capacity fields with `APP_VERSION = '0.4.0'`.
- **SC-003**: End-to-end Playwright workflows on `/capacity` (Team/PI switching, deduction mode toggle, `hours_per_day` update keeping `deducted_hours` fixed, bulk-applying and individually adjusting Team-scoped overhead deductions with `0.25h` snapping, setting/clearing seed NV and PI velocity override, inspecting calculation breakdowns including `max(0, Days − Leaves − deductions) × FTE = Dev` (with an explicit `→ clamped to 0` step alongside `'over_deducted'` when over-deducted), verifying invalid F003 allocation warning, opening archived Team/PI via URL query params in read-only mode & clearing via header/button, and navigating to `/calendar` and `/organization`) pass with reload persistence and zero external network requests.
- **SC-004**: `/capacity` passes visual geometry checks (`tests/visual/capacity-planner.spec.ts`) and `@axe-core/playwright` zero-violation accessibility checks across `1440px`, `1024px`, and `768px`.
- **SC-005**: All quality gates (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`) exit `0`, and all affected living documentation files are updated.

---

## Edge Cases

- **Overlapping holidays, absences & weekends (`A4`, `m3`)**:
  - Weekend date (Sat/Sun): neither holidays nor absences deduct working days (`0` working day, `0` deduction).
  - Active capacity-affecting absences evaluate `full`, `am`, and `pm` independently per weekday: duplicate `am` records count once (`0.5` day), duplicate `pm` records count once (`0.5` day), `am` + `pm` count as `1.0` day.
  - Full-day holiday + any absence on the same weekday: effective unavailable time = `1.0` day (`holiday = 1.0`, `effectiveAbsence = 0`).
  - Half-day holiday + full-day absence on the same weekday: effective unavailable time = `1.0` day (`holiday = 0.5`, `effectiveAbsence = 0.5`).
  - Half-day holiday + `am` or `pm` absence on the same weekday: effective unavailable time = `1.0` day (`holiday = 0.5`, `effectiveAbsence = 0.5`).
- **Unconfirmed holidays (`confirmed = false`, `A4`)**:
  - Deducted immediately from working days (`1.0` or `0.5`), flagged as `est.` in both engine output and UI cell/tooltip breakdowns.
- **Mid-Sprint dated Team membership & transfers (`A4`, `R2`, `R6`)**:
  - A Member joining, leaving, or transferring mid-Sprint only accrues working days, holidays, absences, and `overhead_deductions` on Team A for weekdays inside `[max(sprintStart, assignmentStart), min(sprintEnd, assignmentEnd)]`.
  - Fixed-day bulk apply prorates by `assignedWeekdays / sprintScheduledWeekdays` per Team and snaps each Team's share independently to `0.25h` (halves up): e.g., `4/10 × 8h = 3.2h → 3.25h` on Team A, `6/10 × 8h = 4.8h → 4.75h` on Team B.
  - Bulk apply and individual edits on Team A never read, overwrite, or delete Team B's `overhead_deductions`.
  - PI-level `eligibleFte` uses the scheduled-weekday-weighted average across Iterations (`Σ (fteFactor × assignedWeekdaysInPi) / totalPiScheduledWeekdays`), with per-Iteration `eligibleFte` exposed on each Iteration summary (`m8`).
- **Archived Members & Past/Closed PIs**:
  - Bulk apply targets only active `Team member`s assigned to the Team.
  - An archived Member (`record_status = 'archived'`) with a dated `member_team_assignments` row overlapping an Iteration is counted **only in Iterations that ended before `today`** (`scheduledEndDate < today`, using the Team's scheduled end date and injectable `OrganizationOptions.today`, consistent with `NOW`). In **current and future Iterations** (`scheduledEndDate >= today`), archived Members are excluded from capacity calculations and listed as **`Archived`** (`exclusionReason: 'archived'`) in the excluded-members disclosure. F002 stays unchanged. Individual deduction writes targeting an archived Member are rejected (`409 CONFLICT`).
  - The disclosure lists the assigned Iterations excluded for the reported reason (`excludedIterationIds`), including for archived Members who still contribute in past Iterations. The PI excluded-member count includes only Members with no eligible Iteration.
  - Active PIs (`record_status = 'active'`) remain editable in F004 regardless of `lifecycle_status` (`planning`, `in_progress`, `closed`) until F012/F015 introduces immutable commitments and Sprint Closure.
- **Role eligibility (`A4`)**:
  - `PO`, `SM`, `Admin`, and `RTE` contribute `0` dev days and `0` eligible FTE even if assigned to the Team.
  - If a Team has `0` eligible `Team member`s for a PI, `team_dev_days = 0`, `eligible_fte = 0`, `forecast_sp = 0`, and `/capacity` shows a clear empty-roster notice.
- **Over-deduction / negative clamping (`A4`, `R9`)**:
  - When a Member's `overhead_deductions` exceed their `available_minutes` in an Iteration, `preFteMinutes` clamps to `0` (never negative) and emits `'over_deducted'`. This is the sole capacity warning for overhead. The breakdown popover displays `max(0, Days − Leaves − deductions) × FTE = Dev` and explicitly shows the `→ clamped to 0` step alongside the `'over_deducted'` warning so a negative subtotal is never shown next to `Dev = 0` unexplained.
- **Percent bulk apply exceeding `744h` cap**:
  - Because F002 allows Iterations of arbitrary duration, `POST /api/capacity/overhead-deductions/bulk` in `percent` mode computes and validates all Member × Iteration snapped `deductedHours` before writing. If any row exceeds `744h` (e.g., 32 available weekdays × `24h/day` × `100%` = `768h`), the entire request is rejected atomically (`400 VALIDATION_ERROR`, naming the Member and Iteration in `details`) with zero rows written and existing deductions untouched.
- **`hours_per_day` bounds & fixed-hour deductions (`R6`, `M2`)**:
  - `hours_per_day` is restricted to `[1.0, 24.0]` in `0.5`-hour steps (`0.001` and `7.25` rejected with `400 VALIDATION_ERROR`).
  - Updating `hours_per_day` leaves `deducted_hours` unchanged (`8h` stays `8h`); derived day equivalents, dev days, and Forecast SP recalculate predictably.
- **Snapping & Percent mode one-off semantics (`R6`, `m5`)**:
  - Inline day edits convert `days × hours_per_day` and snap to nearest `0.25h` (halves up), then display the snapped day value (e.g., `0.1d` at `8h` → `0.75h` → `0.09d`).
  - Bulk-applying in `percent` mode computes fixed `deducted_hours` (snapped to `0.25h`) from current available hours; later holiday/absence edits do not auto-recompute persisted deductions.
- **Velocity edge cases (`A3`)**:
  - No completed Sprints, `seed_normalized_velocity = null`, no PI override: NV status is `'unset'`, Forecast SP and Category Budgets display `—`.
  - `Σ actual_dev_days === 0`: fall back to `seed_normalized_velocity` (never divide by zero / `NaN`).
  - `Σ actual_dev_days > 0` and `Σ completed_dev_sp === 0`: genuine `0.0` NV (does not fall back to seed).
  - Explicit `0` PI override or `0` seed NV: valid (`0..1000`), produces `0` Forecast SP.
- **Largest-remainder rounding & tie-breaking (`A5`, `m2`)**:
  - Exact integer arithmetic (`numerator = forecastSpDisplay × effectivePct`, `floor = floor(numerator / 100)`, `remainder = numerator % 100`); equal remainders break ties by `sort_order` ascending, then `categoryId` ascending.
- **Invalid or unconfigured F003 allocation**:
  - `0` active development categories (`not_configured`) or effective total `!== 100%` (`invalid` / `hasDriftWarning`): Team Allocation displays the exact warning and link to `/organization`, never displays `Total 100% ✓`.
- **Displayed load calculation**:
  - Use the Forecast SP or Category Budget SP displayed for the same scope as the planned SP. Use the same denominator for the percentage and band. Keep raw forecasts and budgets at full precision.
  - `forecast_sp === 0 && planned_sp === 0` → `load_pct = null, band = 'none'`; `forecast_sp === 0 && planned_sp > 0` → `load_pct = null, band = 'red'`.
- **Archived ART / Team / PI read-only inspection (`m7`, `m13`)**:
  - URL-only in F004 (`/capacity?teamId=<uuid>&piId=<uuid>`): URL params take precedence over the header selector; header keeps its active selection; page renders a read-only banner with `"Return to active selection"` (clearing URL params) and disabled mutations; changing the header selector clears the URL params.
  - Invalid deep links: If the URL params are incomplete (only one of `teamId` / `piId`), are not valid UUIDs, reference an unknown Team or PI, or name a Team and PI from different ARTs, `/capacity` ignores them, clears them (`router.replace('/capacity')`), keeps the floating header's current selection, and shows a dismissible notice (`"Link could not be opened — showing current selection"`).

---

## Data Considerations

### 1. Persistence Conventions & Constitution Principle III

- All schema changes live in local PGlite managed by Drizzle ORM (`src/persistence/migrations/0003_capacity_engine_planner.sql` + updated journal & snapshot), using F001's `auditColumns()` (UUIDv4 `text` IDs, UTC `created_at`/`updated_at`, `created_by`/`updated_by` defaulting to `'local:sm'`, never accepted from HTTP bodies) and `ON DELETE RESTRICT` on all foreign keys.
- All persisted overhead deductions use **hours in `0.25h` steps** (`deducted_hours double precision`, `0..744`, exact binary floats, `R6`).
- **Constitution Principle III compliance**: F004 adds **only** operational capacity settings (`teams.deduction_mode`, `teams.seed_normalized_velocity`), working-plan Team-scoped overhead deductions (`overhead_deductions`), and working-plan Team/PI velocity overrides (`team_pi_velocity_overrides`). It creates **zero** `PlanVersion`, `PICommitment`, `SprintCommitment`, `SprintClosure`/`Actuals`, `OverheadTicket`, or `StateChange` records.

### 2. Core Entities (Aligned with Data Model v0.6 + R2/R5/R6)

| Conceptual Entity | Table & Key Fields | Key Invariants |
|---|---|---|
| **Team (`teams`, F002 extended)** | Existing F002 fields (`id`, `train_id`, `name`, `hours_per_day`, `sprint_offset_workdays`, `record_status`, audit) + `deduction_mode` (`'fixed_days' \| 'percent'`, default `'fixed_days'`, NOT NULL) + `seed_normalized_velocity` (`doublePrecision`, nullable, `0..1000`) | `hours_per_day >= 1 AND <= 24 AND (hours_per_day * 2) = floor(hours_per_day * 2)`; `deduction_mode IN ('fixed_days', 'percent')`; `seed_normalized_velocity IS NULL OR (seed_normalized_velocity >= 0 AND <= 1000)`. |
| **OverheadDeduction (`overhead_deductions`, new)** | `id`, `member_id` (FK → `members.id`), `team_id` (FK → `teams.id`), `iteration_id` (FK → `iterations.id`), `category_id` (FK → `categories.id`), `deducted_hours` (`doublePrecision`, `0..744`, step `0.25`), `source` (`'pi_plan' \| 'sprint_adjusted'`, default `'pi_plan'`), audit columns — all FKs `ON DELETE RESTRICT` | Unique `(member_id, team_id, iteration_id, category_id)` (`R2`, `R5`); `CHECK (deducted_hours >= 0 AND deducted_hours <= 744 AND deducted_hours * 4 = floor(deducted_hours * 4))` (`R6`); Category must be active `overhead` in Team's ART on write; Member must be active `Team member` assigned to `team_id` overlapping Iteration on write. |
| **TeamPiVelocityOverride (`team_pi_velocity_overrides`, new)** | `id`, `team_id` (FK → `teams.id`), `pi_id` (FK → `pis.id`), `velocity` (`doublePrecision`, `0..1000`), audit columns — all FKs `ON DELETE RESTRICT` | Unique `(team_id, pi_id)`; Team and PI must share the same `train_id` and ART/Team/PI must be `active` on write. |
| **Existing F002 / F003 Tables (read-only inputs)** | `trains`, `members`, `member_team_assignments`, `pis`, `iterations`, `locations`, `holidays`, `absence_types`, `absences`, `categories`, `team_category_allocations` | Consumed by F004 services; delete/kind-change guards updated (`FR-014`) to protect F004 references cleanly. |

### 3. Canonical Golden Worked-Example Reference (`Palawan` · `PI-2027.1`)

Used as the single canonical deterministic fixture (`AC14`, `m1`, `m2`, `R6`, `AZUSA_HANDOFF.md` §8 & `Capacity.dc.html`):

- **Team**: `Palawan` (`hours_per_day = 8.0`, `sprint_offset_workdays = 0`, `deduction_mode = 'fixed_days'`, `seed_normalized_velocity = 0.92`).
- **Iterations** (5 × 10-weekday Sprints): `2702` (`2027-01-04`..`2027-01-15`), `2704` (`2027-01-18`..`2027-01-29`), `2706` (`2027-02-01`..`2027-02-12`), `2708` (`2027-02-15`..`2027-02-26`), `2710 · IP` (`2027-03-01`..`2027-03-12`).
- **Eligible Roster** (8 `Team member`s = `7.5` FTE; `SM` & `PO` excluded): Andrea Santos (`PH`, `1.0`), Ben Cruz (`PH`, `1.0`), Carlo Reyes (`SG`, `1.0`), Dana Lim (`AU-WA`, `1.0`), Enzo Garcia (`IN`, `1.0`), Faye Tan (`UK`, `1.0`), Gio Mendoza (`US-TX`, `1.0`), Hana Villanueva (`PH`, `0.5`).
- **Dated Weekday Holidays**: `PH` `2027-02-25` (EDSA, confirmed); `SG` `2027-02-08` (CNY in lieu, confirmed) & `2027-03-10` (Hari Raya Puasa, `confirmed: false` `est.`); `AU-WA` `2027-01-26` (Australia Day, confirmed) & `2027-03-01` (Labour Day, confirmed); `IN` `2027-01-26` (Republic Day, confirmed); `UK` none; `US-TX` `2027-01-18` (MLK Day, confirmed) & `2027-02-15` (Presidents' Day, confirmed).
- **Dated Active Capacity-Affecting Absences** (all on non-holiday weekdays): Andrea `2027-01-19..20` (`AL`), `2027-03-02` (`AL`); Ben `2027-01-06` (`AL`), `2027-02-16..18` (`AL`); Carlo `2027-02-04..05` (`AL`); Enzo `2027-01-07..08` (`AL`), `2027-02-09` (`SL`); Faye `2027-02-19` (`AL`); Gio `2027-01-20..22` (`AL`), `2027-03-04..05` (`AL`); Dana & Hana none.
- **Scenario 1 — Baseline** (`General work = 8h` / `1.0d`, `Training = 4h` / `0.5d` per eligible Member per Sprint at `8h/day`):
  - Sprint dev days: `60.75` (`2702`), `55.75` (`2704`), `59.75` (`2706`), `56.25` (`2708`), `58.75` (`2710 · IP`) → **PI total `291.25`** (displayed `291.3`).
  - Displayed Forecast SP (`× 0.92`): `56`, `51`, `55`, `52`, `54` → **PI total `268 SP`** (raw `267.95`).
  - Pinned Category Budgets (`56% / 15% / 14% / 8% / 7%` in `sort_order 0..4`):
    - `2702` (`56 SP`): `31 / 8 / 8 / 5 / 4`
    - `2704` (`51 SP`): `28 / 8 / 7 / 4 / 4`
    - `2706` (`55 SP`): `31 / 8 / 8 / 4 / 4`
    - `2708` (`52 SP`): `29 / 8 / 7 / 4 / 4`
    - `2710 · IP` (`54 SP`): `30 / 8 / 8 / 4 / 4`
    - **PI totals (`268 SP`)**: Feature `149`, SW maintenance `40`, Enablers `38`, Estimations `21`, Technical debt `20`.
- **Scenario 2 — Adjusted** (Carlo's `2706` `General work` deduction adjusted to `4h` / `0.5d`):
  - Sprint `2706` dev days = **`60.25`** (displayed `60.3`), PI total = **`291.75`** (displayed `291.8`).
  - Sprint `2706` Forecast SP = `Math.round(60.25 × 0.92) = 55 SP` (PI displayed total `268 SP`, raw `268.41`).
