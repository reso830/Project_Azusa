# Azusa — Feature Brief 002: Organization & PI Cadence

**Milestone:** M0 — Foundations  
**Feature ID:** F002  
**Version:** 0.1 — Draft for SDD  
**Date:** November 23, 2026  
**Dependency:** F001 — Application Foundation

**Canonical references:**
- `AZUSA_HANDOFF.md` — §§7.1, 7.2 and 10
- `AZUSA_HANDOFF_UPDATE_2026-11-20.md`
- `docs/azusa-data-model.md` — v0.6
- `AZUSA_ROADMAP_v2.md`
- `AZUSA_F001_APPLICATION_FOUNDATION_v0.2.md`

## 1. Objective

Establish Azusa's organizational structure and PI/Sprint calendar definitions so subsequent features can configure work categories, calculate capacity, maintain team calendars, and support Team-level PI Planning.

The feature provides the foundational records and management capabilities for:

- Agile Release Trains (ARTs)
- Teams within an ART
- Team members and their organizational attributes
- Locations and time zones used by member-based holiday calendars
- Program Increments (PIs)
- Iterations (Sprints), including optional IP iterations
- Team-specific Sprint schedules with a permitted one-working-day lead/lag
- The foundational Location, Holiday, Absence and AbsenceType records needed by downstream capacity calculations

**User outcome:** As the local Azusa operator, I can establish one or more ARTs, configure each ART's PI and Sprint cadence, organize its Teams and members, assign members to locations, and define each Team's permitted one-working-day schedule offset. The resulting organizational and calendar records are consistent and available to downstream planning and capacity features.

## 2. Scope and functional requirements

### 2.1 ART management

- Create and edit ART records.
- An ART has a name and owns its PI/Iteration cadence.
- Different ARTs may have different PI and Sprint structures.
- The ART record provides the organizational parent for its Teams and PIs.
- The data model may reference ART-level default work categories and calendar settings, but category definition and allocation behavior belong to F003.

### 2.2 Team management

- Create and edit Teams within an ART.
- Each Team belongs to exactly one ART.
- A Team uses the ART's canonical PI and Iteration identities.
- Establish the Team's `sprint_offset_workdays` with the permitted values:
  - `-1`: one working day ahead of the ART iteration schedule.
  - `0`: aligned with the ART iteration schedule.
  - `+1`: one working day behind the ART iteration schedule.
- The offset is a Team-level scheduling arrangement, not a separate Sprint cadence or identity.
- Team-specific scheduled Sprint boundaries must be distinguishable from the canonical ART Iteration dates.
- Preserve the Team's default `hours_per_day` value of **8.0** in the domain model. The workday-hours setting and capacity behavior are handled by the owning capacity/Sprint Planning features; F002 must not implement capacity calculations.
- Do not configure planning style or DoR/DoD templates in F002. Those settings belong to their owning features.

### 2.3 Member management

- Create and edit Member records associated with a Team.
- Support the conceptual Member attributes defined by Data Model v0.6:
  - Full name
  - Nickname
  - Initials
  - Organizational role
  - FTE factor (default `1.0`)
  - Location
  - Avatar colour
- Support multiple members per Team without a fixed roster-size limit inherited from the predecessor spreadsheet.
- A Member belongs to one Team and has a Location association for member-based holiday calculations.
- Preserve the rule that members whose role is **PO** or **SM** do not contribute to development capacity. Actual capacity calculation belongs to F004.
- FTE is stored as a member attribute. F002 does not calculate capacity from it.

### 2.4 Role placeholders and single-user operation

- Preserve the role concepts needed by the domain and future workflow provenance: Admin, RTE, SM, PO and Team member. Business Owner remains tentative in the conceptual model.
- These are role/provenance placeholders only in the current local, single-user scope.
- Do not implement authentication, user accounts, multi-user sessions, authorization rules or RBAC enforcement.
- Preserve `created_by`, `updated_by` and timestamp conventions established in F001. Use the existing local actor convention for current writes; do not create user-management functionality.
- The Admin/RTE and SM responsibilities described by the domain model are workflow ownership expectations, not access-control enforcement in F002.

### 2.5 Location registry and time zones

- Establish a reusable Location registry; locations are shared reference data, not owned by individual Teams.
- A Member is associated with a Location. A Team may contain members from multiple Locations.
- Support the Location attributes in Data Model v0.6: code, name, country, optional subdivision, time zone, calendar source and last-refreshed metadata.
- Use ISO 3166-1 country codes and ISO 3166-2 subdivision codes where applicable.
- Seed the initial Location set from the handoff:

| Code | Location | Country / subdivision | Displayed offset in handoff | Calendar source |
|---|---|---|---|---|
| `PH` | Philippines | PH | UTC+8 | Public holidays, PH |
| `SG` | Singapore | SG | UTC+8 | Public holidays, SG |
| `AU-WA` | Western Australia | AU · WA | UTC+8 | Public holidays, AU · WA |
| `IN` | India · Karnataka | IN · KA | UTC+5:30 | Public holidays, IN · KA |
| `UK` | United Kingdom · England | GB · ENG | UTC+0 | Bank holidays, GB · ENG |
| `US-TX` | United States · Texas | US · TX | UTC−6 | Federal holidays + one company day |

- Store time-zone identifiers in a form compatible with F001's IANA timezone handling; do not rely solely on fixed UTC offsets for runtime date/time calculations.
- Do not implement per-location workday-hours configuration in F002; it is a future enhancement identified in the handoff.

### 2.6 Holiday and absence reference records

F002 establishes the foundational data and relationships needed by later capacity features. It does **not** deliver the full Team Calendar experience.

**Holiday records:**

- Holidays belong to Locations, not Teams.
- Support the conceptual Holiday attributes: Location, date, name, portion (`full` / `half`), source (`library` / `company` / `manual`) and confirmation state.
- Seed public-holiday data using the `date-holidays` npm library (ISC licence), for the initial supported Locations where supported by the library.
- Company-declared and manually entered holidays must be representable as overrides to library data.
- Dates that depend on lunar or moon-sighting announcements must be representable as unconfirmed/estimated.
- Preserve the source and confirmation metadata so F005 can present the correct holiday status and refresh behavior.

**Absence records and types:**

- Establish the Absence and AbsenceType concepts and their Member relationship for downstream calendar and capacity use.
- An Absence is always dated; floating/undated leave is not supported. A provisional date can be assigned and moved later.
- Preserve the model attributes: Member, date, portion (`full` / `am` / `pm`), type, planned flag, status (`active` / `cancelled`) and optional note.
- AbsenceType supports name, code, colour and `affects_capacity`.
- The handoff examples include AL (annual leave), SL (sick leave), HD (half day), BT (business trip, does not affect capacity), WFH and on-site (attendance only). The exact initial catalog can be confirmed during Specify.
- Planned overtime is represented by the existing absence/availability model's extra-hours capability where applicable; the Team Calendar feature owns its operational interaction and capacity effect.

**Boundary with F005:** F002 establishes the records, relationships, initial Location catalog and public-holiday seed needed by capacity calculations. F005 owns the full Team Calendar UI and the day-to-day entry/editing experience for absences, holidays, ceremonies, meetings, milestones and planned overtime. Do not build a separate centralized Settings application.

### 2.7 PI management

- Create and edit PI records belonging to an ART.
- A PI has a name, explicit start date, explicit end date and lifecycle status.
- PI boundaries are explicitly configured; they are not inferred from calendar quarters or from the PI name.
- Different ARTs may use different PI calendars and cadence structures.
- PI naming conventions such as `PI-YYYY.n` are examples, not mandatory rules.
- F002 establishes the PI definition and its Iteration structure. The **Start PI** action and creation of immutable PI Commitments belong to F012.

### 2.8 Iteration / Sprint cadence configuration

- Configure the ART's Iteration structure within each PI.
- Admin/RTE is the intended configuration owner in the domain model; RBAC is not enforced in the current single-user phase.
- Support a configurable number of development Sprints and an optional IP iteration.
- Sprint duration is configurable and is not restricted to a two-week cadence. Explicit scheduled start and end dates are authoritative; the number and duration of Sprints may differ between ARTs and organizations.
- Each Iteration has:
  - Parent PI
  - Explicit name
  - Explicit scheduled start and end dates
  - Kind: `development` or `ip`
- Admin/RTE can name Sprints. The optional `YYWW` convention refers to the ISO calendar week in which the Sprint ends. It is a naming convention only; dates must never be derived from the name.
- PI and Sprint names, dates and cadence must not assume calendar-quarter alignment.
- Preserve the PI/Iteration relationship and ordering so downstream screens can present Sprints consistently.

### 2.9 Team-specific Sprint schedule

- Teams in the same ART share canonical Iteration identities and the ART's overall cadence.
- A Team may lead or lag by at most one **working day** for operational scheduling and ceremony management.
- Support only `-1`, `0` and `+1` working-day offsets in the current scope.
- Team-specific scheduled Sprint start/end boundaries must be available to downstream capacity and calendar calculations without changing the canonical ART Iteration dates or identity.
- The Team offset must not create a separate PI or Sprint sequence.
- The exact working-day calendar used to calculate the offset must be made explicit during Specify/Plan if it is not already determined by the existing calendar utilities. Do not silently substitute calendar days.

## 3. User experience scope

No dedicated high-fidelity prototype is supplied for F002's organization and cadence-management screens. This feature should establish the minimum usable management experience consistent with Azusa's existing design system.

Expected capabilities:

- ART list and create/edit interaction.
- Team list within an ART and create/edit interaction, including the Team schedule offset.
- Member roster within a Team and create/edit interaction, including FTE, role and Location assignment.
- PI list/detail within an ART and create/edit interaction.
- PI Iteration/Sprint structure editor for names, kinds, explicit dates and configurable count/duration.
- Location registry sufficient to inspect the seeded Locations and their time-zone/calendar-source metadata.

These are functional surfaces, not a mandate to create a large administration workspace. The exact page composition, navigation entry points and form layouts should be defined during Specify using the existing shell and Kumiko design system.

Configuration is delivered with the feature that owns it. F002 must not create a standalone Settings application.

## 4. Domain invariants and validation

The implementation must preserve these invariants:

1. A Team belongs to exactly one ART.
2. A PI belongs to exactly one ART.
3. An Iteration belongs to exactly one PI.
4. An ART owns its PI/Iteration cadence; different ARTs may have different cadences.
5. Teams within an ART share canonical PI and Iteration identities.
6. A Team's Sprint offset is limited to −1, 0 or +1 working day.
7. A Team offset changes the Team-specific scheduled boundaries, not the canonical ART Iteration identity or dates.
8. A Member belongs to one Team and references a Location.
9. Locations are shared reference data; holidays belong to Locations, not Teams.
10. PI and Iteration names are stored explicitly. Names do not determine dates.
11. PI and Iteration dates are explicit and chronologically coherent.
12. PO and SM members are excluded from development capacity; F002 stores the role but does not calculate capacity.
13. Absences are dated and have explicit portion and status values.
14. Holiday source and confirmation state are preserved, including company/manual overrides and estimated dates.
15. F002 does not create PI Commitments or Sprint Commitments.

Any further constraints (for example, whether overlapping PI definitions within one ART are permitted) must be confirmed during Specify rather than silently assumed.

## 5. Acceptance criteria

**AC01 — ART management**  
The operator can create and edit ART records. Each ART is independently identifiable and can own its own PI/Iteration cadence.

**AC02 — Team ownership**  
The operator can create and edit Teams under an ART. A Team cannot be assigned to multiple ARTs. Team records preserve the configured schedule offset and the 8.0-hour default workday value.

**AC03 — Member roster**  
The operator can create and edit Members under a Team, including name, nickname, initials, role, FTE factor, Location and avatar colour. There is no fixed 13-member roster limit.

**AC04 — Role and capacity metadata**  
PO and SM roles are represented so downstream capacity logic can exclude those members. No authentication or RBAC behavior is introduced.

**AC05 — Location registry**  
The six initial Locations from the handoff are available with their country/subdivision, time-zone and calendar-source metadata. A Member can be assigned to a Location, and a Team can contain Members from multiple Locations.

**AC06 — Holiday reference data**  
Holiday records can be associated with Locations and preserve date, portion, source and confirmation state. Initial public-holiday data is seeded from `date-holidays` where supported. Company/manual overrides and unconfirmed estimated dates can be represented without losing their provenance.

**AC07 — Absence reference model**  
The database/domain model supports dated Member absences, full/AM/PM portions, planned/unplanned distinction, active/cancelled status and configurable AbsenceTypes with `affects_capacity`. F002 does not need to deliver the full Team Calendar entry workflow.

**AC08 — PI management**  
The operator can create and edit PIs under an ART with explicit names and start/end dates. PI boundaries do not depend on calendar quarters or name parsing.

**AC09 — Configurable Iteration structure**  
The operator can configure a PI's development Sprint count, optional IP iteration, explicit Sprint names, kinds and scheduled start/end dates. Different ARTs can use different structures and durations.

**AC10 — Optional Sprint naming convention**  
The system can support the optional `YYWW` ending-ISO-week naming convention, but it also accepts arbitrary user-supplied names. Dates remain authoritative and are never calculated from names.

**AC11 — Team lead/lag**  
The operator can configure a Team offset of −1, 0 or +1 working day. The resulting Team schedule is distinct from, but remains linked to, the canonical ART Iteration identity. Values outside the permitted range are rejected.

**AC12 — Calendar data integrity**  
Holiday and absence records retain their Location/Member associations and source/status metadata. No undated absence is accepted.

**AC13 — Downstream readiness**  
F003–F005 can consume ART, Team, Member, PI, Iteration, Location, Holiday and Absence records without introducing duplicate organizational or calendar definitions.

**AC14 — Documentation and verification**  
The conceptual domain model, data dictionary, repository map and feature documentation are updated for the implemented entities and rules. Automated tests cover ownership, cadence, date, offset, location and reference-data invariants.

## 6. Out of scope

- Authentication, user accounts, multi-user sessions, permission management and RBAC enforcement.
- Start PI action, PI Commitment snapshots, plan versioning and commitment comparison (F012).
- Start Sprint, Sprint Commitments, Sprint Planning and Sprint Closure (F013/F015).
- Work Category definitions, category defaults, Team overrides and PI allocation percentages (F003).
- Capacity calculations, normalized velocity, forecast SP and Capacity Planner UI (F004).
- Full Team Calendar UI and day-to-day editing of leave, holidays, ceremonies, meetings, milestones and overtime (F005).
- Team planning style (Owner/Distributed) and DoR/DoD templates (their owning features).
- Work items, Projects, Features, Stories, Bugs and Tasks (F006/F007 onward).
- A standalone Settings application.
- Per-location workday-hours configuration, self-service days off and other future enhancements identified in the handoff.

## 7. Implementation guidance

These are constraints and areas for the Specify/Plan stages, not a prescribed physical schema or task breakdown.

- Treat Data Model v0.6 as the conceptual source of truth. This brief does not prescribe one database table per conceptual entity.
- Preserve ART iteration identity separately from Team-specific scheduled Sprint boundaries.
- Use explicit dates as scheduling truth. Do not parse names to determine dates.
- Use IANA timezone identifiers for runtime timezone calculations, consistent with F001; displayed UTC offsets in the handoff are reference values, not substitutes for timezone rules.
- Keep Location and Holiday reference data separate from Team membership; a Member's Location determines the local holiday calendar used later for capacity.
- Seed the six documented starting Locations and public-holiday records without hardcoding a single global holiday calendar.
- Keep role placeholders separate from authorization. Do not introduce RBAC as an incidental part of organization setup.
- Avoid implementing the Team Calendar UI here. Establish the records and relationships F004/F005 need, then deliver operational calendar interactions in F005.
- Add deterministic tests for PI/Sprint date generation, custom naming, optional IP iteration, Team offsets, cross-location membership, and holiday/absence associations.
- Update `docs/architecture/domain-model.md`, `data-dictionary.md`, `docs/REPO_MAP.md`, relevant ADRs and `CHANGELOG.md` as implementation requires. Documentation is part of the Feature's Definition of Done.

## 8. Specify/Plan questions to resolve before implementation

The following points are not fully specified by the source documents and should be resolved during Agy's Specify/Plan stage. They must not be silently guessed:

1. **Working-day calendar for Team offsets:** Is the one-day offset calculated using weekdays only, or should it account for an ART-level calendar/holiday rule? Teams can span multiple Locations, so an individual member's local holiday calendar cannot automatically define one Team-wide offset.
2. **PI/Iteration overlap rules:** Are overlapping PIs or Iterations within the same ART prohibited, or should the system permit special cases? The source establishes explicit dates and ownership but does not state every overlap constraint.
3. **Location/holiday/absence UI boundary:** This brief places Location registry and initial reference-data setup in F002, while F005 owns operational holiday and absence editing through the Team Calendar. Confirm the minimum F002 screens needed without duplicating F005.
4. **AbsenceType initial catalog:** Confirm which of the handoff examples (AL, SL, HD, BT, WFH, on-site) should be seeded in the first implementation.
5. **Member role catalog:** Confirm the initial concrete role values and retain Business Owner as tentative unless the operator approves it.
6. **Member lifecycle and deletion:** Define how a Member or Team that already has historical planning/commitment records is deactivated or removed. Do not cascade-delete historical records.

## 9. Feature exit criteria

F002 is complete when:

- ARTs, Teams and Members can be established and maintained.
- Each ART can have its own explicitly configured PI and Sprint cadence.
- Teams share ART iteration identities while supporting the permitted one-working-day schedule offset.
- Member FTE, role and Location information is available to downstream capacity calculations.
- The initial Location and holiday reference data, plus dated Absence/AbsenceType model, is available without implementing the full Team Calendar.
- Domain invariants are covered by automated tests.
- Documentation accurately reflects the implemented model and behavior.

**Next dependencies:** F003 — Work Categories & Allocation; F004 — Capacity Engine & Capacity Planner; F005 — Team Calendar & Availability; F006 — Project & Feature Registry.