# Azusa — Milestone & Feature Checklist

**Status:** Proposed implementation roadmap  
**Version:** 0.1.0  
**Updated:** 2026-11-08  
**Method:** Milestone → Feature → Feature Brief → Specify → Plan → Tasks → Implementation → Verification/UAT

> Check off a **feature** only when implementation, required tests, documentation, and UAT are complete. Check off a **milestone** only when its features and exit criteria are complete. A drafted or approved brief alone does not count as implementation completion.

## M0 — Foundations

**Goal:** Establish the local application and organizational configuration needed for planning.

- [ ] **F001 — Application Foundation** — Next.js/TypeScript setup; PGlite + Drizzle; tests; app shell and design system; backups; README, repository map, changelog, architecture and domain documentation. *Feature brief drafted.*
- [ ] **F002 — ART & Calendar Configuration** — ARTs, teams, PIs, configurable sprint calendars/names/durations, IP sprint, and ±1-working-day team offsets.
- [ ] **F003 — People & Availability** — Members, roles, FTE, locations, public/company holidays, absences and availability records.
- [ ] **F004 — Categories & Overhead** — Development categories, team allocation overrides, overhead rules, and non-story activities such as training/retrospectives.

**Exit criterion:** Configure an ART and sprint calendar, create teams and members, and manage availability across locations.

## M1 — Planning Fundamentals

**Goal:** Establish work-item structure, reliable capacity calculations, and sprint allocations.

- [ ] **F005 — Work Item Management** — Projects, single-team features, stories, bugs as a separate work-item type, categories, ownership rules, CRUD and detail views.
- [ ] **F006 — Capacity Planning** — Pure calculation engine, availability, overhead deductions, normalized velocity, forecast story points, category budgets and Capacity Planner UI.
- [ ] **F007 — Sprint Allocation** — Assign work to sprints, committed/stretch/unplanned designations, stretch slices with point splits, load calculations and PI-boundary validation.

**Exit criterion:** Construct a team PI plan and verify that sprint allocations and capacity forecasts are coherent.

## M2 — Team PI Planning

**Goal:** Deliver the interactive, team-level PI planning experience.

- [ ] **F008 — Team PI Board** — React Flow board with project swimlanes, sprint columns, freehand story placement, drag-to-replan, stretch spans and load indicators.
- [ ] **F009 — Dependencies & Delivery Flow** — Predecessor → successor links across projects/teams, external dependency records, connector lines, delivery flow and advisory checks.
- [ ] **F010 — PI Plan Versioning** — Explicit, complete plan-version snapshots; historical inspection and comparisons; independent of commitment records.
- [ ] **F011 — Team PI Brief** — PI objectives/business value, ROAM risks, confidence vote, capacity/dependency summary, presentation view and PDF export.

**Exit criterion:** Perform a realistic team PI planning session, revise and version the plan, and generate the PI brief.

## M3 — ART Planning & Commitment

**Goal:** Deliver ART-wide planning and record official PI commitments.

- [ ] **F012 — ART Program Board** — Team × iteration view, derived feature spans, aggregated capacity, cross-team dependencies, external dependency indicators and milestones.
- [ ] **F013 — PI Commitment Lifecycle** — Admin/RTE Start PI confirmation and recording of immutable PI Commitments for participating teams.

**Exit criterion:** Review a multi-team PI plan, identify dependencies and formally commit the PI.

## M4 — Sprint Execution

**Goal:** Manage sprint planning, delivery, and finalized actuals while preserving commitments.

- [ ] **F014 — Workflows & State History** — Configurable Story/Bug states, WIP limits, active/waiting classification and transition history.
- [ ] **F015 — Sprint Planning & Start** — Tasks and member hour allocations, ceremonies, planning review, date picker, retroactive start and Sprint Commitment recording.
- [ ] **F016 — Iteration Board** — Kanban workflow, story/bug cards, task rollups, assignees, blocked indicators and filters.
- [ ] **F017 — Sprint Closure & Actuals** — Date-aware Close Sprint, actual points/capacity, stretch-slice confirmation, finalized outcomes and execution history.

**Exit criterion:** Start, execute and close a sprint while preserving its PI and Sprint commitments and actual outcomes.

## M5 — Metrics & Reporting

**Goal:** Provide explainable, interactive reporting at team and ART levels.

- [ ] **F018 — Metrics Engine** — Velocity, normalized velocity, throughput, predictability, flow efficiency, capacity accuracy and commitment-vs-actual queries with golden tests.
- [ ] **F019 — Reporting Foundation** — Chart-library evaluation, slicers, cross-filtering, drill-through, tooltips and shared reporting components.
- [ ] **F020 — Team Dashboard** — Team metrics, gauges, comparisons, plan stability, estimate drift and story-level drill-through.
- [ ] **F021 — ART Dashboard & Export** — Train aggregation, team comparisons, drill-down, PNG/PDF dashboard export and CSV data export.

**Exit criterion:** Analyze sprint and PI delivery at team and train levels, with metrics traceable to underlying records.

---

## Roadmap notes

- **Architecture preparation:** Maintain the global domain model and major architecture decisions from M0 onward; implement physical database structures incrementally.
- **Planning semantics:** Plan versions, PI Commitments, Sprint Commitments and Actuals are distinct. Starting a PI or Sprint records commitments; closing a Sprint finalizes actuals.
- **Sprint cadence:** Calendar is configurable per ART. Teams share the cadence, with a permitted offset of up to one working day.
- **Documentation:** Each feature updates affected documentation as part of its Definition of Done.
- **Scope:** Feature boundaries and ordering may be refined through SDD; changes should be reflected in this checklist and its changelog/relevant decision record.

**Progress:** 0/21 features implemented · 0/6 milestones completed. F001 brief drafted, not implemented.
