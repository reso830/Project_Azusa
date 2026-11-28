# Technical Research & Decisions: Team Calendar & Availability (F005)

**Branch**: `005-team-calendar-availability` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

---

## 1. Reconciling F004 Capacity Engine with F005 Post-FTE Clock-Time Events (`A2`, `A3`)

- **Context**: F004's pure engine (`src/domain/capacity/engine.ts`) computes `preFteMinutes = max(0, availableMinutes − overheadMinutes)` and `devDaysRaw = (preFteMinutes × fteFactor) / workdayMinutes`. `LeaveCalendar.dc.html` scaled ceremonies and meetings by FTE (`dedOn * fte`) and omitted Sprint-level `OverheadDeduction`.
- **Decision (`A2`, `A3`)**:
  - Preserve F004's pre-FTE Sprint-level overhead deduction: `postFteMinutes = max(0, availableMinutes − overheadMinutes) × fteFactor`.
  - Apply ceremonies (including `is_recurring_daily = true` stand-up) and attended meetings as **actual clock-time deductions AFTER FTE scaling** (never multiplied by `fteFactor`).
  - Evaluate per-day event deductions on each assigned weekday with `availableDayMinutes > 0` (`effectiveDayEvents = min(availableDayMinutes × fteFactor, dayCeremonyMinutes + dayMeetingMinutes)`), ensuring full-day leave/holiday on an event day removes that day's event deduction and an over-booked day clamps at `0` rather than stealing hours from other days.
  - Add planned overtime (`overtimeMinutes`, canonical integer minutes in 15-min steps, allowed on weekdays, weekends, and holidays) **AFTER FTE scaling**.
  - Final reconciled Sprint formula: `devMinutesRaw = max(0, postFteMinutes − Σ effectiveDayEvents) + overtimeMinutes`.
  - **Reconciliation caveat**: `Σ dailyCalendarDevHours − (Overhead × FTE) = Sprint Dev h` holds when a Member is not clamped by pre-FTE overhead (`available >= overhead`) or Sprint-level event clamping; when clamped, the exact formula `max(0, max(0, available − overhead) × FTE − effectiveEvents) + overtime` governs and is surfaced in both the Team Calendar row/Team tooltips and `/capacity`'s updated `BreakdownPopover`.
  - **Separate warning codes**: `'over_deducted'` remains strictly for Sprint-level overhead exceeding available time; `'events_exceed_day'` flags single-day event clamping; `'events_exceed_sprint'` flags Sprint-level event clamping.
  - When `ceremonies`, `meetings`, and `overtime` are empty (e.g., immediately upon F004→F005 upgrade), this reduces **identically** to F004's existing formula, keeping 100% of F004 golden fixtures unchanged. Once ceremonies or meetings are recorded, `/capacity` dev days and Forecast SP decrease accordingly (intended per `domain-model.md`).
  - Both `/calendar` and `/capacity` invoke the same engine with the same DB inputs so numbers never drift between screens.

---

## 2. Dedicated `planned_overtime` Table vs. Overloading `absences.extra_hours` (`A3`)

- **Context**: F002's `absences` table has a nullable `doublePrecision` column `extra_hours` alongside `NOT NULL` `absence_type_id` and overlap checks for active absences.
- **Decision**: Add a dedicated `planned_overtime` table storing canonical integer `duration_minutes` (`> 0`, `<= 1440`, `% 15 = 0`) keyed uniquely by `(member_id, date)`.
- **Rationale**:
  1. Satisfies `A3` requirement #3 ("Store durations as integer minutes") and #6 ("Keep overtime separately identifiable from normal working capacity").
  2. Allows planned overtime to coexist cleanly with an active full-day absence on the same date (triggering `A3`'s non-blocking advisory warning) without mutating `absences.absence_type_id` to nullable or inventing a synthetic `AbsenceType`.
  3. Eliminates dual-source ambiguity by updating F002's `CreateAbsenceSchema` to reject non-null `extraHours` (`400 VALIDATION_ERROR`) while leaving the legacy nullable `absences.extra_hours` SQL column and any existing values untouched as unused legacy data with no migration or conversion (documented in `data-dictionary.md` and ADR `0005`; **approved by operator `2026-11-29`** as an accepted departure from Brief §2.9).

---

## 3. Library Holiday Edit-to-Override & Suppression Identity (`A4`)

- **Context**: `holidays` already enforces `holidays_library_identity_unique (location_id, date, name) WHERE source = 'library'`, and F002's `resolveEffectiveLocationHolidays` suppresses library rows only when a `company`/`manual` row shares the exact same `(location_id, date)`.
- **Problem**: If an operator edits an unconfirmed Islamic `library` holiday (`2027-03-10`, `Hari Raya Puasa`) to confirm its actual date as `2027-03-11`, same-date suppression alone would leave `2027-03-10` active on the next refresh. Similarly, explicitly deleting a library holiday would be undone by the next refresh unless tracked.
- **Decision**:
  - Define canonical `librarySourceKey = "${date}|${name.trim().toLowerCase()}"`.
  - Add nullable `holidays.overrides_library_key` (populated on `source = 'manual'` overrides created from editing a `library` row, with partial unique index `(location_id, overrides_library_key)`).
  - Add `holiday_suppressions` (`location_id`, `library_source_key`, `original_date`, `original_name`, unique `(location_id, library_source_key)`) for explicitly removed library holidays.
  - Extend `resolveEffectiveLocationHolidays` to suppress any `library` row whose key matches a `manual` override's `overrides_library_key` OR a `holiday_suppressions` entry (in addition to same-date `company`/`manual` precedence).
  - **Load-then-resolve order (`R2`)**: Services load holidays matching either `(date BETWEEN start AND end)` OR `(overrides_library_key IS NOT NULL AND left(overrides_library_key, 10) BETWEEN start AND end)` plus `holiday_suppressions` for `original_date BETWEEN start AND end`, and `engine.ts` runs `resolveEffectiveLocationHolidays` **before** filtering to `assignedSet.has(date)` so a library holiday moved across a Sprint or PI boundary is suppressed in its original window.
  - **Complete lifecycle**: `PATCH` on a library row that already has a manual override returns `409 CONFLICT`; `DELETE` on a manual override reverts to the library holiday unless `?suppressLibrary=true` (which removes and suppresses it); `DELETE` on a library row deletes any linked manual override and inserts a suppression; `DELETE /api/calendar/holidays/suppressions/[id]` restores a suppressed library holiday.
  - During `POST /api/calendar/holidays/refresh`, delete/re-insert only `source = 'library'` rows for the selected Location(s) and year (respecting `library_seed_cutoff_date`), **retaining suppressed library rows in storage** (filtered out by `resolveEffectiveLocationHolidays` on every read) so `DELETE /api/calendar/holidays/suppressions/[id]` immediately restores a suppressed holiday even after any number of refreshes, while leaving all `company`, `manual`, and `holiday_suppressions` rows untouched.

---

## 4. Floating Header Sprint Picker & Provisional Holiday Management Placement (`A4`, `D5`)

- **Header Sprint Picker**: `LeaveCalendar.dc.html` displays `ART › Team › PI › Sprint` in the floating header. Extending `OrganizationContext` with optional `iterationId` state (reconciled to the current Sprint of the selected PI or first Sprint if none is current) and rendering the 4th picker conditionally on sprint-scoped routes (`/calendar`) matches the prototype cleanly and prepares for F013 (`/sprint-planning`) and F014 (`/iteration`) without altering `/capacity` or `/organization`.
- **Provisional Holiday Management (`A4`)**: Mounting the decoupled `HolidayManagementView` component at `/calendar/holidays` (linked from the Holidays card header, omitted from the main navigation menu and profile Settings menu) delivers full holiday operations in M0 while staying trivial to re-mount under Prototype v3's Settings architecture later.

---

## 5. Offline Holiday Refresh & Zero New Dependencies

- `date-holidays` `3.39.2` is already installed and used by `src/persistence/seed.ts`. Exporting its pure year-generation helper allows `holiday-management-service.ts` to refresh library holidays 100% offline with zero external network calls and zero new npm packages.
