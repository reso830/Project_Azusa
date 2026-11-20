# Azusa — Feature Brief F001: Application Foundation

**Milestone:** M0 — Foundations  
**Feature ID:** F001  
**Version:** 0.2  
**Status:** Draft for SDD regeneration  
**Date:** 2026-11-20  
**Supersedes:** F001 Feature Brief draft dated 2026-11-08

## 1. Objective

Establish Azusa's locally operated application foundation: the application runtime, persistent local storage, safe database lifecycle and recovery, approved visual shell, reusable design foundations, automated quality gates, and maintainable project documentation.

Subsequent features must be able to add domain capabilities and screens without rebuilding the application shell, persistence foundation, testing conventions, or documentation structure.

**User outcome:** As the operator and developer, I can clone the repository, follow the documented setup, run Azusa locally, navigate its recognizable application shell, verify that local data persists, recover from a backup, and understand the codebase through current documentation.

F001 is infrastructure and shell work. It does not implement the planning, capacity, work-management, execution, or reporting functionality represented by the navigation placeholders.

## 2. Source of truth and references

Use the following sources in this order when preparing the F001 specification:

1. **Project Constitution** — governing engineering, SDD, documentation, testing, and scope principles.
2. **November 20 handoff package v2**:
   - `AZUSA_HANDOFF.md` — vision, constraints, stack, design system, shell, and foundational requirements.
   - `AZUSA_HANDOFF_UPDATE_2026-11-20.md` — later design decisions and deltas; wins over conflicting base-handoff details.
   - `docs/azusa-data-model.md` v0.6 — authoritative conceptual domain model; not a physical schema.
   - `docs/azusa-sprint-planning-decisions.md` — calendar, capacity, Sprint Planning, overhead, buffers, and planning-style decisions.
   - `docs/azusa-work-item-view.md` — work-item types, layouts, fields, checklists, and lifecycle decisions.
   - `icons/icons.json`, `icons/svg/`, `assets/`, screenshots, and prototype sources — supplied design assets and visual intent.
3. **This Feature Brief** — F001 scope and outcomes.
4. Existing F001 SDD artifacts — technical research and decisions are useful prior work, but their references to the November 8 handoff, Data Model v0.4, the old navigation, and the old 21-feature roadmap are superseded.

The prototype is a design reference, not a pixel-perfect implementation specification. Do not port the `.dc.html` prototype runtime.

## 3. In scope

### 3.1 Local application and engineering foundation

- Establish one locally operated Next.js application using strict TypeScript.
- Keep clear boundaries between presentation, application/domain logic, and persistence.
- Establish reusable validation conventions and automated quality checks, including linting, formatting, type checking, unit/integration tests, production build verification, and browser-level tests.
- Provide reproducible local development and verification commands.
- Keep runtime operation local: no hosted backend, cloud database, paid API, telemetry dependency, or externally hosted font dependency.
- Use the technology direction established by the handoff: TypeScript, Next.js, PGlite with Drizzle ORM, Zod, Vitest, and Playwright. Preserve relevant technical decisions from the existing F001 research/plan when they remain compatible with this brief; revalidate rather than blindly copy them.

### 3.2 Local persistence, migrations, and recovery

- Integrate PGlite with Drizzle ORM using persistent local filesystem storage.
- Establish explicit, version-controlled database migrations and demonstrate both fresh initialization and safe upgrade of an existing database.
- Keep F001's physical schema limited to infrastructure-owned records needed by the foundation (for example, application metadata and health/diagnostic state). Do not create ART, Team, Member, PI, Sprint, Project, Feature, Story, Bug, Task, planning, or reporting tables in F001.
- Establish consistent identity and audit conventions for future records: UUID identifiers, UTC timestamps, and `created_by` / `updated_by` fields. Until authentication exists, use the documented local operator actor convention (`local:sm`).
- Provide an automatic local startup backup before migrations are applied to an existing database.
- Provide documented developer-facing CLI operations for manual backup and safe restore.
- Preserve the safety properties established in the earlier F001 technical review: exclusive database ownership, atomic/incomplete-backup handling, retention pruning only after successful initialization/migration, safe restore staging and validation, and recoverable active-database replacement only when explicitly requested. Never silently overwrite the active database.
- Surface database initialization, migration, locking, backup, and restore failures clearly through structured diagnostics and the application shell where applicable.

The specification and implementation plan should retain the safety outcomes of the previous F001 work while revalidating the exact mechanisms and edge cases against the current repository and tool versions.

### 3.3 Design system foundations

Implement the supplied Azusa visual language for the application shell and placeholder screens:

- Supplied Azusa logo and asanoha motif.
- Warm light palette, flat surfaces, ink and orange accents, and the approved design tokens in the handoff.
- Locally bundled typography: Zen Kaku Gothic New, IBM Plex Sans, and IBM Plex Mono.
- The complete **42-icon Kumiko set** from `icons/icons.json` and `icons/svg/`, including the fixed-colour status/commitment badges. Preserve the icon geometry, stroke, cap, join, and colour rules from the handoff.
- Reusable icon, typography, colour, spacing, surface, and interaction primitives sufficient for the shell and future feature work.
- No unrelated stock imagery or newly invented illustration assets.

### 3.4 Application shell and navigation

Implement the approved floating shell. Do not substitute a conventional sidebar or full-width top bar.

**Header structure:**

- **Left:** Azusa logo button opening the primary navigation dropdown.
- **Centre:** Today widget.
- **Right:** expandable search control and local operator profile control.

The shell remains a single row. The page title row is the location for page-specific selectors, actions, and controls; the global header should not accumulate page-specific controls.

**Primary navigation groups and destinations:**

| Group | Destination | Placeholder route | Planned feature |
|---|---|---|---|
| PI | Team PI board | `/` | M1 · F009 |
| PI | ART program board | `/program-board` | M4 · F019 |
| PI | Team PI brief | `/pi-brief` | M1 · F011 |
| Capacity | Team calendar | `/calendar` | M0 · F005 |
| Capacity | Capacity planner | `/capacity` | M0 · F004 |
| Sprint | Team backlog | `/backlog` | M1 · F008 |
| Sprint | Sprint planning | `/sprint-planning` | M2 · F013 |
| Sprint | Iteration board | `/iteration` | M2 · F014 |
| Insights | Team dashboard | `/dashboard` | M3 · F017 |

There are **nine primary navigation destinations**. Settings is accessed from the profile dropdown, not from the primary navigation, and is not a tenth primary destination. A minimal `/settings` placeholder may be used to verify the profile-menu route and shell behavior, but it must not implement a standalone Settings application.

The current page is highlighted in the primary navigation. Work-item detail routes and Settings are not primary navigation destinations and should not highlight a primary item.

### 3.5 Placeholder route behavior

F001 establishes the routes and shell behavior for future screens without pretending those features are implemented.

Each of the nine primary destinations should render a consistent placeholder containing:

- The correct page title.
- The supplied asanoha empty/loading mark where appropriate.
- A clear notice that the page's domain functionality is not yet implemented.
- Its current milestone/feature reference from the roadmap.
- A compact foundation health/status card showing local database, migration, and backup status.

Settings, if represented by a placeholder route, is reached from the profile dropdown. It must not be presented as an implemented configuration workspace. Configuration will be introduced incrementally by the feature that owns it; there is no standalone Settings milestone or feature in the current roadmap.

The Dashboard and ART Program Board screens are also placeholders in F001. Existing older screenshots or prototype sources for those screens are not approved as current final designs; their UI will be revisited in their owning features.

### 3.6 Today widget, search, and profile

**Today widget:**

- Display the viewer-local date and ISO-8601 calendar week/day.
- Display an explicit unconfigured state (`No active PI · No active Sprint`) until organization and PI configuration exist.
- Display the viewer's local 24-hour clock and timezone label. Do not hardcode sample PI/Sprint values or pretend sample team locations are live data.
- Preserve the previously approved timezone handling: IANA timezone IDs internally, known alias normalization, deterministic abbreviations for the supported fixed-offset zones, UTC-offset labels for other zones, and a safe UTC fallback for invalid/missing timezone IDs.
- Refresh the displayed time without hydration mismatch or visible layout shift.
- Hide the Today widget on the Settings route, consistent with the existing F001 shell decision.

**Search:**

- Implement only the shell interaction: collapsed control, expand/focus, route-appropriate placeholder, collapse on blur/Escape.
- Search indexing, queries, filtering, and result navigation are out of scope.

**Profile:**

- Display the local operator placeholder (initials such as `SM`).
- Provide a profile dropdown containing Settings.
- Do not implement login, user switching, authentication, or RBAC.

### 3.7 Responsive behavior and accessibility

- Preserve the single-row floating header at the agreed desktop/narrow test widths (1440px, 1024px, and 768px).
- When expanded search would overlap the centered Today widget below the agreed breakpoint, hide the widget using a layout-preserving visibility treatment and restore it when search collapses.
- Use accessible disclosure navigation semantics, keyboard operation, visible focus indicators, accessible labels, and semantic status/error announcements.
- Verify the shell with automated accessibility checks and browser tests.

### 3.8 Foundation health and diagnostics

- Provide a small infrastructure-owned health/diagnostic capability to verify local persistence and surface initialization/migration/backup state.
- Provide a compact Foundation Status card on placeholder screens.
- Provide a visible accessible error banner when critical database initialization, migration, or backup operations fail.
- Keep diagnostic persistence infrastructure-only; do not use this as a reason to introduce business-domain tables.

### 3.9 Living project documentation

Documentation is part of F001's deliverable and must be maintained with the code.

Establish at minimum:

| Artifact | Required responsibility |
|---|---|
| `README.md` | Project purpose, prerequisites, installation, configuration, local run, tests, backup/restore, and documentation index |
| `docs/REPO_MAP.md` | Major directories, entry points, module responsibilities, architecture boundaries, and common change paths |
| `CHANGELOG.md` | Human-readable application version history: additions, changes, fixes, and breaking changes |
| `docs/architecture/overview.md` | Runtime, module boundaries, persistence, startup, and data flow |
| `docs/architecture/domain-model.md` | The complete conceptual domain model aligned with Data Model v0.6; conceptual only, not premature physical tables |
| `docs/architecture/data-dictionary.md` | Fields and structures actually implemented in F001; extend as features add persisted entities |
| `docs/architecture/decisions/` | ADRs for significant architectural decisions, rationale, alternatives, and consequences |
| `docs/operations/` | Database initialization, migrations, backup, restore, and recovery procedures |
| `docs/feature-roadmap.md` | The approved milestone/feature checklist and progress status |

The repository map is an architectural navigation guide, not an exhaustive file inventory. Avoid duplicate or competing sources of truth. Update affected documentation in the same feature changeset. Do not create empty future-feature specifications merely to satisfy a documentation checklist.

## 4. Acceptance criteria

**AC01 — Reproducible local setup**  
A developer can follow the README on a clean supported workstation, install dependencies, initialize the local database, and start Azusa without cloud services, external runtime APIs, or secret credentials.

**AC02 — Approved shell and design foundations**  
The application uses the supplied logo, asanoha motif, approved palette and typography, floating header, and complete 42-icon Kumiko set. The implementation does not introduce a sidebar or conventional top bar.

**AC03 — Navigation coverage**  
All nine primary destinations are available through the correct PI / Capacity / Sprint / Insights groups. Settings is reached from the profile dropdown, not the primary navigation. Active-page indication is correct.

**AC04 — Honest placeholder routes**  
Every primary destination renders a clearly non-operational placeholder with its page title and roadmap reference. The Dashboard and ART Program Board are not presented as functional screens. Settings remains a placeholder if routed; no standalone Settings application is implemented.

**AC05 — Today widget correctness**  
The widget shows viewer-local date, ISO week/day, explicit unconfigured PI/Sprint state, and viewer-local time/timezone. It does not invent an active PI, Sprint, or additional team clocks. Settings omits the widget.

**AC06 — Responsive and accessible shell**  
The shell remains usable at the agreed viewport widths; expanded search does not overlap the Today widget; navigation, search, and profile controls are keyboard accessible with visible focus and appropriate accessible semantics. Automated accessibility checks report no violations in the tested shell states.

**AC07 — Persistent local storage and migrations**  
An infrastructure test record survives application restart. A fresh database initializes successfully, and an incremental migration preserves existing records. F001 does not create business-domain tables.

**AC08 — Backup and restore safety**  
The application creates a recoverable startup backup for an existing healthy database before migrations. Manual backup and restore procedures are documented and tested. Restore validation and failure handling protect the active database from accidental or silent replacement.

**AC09 — Health and failure visibility**  
The operator can inspect foundation health. Critical initialization, migration, or backup failures are surfaced through structured diagnostics and an accessible UI error message rather than being silently ignored.

**AC10 — Quality gates and documentation**  
The documented lint, format, typecheck, test, build, and browser verification commands run successfully. All required documentation artifacts exist, contain accurate non-placeholder content, and match the delivered implementation.

## 5. Out of scope

- ART, Team, Member, Location, PI, Sprint, Holiday, Absence, and calendar business CRUD or configuration functionality (F002 onward).
- Work Categories, Team Category Allocations, capacity calculations, Capacity Planner functionality, and Team Calendar functionality.
- Project and Feature Registry, Stories, Bugs, Tasks, checklist templates, tags, discussions, dependencies, buffers, overhead reserves/tickets, and work-item pages/modals.
- Team PI board, ART Program Board, Team Backlog, Sprint Planning, Iteration Board, PI Brief, dashboards, metrics, and exports.
- Functional Settings sections. Settings controls are delivered incrementally with their owning features; no standalone Settings feature is planned.
- Search indexing or result retrieval.
- Authentication, multi-user sessions, and RBAC enforcement.
- Porting the `.dc.html` prototype runtime or rendering fake/sample operational boards, work items, charts, or calendars.

## 6. SDD regeneration guidance

The previous F001 `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md` were generated against the November 8 handoff and are not the current requirements baseline.

Re-run the F001 SDD workflow using this brief and the November 20 handoff package. The prior SDD package is useful technical research, not an authoritative requirements source. Preserve valid technical decisions where they remain compatible, but update all stale handoff, icon-count, navigation, route, roadmap, and data-model references. Regenerate or reconcile supporting artifacts (research, data model, contracts, quickstart, review checklists) as needed so they agree with the new specification, plan, and tasks.

Use the revised roadmap's M0–M4 / F001–F019 identifiers consistently. Do not carry forward the superseded M0–M5 / F001–F021 numbering.

## 7. Feature exit

F001 is complete when Azusa is locally runnable, visually identifiable, navigable through its nine primary placeholder destinations, durably persisted and recoverable, covered by foundational quality gates, and documented sufficiently for human and AI-assisted development. F002 can then introduce organizational and PI cadence functionality without replacing the application shell or persistence foundation.
