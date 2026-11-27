# Azusa — Feature Brief 005: Team Calendar & Availability

**Milestone:** M0 — Foundations  
**Feature ID:** F005  
**Version:** 0.1 — Draft for SDD  
**Date:** November 26, 2026  
**Dependencies:** F002 — Organization & PI Cadence; F004 — Capacity Engine & Capacity Planner

**Canonical references:**
- `AZUSA_ROADMAP_v2.md` — F005 and distributed Settings decisions
- `AZUSA_HANDOFF_UPDATE_2026-11-20.md` — §10 Calendar and §13.14 Team Calendar
- `docs/azusa-data-model.md` — v0.6, Organisation and calendar; Capacity and activities
- `docs/azusa-sprint-planning-decisions.md` — Team Calendar, Capacity, Overhead and Milestones
- `AZUSA_HANDOFF.md` — §7.2 Calendar, §10 Calendar, §13.7 Settings and holiday calendar
- `AZUSA_F002_ORGANIZATION_PI_CADENCE_v0.1.md`
- F003 — Work Categories & Allocation
- F004 — Capacity Engine & Capacity Planner, including subsequent clarification decisions
- Azusa Constitution

## 1. Objective

Deliver the operational Team Calendar as the single source of truth for dated leave, availability and calendar-driven capacity.

The Team Calendar provides two views:

- **Days off:** Manage and inspect member availability, leave and attendance.
- **Dev hours:** Inspect the resulting daily and Sprint-level development capacity.

The calendar also manages:

- Location-specific public and company holidays.
- Member absences and attendance records.
- Sprint ceremonies.
- Meetings and their attendees.
- Team-level milestones.
- Planned overtime.

All changes must feed into F004's capacity calculation engine so that available capacity is recalculated consistently.

**User outcome:** As a Scrum Master, I can inspect my Team's availability across a Sprint, record leave and attendance, schedule ceremonies and meetings, maintain milestones and planned overtime, and immediately understand the impact on individual and Team capacity.

## 2. Functional Scope

### 2.1 Team Calendar

The Team Calendar displays one selected Team and Sprint.

It must use the Team-specific scheduled Sprint boundaries established by F002, including the permitted -1, 0 and +1 working-day offset.

The calendar must support:
- Two-week Sprints.
- Three-week Sprints.
- Four-week Sprints.

The number of working days is determined by the selected Sprint's actual scheduled dates, not by a hardcoded 10-day assumption.

The calendar uses the existing organizational context (ART, Team, PI and Sprint) and provides navigation to:
- Sprint Planning.
- Capacity Planner.

Do not create separate calendars for individual Members or Locations.

### 2.2 Days Off View

Display a Member × Day calendar grid.

**Rows:** Team Members.  
**Columns:** Dates within the selected Sprint.

Each Member row displays:
- Name and initials/avatar.
- Location badge.
- Daily absence and attendance markers.
- Relevant absence type and status.

The grid must distinguish:
- Planned leave.
- Unplanned leave.
- Half-day AM.
- Half-day PM.
- Cancelled leave.
- Business trips.
- Work From Home.
- On-site attendance.
- Planned overtime.
- Location-specific public holidays.
- Weekends.

Use the existing prototype's marker styles and colour conventions.

**Interactions:**
- Clicking a Member's day allows the operator to record an absence, half-day, attendance entry or planned overtime.
- Clicking an existing absence entry again cancels it.
- Absence records remain persisted with `status = cancelled`; cancellation must not be treated as hard deletion.
- Entries must be editable so their date, portion or type can be corrected.
- Capacity recalculates after changes.

Absences are always dated.

If someone requests a day off but cannot yet confirm the exact date, the operator may temporarily reserve a placeholder working date (e.g. Sprint Day 2) and move the entry later.

Do not introduce floating or undated absences.

Do not introduce a separate absence-movement history. Only the current dated record and its status are required.

### 2.3 Dev Hours View

Provide an alternative presentation of the same calendar grid.

Each Member/day cell displays the calculated development hours available for that day.

The calculation must consume F004's capacity engine and account for:

- Team workday hours (default 8.0 hours).
- Member FTE.
- Member's Location-specific holidays.
- Active capacity-affecting absences.
- Daily stand-up.
- Dated Sprint ceremonies.
- Meetings attended by the Member.
- Applicable planned overhead reserves.
- Planned overtime.

Rules:
- Full-day leave or holiday results in zero available hours.
- Half-day availability is reduced accordingly.
- Non-capacity-affecting attendance records do not reduce hours.
- Planned overtime adds its recorded extra hours.
- Negative development capacity is clamped to zero by F004 and produces a warning.
- Overlapping absences, holidays and weekends must not be deducted twice.

The Dev Hours view must display:

**Per Member:**
- Daily available hours.
- Total development hours for the selected Sprint.
- `VS PI` — difference between current live capacity and PI-committed capacity.
- `VS SPRINT` — difference between current live capacity and Sprint-committed capacity.

**Team:**
- Daily aggregated development hours.
- Total Team development hours for the Sprint.

Only Members eligible for development capacity contribute to the Team capacity totals. The current F004 decision restricts this to the `Team member` role. Admin, RTE, SM and PO are excluded.

Other Members may still appear in the calendar for attendance and meeting purposes.

All durations should use the canonical integer-minute representation established by the data model and F004.

### 2.4 Absence Management

Use the existing `Absence` and `AbsenceType` entities established in F002.

Initial AbsenceType catalog:

| Code | Description |
|---|---|
| AL | Annual Leave |
| SL | Sick Leave |
| HD | Half Day |
| BT | Business Trip |
| WFH | Work From Home |
| ON_SITE | On-site attendance |

The catalog is configurable through its owning domain model. F005 must not introduce a separate hardcoded absence-type enum.

Each Absence supports:
- Member.
- Date.
- Portion (`full`, `am`, `pm`).
- Absence type.
- Planned/unplanned flag.
- Status (`active`, `cancelled`).
- Optional note.

The `AbsenceType.affects_capacity` property is authoritative.

Examples:
- AL and SL reduce capacity.
- HD reduces capacity according to its portion.
- BT, WFH and ON_SITE are attendance indicators and do not reduce capacity.

Sick-leave notes remain optional. Do not introduce unnecessary medical information fields.

For now, absence entry is performed by the SM. Self-service is deferred until multi-user/RBAC functionality becomes necessary.

### 2.5 Location Holidays

Holidays belong to Locations, not Teams.

The Member's Location determines which holiday calendar applies to their capacity.

F002 establishes:
- Location records.
- Location metadata and time zones.
- Initial public-holiday seed records.

F005 owns the operational holiday management interface.

**Holiday management experience:**

Provide a holiday-management view accessible from the Holidays section of the Team Calendar.

The existing Locations and Holidays prototype is the design reference:
- Year selector.
- Locations overview.
- Full-year month × Location holiday grid.
- Refresh from public calendars.
- Add Company Holiday action.
- Visual distinction between public, company, unconfirmed and weekend holidays.

Location records and their organizational metadata remain owned by F002. F005 must not introduce another Location registry or allow duplicate Location creation.

The Location overview is read-only for this feature.

Do not carry forward the old prototype's per-Location hours/day editing. That capability is deferred.

**Holiday data rules:**

- Public holidays are seeded using `date-holidays`.
- Company-declared and manually maintained holidays override library-generated entries.
- Preserve holiday source (`library`, `company`, `manual`).
- Preserve confirmation status.
- Unconfirmed holidays immediately reduce capacity and display an `est.` indicator.
- If a holiday is subsequently cancelled or changed, capacity is recalculated.
- Half-day holidays reduce capacity by half.
- Weekend holidays have no capacity effect.

Refreshing public holiday data must preserve company and manual overrides.

Do not introduce a paid holiday API or hosted calendar service.

**Team Calendar Holidays table:**

For the selected Sprint, show the holidays relevant to the Team's Member Locations.

Columns:
- Date.
- Holiday name.
- Location.
- Development days lost.

The lost-capacity value comes from F004, not a separately implemented calculation.

### 2.6 Sprint Ceremonies

Use the `SprintCeremony` entity.

Ceremonies are entered **per Sprint with explicit dates**.

There are no reusable fixed-day ceremony templates in this model.

Each ceremony has:
- Team.
- Iteration.
- Date.
- Name.
- Duration.

The whole Team attends a Sprint ceremony.

Examples:
- Sprint Planning.
- Backlog Refinement.
- Sprint Review.
- Retrospective.
- Daily stand-up.

Ceremony entries affect the Dev Hours view and the corresponding date-header highlighting.

The calendar must provide:
- Add ceremony.
- Edit ceremony.
- Remove ceremony.
- Display ceremonies in chronological order.

The Scrum Ceremonies table displays:
- Date.
- Ceremony name.
- Duration.

A Daily stand-up entry is displayed as `Daily` in the table.

### 2.7 Meetings

Use the `Meeting` entity.

Meetings are Team-associated calendar activities that may involve the whole Team or selected Members.

Each meeting has:
- Team.
- Date.
- Name.
- Duration.
- Attendees (whole Team or selected Members).

Rules:
- A whole-Team meeting deducts time from all applicable Team Members.
- A meeting with specific attendees deducts time only from those attendees.
- Members not attending the meeting must not have their capacity reduced.
- Meeting entries affect the Dev Hours view.
- Meeting dates participate in calendar event highlighting.

Provide:
- Add meeting.
- Edit meeting.
- Remove meeting.
- Attendee selection.
- Whole-Team attendance option.

The Meetings table displays:
- Date.
- Meeting name.
- Attendees.
- Duration.

Use Member avatars/initials to identify attendees where practical.

### 2.8 Team Milestones

Use the `Milestone` entity.

A Milestone is a generic Team-level dated marker.

Examples:
- Release.
- Code freeze.
- Product demonstration.
- Partner cut-over.
- Audit deadline.

A Milestone has:
- Team.
- Date.
- Name.
- Scope (`team`).

Rules:
- No separate milestone categories or types.
- Multiple milestones may exist on the same date.
- Milestones do not affect capacity.
- If a milestone day consumes working hours, record the appropriate meeting or overtime separately.
- ART-level milestones are deferred to F019.

**Interactions:**

Clicking a working date in the calendar header opens the Milestone modal.

If the date has no milestone:
- Show an Add Milestone form.
- Enter a name.
- Save.

If the date already has milestones:
- Display existing milestones.
- Allow inline editing.
- Allow removal using the remove control.
- Allow adding another milestone.
- Provide Done to close the modal.

The Milestones table also provides `+ Add`, opening the same modal with a date selector.

**Visual treatment:**
- Solid red date header (`#FF0000`) with white text.
- Milestone highlighting takes precedence over ceremony highlighting.
- Header tooltip displays the milestone names and relevant ceremonies.

Work-item milestone linking and target-date plan checks belong to F007. F005 only owns the Milestone records and calendar presentation.

### 2.9 Planned Overtime

Support planned overtime as a dated Member availability entry.

Use the `extra_hours` capability in the v0.6 Absence/availability model.

Rules:
- Overtime is associated with a Member and date.
- Extra hours must be explicitly recorded.
- The calendar displays a dedicated planned-overtime marker.
- Overtime increases available development hours through F004.
- The prototype uses +2 hours as its sample value; do not hardcode this as a universal overtime allowance.

Planned overtime must remain distinct from:
- Unplanned actual deductions during Sprint execution.
- Overhead reserves.
- Overhead tickets.

F005 manages the planned overtime entry. Actual unplanned activity recording belongs to the later Sprint execution features.

### 2.10 Commitment Status and Capacity Comparisons

The calendar must expose the commitment status of the selected PI and Sprint.

Display two status chips:

- `PI committed` / `PI not started · capacity is live`
- `Sprint committed` / `Sprint not started`

The commitment chips are informational. F005 does not create PI or Sprint Commitments.

When a corresponding immutable commitment exists:
- Show the committed status.
- Show the commitment date in the tooltip.
- Enable the corresponding comparison column.

The comparison is:

`capacity_delta = current_live_capacity − committed_capacity`

Rules:
- `VS PI` is shown only when a PI Commitment exists.
- `VS SPRINT` is shown only when a Sprint Commitment exists.
- A Member added after a commitment has no historical line to compare against; show the Member as new rather than treating their committed capacity as zero.
- Current capacity remains live and updates when calendar records change.
- Historical commitment totals remain immutable.

F012 and F013 own the creation of the relevant commitment records. F005 consumes them when available; it must not implement a duplicate snapshot mechanism.

### 2.11 Live Capacity Recalculation

Changes to calendar records must update the affected Member/day and Team totals.

Examples:
- Adding leave reduces availability.
- Cancelling leave restores availability.
- Adding a meeting reduces capacity only for its attendees.
- Adding a ceremony reduces capacity for the whole Team.
- Adding a holiday affects Members in the corresponding Location.
- Adding planned overtime increases available hours.
- Moving an absence to another date recalculates both affected dates.

All calculations must use F004's capacity engine.

F005 must not duplicate the capacity formulas in UI components.

## 3. UI Layout

Follow the supplied Team Calendar prototypes:

- `LeaveCalendar.dc.html`
- `LeaveCalendar3w.dc.html`
- `LeaveCalendar4w.dc.html`
- Screenshots `10-team-calendar-2w.png`, `10b-team-calendar-3w.png`, `10c-team-calendar-4w.png`.

### 3.1 Header

Display:
- Team Calendar title.
- `Days off | Dev hours` view switch.
- Short usage instructions.
- PI and Sprint commitment status chips.
- Sprint Planning navigation.
- Capacity Planner navigation.

### 3.2 Calendar Grid

Use a Member × Day layout.

The calendar must display:
- Member name and Location.
- Day headers and week grouping.
- Daily availability markers or Dev hours.
- Per-Member Sprint total.
- VS PI and VS SPRINT columns where applicable.
- Team daily totals.
- Overall Team total.

Visual indicators:
- Today: yellow.
- Weekend: muted grey.
- Holiday: green.
- Ceremony/event date: light orange.
- Milestone: solid red, overriding ceremony tint.
- Absence and attendance types: existing prototype marker palette.

### 3.3 Responsive Sprint Lengths

Use the existing prototypes as references.

- Two-week Sprints: normal layout.
- Three-week Sprints: normal layout.
- Four-week Sprints: compact Member-name and total columns to preserve usable space.

At narrower widths, horizontal scrolling is acceptable.

If the four-week grid becomes too wide, weekends may collapse into narrow dividers, as described in the design handoff.

### 3.4 Tables Below the Grid

Use the established 2 × 2 arrangement:

| Top left | Top right |
|---|---|
| Holidays | Milestones |

| Bottom left | Bottom right |
|---|---|
| Scrum ceremonies | Meetings |

Each table has its own Add action where applicable.

Keep the visual design consistent with the Team Calendar prototype rather than creating four unrelated administration pages.

### 3.5 Holiday Management View

The holiday management view should be part of F005's calendar experience.

Reuse the existing Locations and Holidays design as a starting point, with these ownership adjustments:

- Location registry remains F002-owned and read-only.
- Holiday records are maintained through F005.
- No separate monolithic Settings application.
- No per-Location hours/day configuration.
- No duplicate Location creation.

## 4. Domain Model and Invariants

Use the conceptual entities already established by Data Model v0.6.

| Entity | F005 responsibility |
|---|---|
| Location | Read-only reference data from F002 |
| Holiday | Management and editing UI |
| Absence | Dated entry, editing and cancellation |
| AbsenceType | Consume configured type and capacity behavior |
| SprintCeremony | Create, edit and remove dated ceremonies |
| Meeting | Create, edit and remove meetings with attendees |
| Milestone | Create, edit and remove Team milestones |
| OverheadReserve | Consume applicable capacity values; not an independent editor |
| Absence.extra_hours | Record planned overtime |

**Required invariants:**

1. The Team Calendar is the single source of truth for dated leave and availability.
2. Absences must always have a date.
3. Holidays belong to Locations, not Teams.
4. Member-specific Location holidays must not change the Team's Sprint schedule.
5. Holiday refresh must preserve company/manual overrides.
6. Unconfirmed holidays reduce capacity immediately and display `est.`.
7. Weekend holidays do not reduce capacity.
8. Absence and holiday overlaps must not double-deduct capacity.
9. Cancelled absences do not reduce capacity.
10. `affects_capacity` is the authoritative AbsenceType capacity rule.
11. Only eligible Team members contribute to development capacity totals.
12. Dated Member-Team assignments must be respected when calculating and presenting Team capacity.
13. Ceremonies are dated per Sprint and attended by the whole Team.
14. Meetings deduct capacity only from their attendees.
15. Milestones do not affect capacity.
16. Planned overtime adds extra hours through the F004 calculation contract.
17. All duration calculations use integer minutes internally.
18. Commitment comparisons never rewrite immutable PI or Sprint Commitments.
19. No per-change absence-movement audit history is required.
20. F005 must not duplicate F004's calculation engine.

## 5. Acceptance Criteria

**AC01 — Team Calendar availability**

Given an existing Team and PI from F002, the operator can select an Iteration and inspect the Team's scheduled calendar using its Team-specific Sprint boundaries.

**AC02 — Sprint duration support**

The calendar renders correctly for two-, three- and four-week Sprints without assuming a fixed Sprint duration.

**AC03 — Days off view**

The operator can inspect Member availability and distinguish leave, attendance, holidays, weekends and cancellation states.

**AC04 — Absence entry**

The operator can create a dated absence with its Member, type, portion and planned/unplanned status.

**AC05 — Absence cancellation**

Cancelling an absence preserves the record with `status = cancelled` and removes its capacity impact.

**AC06 — No floating leave**

The system rejects undated absence entries. A provisional placeholder date is permitted.

**AC07 — Multi-location holiday handling**

Given Members in different Locations, each Member's capacity uses the correct Location holiday calendar.

**AC08 — Holiday management**

The operator can inspect and maintain holiday records, add company/manual holidays, refresh library-generated holidays and preserve overrides.

**AC09 — Unconfirmed holidays**

Unconfirmed holidays reduce capacity immediately and are visibly marked as estimated.

**AC10 — Ceremony management**

The operator can create, edit and remove dated Sprint ceremonies. The entries affect the corresponding Team Members' available hours.

**AC11 — Meeting management**

The operator can create meetings for the whole Team or selected attendees. Only the applicable attendees have their capacity reduced.

**AC12 — Milestone management**

The operator can create, edit and remove Team milestones. Multiple milestones may exist on one date, and milestone headers take precedence over ceremony highlighting.

**AC13 — Planned overtime**

The operator can record planned overtime against a Member and date. The resulting extra hours are included by F004 in capacity calculations.

**AC14 — Dev Hours view**

The operator can inspect daily development hours, Member totals and Team totals, with relevant leave, holiday and event deductions.

**AC15 — Commitment comparisons**

Where PI/Sprint Commitment records exist, the calendar displays commitment status and live-versus-committed capacity differences. New Members are not incorrectly compared against zero.

**AC16 — Dated Member-Team assignments**

Capacity is attributed to the correct Team only during the applicable Member-Team assignment period.

**AC17 — Canonical calculations**

All displayed capacity figures come from F004. No duplicate calculation formulas are implemented in the calendar UI.

**AC18 — Documentation and verification**

Automated tests cover absence entry/cancellation, holiday handling, multi-location behavior, ceremonies, meetings, milestones, planned overtime, capacity integration and commitment comparisons.

Update the data model, data dictionary, repository map, relevant ADRs and changelog alongside implementation.

## 6. Out of Scope

- ART, Team, Member and PI management — F002.
- Location registry creation and organizational assignment — F002.
- Capacity calculation formulas and normalized velocity — F004.
- Work Category and allocation management — F003.
- OverheadReserve creation during PI Planning — F009.
- OverheadReserve adjustment and OverheadTicket management — F013.
- Buffer management and BufferDraw — F009/F014.
- Sprint Planning and Start Sprint — F013.
- Actual unplanned deductions and Sprint execution activities — F014/F015.
- PI Commitment creation — F012.
- Sprint Commitment creation — F013.
- Sprint Closure and finalized Actuals — F015.
- ART-level milestones and ART Program Board presentation — F019.
- Authentication, RBAC and multi-user access.
- Self-service leave entry.
- Per-Location workday-hours configuration.
- A centralized Settings application.
- External hosted calendar services or paid APIs.

## 7. Specify/Plan Decisions to Resolve

The following points should be explicitly settled during Agy's Specify/Plan stage.

### 7.1 Daily stand-up representation

The prototype displays Daily stand-up as a single `Daily` entry, while the v0.6 model defines SprintCeremony with an explicit date.

Determine whether to:
- Generate one dated SprintCeremony per working day.
- Represent a daily recurring ceremony through a separate recurrence rule.

Do not reintroduce reusable fixed-day CeremonyTemplates.

### 7.2 OverheadReserve distribution in daily Dev Hours

OverheadReserve is persisted per Member × Iteration × Category, not per date.

The calendar's Dev Hours view must reconcile daily cells with the Member's Sprint total.

Determine whether Sprint-level reserves should:
- Be displayed as a separate Sprint-level deduction; or
- Be distributed across working days as a derived presentation value.

Do not persist a second set of dated overhead deductions.

### 7.3 Overlapping ceremonies and meetings

The current model records dates and durations but does not explicitly establish start/end times.

Determine how to handle overlapping ceremonies and meetings so the same time is not deducted twice from a Member's capacity.

Decide whether date + duration is sufficient for the current scope or whether time-of-day fields are required.

### 7.4 Planned overtime boundaries

Determine whether planned overtime is allowed on weekends or public holidays and how its extra hours interact with the F004 zero-capacity rules.

Preserve `extra_hours` as the underlying value and avoid hardcoding the prototype's +2-hour example.

### 7.5 Holiday refresh and overrides

Specify the precedence and update behavior when refreshed library holidays conflict with existing company/manual entries.

The intended outcome is to preserve manual/company decisions without accumulating duplicate effective holidays.

### 7.6 Dated Member-Team assignments

F004 requires dated Member-Team assignments for capacity calculations, while earlier organization records describe Member ownership through Team association.

Confirm the canonical assignment representation and its ownership with F002/Claude. F005 must consume the correct assignment periods rather than infer historical membership from a Member's current Team.

### 7.7 Commitment integration

F005 precedes F012 and F013 in the roadmap.

Confirm the initial behavior when commitment records do not yet exist:
- Display the live/not-started chips.
- Suppress unavailable comparison values.
- Wire the comparison columns to immutable commitment data when F012/F013 become available.

Do not introduce provisional commitment tables in F005.

## 8. Feature Exit Criteria

F005 is complete when:

- The Team Calendar is the operational source of truth for dated availability.
- The operator can manage absences, holidays, ceremonies, meetings, milestones and planned overtime.
- Days off and Dev Hours views work for all supported Sprint durations.
- Per-Member and Team capacity totals reconcile with F004.
- Location-specific holidays and dated Member-Team assignments are handled correctly.
- Commitment status and comparisons consume the correct immutable records when available.
- The holiday management experience is integrated without creating a monolithic Settings application.
- Automated tests and project documentation are updated.

**M0 completion:** F001–F005 provide the local application foundation, organizational structure, category model, capacity engine and operational calendar required for M1 — Team PI Planning.

**Next feature:** F006 — Project & Feature Registry.