# Tasks: Team Calendar & Availability (F005)

**Branch**: `005-team-calendar-availability` | **Date**: 2026-11-29 (Review Pass 6 — idempotent repeat-cancel & cancelled-entry popover controls, snapshot-roster baseline for `teamVsPiHours`/`teamVsSprintHours` + missing-Iteration `null` handling)  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/api.md](./contracts/api.md)

## Conventions

- **Status legend**: `[x]` done · `[ ]` pending · `[~]` skipped
- **Parallel marker**: `[P]` indicates tasks touching distinct files with no shared edits that can run in parallel within the same phase
- **Phase dependencies**: `01 → 02 → 03 → 04 → 05 → 06 → 07` (every phase is additive and leaves the test suite and linter green)
- **Verification commands**: `npm run test:run` · `npm run lint` · `npm run format:check` · `npm run typecheck` · `npm run build` · `npm run test:visual` · `npm run test:e2e`

## Phase Summary

| Phase | Focus | Task IDs | User Stories |
|---|---|---|---|
| **Phase 01** | Pure Calendar Domain, Holiday Override Rules, F004 Engine Extensions & Unit Tests | `T001–T004` | `US1, US2, US3, US4, US5` |
| **Phase 02** | Drizzle Schema Extensions, Migration `0004` & Upgrade/CLI-Backup Tests | `T005–T006` | `US2, US3, US5, US6` |
| **Phase 03** | Calendar & Holiday Services, F004 Capacity Integration, F002 Guards & Persistence Tests | `T007–T010` | `US1, US2, US3, US4, US5, US6` |
| **Phase 04** | Local HTTP API Route Handlers (`/api/calendar/*`) & Route Contract Tests | `T011–T014` | `US1, US2, US3, US4, US5` |
| **Phase 05** | `/calendar`, `/capacity` Breakdown Alignment & Provisional `/calendar/holidays` UI, Visual & E2E Suites | `T015–T025` | `US1, US2, US3, US4, US5, US6` |
| **Phase 06** | Release Prep (Version Sync `0.5.0` & Living Documentation) | `T026–T031` | `US6` |
| **Phase 07** | Browser Smoke Test & Post-UAT Roadmap Acceptance | `T032–T038` | `US1, US2, US3, US4, US5, US6` |

---

## Phase 01: Pure Calendar Domain, Holiday Override Rules, F004 Engine Extensions & Unit Tests

**Purpose**: Establish pure TypeScript calendar schemas, grid/legend helpers, override/suppression-aware holiday resolution (`A4`), and extend F004's pure capacity engine (`src/domain/capacity/`) with post-FTE clock-time ceremonies/meetings, post-FTE planned overtime, daily Dev Hours, holiday `devDaysLost`, and optional commitment comparisons (`A1`–`A3`), verified deterministically with Vitest before touching persistence or UI.

- [ ] **T001** `[P]` `[US5]` Implement library holiday identity & override/suppression resolution helpers
  - **Target files/components**: `src/domain/calendar/holiday-overrides.ts`, `src/domain/organization/holidays.ts`
  - **Expected behavior**:
    - Create `makeLibrarySourceKey(date, name)` in `src/domain/calendar/holiday-overrides.ts` returning `"${date}|${name.trim().toLowerCase()}"`.
    - Extend `resolveEffectiveLocationHolidays(rows, suppressedKeys?)` in `src/domain/organization/holidays.ts` so a `library` row is suppressed whenever: (a) its `librarySourceKey` matches any `manual` row's `overridesLibraryKey` for that `locationId` (even if the manual override moved the holiday to a different date), (b) its `librarySourceKey` appears in `suppressedKeys` for that `locationId`, or (c) a `company` or `manual` row exists on the same `(locationId, date)` (preserving existing F002 precedence).
  - **Constraints**: Pure TypeScript only; backward compatible when `suppressedKeys` and `overridesLibraryKey` are omitted so existing F002/F004 callers remain green.
  - **Validation/test location**: `tests/unit/calendar-domain.test.ts` (`T004`) and existing F002/F004 unit tests via `npm run test:run`.
  - **Out-of-scope files/components**: Persistence schemas (`Phase 02`), `date-holidays` seeding (`Phase 03`).

- [ ] **T002** `[P]` `[US1, US2, US3, US5]` Create strict Zod v4 calendar schemas (and deprecate F002 `extraHours`) + pure Sprint grid & dynamic legend builders
  - **Target files/components**: `src/domain/calendar/schemas.ts`, `src/domain/calendar/grid.ts`, `src/domain/organization/schemas.ts`
  - **Expected behavior**:
    - `schemas.ts`: Define `.strict()` Zod v4 schemas matching `specs/005-team-calendar-availability/contracts/api.md`: `CalendarViewQuerySchema`, `CreateCalendarAbsenceSchema` (required ISO weekday date — rejects floating/undated leave and Sat/Sun), `UpdateCalendarAbsenceSchema` (at least one field; supports `status: 'active' | 'cancelled'`; **rejects `status: 'cancelled'` combined with `date`, `absenceTypeId`, `portion`, or `planned` fields** per `R5`), `UpsertPlannedOvertimeSchema` (`durationMinutes` integer `15..1440`, `% 15 === 0`), `DeletePlannedOvertimeQuerySchema`, `CreateCeremonySchema` (enforcing `isRecurringDaily === true => date === null`, `isRecurringDaily === false => date` ISO weekday, `durationMinutes` `15..1440` `% 15 === 0`), `UpdateCeremonySchema`, `CreateMeetingSchema` (weekday `date`, `wholeTeam === true => empty/omitted attendeeMemberIds`, `wholeTeam === false => non-empty unique attendeeMemberIds`), `UpdateMeetingSchema`, `CreateMilestoneSchema`, `UpdateMilestoneSchema`, `AnnualHolidaysQuerySchema` (`year` `2000..2100`), `CreateOperationalHolidaySchema`, `UpdateOperationalHolidaySchema`, `DeleteHolidayQuerySchema` (optional `suppressLibrary` boolean), and `RefreshHolidaysSchema`.
    - `src/domain/organization/schemas.ts`: Update `CreateAbsenceSchema` to reject non-null `extraHours` (`400 VALIDATION_ERROR` pointing callers to `/api/calendar/overtime`) so `planned_overtime` is the sole source of truth (`R1`).
    - `grid.ts`: Export pure `buildSprintCalendarDays(schedule, nextScheduleStartDate, today)` computing the contiguous Sprint calendar window `[calendarStartDate .. calendarEndDate]` (extending Friday `scheduledEndDate` through Sunday `+2` days clipped before `nextScheduleStartDate` so `offset = 0`, `-1`, and `+1` have zero gap weekends per `R4`), exact per-ISO-week `CW##` span counts (`grid-column: span <count>`), month-boundary divider flags (`isMonthBoundary`), weekend flags, **`weeksCount = Math.ceil(scheduledWeekdays / 5)`** (Sprint working-week length, separate from `isoWeeks.length`), and `compact: weeksCount >= 4` (keeping normal-width columns for a `±1`-shifted 3-week Sprint spanning 4 `CW##` bands per `R7`); export pure `buildDynamicCalendarKey(absenceTypes)` deriving legend entries dynamically from F002's `AbsenceType[]` + Planned Overtime + Cancelled + calendar markers (`A5`, `D2`).
  - **Constraints**: Pure TypeScript + `zod` only; zero hardcoded absence-type enums (`AL`/`SL`/etc. read from catalog); reject unknown keys and actor fields.
  - **Validation/test location**: `tests/unit/calendar-domain.test.ts` (`T004`) and `tests/unit/organization-roles-schemas.test.ts`.
  - **Out-of-scope files/components**: API Route Handlers (`Phase 04`), React UI (`Phase 05`).

- [ ] **T003** `[US1, US4, US5]` Extend pure F004 capacity engine for post-FTE ceremonies/meetings, post-FTE planned overtime, daily Dev Hours, holiday `devDaysLost`, and optional commitment comparisons
  - **Target files/components**: `src/domain/capacity/types.ts`, `src/domain/capacity/engine.ts`
  - **Expected behavior**:
    - In `types.ts`: **Remove** the unused F004 `futureAvailability` placeholder and add unified top-level optional fields on `CapacityEngineInput`: `ceremonies?`, `meetings?`, `plannedOvertime?`, `suppressedHolidayKeys?`, and `commitments?: { pi?: { committedAt: string; byIteration: ReadonlyMap<string, ReadonlyMap<string, number>> }; sprint?: { committedAt: string; byIteration: ReadonlyMap<string, ReadonlyMap<string, number>> } }` (per-Iteration, per-Member committed integer minutes). Add `overridesLibraryKey?: string | null` to the engine's `Holiday` type. Add distinct warning codes (`'over_deducted' | 'events_exceed_day' | 'events_exceed_sprint'`) and expose `calendarEventMinutes`, `calendarEventDaysRaw`, `overtimeMinutes`, `overtimeDaysRaw`, and `hasEventsWarning` on `MemberIterationBreakdown` (`R3`).
    - In `engine.ts`:
      1. **Resolve-then-filter holidays (`R2`)**: Call `resolveEffectiveLocationHolidays(locationHolidays, locationSuppressedKeys)` **before** filtering to `assignedSet.has(date)` so a manual override moved outside the Sprint or PI suppresses its original library row.
      2. `availableMinutes` and `preFteMinutes = max(0, availableMinutes - overheadMinutes)` remain bit-for-bit identical to F004 when ceremonies/meetings/overtime are empty (`'over_deducted'` emitted strictly for overhead clamping).
      3. `postFteMinutes = preFteMinutes * fteFactor`.
      4. On each assigned weekday where `availableDayMinutes > 0`, sum applicable ceremonies (`isRecurringDaily` + dated ceremonies inside the scheduled window) and attended meetings (`wholeTeam` or `memberId` in `attendeeMemberIds`), cap daily effective event deduction at `availableDayMinutes * fteFactor` (emitting `'events_exceed_day'` if events exceed day capacity), and apply **after** FTE scaling (`A1`, `A2`, `R3`). Full-day leave or full-day holiday on an event date yields `0` event deduction for that Member on that date.
      5. Add `overtimeMinutes` (sum of Member's `plannedOvertime` on dates within the Sprint's contiguous calendar window `[calendarStartDate .. calendarEndDate]` while assigned to the Team, including weekends and holidays) **after** FTE scaling (`A3`, `R4`).
      6. Reconciled Sprint capacity: `netDevMinutesBeforeOvertime = max(0, postFteMinutes - effectiveCalendarEventMinutes)` (emitting `'events_exceed_sprint'` if clamped), `devMinutesRaw = netDevMinutesBeforeOvertime + overtimeMinutes`, `devDaysRaw = devMinutesRaw / workdayMinutes`, `devHours = devMinutesRaw / 60`.
      7. Export `calculateTeamSprintCalendarCapacity(...)` returning per-Member `dailyCells` (`devMinutes: null, devHours: null` and `sprintDevHours: null` for non-dev roles), separate `sprintOverheadHours` / `sprintOverheadPostFteHours`, reconciled `sprintDevHours` / `sprintDevDaysRaw` (identical to `calculateTeamPiCapacity`), Team totals (`teamDailyTotals`, `teamSprintOverheadHours`, `teamSprintOverheadPostFteHours`, `teamSprintOvertimeMinutes`, `teamSprintDevHours`, `teamHasClampedMember` — eligible `Team member`s only), deduplicated FTE-weighted per-Holiday `devDaysLost` (`R4`, `R7` — when multiple effective holidays share `(locationId, date)`, attribute the date's `max(portion)` loss once to the primary row [`full` > `half`, `company` > `manual` > `library`, `name` asc, `id` asc] and `0` to secondary rows so `Σ devDaysLost === Σ over eligible Members m of (m.fteFactor × m.holidayDaysRaw)`), and per-Iteration commitment deltas (`vsPiHours = liveSprintHours(m, i) − piCommittedSprintHours(m, i)`, `teamVsPiHours = teamSprintDevHours(i) − (Σ_{minutes ∈ pi.byIteration.get(i).values()} minutes / 60)` summing the **immutable snapshot roster** including departed/archived Members; when `!pi.byIteration.has(i)`, return `vsPiHours = null`, `teamVsPiHours = null`, `isNewSincePiCommitment = false` for all Members; identically for `vsSprintHours` / `teamVsSprintHours`).
  - **Constraints**: Pure TypeScript only; zero DB/React/Next.js imports; 100% of existing F004 golden tests (`tests/unit/capacity-golden.test.ts`) MUST continue passing unchanged.
  - **Validation/test location**: `tests/unit/capacity-golden.test.ts`, `tests/unit/capacity-engine.test.ts`, and `tests/unit/calendar-domain.test.ts` (`T004`).
  - **Out-of-scope files/components**: Persistence services (`Phase 03`), UI components (`Phase 05`).

- [ ] **T004** `[US1, US2, US3, US4, US5]` Add comprehensive pure Vitest unit & golden tests for calendar domain rules and extended F004/F005 capacity engine
  - **Target files/components**: `tests/unit/calendar-domain.test.ts`, `tests/unit/capacity-engine.test.ts`
  - **Expected behavior**:
    - `calendar-domain.test.ts`: Test `makeLibrarySourceKey`, `resolveEffectiveLocationHolidays` (same-date override, moved-date `overridesLibraryKey` override **crossing a Sprint/PI boundary** per `R2`, `suppressedKeys` suppression, idempotency), `buildSprintCalendarDays` (2w, 3w, 4w compact, **`±1`-shifted 3-week Sprint asserting `weeksCount === 3`, `compact === false`, and `4` `CW##` bands with exact day spans** per `R7`, contiguous weekend ownership per `R4`, month dividers), `buildDynamicCalendarKey` (dynamic F002 `AbsenceType[]` + future custom type auto-inclusion), and all strict Zod schemas (rejecting undated/weekend absences, **rejecting `UpdateCalendarAbsenceSchema` combining `status: 'cancelled'` with `date`/`absenceTypeId`/`portion`/`planned` per `R5`**, `CreateAbsenceSchema` non-null `extraHours` per `R1`, `10`-min off-step durations, daily ceremony with non-null date, weekend meeting, non-whole-team meeting with empty attendees, unknown keys).
    - `capacity-engine.test.ts`: Add F005 golden test cases verifying: `0.5` FTE Member with post-FTE `2 h` Sprint planning + `15 min` recurring Daily + `1 h` attended meeting (`4.0 - 3.25 = 0.75 h`), non-attendee unaffected by specific meeting, full-day `AL` or holiday removing that day's ceremony/meeting deductions, half-day `HD` + ceremony clamping at `0` emitting `'events_exceed_day'` (and NOT `'over_deducted'`), `'events_exceed_sprint'` vs `'over_deducted'` separation (`R3`), post-FTE planned overtime on weekday/weekend/public holiday (including trailing Friday-end weekend per `R4`), separate Sprint `OverheadDeduction` reconciliation matching `calculateTeamPiCapacity` identically (plus Team-level `teamSprintOverheadPostFteHours` & `teamHasClampedMember`), `SM`/`PO` returning `null` dev hours and excluded from Team totals, FTE-weighted Holiday `devDaysLost` (half-day `×0.5`, `0.5` FTE, unconfirmed `est.`, holiday+absence non-double-count, AND **same-date `company` full + `manual` half deduplication including a `0.5` FTE Member asserting `Σ devDaysLost === Σ (m.fteFactor × m.holidayDaysRaw)` and secondary row `devDaysLost === 0`** per `R7`), moved library holiday crossing a Sprint/PI boundary (`R2`), and **two-Sprint PI/Sprint commitment comparisons with different per-Sprint committed totals asserting each Sprint's `vsPiHours`, `teamVsPiHours`, `vsSprintHours`, and `teamVsSprintHours` use strictly that Iteration's committed line, a Member transferred out or archived after commitment remains in the committed baseline (`teamVsPiHours` reflects their lost capacity), a live-only Member is flagged `New`, and an Iteration absent from the snapshot returns `null` deltas with `isNewSincePiCommitment === false`**.
  - **Constraints**: Pure deterministic unit tests; zero DB or network I/O; existing F004 golden tests remain untouched and green.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: PGlite integration tests (`Phase 02`–`03`).

---

## Phase 02: Drizzle Schema Extensions, Migration `0004` & Upgrade/CLI-Backup Tests

**Purpose**: Extend `holidays` with `overrides_library_key`, add `holiday_suppressions`, `planned_overtime`, `sprint_ceremonies`, `meetings`, `meeting_attendees`, and `milestones` in Drizzle with `ON DELETE RESTRICT` foreign keys and canonical integer-minute SQL `CHECK` constraints, commit additive migration `0004_team_calendar_availability.sql` with journal/snapshot metadata, and verify F004→F005 upgrade and CLI `db:backup`/`db:restore` round-trip safety.

- [ ] **T005** `[US2, US3, US5]` Extend `src/persistence/schema/calendar.ts` and commit additive migration `0004_team_calendar_availability.sql`
  - **Target files/components**: `src/persistence/schema/calendar.ts`, `src/persistence/migrations/0004_team_calendar_availability.sql`, `src/persistence/migrations/meta/_journal.json`, `src/persistence/migrations/meta/0004_snapshot.json`
  - **Expected behavior**:
    - In `src/persistence/schema/calendar.ts`:
      - Add nullable `overridesLibraryKey` (`overrides_library_key`) on `holidays` with `CHECK (overrides_library_key IS NULL OR (source = 'manual' AND length(trim(overrides_library_key)) > 0))` and partial unique index `holidays_manual_override_key_unique` on `(location_id, overrides_library_key) WHERE overrides_library_key IS NOT NULL`.
      - Add `holidaySuppressions` (`holiday_suppressions`), `plannedOvertime` (`planned_overtime`), `sprintCeremonies` (`sprint_ceremonies` with partial unique index `sprint_ceremonies_daily_unique` where `is_recurring_daily = true`), `meetings`, `meetingAttendees` (`meeting_attendees`, `ON DELETE CASCADE` on `meeting_id`, `ON DELETE RESTRICT` on `member_id`), and `milestones` (`scope IN ('team')`) matching `specs/005-team-calendar-availability/data-model.md`.
    - Generate and review `0004_team_calendar_availability.sql`, `meta/_journal.json`, and `meta/0004_snapshot.json`.
  - **Constraints**: Never modify `0000`–`0003` SQL migrations; never drop `absences.extra_hours`; zero `PlanVersion`/`PICommitment`/`SprintCommitment`/`Actuals`/`OverheadTicket`/`CeremonyTemplate` tables.
  - **Validation/test location**: `tests/integration/calendar-migration-backup.test.ts` (`T006`).
  - **Out-of-scope files/components**: `src/persistence/lock.ts`, `src/persistence/backup.ts`.

- [ ] **T006** `[US6]` Add integration tests for F004→F005 migration upgrade, direct SQL constraints, and CLI `db:backup`/`db:restore` round-trip
  - **Target files/components**: `tests/integration/calendar-migration-backup.test.ts`, `tests/integration/migration-upgrade.test.ts` (update only if journal entry count is asserted)
  - **Expected behavior**:
    - Test 1 (F004→F005 upgrade): Apply `0000`–`0003`, insert F001–F004 rows including an `absences` row with a legacy non-null `extra_hours` value (e.g., `2.0`), run `runMigrations()` applying `0004_team_calendar_availability.sql`, and assert 100% of F001–F004 rows survive intact with `holidays.overrides_library_key = null` and the existing `absences.extra_hours` value left unchanged (`R1`).
    - Test 2 (Direct SQL constraints): Verify PostgreSQL rejects off-step `duration_minutes` (`10`, `0`, `1455`), duplicate recurring daily ceremony on `(team_id, iteration_id)`, daily ceremony with non-null `date`, non-daily ceremony with null `date`, `overrides_library_key` on a non-`manual` holiday, duplicate `(location_id, library_source_key)` suppression, duplicate `(member_id, date)` overtime, `scope = 'train'` on `milestones`, and `ON DELETE RESTRICT` on referenced Team/Member/Iteration/Location (while verifying deleting a `meetings` row cascades `meeting_attendees`).
    - Test 3 (CLI `db:backup` & `db:restore` round-trip): Populate F005 ceremonies, meetings + attendees, milestones, planned overtime, manual holiday override, and library suppression, invoke `scripts/db/backup.ts` and `scripts/db/restore.ts --from ... --to ...`, and verify 100% restored row counts, exact field values, and restored `.azusa-last-healthy.json` matches imported `APP_VERSION` (so Phase 02 stays green at `0.4.0` and Phase 06 `T026` stays green after bumping to `0.5.0`).
  - **Constraints**: Isolated temp directories cleaned up on teardown; never touch `.azusa/data/`.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 03: Calendar & Holiday Services, F004 Capacity Integration, F002 Guards & Persistence Tests

**Purpose**: Implement `calendar-service.ts` and `holiday-management-service.ts`, wire F005 ceremonies/meetings/overtime/suppressions into F004's `capacity-service.ts` so `/calendar` and `/capacity` agree identically (`A2`), update F002 delete `409` guards (`FR-014`), and verify every persistence invariant against real PGlite.

- [ ] **T007** `[P]` `[US1, US2, US3, US4]` Implement transactional `src/application/calendar/calendar-service.ts`
  - **Target files/components**: `src/application/calendar/calendar-service.ts`
  - **Expected behavior**:
    - Implement `getTeamSprintCalendar(db, { teamId, piId, iterationId }, opts)` loading Team, ART, PI, Iteration, dated `member_team_assignments` and `planned_overtime` over the full contiguous calendar window `[calendarStartDate .. calendarEndDate]` (`R4`, `R7`), Members (eligible `Team member`s + non-dev roles), Locations, Holidays matching `(date BETWEEN start AND end) OR (overrides_library_key IS NOT NULL AND left(overrides_library_key, 10) BETWEEN start AND end)` + `holiday_suppressions` (`R2`), `AbsenceType` catalog, `Absences`, `overhead_deductions`, `sprint_ceremonies`, `meetings` + `meeting_attendees`, and `milestones`, delegating 100% of math to `calculateTeamSprintCalendarCapacity`.
    - Implement transactional mutations reusing `writeOrganization`, `validate`, `requireRecord`, `requireActive`, and `resolveActor`:
      - `createCalendarAbsence` & `updateCalendarAbsence` (`R5`): **create** and **active edit/move/reactivate** (resulting `status === 'active'`) reject undated entries and weekends (`400`), validate active Member (`409`), dated `member_team_assignments` covering `date` (`409`), and non-overlapping active capacity-affecting absences (`409`), never hardcode `AbsenceType.code`, and return `'overlaps_planned_overtime'` advisory warning if active full-day absence overlaps planned overtime; **cancel-only** (`{ status: 'cancelled', note? }` with no `date`/`absenceTypeId`/`portion`/`planned` fields) validates active Member (`409`) and skips dated-assignment and overlap checks (on an already-cancelled row, `{ status: 'cancelled' }` is a `200` idempotent no-op and `{ status: 'cancelled', note }` returns `200` updating `note` only); **any other edit on an already-cancelled absence without setting `status: 'active'`** is rejected with `409 CONFLICT`.
      - `upsertPlannedOvertime` & `deletePlannedOvertime` (allows weekdays/weekends/holidays, `15`-min integer minutes, returns `'overlaps_full_day_absence'` and/or `'outside_sprint_window'` advisory warnings without rejecting/modifying existing records per `A3`).
      - `createCeremony`, `updateCeremony`, `deleteCeremony` (enforces single recurring Daily stand-up per Team × Iteration and Team-scheduled Sprint weekday bounds for dated ceremonies per `A1`).
      - `createMeeting`, `updateMeeting`, `deleteMeeting` (weekday `date`, whole Team or assigned attendees on `date`).
      - `createMilestone`, `updateMilestone`, `deleteMilestone` (multiple per date, `scope = 'team'`).
  - **Constraints**: Zero calculation formulas duplicated outside `src/domain/capacity/`; zero HTTP/React imports.
  - **Validation/test location**: `tests/integration/calendar-persistence.test.ts` (`T010`).
  - **Out-of-scope files/components**: HTTP Route Handlers (`Phase 04`), UI components (`Phase 05`).

- [ ] **T008** `[P]` `[US5]` Export offline holiday year generator in `src/persistence/seed.ts` and implement `src/application/calendar/holiday-management-service.ts`
  - **Target files/components**: `src/persistence/seed.ts`, `src/application/calendar/holiday-management-service.ts`
  - **Expected behavior**:
    - Export a clean offline `generateLibraryHolidaysForYear(location, year)` helper from `src/persistence/seed.ts` using existing `date-holidays` `3.39.2` (preserving `isEstimatedHolidayRule` for `confirmed = false` and `library_seed_cutoff_date` rules).
    - Implement in `holiday-management-service.ts`:
      - `getAnnualHolidays(db, { year })`: returns read-only active F002 Locations (with member counts, effective weekday/total holiday counts, `lastRefreshedAt`), effective annual holidays for `year` (loading moved-override rows via `OR left(overrides_library_key, 10)` per `R2`), and `suppressions` for `year` so operators can restore removed library holidays.
      - `createOperationalHoliday(db, input, opts)`: inserts `company` or `manual` holiday for an active Location.
      - `updateOperationalHoliday(db, id, input, opts)`: updates `company`/`manual` rows in place; if target is `library`, checks for an existing `manual` override matching `overrides_library_key = makeLibrarySourceKey(orig.date, orig.name)` (returning `409 CONFLICT` if one exists) and otherwise atomically inserts the `manual` override without mutating the library row (`A4`).
      - `deleteOperationalHoliday(db, id, { suppressLibrary }, opts)`: deletes `company` rows; for `manual` rows with `overrides_library_key`, reverts to the library holiday unless `suppressLibrary === true` (which deletes the manual override AND inserts a `holiday_suppressions` row); for `library` rows, deletes any linked `manual` override AND inserts a `holiday_suppressions` row (`A4`).
      - `restoreSuppressedHoliday(db, suppressionId, opts)`: deletes the `holiday_suppressions` row for an active Location and inspects the stored `library` row directly (no regeneration step, since refresh retains suppressed rows). Returns `{ restored: true, libraryRowAvailable: true, effective: true, effectiveReason: null, warning: null }` if effective, `{ restored: true, libraryRowAvailable: true, effective: false, effectiveReason: 'overridden_by_company_or_manual', warning: null }` if shadowed by a `company`/`manual` row on that date, or `{ restored: true, libraryRowAvailable: false, effective: false, effectiveReason: 'library_row_missing', warning: 'library_holiday_no_longer_generated' }` if the stored library row no longer exists — preserving all overrides and other suppressions (`R8`).
      - `refreshLibraryHolidays(db, { year, locationId? }, opts)`: refreshes **only** `source = 'library'` rows for targeted active Location(s) and `year` (respecting `library_seed_cutoff_date`), **retaining suppressed library rows in storage** (filtered out by `resolveEffectiveLocationHolidays` on read so post-refresh restore works cleanly), preserves all `company`, `manual`, and `holiday_suppressions` rows without duplication, and updates `locations.last_refreshed_at` and `seeded_years`.
  - **Constraints**: 100% offline via `date-holidays`; zero Location creation/editing/workday-hours mutations (`F002` owns Locations).
  - **Validation/test location**: `tests/integration/calendar-persistence.test.ts` (`T010`).
  - **Out-of-scope files/components**: F002 Location CRUD (`organization/calendar-reference-service.ts` except delete guard & effective read in `T009`).

- [ ] **T009** `[US4, US5, US6]` Wire F005 calendar inputs into F004 `capacity-service.ts` and update F002 delete & offset guards
  - **Target files/components**: `src/application/capacity/capacity-service.ts`, `src/application/organization/organization-service.ts`, `src/application/organization/cadence-service.ts`, `src/application/organization/calendar-reference-service.ts`
  - **Expected behavior**:
    - In `capacity-service.ts`: load `member_team_assignments` and `planned_overtime` over the PI's full contiguous calendar window `[firstCalendarStartDate .. lastCalendarEndDate]` (extending a Friday-ending final Sprint through Sunday `+2` days per `R4`/`R7`), load holidays with `OR (overrides_library_key IS NOT NULL AND left(overrides_library_key, 10) BETWEEN start AND end)` (`R2`), plus `sprint_ceremonies`, `meetings` + `meeting_attendees`, and `holiday_suppressions` for the PI's Iterations, and pass them into `calculateTeamPiCapacity()` so `/capacity` and `/calendar` always report identical reconciled dev days, dev hours, and Forecast SP (`A2`, `R7`).
    - In `calendar-reference-service.ts`: load moved-override holidays + `holiday_suppressions` in `listLocations` and `listLocationHolidays`, and update `deleteLocation` conflict message to include `holiday_suppressions`.
    - In `organization-service.ts`: update `deleteTeam` and `deleteMember` `409 CONFLICT` guards for F005 tables, and update `updateTeam` so changing `sprint_offset_workdays` returns `409 CONFLICT` if any dated `sprint_ceremonies` in **current or future Iterations** (`scheduledEndDate >= today`) would fall outside the Team's new scheduled window (past Iterations do not lock offset changes).
    - In `cadence-service.ts`: update `deleteIteration` `409 CONFLICT` guard to detect `sprint_ceremonies`, and update `updateIteration` so changing Iteration `startDate`/`endDate` returns `409 CONFLICT` if any dated `sprint_ceremonies` for that Iteration would fall outside their Team's new scheduled window.
  - **Constraints**: Preserve 100% of existing F002–F004 integration tests.
  - **Validation/test location**: `tests/integration/calendar-persistence.test.ts` (`T010`) and existing F002/F004 integration tests.
  - **Out-of-scope files/components**: HTTP Route Handlers (`Phase 04`).

- [ ] **T010** `[US1, US2, US3, US4, US5, US6]` Add real-PGlite integration tests for calendar persistence, `/calendar`↔`/capacity` reconciliation, holiday lifecycle/refresh, and F002 guards
  - **Target files/components**: `tests/integration/calendar-persistence.test.ts`
  - **Expected behavior**:
    - Verify absence create/edit/move/cancel (`status = 'cancelled'`), undated & weekend rejection, unassigned-date rejection on create/move, historical & backdated assignments, **cancel-only skipping the dated-assignment check**, **repeat cancel on an already-cancelled row (without `note` → `200` no-op; with `note` → `200` updates `note` only)**, **combined `status: 'cancelled'` + `date`/`absenceTypeId`/`portion`/`planned` rejected with `400 VALIDATION_ERROR`**, **other edits on an already-cancelled absence without setting `status: 'active'` rejected with `409 CONFLICT`** (`R5`), `BT`/`WFH`/`ON_SITE` zero deduction, `HD` half-day deduction.
    - Verify planned overtime create/update/delete on weekday, weekend, inter-Iteration gap (asserting `'outside_sprint_window'` advisory warning), and full-day `AL` (asserting `'overlaps_full_day_absence'` advisory warning without modifying the absence).
    - Verify recurring Daily stand-up uniqueness (`409` on second Daily), dated ceremonies, `updateTeam` `sprint_offset_workdays` change rejected (`409`) for current/future orphaned ceremony while allowed when only past Iterations have ceremonies, `updateIteration` date change rejected (`409`) when a dated ceremony would fall outside the shifted window, whole-Team vs specific-attendee meetings (rejecting weekends), multiple milestones on one date.
    - Verify **exact reconciliation**: `getTeamSprintCalendar().teamSprintDevHours === getTeamPiCapacity().iterations[i].teamDevHours` (and per-Member `sprintDevHours === cell.devHours`) with `0.5` FTE Member, `OverheadDeduction`, ceremonies, meetings, absences, holidays, and overtime all active simultaneously (`A2`), **including trailing-Sunday overtime in the PI's final Sprint plus a Member assignment starting on that trailing weekend** (`R7`), and **same-date `company` full + `manual` half holidays with a `0.5` FTE Member asserting `Σ holidays[].devDaysLost === Σ (m.fteFactor × m.holidayDaysRaw)` and secondary row `devDaysLost === 0`** (`R7`).
    - Verify **moved holiday across Sprint/PI boundary (`R2`)**: edit an estimated `library` holiday on the last day of Sprint 1 (or last day of PI-1) to a date in Sprint 2 (or PI-2), assert Sprint 1 / PI-1 no longer deducts capacity for the old date on both `getTeamSprintCalendar` and `getTeamPiCapacity`, and Sprint 2 / PI-2 deducts for the new date.
    - Verify full holiday lifecycle (`A4`, `R8`): add company holiday, edit library holiday → `manual` override (`PATCH` again on same library row → `409`), `DELETE` manual override reverts to library, `DELETE` manual override with `suppressLibrary=true` suppresses it, `DELETE` library row with existing manual override keeps library row + deletes override + suppresses, **suppress → `restoreSuppressedHoliday` (with NO intermediate refresh) → `effective: true` and capacity deduction returns**, **suppress → `refreshLibraryHolidays` → `restoreSuppressedHoliday` → `effective: true`**, **restore when a `company`/`manual` holiday exists on the same `(locationId, date)` → `effective: false, effectiveReason: 'overridden_by_company_or_manual'`**, **restore after Location jurisdiction change (library row missing) → `libraryRowAvailable: false, effective: false, effectiveReason: 'library_row_missing', warning: 'library_holiday_no_longer_generated'` while preserving other overrides and suppressions**, and `refreshLibraryHolidays` run twice is idempotent with zero duplicates.
    - Verify updated F002 `deleteTeam`, `deleteMember`, `deleteIteration`, and `deleteLocation` `409 CONFLICT` guards.
  - **Constraints**: Isolated temp PGlite DBs cleaned up on teardown.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 04: Local HTTP API Route Handlers (`/api/calendar/*`) & Route Contract Tests

**Purpose**: Expose thin, strict Zod-validated Next.js App Router Route Handlers for all F005 endpoints matching `contracts/api.md`, verified by dedicated `tests/integration/calendar-routes.test.ts`.

- [ ] **T011** `[P]` `[US1, US2]` Implement `GET /api/calendar`, `POST /api/calendar/absences`, `PATCH /api/calendar/absences/[id]`, and `PUT|DELETE /api/calendar/overtime`
  - **Target files/components**: `src/app/api/calendar/route.ts`, `src/app/api/calendar/absences/route.ts`, `src/app/api/calendar/absences/[id]/route.ts`, `src/app/api/calendar/overtime/route.ts`
  - **Expected behavior**: Wire thin HTTP adapters reusing `readQuery`, `readBody`, `organizationDb`, and `organizationResponse` (`Cache-Control: no-store`, `200`/`201`, uniform `400`/`404`/`409`/`503` envelopes) matching `contracts/api.md` §§1–3.
  - **Constraints**: Zero calculation or DB logic in route handlers; reject unknown keys and actor fields.
  - **Validation/test location**: `tests/integration/calendar-routes.test.ts` (`T014`).
  - **Out-of-scope files/components**: Existing `/api/organization/*`, `/api/categories/*`, `/api/capacity/*` routes.

- [ ] **T012** `[P]` `[US3]` Implement `/api/calendar/ceremonies`, `/api/calendar/meetings`, and `/api/calendar/milestones` Route Handlers
  - **Target files/components**: `src/app/api/calendar/ceremonies/route.ts`, `src/app/api/calendar/ceremonies/[id]/route.ts`, `src/app/api/calendar/meetings/route.ts`, `src/app/api/calendar/meetings/[id]/route.ts`, `src/app/api/calendar/milestones/route.ts`, `src/app/api/calendar/milestones/[id]/route.ts`
  - **Expected behavior**: Wire thin HTTP adapters (`POST` → `201`, `PATCH`/`DELETE` → `200`, `Cache-Control: no-store`) matching `contracts/api.md` §§4–6.
  - **Constraints**: Zero business logic in route handlers.
  - **Validation/test location**: `tests/integration/calendar-routes.test.ts` (`T014`).
  - **Out-of-scope files/components**: UI components.

- [ ] **T013** `[P]` `[US5]` Implement `/api/calendar/holidays`, `/api/calendar/holidays/[id]`, `/api/calendar/holidays/refresh`, and `/api/calendar/holidays/suppressions/[id]` Route Handlers
  - **Target files/components**: `src/app/api/calendar/holidays/route.ts`, `src/app/api/calendar/holidays/[id]/route.ts`, `src/app/api/calendar/holidays/refresh/route.ts`, `src/app/api/calendar/holidays/suppressions/[id]/route.ts`
  - **Expected behavior**: Wire thin HTTP adapters (`GET` → `200`, `POST` → `201`, `PATCH`/`DELETE`/`POST refresh` → `200`, `Cache-Control: no-store`, supporting `?suppressLibrary=true` on `DELETE /holidays/[id]` and un-suppress restore on `DELETE /holidays/suppressions/[id]`) matching `contracts/api.md` §7.
  - **Constraints**: Zero external network calls (offline `date-holidays` only).
  - **Validation/test location**: `tests/integration/calendar-routes.test.ts` (`T014`).
  - **Out-of-scope files/components**: F002 `/api/organization/locations/*` routes.

- [ ] **T014** `[US1, US2, US3, US4, US5]` Add dedicated HTTP Route Handler contract tests (`calendar-routes.test.ts`)
  - **Target files/components**: `tests/integration/calendar-routes.test.ts`
  - **Expected behavior**: Exercise every `/api/calendar/*` route against a real PGlite test context verifying `200`/`201` happy paths (including **repeat cancel on an already-cancelled absence with and without `note` returning `200`**), `Cache-Control: no-store`, `400 VALIDATION_ERROR` (undated/weekend absence, **combined `status: 'cancelled'` + `date`/`absenceTypeId`/`portion`/`planned`**, off-step `10`-min duration, unknown keys, actor injection, invalid UUIDs, empty attendee list when `wholeTeam = false`), `404 NOT_FOUND`, and `409 CONFLICT` (**editing an already-cancelled absence without setting `status: 'active'`**, cross-ART mismatch, duplicate Daily stand-up, archived ART/Team/PI/Member/Location writes, overlapping active capacity-affecting absence).
  - **Constraints**: Separate file from `calendar-persistence.test.ts`; zero external network requests.
  - **Validation/test location**: `npm run test:run`, `npm run lint`, and `npm run typecheck` exit `0`.
  - **Out-of-scope files/components**: UI components.

---

## Phase 05: `/calendar`, `/capacity` Breakdown Alignment & Provisional `/calendar/holidays` UI, Visual & E2E Suites

**Purpose**: Align `/capacity`'s `BreakdownPopover` & `MemberCapacityTable` with F005 events/overtime (`R3`), replace the `/calendar` placeholder with the Team Calendar matching `LeaveCalendar.dc.html`, `LeaveCalendar3w.dc.html`, and `LeaveCalendar4w.dc.html` (`10*.png`), and mount the decoupled provisional `HolidayManagementView` at `/calendar/holidays` matching `Settings.dc.html` (`07-settings-locations-holidays.png`) under `Visual-Fidelity Mode: Visual-fidelity` at `1440px` baseline (subject to operator-accepted deviations `D1`–`D6`), then verify with Playwright visual geometry and E2E + `@axe-core/playwright` suites across `1440px`, `1024px`, and `768px`.

*(Note: `T017–T023` share `src/ui/calendar/calendar.module.css` and are ordered sequentially without `[P]`.)*

- [ ] **T015** `[US1]` Extend floating header context with Sprint selector on `/calendar` in `src/ui/shell/OrganizationContext.tsx`, `src/ui/shell/HeaderContextSelector.tsx`, and `src/ui/shell/FloatingHeader.tsx`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/LeaveCalendar.dc.html#L34-L40` & `screenshots/10-team-calendar-2w.png` (4th breadcrumb picker `› Sprint` showing Sprint name, date range, and `Upcoming` / `Current` / `Done` status pill; shown on `/calendar` while leaving `/capacity` and `/organization` headers unchanged).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px`; states: active PI with multiple Sprints (current/upcoming/done), PI with `0` Iterations (`No sprints`), and atomic `setSelection({ teamId, piId, iterationId? })` sync.
  - **Translation note**: Reuse the existing `ContextPicker` component and `shell.module.css` styles in `HeaderContextSelector.tsx`; persist optional `iterationId` in `OrganizationContext` and default to the current Iteration of the selected PI (or first Iteration if none is current).
  - **Provenance**: `lifted from prototype CSS` via existing `shell.module.css` (`LeaveCalendar.dc.html#L34-L40`).
  - **Done when**: Tier 1 (`npm run test:visual` including `shell-fidelity.spec.ts` & `team-calendar.spec.ts` in `T024`) green at `1440px`, `1024px`, `768px` AND Tier 2 frozen-state screenshots reviewed against `10-team-calendar-2w.png`.
  - **Out-of-scope files/components**: Main logo navigation menu (`nav-config.ts`), disabled profile-menu `Settings`.

- [ ] **T016** `[US4]` Update `/capacity` Breakdown Popover & Member Capacity Table for F005 events, overtime, and distinct warning codes (`R3`)
  - **Target files/components**: `src/ui/capacity/BreakdownPopover.tsx`, `src/ui/capacity/MemberCapacityTable.tsx`
  - **Match**: Existing F004 Kumiko breakdown popover and cell-marker styling in `src/ui/capacity/capacity.module.css` (`specs/004-capacity-engine-planner/spec.md` §3.6, `R8`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: Member with zero events/overtime (existing F004 tests unchanged), Member with ceremonies/meetings + planned overtime, Member with `'over_deducted'` vs `'events_exceed_day'` vs `'events_exceed_sprint'`.
  - **Translation note**: Add `Ceremonies & meetings` (post-FTE clock time, hours & days) and `Planned overtime` (post-FTE, hours & days) `<dt>/<dd>` rows to `BreakdownPopover.tsx`; update the equation line to `max(0, max(0, Days − Leaves − deductions) × FTE − Events) + Overtime = Dev`; render distinct warning text for `'over_deducted'`, `'events_exceed_day'`, and `'events_exceed_sprint'`, and surface distinct subtle cell markers in `MemberCapacityTable.tsx`.
  - **Provenance**: `recreated manually` extending existing F004 `BreakdownPopover.tsx` / `MemberCapacityTable.tsx` (reason: `R3` — `/capacity` must explain every number once F005 events/overtime feed the shared engine).
  - **Done when**: Existing `tests/visual/capacity-planner.spec.ts` and `tests/e2e/capacity-planner.spec.ts` pass AND `tests/e2e/team-calendar.spec.ts` verifies `/capacity` breakdown shows ceremonies, meetings, overtime, and distinct warning messages.
  - **Out-of-scope files/components**: `/capacity` KPI layout or overhead editing flows (`F004`).

- [ ] **T017** `[US1, US4]` Build `/calendar` page entry, title row, view switch & commitment chips in `src/app/calendar/page.tsx`, `src/ui/calendar/TeamCalendarWorkspace.tsx`, and `src/ui/calendar/calendar.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/LeaveCalendar.dc.html#L55-L74` & `screenshots/10-team-calendar-2w.png` (page padding `24px 28px 32px`, `Zen Kaku Gothic New` `28px` bold `"Team calendar"` title, right-aligned `"Sprint planning"` `/sprint-planning` and `"Capacity planner"` `/capacity` white `10px`-radius buttons with Kumiko icons, white `14px`-radius calendar card, segmented `Days off | Dev hours` radio toggle on `#ECECEE` with `#1A1B22` active pill, instructional copy updated for `D1`, and right-aligned commitment status chips per `D4`: `PI not started · capacity is live` [with tooltip clarifying `"No PI commitment snapshot exists yet (PI Commitments arrive in F012). Capacity reflects live calendar edits."` even when `pi.lifecycleStatus === 'in_progress'`] and `Sprint not started`).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px`; states: loading, DB-unavailable/error alert with Retry, no Team/PI/Iteration empty state, archived ART/Team/PI URL deep-link read-only banner (`"Viewing archived <Team> · <PI> (read-only)"` + `"Return to active selection"`, disabling all cell/table mutations in the UI per `R5`), invalid deep-link dismissible notice, and active populated state.
  - **Translation note**: Lift title row, toolbar, segmented switch, and commitment chip CSS directly from `LeaveCalendar.dc.html#L55-L74` into `calendar.module.css`; mirror F004's atomic deep-link sync + URL clearing pattern.
  - **Provenance**: Title row, segmented switch, and chip styling `lifted from prototype CSS` (`LeaveCalendar.dc.html#L55-L74`); updated instructional copy, commitment tooltip clarification, and empty/read-only banners `recreated manually` (reason: Deviations `D1`, `D4`, and Principle VII states).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshots reviewed against `10-team-calendar-2w.png`.
  - **Out-of-scope files/components**: Commitment creation buttons (`F012`/`F013`).

- [ ] **T018** `[US1, US4]` Build Member × Day Calendar Grid (`Days off` & `Dev hours`, 2w/3w/4w) in `src/ui/calendar/CalendarGrid.tsx` and `src/ui/calendar/calendar.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/LeaveCalendar.dc.html#L75-L96`, `LeaveCalendar3w.dc.html`, `LeaveCalendar4w.dc.html`, and `screenshots/10-team-calendar-2w.png`, `10b-team-calendar-3w.png`, `10c-team-calendar-4w.png` (ISO `CW##` week band spanning exact day count per ISO week for `±1` offsets per `R4`, `2px` month-boundary divider, clickable working date headers with `#F8CBAD` ceremony tint, `#FFFF90` today ring, and `#D00000` solid red milestone override, Member name + `#1A1B22` Location badge, `#808080` weekends, `#C5E0B4` holidays with `est.` indicator when unconfirmed, compact columns for ≥4-week Sprints, Dev Hours per-Member daily cells + Sprint `Overhead` reconciliation column per `D3` + `Dev h` total + conditional `vs PI`/`vs Sprint` columns when commitments exist + Team daily, Team `Overhead`, and Team `Dev h` totals summing eligible `Team member`s only, with Team/Member tooltips explaining any pre-FTE/event clamp).
  - **Breakpoints/checkpoints**: `1440px` (2w, 3w, and 4w fidelity baseline), `1024px`, `768px` (horizontal scroll inside card, zero page overflow); states: `Days off` view, `Dev hours` view, multi-marker cell (e.g. holiday + overtime), mid-Sprint unassigned cells, non-dev role rows (`SM`/`PO`/`Admin`/`RTE` muted with role pill and **`—`** in daily & Sprint `Dev h` cells), and distinct `'over_deducted'` / `'events_exceed_day'` / `'events_exceed_sprint'` warning badges.
  - **Translation note**: Lift grid template, weekend proportions (`0.55fr` vs `1fr`, collapsible to `6px` divider if tight on 4-week view), compact 4w column widths (`118px` name / `48px` total), cell typography (`IBM Plex Mono`), and header precedence (`Milestone > Today > Ceremony`) from `LeaveCalendar*.dc.html`.
  - **Provenance**: Grid layout, CW headers, month divider, header colours, and cell anatomy `lifted from prototype CSS` (`LeaveCalendar*.dc.html`); Sprint-level `Overhead` reconciliation column on Member & Team rows, `est.` indicator, and muted non-dev `—` display `recreated manually` (reason: Deviation `D3`, `A2`, `R4`, `AC09`, `AC14`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshots reviewed against `10-team-calendar-2w.png`, `10b-team-calendar-3w.png`, and `10c-team-calendar-4w.png`.
  - **Out-of-scope files/components**: Capacity formula calculations (consumed strictly from `GET /api/calendar`).

- [ ] **T019** `[US2]` Build Dynamic Calendar Key / Legend in `src/ui/calendar/CalendarKey.tsx` and `src/ui/calendar/calendar.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/LeaveCalendar.dc.html#L98-L104` & `screenshots/10-team-calendar-2w.png` (`border-top: 1px solid #EFEAE3`, `190px` `"Key"` heading, 4-column swatch grid with `24×22px` `5px`-radius code chips; applying Deviation `D2`: dynamically derived from `absenceTypes[]` from F002 + Planned Overtime + Cancelled + calendar markers `Milestone`, `Scrum event`, `Weekend`, `Holiday`, `Today`, omitting unseeded `Misc.`/`AWOL`).
  - **Breakpoints/checkpoints**: `1440px` (4-column grid), `1024px`, `768px` (clean wrap); states: default 6 F002 `AbsenceType`s and extra custom `AbsenceType` rendered automatically.
  - **Translation note**: Lift Key container and swatch geometry from `LeaveCalendar.dc.html#L98-L104`; render swatches dynamically from `buildDynamicCalendarKey(absenceTypes)`.
  - **Provenance**: Container & swatch CSS `lifted from prototype CSS` (`LeaveCalendar.dc.html#L98-L104`); dynamic catalog rendering `recreated manually` (reason: Deviation `D2`, `A5`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshots reviewed.
  - **Out-of-scope files/components**: Hardcoded absence-type enums.

- [ ] **T020** `[US2]` Build Member × Day Cell Entry Popover (`CellEntryPopover.tsx`) for absences, planned overtime, and multi-entry inspection
  - **Match**: Azusa Kumiko dialog/popover visual language (`#FFFFFF` surface, `16px` radius, `0 24px 60px rgba(26,27,34,.22)` elevation, `#1A1B22` primary action, `:focus-visible` `2px solid #E07F24`) fulfilling Deviation `D1`, `A3`, and `A5`.
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: empty weekday cell (add absence or add overtime defaulting to `2 h` in `0.25 h` steps), weekend/holiday cell (shows holiday/weekend info + add/edit planned overtime), occupied active cell (inspect existing entries without auto-cancelling, edit date/type/portion/planned/note, explicit **Cancel** setting `status = 'cancelled'`), **cancelled entry** (shows read-only summary + **Reactivate** and **Edit note** controls; **Cancel** and date/type/portion/planned edit fields are hidden), **multi-entry cell containing both an active and a cancelled record** (renders active controls on the active entry and cancelled controls on the cancelled entry, alongside holiday/overtime/AM+PM combinations), and non-blocking advisory warning banners when overtime overlaps an active full-day absence or falls outside an active Sprint window.
  - **Translation note**: Keyboard-accessible (`Escape` closes, returns focus to cell trigger); supports moving an absence to another weekday via date input; disabled in read-only archived mode.
  - **Provenance**: `recreated manually` using Azusa Kumiko modal/popover tokens (reason: Deviation `D1`, `A3`, `A5`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshot of open popover reviewed.
  - **Out-of-scope files/components**: Direct one-click cancellation on cell click (`D1`), self-service auth.

- [ ] **T021** `[US3]` Build Team Milestone Modal (`MilestoneModal.tsx`)
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/LeaveCalendar.dc.html#L139-L157` (centered `440px` modal, `#D00000` `12×12px` square badge, `"Add milestone"` when date is empty vs `"Milestones"` when milestones exist with inline rename inputs, `✕` remove buttons, `"Add another"` row, and `"Done"` button; date text when opened from date header vs Sprint working-date `<select>` when opened from Milestones table `+ Add`).
  - **Breakpoints/checkpoints**: `1440px`, `1024px`, `768px`; states: empty date from header, date with 1+ milestones from header (inline edit + remove + add another), and table `+ Add` with date selector.
  - **Translation note**: Replicate DOM structure and spacing from `LeaveCalendar.dc.html#L139-L157` element-for-element; wire `Escape` close and focus return.
  - **Provenance**: `lifted from prototype CSS` (`LeaveCalendar.dc.html#L139-L157`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshot of open modal reviewed.
  - **Out-of-scope files/components**: ART-level milestones (`F019`), work-item milestone links (`F007`).

- [ ] **T022** `[US3, US5]` Build 2 × 2 Tables Below Grid (`Holidays`, `Milestones`, `Scrum ceremonies`, `Meetings`) in `src/ui/calendar/CalendarTables.tsx` and `src/ui/calendar/calendar.module.css`
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/LeaveCalendar.dc.html#L107-L137` & `screenshots/10-team-calendar-2w.png` (`grid-template-columns: repeat(2, minmax(0, 1fr))`, `gap: 12px`, four `#FFFFFF` `14px`-radius cards: top-left **Holidays** with `Manage holidays ›` link to `/calendar/holidays` per `D5` and F004 FTE-weighted `Dev days` lost + `est.` badge; top-right **Milestones** with `+ Add` and `✕` remove + empty italic copy; bottom-left **Scrum ceremonies** with `Daily` row + chronological dated ceremonies + `+ Add`/edit/remove; bottom-right **Meetings** with `Whole team` or overlapping circular initials avatars + `+ Add`/edit/remove + attendee picker).
  - **Breakpoints/checkpoints**: `1440px` (2 × 2 grid matching prototype), `1024px`, `768px` (stacks cleanly to 1 column without overflow); states: populated Sprint, empty tables, ceremony add/edit form (Daily toggle vs dated picker + 15-min duration), meeting add/edit form (Whole team toggle vs Member multi-select).
  - **Translation note**: Lift 2 × 2 card grids, row heights (`min-height: 40px`), color swatches (`#C5E0B4`, `#D00000`, `#F8CBAD`, `#BDD7EE`), and avatar stack CSS from `LeaveCalendar.dc.html#L107-L137`.
  - **Provenance**: 2 × 2 card layout, table columns, swatches, and avatar stacks `lifted from prototype CSS` (`LeaveCalendar.dc.html#L107-L137`); inline/modal ceremony & meeting CRUD forms and `Manage holidays ›` link `recreated manually` (reason: prototype `+ Add` links are stubs; Deviation `D5`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshots reviewed against `10-team-calendar-2w.png`.
  - **Out-of-scope files/components**: `OverheadDeduction` editing (`/capacity`).

- [ ] **T023** `[US5]` Build Decoupled Provisional Holiday Management View (`HolidayManagementView.tsx` + `/calendar/holidays`)
  - **Match**: `docs/handoffs/azusa-handoff-v2.zip` → `prototype/Settings.dc.html#L48-L115` & `screenshots/07-settings-locations-holidays.png` (`"Locations and holidays"` title, year quick-pick pills for the active/seeded window plus `‹`/`›` stepper supporting `2000–2100`, `"Refresh from public calendars"` button, `"+ Company holiday"` `#1A1B22` button, read-only **Locations** card with Code/Location/Calendar source/Time zone/Members/Weekday holidays/Last refreshed, and full-year **Month × Location holiday grid** with legend swatches: public `#F6EEDB`, company `#FCEFE2` + `#F0C08F` border, unconfirmed dashed `#C9A85A` `(est.)`, weekend `#F3EFE9`; applying Deviation `D5`: no monolithic Settings sidebar, no `+ Location`, no per-Location `Hours / day` column, plus `"← Back to Team calendar"` link and a collapsible `"Suppressed public holidays"` restore list).
  - **Breakpoints/checkpoints**: `1440px` (fidelity baseline), `1024px`, `768px` (table cards scroll horizontally inside container, zero page overflow); states: populated annual grid, `+ Company holiday` modal, edit holiday modal (for `library` holiday explains creation of preserved `manual` override; for `manual` override offers `"Revert to public holiday"` vs `"Remove holiday completely"`), suppressed-holidays restore panel, and post-refresh summary banner.
  - **Translation note**: Keep `HolidayManagementView.tsx` completely decoupled from Next.js route/shell chrome so Prototype v3 Settings can re-mount it directly (`A4`); lift panel/grid/badge CSS from `Settings.dc.html#L48-L115`.
  - **Provenance**: Year selector, action buttons, Locations table, and Month × Location grid `lifted from prototype CSS` (`Settings.dc.html#L48-L115`); `"← Back to Team calendar"`, `2000–2100` year stepper, edit/revert/suppress/restore modals, and omission of Settings sidebar/`+ Location`/`Hours / day` `recreated manually` (reason: Deviation `D5`, `A4`).
  - **Done when**: Tier 1 (`npm run test:visual`) green at `1440px`, `1024px`, `768px` AND Tier 2 screenshots reviewed against `07-settings-locations-holidays.png`.
  - **Out-of-scope files/components**: F002 Location creation/editing, profile-menu `Settings`, main logo navigation menu.

- [ ] **T024** `[US1, US4, US5, US6]` Add Playwright visual geometry tests (`tests/visual/team-calendar.spec.ts`) and update F001 placeholder expectations for `/calendar`
  - **Target files/components**: `tests/visual/team-calendar.spec.ts`, `tests/e2e/foundation-smoke.spec.ts`, `tests/visual/shell-fidelity.spec.ts`
  - **Expected behavior**:
    - `tests/visual/team-calendar.spec.ts`: Seed deterministic Team + PI + 2w/3w/4w Iterations + multi-location Members + Holidays + Absences + Ceremonies + Meetings + Milestones, navigate to `/calendar` and `/calendar/holidays`, and assert across `1440px`, `1024px`, and `768px`: header `ART › Team › PI › Sprint` geometry, `Team calendar` highlighted in nav menu, calendar grid + Key + 2 × 2 tables geometry (zero overlap/clipping, zero page-level horizontal overflow), red milestone header precedence over ceremony tint, and `/calendar/holidays` read-only Locations + Month × Location grid geometry.
    - Update `tests/e2e/foundation-smoke.spec.ts` and `tests/visual/shell-fidelity.spec.ts` so `/calendar` asserts the live Team Calendar heading instead of the F001 placeholder badge.
  - **Constraints**: Isolated `.azusa/test-playwright/` storage; port `3100`; zero external network requests.
  - **Validation/test location**: `npm run test:visual` and `npm run test:e2e` exit `0`.
  - **Out-of-scope files/components**: Remaining placeholder routes (`/backlog`, `/sprint-planning`, `/iteration`, `/dashboard`, `/`, `/program-board`, `/pi-brief`).

- [ ] **T025** `[US1, US2, US3, US4, US5, US6]` Add Playwright E2E and `@axe-core/playwright` accessibility test suite (`tests/e2e/team-calendar.spec.ts`)
  - **Target files/components**: `tests/e2e/team-calendar.spec.ts`
  - **Expected behavior**:
    - Walk US1–US5 end-to-end against isolated port `3100` with zero external network requests:
      - Switch Team/PI/Sprint across 2w, 3w, and 4w Sprints (and a `±1` offset Team); verify commitment chips (`PI not started · capacity is live`, `Sprint not started`) and `Sprint planning` / `Capacity planner` navigation links.
      - In `Days off`, click a cell → add `AL`, reload, click again (confirm popover opens without auto-cancelling), move date, cancel (`status = 'cancelled'`), add a new active absence on the same cell so **both an active and a cancelled entry coexist** and confirm the popover shows Edit+Cancel for the active entry and Reactivate+Edit note (hiding Cancel/date/type/portion) for the cancelled entry, log `WFH` & `BT` (zero capacity impact), log planned overtime on weekday, weekend, and full-day `AL` (verifying non-blocking overlap warning), and confirm dynamic Key/Legend matches F002's 6 `AbsenceType`s.
      - Add recurring `Daily` stand-up + dated `Sprint planning` ceremony, add `Whole team` + specific-attendee meetings, click a ceremony date header to add 2 milestones (confirming `#D00000` overrides `#F8CBAD`, inline edit, `✕` remove, and table `+ Add`).
      - Switch to `Dev hours`, verify `0.5` FTE post-FTE clock-time deductions, separate Sprint-level `OverheadDeduction` reconciliation at Member & Team rows matching `/capacity` identically, muted `SM`/`PO` `—` cells excluded from Team `Dev h` totals, navigate to `/capacity` and open `BreakdownPopover` to confirm `Ceremonies & meetings`, `Planned overtime`, full equation, and distinct event warning badges (`R3`), and verify reload persistence.
      - Navigate to `/calendar/holidays` via `Manage holidays ›`, step year selector, add a `company` holiday, edit a `library` holiday into a `manual` override, remove another `library` holiday (suppressing it), click `Refresh from public calendars` (confirming overrides & suppressions survive with zero duplicates), and restore a suppressed holiday.
      - Verify archived Team/PI read-only deep link and invalid deep-link fallback.
      - Run `@axe-core/playwright` zero-violation scans on `/calendar` (`Days off` with a **populated `#D00000` milestone date header**, `Dev hours`, open popover, open milestone modal) and `/calendar/holidays` across `1440px`, `1024px`, and `768px` (`D6`).
  - **Constraints**: Isolated `.azusa/test-playwright/` state; zero external network requests.
  - **Validation/test location**: `npm run test:e2e`, `npm run test:visual`, `npm run test:run`, `npm run lint`, `npm run typecheck`, `npm run build` all exit `0`.
  - **Out-of-scope files/components**: Production `.azusa/data/`.

---

## Phase 06: Release Prep (MANDATORY)

**Purpose**: Synchronize application version (`0.4.0` → `0.5.0`) across manifest, lockfile, migration, and restore markers, and update all affected Constitution Principle VI living documentation before the final Browser Smoke Test.

- [ ] **T026** `[US6]` Bump application version (`0.4.0` → `0.5.0`) and align version assertions
  - **Target files/components**: `package.json`, `package-lock.json`, `src/persistence/version.ts`, `tests/integration/capacity-migration-backup.test.ts`
  - **Expected behavior**: Bump root `version` to `"0.5.0"` in `package.json` and `package-lock.json` (both top-level and `packages[""]`), update `APP_VERSION = '0.5.0'` in `src/persistence/version.ts`, and update `tests/integration/capacity-migration-backup.test.ts` (`:317`) to assert against the imported `APP_VERSION` constant instead of hardcoded `'0.4.0'` (matching `T006` so every phase stays green).
  - **Constraints**: Preserve existing `'foundation.init'` records on upgrade.
  - **Validation/test location**: `npm run test:run` and `npm run build`.
  - **Out-of-scope files/components**: Feature UI code.

- [ ] **T027** `[P]` `[US6]` Update `CHANGELOG.md`, `README.md`, and `docs/operations/database-and-recovery.md`
  - **Target files/components**: `CHANGELOG.md`, `README.md`, `docs/operations/database-and-recovery.md`
  - **Expected behavior**: Add `0.5.0` entry to `CHANGELOG.md` summarizing F005 Team Calendar & Availability, post-FTE ceremony/meeting/overtime capacity integration (explicitly noting that `/capacity` numbers are unchanged at upgrade when no ceremonies/meetings/overtime exist, and decrease once ceremonies/meetings are added), deprecation of `absences.extra_hours`, and provisional Holiday Management; update `README.md` for `/calendar` and `0.5.0`; update `docs/operations/database-and-recovery.md` for `F005 / 0.5.0` and additive migration `0004_team_calendar_availability.sql`.
  - **Constraints**: Concise and factual; no duplicated specification prose.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts` and `npm run format:check`.
  - **Out-of-scope files/components**: `specs/`.

- [ ] **T028** `[P]` `[US6]` Update `docs/REPO_MAP.md` and `docs/architecture/overview.md`
  - **Target files/components**: `docs/REPO_MAP.md`, `docs/architecture/overview.md`
  - **Expected behavior**: Document all new F005 modules (`src/domain/calendar/*`, `src/application/calendar/*`, `0004_team_calendar_availability.sql`, `src/app/api/calendar/*`, `src/app/calendar/{page.tsx,holidays/page.tsx}`, `src/ui/calendar/*`, and `/capacity` breakdown updates) and update the system/data-flow overview.
  - **Constraints**: Reflect actual implemented paths accurately.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T029** `[P]` `[US6]` Update `docs/architecture/domain-model.md` and `docs/architecture/data-dictionary.md`
  - **Target files/components**: `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`
  - **Expected behavior**: Update `domain-model.md` implementation status to reflect F005 operational calendar entities and post-FTE ceremony/meeting/overtime capacity rules (M0 complete once accepted); update `data-dictionary.md` (`0.5.0`) with `holidays.overrides_library_key`, `holiday_suppressions`, `planned_overtime` (marking `absences.extra_hours` deprecated/unused per `R1`), `sprint_ceremonies`, `meetings`, `meeting_attendees`, `milestones`, and `TeamSprintCalendarView`.
  - **Constraints**: Preserve Data Model v0.6 invariants while documenting `A1`–`A5` & `R1`–`R5` refinements.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T030** `[P]` `[US6]` Add ADR `0005-team-calendar-and-availability.md`
  - **Target files/components**: `docs/architecture/decisions/0005-team-calendar-and-availability.md`
  - **Expected behavior**: Record key F005 architectural decisions, rationale, and operator clarifications (`A1`–`A5`, `R1`–`R9`): single `is_recurring_daily = true` Daily stand-up & additive date+duration events without time-of-day (`A1`), post-FTE clock-time ceremonies/meetings & post-FTE planned overtime with separate Sprint-level `OverheadDeduction` reconciliation and `/capacity` breakdown impact (explicitly noting `/capacity` numbers stay unchanged at upgrade and lower once ceremonies/meetings are logged, `A2`/`R3`), dedicated integer-minute `planned_overtime` table departing from Brief §2.9 `Absence.extra_hours` + deprecating `extra_hours` with legacy values left untouched (**operator-approved `2026-11-29`**, `A3`/`R1`), `overrides_library_key` + `holiday_suppressions` + load-then-resolve order for cross-boundary moved holidays + provisional decoupled Holiday Management placement pending Prototype v3 (`A4`/`R2`/`R8`), contiguous Sprint calendar window & deduplicated `devDaysLost` formula (`R4`/`R7`), `updateIteration` (all Iterations) vs `updateTeam` (current/future Iterations) ceremony-window guards (`R8`), and cell-click popover + dynamic `AbsenceType` legend + `#D00000` milestone red (`A5`, `R6`, `D1`–`D6`).
  - **Constraints**: Match existing ADR style in `0001`–`0004`.
  - **Validation/test location**: `tests/unit/docs-completeness.test.ts`.
  - **Out-of-scope files/components**: Source code.

- [ ] **T031** `[US6]` Run docs sanity check and full quality-gate suite
  - **Target files/components**: `tests/unit/docs-completeness.test.ts` (update if needed for ADR `0005` / version)
  - **Expected behavior**: Verify zero stale references or `TBD`/`TODO` markers across `docs/` and run all 7 quality gates (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`), confirming every command exits `0`.
  - **Constraints**: Leave `F005` unchecked in `docs/feature-roadmap.md` until Phase 07 operator UAT acceptance.
  - **Validation/test location**: All 7 npm quality-gate commands exit `0`.
  - **Out-of-scope files/components**: `docs/feature-roadmap.md` (`T038`).

---

## Phase 07: Browser Smoke Test & Post-UAT Roadmap Acceptance (MANDATORY)

**Purpose**: Walk every user story's **Independent Test** in a real browser against the to-be-merged production build (after Release Prep), confirm visual fidelity, accessibility, and empty/loading/error states, and update `docs/feature-roadmap.md` only after conformance review and explicit operator UAT acceptance.

- [ ] **T032** `[US1]` Walk US1 Independent Test in a real browser (navigation, Team Sprint boundaries, 2/3/4-week Sprints, dated assignments); record result
  - **Target files/components**: Runtime verification on `/calendar` against production build
  - **Expected behavior**: Confirm every step of US1's Independent Test passes with zero console/hydration errors and zero external network requests; record pass/fail evidence in `tasks.md`.
  - **Constraints**: Exercise against production `next start` build.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T033** `[US2]` Walk US2 Independent Test in a real browser (dated absence popover add/edit/move/cancel, planned overtime on weekday/weekend/full-day absence warning, dynamic Key/Legend); record result
  - **Target files/components**: Runtime verification on `/calendar` (`Days off` view)
  - **Expected behavior**: Confirm every step of US2's Independent Test passes with reload persistence; record evidence in `tasks.md`.
  - **Constraints**: Confirm clicking an occupied cell never auto-cancels (`D1`/`A5`).
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T034** `[US3]` Walk US3 Independent Test in a real browser (recurring Daily + dated ceremonies, whole-Team & attendee meetings, date-header & table milestones with red precedence); record result
  - **Target files/components**: Runtime verification on `/calendar` (grid headers + 2 × 2 tables)
  - **Expected behavior**: Confirm every step of US3's Independent Test passes with reload persistence; record evidence in `tasks.md`.
  - **Constraints**: Confirm milestones have `0` capacity impact and override `#F8CBAD` ceremony headers.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T035** `[US4]` Walk US4 Independent Test in a real browser (`Dev hours`, `0.5` FTE post-FTE clock-time deductions, separate Sprint `OverheadDeduction` reconciliation matching `/capacity` + updated `/capacity` `BreakdownPopover`, muted non-dev `—` cells, commitment chips); record result
  - **Target files/components**: Runtime verification on `/calendar` (`Dev hours` view) and `/capacity`
  - **Expected behavior**: Confirm every step of US4's Independent Test passes and `/calendar` Sprint `Dev h` matches `/capacity` identically; record evidence in `tasks.md`.
  - **Constraints**: Confirm zero duplicate UI capacity math and zero provisional commitment tables.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T036** `[US5]` Walk US5 Independent Test in a real browser (Holidays table F004 `Dev days` lost, provisional `/calendar/holidays` read-only Locations, company holiday, library edit→manual override incl. cross-boundary move, library remove→suppress, idempotent refresh, suppress restore); record result
  - **Target files/components**: Runtime verification on `/calendar` and `/calendar/holidays`
  - **Expected behavior**: Confirm every step of US5's Independent Test passes with reload persistence and zero external network calls; record evidence in `tasks.md`.
  - **Constraints**: Confirm no monolithic `/settings` shell, no `+ Location`, and no per-Location `Hours / day`.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T037** `[US6]` Verify US6 Independent Test (F004→F005 migration upgrade, CLI `db:backup`/`db:restore`, visual fidelity at `1440px`, `@axe-core/playwright` zero violations at `1440px`/`1024px`/`768px`, and living documentation); record result
  - **Target files/components**: Runtime verification of migration, backup/restore (`APP_VERSION = '0.5.0'`), empty/loading/error states, keyboard operation, non-color status cues, and living docs
  - **Expected behavior**: Confirm every step of US6's Independent Test passes; record evidence in `tasks.md`.
  - **Constraints**: Confirm `docs/feature-roadmap.md` keeps `F005` unchecked until `T038`.
  - **Validation/test location**: Verification note recorded in `tasks.md`.

- [ ] **T038** `[US6]` Post-UAT roadmap update
  - **Target files/components**: `docs/feature-roadmap.md`
  - **Expected behavior**: Only after conformance review and explicit operator UAT acceptance, tick `- [x] **F005 — Team Calendar & Availability**` and update the roadmap progress summary (`5 / 19`, completing M0 — Foundations).
  - **Constraints**: Do not tick `F005` before operator UAT acceptance.
  - **Validation/test location**: `docs/feature-roadmap.md` + `npm run test:run` (`docs-completeness.test.ts`).
