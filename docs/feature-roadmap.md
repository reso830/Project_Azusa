# Azusa — Milestone & Feature Roadmap

**Version:** 0.2  
**Date:** 2026-11-20  
**Status:** Approved by the operator — 2026-11-21  
**Supersedes:** Previous six-milestone / 21-feature proposal

## Purpose

This roadmap organizes Azusa's implementation into milestones and numbered features for the Milestone → Feature SDD cadence. A milestone groups related capabilities and provides an integration/validation boundary. A feature is the unit of specification, implementation, verification, and UAT.

The roadmap contains **5 milestones and 19 features**. Feature checkboxes should only be marked complete after implementation, required verification, conformance review, and explicit operator UAT acceptance.

## Roadmap at a glance

- [ ] **M0 — Foundations** (F001–F005)
- [ ] **M1 — Team PI Planning** (F006–F012)
- [ ] **M2 — Sprint Execution** (F013–F015)
- [ ] **M3 — Metrics & Reporting** (F016–F018)
- [ ] **M4 — ART-Level Planning** (F019)

**Progress:** 4 / 19 features implemented and accepted (F001–F004). Operator UAT acceptance was confirmed for F001 on 2026-11-23, F002 on 2026-11-24, F003 on 2026-11-25, and F004 on 2026-11-27. See the [F001](../specs/001-application-foundations/tasks.md), [F002](../specs/002-organization-cadence/tasks.md), [F003](../specs/003-work-categories-allocation/tasks.md), and [F004](../specs/004-capacity-engine-planner/tasks.md) verification records. F005–F019 remain planned.

---

# M0 — Foundations

**Goal:** Establish the local application, organizational and calendar foundations, categories, and reliable capacity information required by Team PI Planning.

**Milestone exit criteria:** The operator can configure an ART and its Teams, define the PI/Sprint cadence, maintain categories and allocations, enter calendar/availability information, and inspect capacity forecasts. The application remains local, recoverable, tested, and documented.

- [x] **F001 — Application Foundation**
  - Local Next.js/TypeScript application, PGlite/Drizzle persistence, migrations, safe backup/restore, quality gates, design system, floating shell, nine primary navigation placeholders, profile-menu Settings placeholder, and living documentation.
  - Dependencies: none.
  - Brief: [001-application-foundations.md](features/001-application-foundations.md).

- [x] **F002 — Organization & PI Cadence**
  - ARTs, Teams, Members, role placeholders, Locations/time zones, PIs, Sprints/iterations, custom PI/Sprint names, explicit dates, configurable sprint count/duration, and Team offsets of −1 / 0 / +1 working day while preserving shared ART iteration identity. Establish the location/holiday and absence records needed by downstream capacity calculations.
  - Establishes organizational and calendar entities; RBAC is not enforced in the current single-user phase.
  - Dependencies: F001.

- [x] **F003 — Work Categories & Allocation**
  - Configurable development and overhead categories, Bugs category, names/short labels/colours, ART defaults, Team overrides/inheritance, per-PI allocation, and validation that development-category allocations total 100%.
  - Settings for categories are delivered here, not through a separate Settings feature.
  - Dependencies: F002.

- [x] **F004 — Capacity Engine & Capacity Planner**
  - Independently testable capacity and forecasting logic: working days, FTE, absences/holidays, overhead, normalized velocity, PI/Sprint overrides where applicable, forecast SP, category budgets, and load indicators. Deliver the PI-level Capacity Planner screen.
  - Use golden tests and one canonical seed dataset. Preserve the 8-hour workday rule and do not introduce a separate focus factor.
  - Dependencies: F002, F003. Calendar data may initially be supplied through seed/test records; F005 provides the full calendar experience.

- [ ] **F005 — Team Calendar & Availability**
  - Team Calendar as the single source of truth for dated leave/absence and calendar-driven capacity: Days off / Dev hours views, local holidays, absences, ceremonies entered per Sprint with dates, meetings with attendees, Team milestones, and planned overtime. Include per-member/day and Team totals, commitment status and vs-PI/vs-Sprint comparisons where applicable.
  - Calendar configuration and editing are owned by this feature; there is no separate Settings feature.
  - Dependencies: F002, F004.

---

# M1 — Team PI Planning

**Goal:** Support complete Team-level planning: organize work, rank the backlog, allocate it across a PI, understand dependencies, prepare the PI brief, version the plan, and establish the official PI commitment.

**Milestone exit criteria:** The operator can prepare a Team PI plan with Projects, Features, Stories and Bugs; allocate committed and Stretch work across Sprints; reserve Buffers and Overhead; inspect capacity and dependencies; produce the Team PI Brief; save plan versions; and Start PI to record official PI Commitments.

- [ ] **F006 — Project & Feature Registry**
  - Lightweight Project and Feature management. A Project is a long-lived umbrella for Features and may span PIs and Teams. A Feature belongs to exactly one Project, one owning Team, and one PI. Provide basic list/create/edit flows and association visibility, including the Feature metadata already defined by the domain model (key/name, target date, estimate revisions, and colour); do not build a Project workspace, progress dashboard, cross-Team workbench, or analytics.
  - No dedicated prototype is required; define the minimal registry/form UI during this feature.
  - Dependencies: F002.

- [ ] **F007 — Work Item Management**
  - Create and manage Stories and Bugs. Stories are Project-parented with optional Feature; Bugs are a separate type, Project-parented, and restricted to the Bugs category. Implement full Story, light Story (Enabler/Estimation/Tech debt), and Bug layouts; detail page/modal; user-story statement where applicable; bug severity/environment/version/device-OS/repro steps/expected-actual fields; AC/DoR/DoD three-state checklists and per-kind templates; tags; discussion; ownership/planning fields; close/reopen; Removed with reason; and history.
  - No separate priority field: backlog rank is priority. Task planning/hour assignment is completed in F013; work-item task presentation can be integrated with that capability.
  - Resolve the Bug SP/velocity convention in this feature or explicitly carry the decision to F016 before metrics are implemented.
  - Dependencies: F003, F006.

- [ ] **F008 — Team Backlog**
  - PO-ranked Team work list grouped into Current Sprint, Upcoming Sprints, and Backlog. Support ranking, filtering/search within the list, moving items between backlog and Sprints, carry-over visibility, and entry into Sprint Planning. Rank is the priority for all work-item types.
  - Dependencies: F006, F007, F002.

- [ ] **F009 — Team PI Board & Allocation**
  - Freehand React Flow Team PI board with Project swimlanes and Sprint columns, Story cards, Feature context, committed and Stretch StorySlices, editable point splits, view-scoped BoardPlacement, capacity/load indicators, category views, filters, legend, zoom/fit, and board plan checks.
  - Support PI-planned Buffer placeholders (SP, category/type, holder) and per-member OverheadReserves (hours per Sprint). Buffers count in planned load but are outside commitment; Overhead is time reserve and never SP.
  - Dependencies: F002, F003, F004, F006, F007.

- [ ] **F010 — Dependencies & Delivery Flow**
  - Internal Story dependencies with explicit predecessor → successor semantics, allowed across Features, Projects, and Teams; same-Feature links represent delivery flow. Support ExternalDependency records for prerequisites outside the ART/department, linked to internal Stories and optionally shown in a Dependencies swimlane. Render connector lines and advisory dependency/ordering checks. A Stretch Story dependency applies to the whole Story.
  - Dependencies: F007, F009.

- [ ] **F011 — Team PI Brief**
  - Generate the Team's PI Planning one-pager from the current plan: PI objectives and business value, committed/uncommitted objectives, Feature summary, per-Sprint capacity and load, dependencies, ROAM risks, confidence vote, presentation mode, and PDF export.
  - Dependencies: F009, F010.

- [ ] **F012 — Plan Versioning & PI Commitment**
  - Explicit user-created complete PI plan versions (v1, v2, v3…), historical inspection and comparison, kept separate from commitment events. Admin/RTE Start PI records immutable PI Commitments for participating Teams. Preserve event timestamps and commitment trail; later plan versions never overwrite commitments.
  - Define the end-of-PI carry-over/continuation workflow consistently with the rule that Features, Stories, and StorySlices cannot cross PI boundaries; preserve the original history.
  - Dependencies: F009, F010, F011.

---

# M2 — Sprint Execution

**Goal:** Turn PI allocations into actionable Sprint plans, execute work, and record actual outcomes without losing historical commitments.

**Milestone exit criteria:** The operator can prepare and commit a Sprint plan, execute work through the Iteration Board, close the Sprint with reviewed Actuals, and preserve scheduled dates, effective lifecycle dates, action timestamps, and historical commitments.

- [ ] **F013 — Sprint Planning & Start Sprint**
  - Deliver the Sprint Planning workspace: Sprint goal, Team calendar preview, Team capacity card and plan views, Team member load strip, backlog → Sprint backlog, task creation/estimates/assignees, and Items / Buffer / Overhead tabs. Support Owner and Distributed planning styles, velocity override chain, PI-planned Buffers and OverheadReserves, Sprint-level adjustments, OverheadTickets, and advisory plan checks.
  - Start Sprint review shows the current plan, committed SP, Stretch, Buffers, capacity/load, dependencies and warnings. SM selects an effective date and explicitly confirms; the current reviewed plan is committed even when the effective start date is retroactive. Preserve scheduled dates and actual action timestamp separately.
  - Planning style and relevant Sprint assumptions are snapshotted in the Sprint Commitment.
  - Dependencies: F005, F007, F008, F009, F012.

- [ ] **F014 — Iteration Board & Workflow Execution**
  - Refined dnd-kit Kanban Iteration Board with Story/Bug cards, workflow columns, task progress, state transitions/history, WIP indicators, filters, blocked/aging/missed-target flags, carry-over behavior, board quick settings, and mid-Sprint Buffer draws. Support the approved Story and Bug workflows and Removed lifecycle.
  - Resolve whether WIP limits are advisory or enforced, and specify the Split Story/carry-over interaction. Implement buffer draw behavior so work drawn from a Buffer is traceable and load remains correct.
  - Dependencies: F007, F013.

- [ ] **F015 — Sprint Closure & Actuals**
  - Close Sprint review with an effective-date picker; review and confirm actual Story/StorySlice SP, actual capacity/time, overhead activity, and Buffer release/unused amount. Preserve scheduled Sprint end, SM-selected effective close date, and action timestamp separately. Finalized Actuals never overwrite PI or Sprint Commitments.
  - Dependencies: F013, F014.

---

# M3 — Metrics & Reporting

**Goal:** Produce traceable metrics and interactive Team/ART reporting from Plan Versions, PI Commitments, Sprint Commitments, execution history, and Actuals.

**Milestone exit criteria:** Team and ART reporting is backed by tested metric definitions, supports interactive filtering/drill-down, and explains how displayed results are calculated and which records support them.

- [ ] **F016 — Metrics Engine & Charting Evaluation**
  - Pure, independently testable metrics engine with golden fixtures for planned vs actual capacity, velocity, normalized velocity, throughput, say/do, PI predictability, Sprint predictability, flow efficiency, and plan-trail comparisons. Evaluate charting options against actual dashboard interactions (cross-filtering, drill-through, tooltips, and responsive charts), then select and document the library.
  - Resolve the Sprint predictability formula with the operator; define state typing/thresholds for flow efficiency; finalize Bug SP/velocity treatment if not resolved in F007. Metrics must read the correct commitment level, not simply the latest Plan Version.
  - Dependencies: F012, F015.

- [ ] **F017 — Team Dashboard**
  - Design and implement the Team dashboard: predictability gauges, normalized velocity, velocity trends, category distribution, planned vs actual capacity, throughput, plan-trail insights, slicers/cross-filtering, drill-through to underlying work, and metric explanations.
  - The current handoff intentionally does not provide a newly approved dashboard design; refine the UI during this feature. Older dashboard screenshots are reference material only, not a binding final layout.
  - Dependencies: F016.

- [ ] **F018 — ART Dashboard & Reporting**
  - ART/Train-level aggregation, Team comparisons, drill-down to Team/Sprint data, reporting filters, and PNG/PDF/CSV exports. Keep this analytical dashboard distinct from the ART Program Board.
  - Design the ART/Train dashboard during this feature; no final approved screen is supplied yet.
  - Dependencies: F016, F017.

---

# M4 — ART-Level Planning

**Goal:** Complete the ART-wide visual planning and coordination experience after Team planning, dependencies, and commitments are established.

**Milestone exit criteria:** The ART Program Board presents all participating Teams against shared ART iteration identities, shows Feature spans and cross-Team/external dependencies, and preserves the one-Team ownership of every Feature.

- [ ] **F019 — ART Program Board & Coordination**
  - Refresh and implement the ART Program Board as a Team × Sprint view. Show each Feature only in its owning Team row, derive Feature bars from the owning Team's StorySlices, aggregate cross-Team Story dependencies into Feature-level relationships, expose external dependencies in a Dependencies swimlane, and support train-level milestones and ART-level plan checks. Respect the shared ART iteration identity and each Team's permitted one-working-day offset.
  - The existing Program Board prototype is an older design reference; the refreshed screen is intentionally deferred and should be specified during this feature.
  - Dependencies: F002, F009, F010, F012.

---

## Cross-cutting decisions

### Settings are distributed

There is **no standalone Settings feature or Settings milestone** in the current roadmap. Each feature owns the configuration it introduces:

- F002: organization, Teams, Members, PI/Sprint cadence, Locations.
- F003: work categories and allocation defaults/overrides.
- F004: capacity assumptions and planner-specific controls.
- F005: calendar, holidays, absences, ceremonies, meetings, milestones, overtime.
- F007: work-item checklist templates and related work-item defaults.
- F013: planning style, workday hours, velocity overrides, Sprint Planning options.
- F014: workflow and Iteration Board quick settings.

The profile-menu Settings entry may later provide a consolidated navigation surface, but it must not force all configuration into one large Settings application.

### Project and Feature management is intentionally lightweight

Projects are umbrellas for Features; Features are owned by one Team and one PI. F006 provides basic registry and create/edit interactions. Do not introduce a full Project workspace, project progress dashboard, cross-Team workbench, or project analytics in the initial implementation. This can evolve if later use demonstrates a need.

### Versioning and commitments remain separate

- Plan Version: explicit full snapshot of the planning state.
- PI Commitment: recorded when Admin/RTE starts the PI.
- Sprint Commitment: recorded when SM starts the Sprint after reviewing the current plan.
- Actuals: finalized when SM closes the Sprint.

Scheduled Sprint dates, effective lifecycle dates, and action timestamps remain distinct. Retroactive Start Sprint commits the current plan reviewed at confirmation, not a reconstructed historical plan.

### Local-first and single-user scope

The application remains local-only and single-user in the current scope. Preserve future role provenance and domain boundaries, but do not add authentication, RBAC enforcement, hosted collaboration, or multi-user infrastructure unless the operator explicitly expands scope.

---

## Deferred design and feature-specific decisions

These are not reasons to block the roadmap. Carry each item into the first feature that needs it and resolve it before implementing that behavior.

| Item | Owning feature |
|---|---|
| Minimal Project/Feature registry layout | F006 |
| Bug and light-story modal layouts; final severity indicator on list cards; Feature category short label | F007 / F008 |
| Bug SP and velocity/throughput convention | F007 / F016 |
| End-of-PI carry-over/continuation behavior | F012 |
| Stretch reason popover; exact plan-check presentation; any remaining Team PI board interaction details | F009 |
| Start Sprint review dialog and effective-date interaction | F013 |
| Split Story/carry-over flow; Buffer draw interaction; final WIP hard/soft behavior | F014 |
| Close Sprint review dialog and actuals confirmation | F015 |
| Sprint predictability formula; flow-efficiency state typing and thresholds; chart library selection | F016 |
| Team dashboard design | F017 |
| ART/Train dashboard design and export details | F018 |
| ART Program Board refresh and train-level milestone presentation | F019 |
| Regional holiday-calendar confirmation and source refresh behavior | F002 / F005 |
| Exact time-zone choices for any additional clocks (if ever added) | F001 shell refinement; current requirement is viewer-local clock only |

## Feature dependency summary

| Feature | Depends on |
|---|---|
| F001 | — |
| F002 | F001 |
| F003 | F002 |
| F004 | F002, F003 |
| F005 | F002, F004 |
| F006 | F002 |
| F007 | F003, F006 |
| F008 | F006, F007, F002 |
| F009 | F002, F003, F004, F006, F007 |
| F010 | F007, F009 |
| F011 | F009, F010 |
| F012 | F009, F010, F011 |
| F013 | F005, F007, F008, F009, F012 |
| F014 | F007, F013 |
| F015 | F013, F014 |
| F016 | F012, F015 |
| F017 | F016 |
| F018 | F016, F017 |
| F019 | F002, F009, F010, F012 |

## SDD workflow

Each feature follows the established workflow:

1. ChatGPT prepares the Feature Brief.
2. Agy runs Specify → Plan → Tasks.
3. Claude reviews architecture and conformance to the handoff/domain model.
4. Codex reviews from the implementation/developer perspective.
5. Codex implements.
6. Claude performs conformance review.
7. Claude Code and the operator perform UAT.
8. Update the roadmap checkbox only after acceptance.

Do not fully specify all 19 features upfront. Prepare and refine the brief for the next feature when its milestone/dependencies are sufficiently understood.
