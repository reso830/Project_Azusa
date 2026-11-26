# Research & Architectural Decisions: Capacity Engine & Capacity Planner (F004)

**Branch**: `004-capacity-engine-planner` | **Date**: 2026-11-26 (Review Pass 3 — percent bulk >744h atomic 400, breakdown clamp, archived-Member past-iteration rule, active-URL header sync) | **Spec**: [spec.md](./spec.md)

---

## 1. Workday Validation, Fixed-Hour Overhead Deductions (`0.25h` Steps) & Single Conversion (`M2`, `R5`, `R6`)

- **Decision 1 — Persist overhead deductions in hours (`deducted_hours`, `0.25h` steps, `R6`)**:
  - Column: `deducted_hours double precision NOT NULL`, `CHECK (deducted_hours >= 0 AND deducted_hours <= 744 AND deducted_hours * 4 = floor(deducted_hours * 4))` (`744h = 31 days × 24h`). Multiples of `0.25` (`1/4`) are represented with zero rounding error in IEEE-754 binary floating-point.
  - Day value is derived on read: `days = deducted_hours / teams.hours_per_day`.
  - **Hours are fixed, not days.** Changing `teams.hours_per_day` leaves `deducted_hours` untouched (no rescaling, eliminating Pass-2 overflow & drift risks `M3`/`M4`), and changes derived day equivalents, dev days, and Forecast SP predictably (e.g., `8h → 7.5h` keeps `8h` GW at `8h` = `1.0667d`).
- **Decision 2 — Constrain `hours_per_day` to `[1.0, 24.0]` in `0.5`-hour steps (`M2`, `m12`)**:
  - Validated in SQL (`CHECK (hours_per_day >= 1 AND hours_per_day <= 24 AND (hours_per_day * 2) = floor(hours_per_day * 2))`) and `/capacity`'s `PATCH /api/capacity/team-settings` (the sole UI/API place where `hours_per_day` is edited; F002 team schemas do not expose `hoursPerDay`).
  - Migration `0003` snaps any legacy F002 `teams.hours_per_day` rows as a safety net (`GREATEST(1.0, LEAST(24.0, ROUND((hours_per_day * 2)::numeric) / 2.0))`) before adding the tighter constraint.
  - Guarantees `workdayMinutes = Math.round(hoursPerDay * 60)` is always an exact integer multiple of `30` in `[60, 1440]`, half-days are exact integers (`30..720`, step `15`), and `deductedHours * 60` is always an exact integer multiple of `15` minutes — every duration sits cleanly on the `15`-minute / `0.25h` grid.
- **Decision 3 — `0.25h` snapping & single authoritative formula**:
  - `snapToQuarterHour(hours) = Math.floor(hours * 4 + 0.5) / 4` (nearest `0.25h`, halves rounded up).
  - Fixed-days bulk apply: `snapToQuarterHour(days * hoursPerDay * (assignedWeekdays / sprintScheduledWeekdays))`.
  - Percent bulk apply: `snapToQuarterHour(availableHours * pct / 100)`.
  - Inline edits: typed in days → `snapToQuarterHour(days * hoursPerDay)`, and the cell displays the snapped day value (`deductedHours / hoursPerDay`, e.g., `0.1d` at `8h` → `0.8h` → `0.75h` → `0.09d`).
  - Per Member × Iteration inside the pure engine:
    - `workingMinutes`, `holidayMinutes`, `effectiveAbsenceMinutes`, `availableMinutes`, `overheadMinutes = Σ Math.round(deductedHours * 60)`, and `preFteMinutes = Math.max(0, availableMinutes - overheadMinutes)` are all exact integers.
    - **Authoritative Member dev days**: `devDaysRaw = (preFteMinutes * member.fteFactor) / workdayMinutes` (full precision, zero intermediate rounding — handles `0.5`, `0.33`, etc. cleanly).
    - **Derived Member dev hours & integer minutes**: `devHours = devDaysRaw * hoursPerDay`, `devMinutes = Math.round(devDaysRaw * workdayMinutes)`.
    - **Authoritative Team dev days & Forecast SP**: `teamDevDaysRaw = Σ member.devDaysRaw`, `forecastSpRaw = teamDevDaysRaw * resolvedNv`, `forecastSpDisplay = Math.round(forecastSpRaw)`.

---

## 2. Terminology Rename (`R5`), Team-Scoped `OverheadDeduction` (`R2`), & F013 Rework Note (`R9`)

- **Decision (`R5`)**: Rename v0.6's `OverheadReserve` to **`OverheadDeduction`** (`overhead_deductions`) across all code, routes, schemas, and docs. "Reserve" terminology is kept exclusively for Buffers (`F009`/`F013`).
- **Decision (`R2`)**: Add `team_id` (FK → `teams.id`, `ON DELETE RESTRICT`) to `overhead_deductions` with unique key `(member_id, team_id, iteration_id, category_id)` and lookup index `(team_id, iteration_id)`.
- **Rationale**: Supports F002 mid-Sprint transfers without cross-Team collisions. Each Team's prorated fixed-day share is snapped independently to `0.25h` (e.g., `4/10 × 8h = 3.2h → 3.25h` on Team A; `6/10 × 8h = 4.8h → 4.75h` on Team B).
- **Forward note for F013 (`R9`)**: Earlier v0.6 / 2026-11-19 notes described overhead tickets "drawing against" a reserve with a "Tickets exceed reserve" warning. Per `R9`, overhead is purely a pre-FTE capacity deduction; the only warning is planning beyond available capacity (`over_deducted`). F013's overhead-ticket design must be reworked to fit `R9`.
- **ADR `0004`**: Records both the rename from v0.6's `OverheadReserve` and the `team_id` departure, alongside `R6` and `R9`.

---

## 3. Per-Weekday Overlap Capping & Independent AM/PM Halves (`A4`, `m3`)

- **Decision**: Evaluate each Member × Iteration day-by-day across every Mon–Fri weekday inside the Team's offset-adjusted Sprint window (`computeTeamIterationSchedule`) that falls within the Member's `member_team_assignments` for that Team (`startDate <= day <= (endDate ?? '9999-12-31')`).
- **Per-weekday rule**:
  1. Resolve effective Location holiday(s) on `day` via F002's `resolveEffectiveLocationHolidays`: any `full` holiday → `holidayDeduction = 1.0`; else any `half` holiday → `holidayDeduction = 0.5`; else `0`. Track `isEstimated = true` if any contributing effective holiday has `confirmed === false`.
  2. Scan active, capacity-affecting absences on `day` (`status === 'active' && absenceType.affectsCapacity`) tracking three booleans independently: `hasFull`, `hasAm`, `hasPm`.
     - `rawAbsenceDeduction = hasFull ? 1.0 : (hasAm ? 0.5 : 0) + (hasPm ? 0.5 : 0)`.
     - Duplicate `am` or duplicate `pm` records count once (`0.5`); `am + pm` = `1.0`.
  3. Cap combined deduction: `effectiveAbsenceDeduction = Math.min(rawAbsenceDeduction, 1.0 - holidayDeduction)`.
  4. Convert to exact integer minutes via `holidayMinutes = Math.round(holidayDeduction * workdayMinutes)` and `effectiveAbsenceMinutes = Math.round(effectiveAbsenceDeduction * workdayMinutes)`.
- **Future F005 hooks**: `CapacityEngineInput` leaves optional hooks for future F005 ceremonies, meetings, and planned overtime (defaulting to empty/`0` in F004, per `m9` and Brief §6).

---

## 4. Tightening `contributesToDevCapacity` (`A4`)

- **Decision**: Update `contributesToDevCapacity(role)` in `src/domain/organization/roles.ts` from `role !== 'PO' && role !== 'SM'` to `role === 'Team member'` (`Admin`, `RTE`, `SM`, and `PO` excluded), and update the two F002 tests that asserted `Admin`/`RTE` contributed.
- **UI side effect**: `/organization` automatically displays the `"Excluded from dev capacity"` badge for `Admin` and `RTE` Members as well as `SM` and `PO` (noted in `CHANGELOG.md`).

---

## 5. Percent Mode One-Off Conversion, Pre-FTE Table Display & No Adjusted Marker (`m5`, `R4`, `R8`)

- **One-off percent bulk apply (`m5`)**: Bulk-applying in `percent` mode computes fixed `0.25h`-snapped `deducted_hours` from current available hours and writes them to `overhead_deductions`. Later holiday/absence edits do not auto-recompute persisted deductions.
- **Percent bulk `> 744h` guard**: Because F002 permits Iterations of arbitrary duration, `POST /api/capacity/overhead-deductions/bulk` in `percent` mode computes and validates **all** Member × Iteration snapped `deductedHours` before writing any row. If any computed value exceeds `744h` (e.g., 32 available weekdays × `24h/day` × `100%` = `768h`), the entire request is rejected atomically with `400 VALIDATION_ERROR` naming the offending Member and Iteration, writing zero rows and leaving existing deductions untouched.
- **Pre-FTE table display (`R8`)**: Expanded Sprint cells, inline inputs, and overhead footer totals all display **stored values before FTE** (Hana at `0.5` FTE reads `Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25`; Sprint `2702` GW footer = `8` days). No extra `× FTE` column is added; the member subline shows `0.5 FTE` and `BreakdownPopover` shows `max(0, Days − Leaves − deductions) × FTE = Dev` (explicitly displaying the `→ clamped to 0` step alongside `'over_deducted'` when `Days − Leaves − deductions < 0`).
- **No "Adjusted" marker in F004 (`R4`, `D7`)**: Both bulk and individual edits persist `source = 'pi_plan'`. No corner triangle or heuristic flag is rendered in F004; deferred to F013 (`source = 'sprint_adjusted'`).

---

## 6. Normalized Velocity Resolution Chain & Anchor Note (`A3`)

- **Resolution order**: `sprintOverride ?? piOverride ?? rollingNv ?? teamSeed`.
- **Rolling 4-Sprint rule**: Takes up to the 4 most recent completed Sprints (including both `development` and `ip` iterations). `totalCompletedSp / totalActualDevDays` (ratio of sums). Falls back to `teamSeed` when `0` completed Sprints or `totalActualDevDays <= 0`; returns genuine `0.0` when `totalActualDevDays > 0` and `totalCompletedSp === 0`.
- **Anchor date note**: Because completed Sprint Actuals arrive in F015 (`completedSprints: []` in F004), the exact rolling-window anchor date (before PI start vs. before `today`) will be finalized in F015.

---

## 7. Exact Integer Largest-Remainder Category Budgeting & Display Rounding (`A5`, `m2`)

- **PI dev days vs. Forecast SP display**:
  - PI dev days display as the rounded raw sum (`291.25 → 291.3`), even though 1-decimal Sprint dev days (`60.8 + 55.8 + 59.8 + 56.3 + 58.8 = 291.5`) sum differently — matching `AZUSA_HANDOFF.md` §8 and `Capacity.dc.html`.
  - Sprint Forecast SP = `Math.round(forecastSpRaw)`; PI Forecast SP = sum of displayed Sprint Forecast SPs (`56 + 51 + 55 + 52 + 54 = 268 SP`).
- **Exact integer largest-remainder algorithm (zero floats/epsilon)**:
  - For each Sprint with valid `100%` allocation and `forecastSpDisplay !== null`:
    - `numerator = forecastSpDisplay * c.effectivePct` (exact integer)
    - `floorVal = Math.floor(numerator / 100)`
    - `remainder = numerator % 100` (exact integer `0..99`)
  - Distribute `leftover = forecastSpDisplay - Σ floorVal` by sorting categories by `remainder` descending, then **`sortOrder` ascending**, then **`categoryId` ascending**, adding `+1` to the top `leftover` categories.
  - PI Category Budgets = sum of the corresponding Sprint display budgets (`149 / 40 / 38 / 21 / 20 = 268 SP` on the golden dataset).

---

## 8. URL Query Parameter Precedence & Atomic Cross-ART Header Sync (`m13`)

- `/capacity?teamId=<uuid>&piId=<uuid>` is URL-only in F004 (no extra archived picker UI).
- `OrganizationContext` (`src/ui/shell/OrganizationContext.tsx`) exposes a single atomic `setSelection({ teamId, piId })` action that resolves the target Team's `trainId` and validates `piId` against that target Train before updating `{ trainId, teamId, piId }` in one state update (avoiding stale-closure `piId` drops when deep-linking across ARTs).
- If valid URL params point to an **active** ART, Team, and PI, `/capacity` calls `setSelection({ teamId, piId })` and **immediately clears the URL params** (`router.replace('/capacity')`) once synced, so subsequent manual header changes are never pulled back to the linked Team.
- If valid URL params point to an **archived** ART, Team, or PI, URL params take precedence over the floating header context selector; the header continues to show its active selection unchanged while `/capacity` displays a prominent read-only banner (`"Viewing archived <Team> · <PI> (read-only)"`) with a `"Return to active selection"` button that clears the URL params.
- Changing the Team or PI in the floating header clears any remaining URL params (`router.replace('/capacity')`) so the header selection immediately takes effect.
