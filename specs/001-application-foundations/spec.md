# Feature Specification: Application Foundation

**Feature Branch**: `001-application-foundations`  
**Created**: 2026-11-08  
**Status**: Approved  
**Input**: `docs/features/001-application-foundations.md`  
**Design Reference**: `docs/handoffs/azusa-handoff-v1.zip` (`AZUSA_HANDOFF.md`, `docs/azusa-data-model.md` v0.4, `prototype/Main.dc.html`, `prototype/Settings.dc.html`, `prototype/Icons.dc.html`, `icons/icons.json`, `icons/svg/*.svg`, `assets/azusa-logo.png`, `screenshots/01-team-pi-board.png`, `screenshots/01b-team-pi-board-menu-open.png`, `screenshots/07-settings-locations-holidays.png`, `screenshots/08-icon-set.png`)

---

## Clarifications

### Session 2026-11-08

- **Q1**: Before ART/calendar and member locations are configured in F002/F003, how should the header's Today widget display the PI/Sprint status (Line 1) and clocks (Line 2)? → **A**: Show explicit placeholder text on Line 1 (`"No active PI · No active Sprint"`) and only the viewer's local timezone clock in orange (`#C2650E`) on Line 2.
- **Q2**: How should the 7 navigation dropdown destinations (`Team PI board`, `ART program board`, `Team PI brief`, `Capacity planner`, `Iteration board`, `Team dashboard`, `Settings`) behave in F001? → **A**: Route each menu item to an explicit placeholder view (using the Kumiko `asanoha` empty-state mark) so active menu state, Settings header behavior (Today widget hidden, `"Search settings…"` placeholder), and keyboard navigation are testable end-to-end.
- **Q3**: How should F001 verify and surface local persistence, migrations, and startup backup status (AC04, AC07) without introducing domain tables prematurely? → **A**: Create an infrastructure table (`app_metadata` with audit fields) surfaced via a compact foundation status card on the placeholder screen and a health check, plus an error banner if DB init/migration/backup fails.
- **Q4**: How should automatic backup-on-start and the developer restore procedure operate on the local PGlite database (AC06)? → **A**: Snapshot the local PGlite data directory into a timestamped local backup folder on startup (at most once per process, before migrations, pruning beyond 10 completed automatic backups **only after** database mount and migrations succeed), enforce race-safe cross-process exclusive ownership via `proper-lockfile`, and provide CLI commands for manual backup and safe restore into a disjoint, non-populated target path by default (with a recoverable `db-replaced-<timestamp>` swap and startup recovery journal when `--force-overwrite-active` is used).
- **Q5**: What convention should F001 establish for record identity and the pre-auth local actor (`created_by` / `updated_by`) across persistence schemas? → **A**: RFC 9562 / RFC 4122 UUIDv4 primary keys generated via `crypto.randomUUID()`, UTC timestamps (`created_at`, `updated_at` automatically refreshed on write), and a default local actor ID `"local:sm"` (matching the `"SM"` profile badge) for `created_by` / `updated_by` (with actor overrides restricted to internal server/CLI code, never public HTTP payloads).
- **OD1 (Navigation Accessibility Pattern — C8)**: Which accessibility pattern should the navigation dropdown use so keyboard operation and axe-core checks are 100% consistent? → **A**: Use a disclosure navigation pattern (`<nav aria-label="Primary navigation">` with `aria-expanded`/`aria-controls` on the logo button, `role="group"` section labels, and standard `<a aria-current="page">` links supporting both `Tab` and `ArrowUp`/`ArrowDown` navigation), documented under Deviation `D5`.
- **OD2 (Timezone Label Formatting — C9 / m5)**: How should the Today widget render the viewer's timezone label on Line 2? → **A**: Store/process IANA timezone IDs internally, normalize legacy aliases (`Asia/Calcutta` → `Asia/Kolkata`, `US/Central` → `America/Chicago`), map fixed-offset named zones via a deterministic lookup table (`Asia/Manila` → `PHT`, `Asia/Kolkata` → `IST`, `Asia/Tokyo` → `JST`, `Asia/Singapore` → `SGT`, `UTC`/`Etc/UTC`/`Etc/GMT` → `UTC`), format all other valid zones (including DST-observing zones such as `America/Chicago` and `Europe/London`) as UTC offsets (`UTC-6`, `UTC-5`, `UTC+1`, `UTC+5:30`, `UTC`) via `Intl.DateTimeFormat` `timeZoneName: 'shortOffset'` with `GMT` replaced by `UTC` (never displaying `GMT`), and fall back to `'UTC'` when an invalid or missing timezone ID is provided.
- **OD3 (Roadmap Alignment — C3)**: How should feature and milestone references be numbered across F001 artifacts? → **A**: Align all feature and milestone references to `docs/feature-roadmap.md` (`M0`–`M5`, `F001`–`F021`).
- **OD4 (Responsive Header & Expanded Search Behavior — C10 / m6)**: How should the header behave at narrower viewports (`1024px`, `768px`) when the search input is collapsed vs. expanded? → **A**: Keep the prototype's single-row header at all widths (the collapsed `40px` search state fits down to `768px` without wrapping or compacting). While the search field is expanded (`280px`) and would overlap the centered Today widget (below `1100px`), hide the Today widget using `visibility: hidden` (preserving its space with zero layout shift) and restore `visibility: visible` when search collapses, documented under Deviation `D5`.

---

## Problem Statement

Azusa is a local-first Agile/SAFe planning, execution, and reporting application for Team and Agile Release Train (ART) workflows. Before domain features—such as ART and calendar configuration (`F002`), people and availability (`F003`), work categories and overhead (`F004`), work item management and capacity planning (`M1`: `F005`–`F007`), Team PI planning (`M2`: `F008`–`F011`), ART planning and commitment (`M3`: `F012`–`F013`), sprint execution (`M4`: `F014`–`F017`), and metrics and reporting (`M5`: `F018`–`F021`)—can be implemented, the repository requires a reliable, locally runnable technical and visual foundation.

Currently, the repository contains governance and Spec Kit workflow definitions but no application runtime, database layer, design system implementation, automated test suite, or architecture/operations documentation. F001 establishes this foundation so that the operator can clone the repository, start Azusa locally with zero external or cloud dependencies, interact with the approved Kumiko/asanoha application shell, verify that local PGlite data persists across restarts and migrations, recover data from tested local backups, and rely on automated quality gates and living documentation.

---

## Scope

### In Scope

1. **Local Next.js + Strict TypeScript Application**:
   - Single Next.js application configured with strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), bound to `127.0.0.1` by default, with clear architectural boundaries between presentation, application/domain logic, and persistence.
   - 100% local runtime operation with zero hosted services, cloud databases, external font CDNs, telemetry (`NEXT_TELEMETRY_DISABLED=1`), or paid APIs.
2. **Development Quality Gates & Verification Tooling**:
   - Zod validation conventions, ESLint, formatting checks, TypeScript type checking, Vitest unit/integration testing, production build verification, and Playwright visual-fidelity + end-to-end browser smoke tests (with `@axe-core/playwright` accessibility scanning, isolated test database/build directories, dedicated port `3100`, and `reuseExistingServer: false`) executable via documented scripts.
3. **Local Persistence, Race-Safe Cross-Process Locking, Migrations & Audit Plumbing**:
   - Embedded PGlite database with Drizzle ORM backed by persistent local filesystem storage, protected across processes by `proper-lockfile` using per-target canonical path sentinels (`<parent(dir)>/<basename(dir)>.azusa-lock`), keeping the lock directory empty (with optional non-authoritative diagnostics outside it) and a graceful `onCompromised` handler that halts writes and returns 503 instead of crashing, and within the server process by a once-per-process `globalThis.__azusaDbState` singleton.
   - Explicit, version-controlled Drizzle schema migrations (with configurable `migrationsFolder` support for isolated testing) that initialize a fresh database and upgrade an existing database without data loss.
   - Standard record identity and audit-column conventions across schemas: UUIDv4 primary keys (`crypto.randomUUID()`), UTC `created_at` and auto-updated `updated_at` timestamps, and `created_by` / `updated_by` actor fields defaulting to `"local:sm"` until authentication is introduced.
   - Minimal infrastructure-owned persistence schema (`app_metadata`) to verify persistence across restarts and surface runtime health.
4. **Automatic Backup-on-Start & Safe Developer Restore**:
   - Atomic pre-migration snapshot of the local PGlite data directory into a timestamped local backup directory on application startup (at most once per process, writing to `.tmp-<backupId>` first and renaming upon completion of `manifest.json`), with rolling retention pruning of the 10 most recent completed automatic `-startup` backups executed **only after** database mount and migrations succeed (so failed startups never evict good backups).
   - Documented and tested CLI procedures for manual backup (`db:backup`) and safe restore (`db:restore`) enforcing exclusive database ownership when accessing `AZUSA_DB_DIR`, validating disjoint paths and full record integrity in a temporary staging directory before moving the restored database into place, and implementing a recoverable `db-replaced-<timestamp>` swap + startup recovery journal when `--force-overwrite-active` is used (preserving `db-replaced-<timestamp>` intact on success for operator audit and manual cleanup).
   - Visible surfacing of database initialization, migration, or backup failures via a UI error alert banner (`role="alert"`) and structured logs.
5. **Azusa Design System Foundations**:
   - Core color and surface tokens from `AZUSA_HANDOFF.md` §14.2 (`#F4F1EC` page background, `#FFFFFF` flat surfaces, `#1A1B22` ink, `#E07F24` brand orange, `#A65307` orange text on light, `#C2650E` viewer clock orange, `#67635C` muted text, `#3F3C37` secondary text, `#FCEFE2` active tint, `#E2D9CC` asanoha stroke, hairline tokens, and default semantic status/category/pastel tokens).
   - Locally bundled typography via `@fontsource`: **Zen Kaku Gothic New** (`500`, `700`), **IBM Plex Sans** (`400`–`700`), and **IBM Plex Mono** (`500`, `600`) with `font-variant-numeric: tabular-nums` on numerical displays.
   - Supplied Azusa logo (`assets/azusa-logo.png`, `assets/azusa-logo-256.png`) and top-right radial-masked `asanoha` SVG lattice background (`28 × 48.5` pattern tile covering a top-right square `80%` of page width).
   - Reusable **Kumiko line** icon component library covering all 25 icons from `icons/icons.json` and `icons/svg/*.svg` (`24×24` viewBox, `1.75px` mitred stroke, butt caps, `currentColor` + `#E07F24` accent, `16 / 20 / 24 / 32` px size ramp, with the `delivery-flow` divider seam resolved on non-white surfaces).
6. **Application Shell & Placeholder Routes**:
   - Single-row floating header at all widths (no conventional sidebar or top bar):
     - **Left**: Disclosure navigation (`<nav aria-label="Primary navigation">`) with the `60px` Azusa logo button (`64×64px` hit target, `aria-expanded`, `aria-controls`) toggling the `290px` navigation dropdown (`Plan`: Team PI board, ART program board, Team PI brief; `Capacity`: Capacity planner; `Sprint`: Iteration board; `Insights`: Team dashboard; divider + `Settings`).
     - **Center**: Today widget (`role="timer"`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`, omitted on Settings) displaying viewer-local date (`YYYY/MM/DD`), ISO calendar week and weekday (`CWww.d`), explicit unconfigured state (`No active PI · No active Sprint`), and viewer-local 24-hour clock (`HHMMh ZONE` in `#C2650E`, refreshing every 15 seconds). When the search input is expanded (`280px`) at viewport widths where it would overlap the centered Today widget (`< 1100px`), the Today widget sets `visibility: hidden` (keeping its layout space) and restores `visibility: visible` when search collapses.
     - **Right**: Expandable search control (`40px` white circle button expanding on activation to a `280px` search input with route-aware placeholder—`"Search settings…"` on Settings and `"Search stories, features…"` elsewhere—and collapsing on blur/Escape) and `"SM"` profile badge (`40px` ink circle).
   - Route-specific placeholder views for all 7 navigation destinations, displaying the page title row (`Zen Kaku Gothic New`), the `asanoha` empty-state mark, the target milestone/feature badge from `docs/feature-roadmap.md` clearly indicating that the screen's domain functionality is not yet operational, and the compact foundation status card.
   - Keyboard-accessible shell interactions (`Tab`, `Shift+Tab`, `Enter`/`Space`, `Escape`, `ArrowDown`/`ArrowUp`/`Home`/`End` in navigation dropdown), visible `:focus-visible` outlines, zero axe-core violations, and non-overlapping layout behavior across `1440px`, `1024px`, and `768px`.
7. **Living Repository Documentation**:
   - Creation and alignment of `README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md` (codifying Data Model v0.4 and Constitution Principle III), `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/`, and `docs/operations/`.

### Non-Goals (Out of Scope)

1. **ART & Calendar Configuration (F002) and People & Availability (F003)**:
   - Creating database tables, APIs, or UI for Trains (ARTs), Teams, Members, Locations, public/company Holidays (`date-holidays`), PIs, Iterations/Sprints, ±1 working-day Team offsets, AbsenceTypes, or Absences.
2. **Work Categories & Overhead (F004)**:
   - Implementing `Category` or `TeamCategoryAllocation` tables, 100% development allocation validation, overhead deduction records (`Deduction`, `CeremonyTemplate`, `UnplannedDeduction`), or category split cards.
3. **Work Item Management, Capacity Planning & Sprint Allocation (M1: F005–F007)**:
   - Implementing `Project`, `Feature`, `Story`, `Bug`, `StorySlice`, or `Task` tables and CRUD UI (`F005`), capacity calculation formulas and the interactive Capacity planner screen (`F006`), or Sprint capacity allocation (`F007`).
4. **Team PI Planning, ART Planning & Sprint Execution (M2–M4: F008–F017)**:
   - Implementing `Dependency`, `ExternalDependency`, `BoardPlacement`, `Workflow`/`State`, or `StateChange` tables and screens; React Flow (`xyflow`) or `dnd-kit` board canvases; manual `PlanVersion` snapshots (`v1`, `v2`…); `Start PI` (`PICommitment`); `Start Sprint` (`SprintCommitment`); or `Close Sprint` (`SprintClosure`/`Actuals`). *(Note: These domain concepts are documented in `docs/architecture/domain-model.md` in F001 to establish architectural boundaries, but their tables and UI belong to M1–M4.)*
5. **Metrics Engine, Reporting Foundation & Dashboards (M5: F018–F021)**:
   - Implementing metrics calculations (`F018`), Recharts/shadcn or ECharts reporting components (`F019`), the Team dashboard (`F020`), or the ART dashboard and export (`F021`).
6. **Functional Search Indexing & Results**:
   - Implementing backend search queries, indexing, or result dropdowns; F001 search is strictly limited to the header expand/focus/collapse shell interaction.
7. **Authentication, Multi-User Sessions & RBAC Enforcement**:
   - Integrating Better Auth, login flows, user switching UI, or role-based access enforcement.
8. **Settings Backup/Export/Import UI**:
   - Building interactive backup/restore/export screens inside Settings; F001 backup and restore are automatic on startup and CLI-driven.
9. **Porting Prototype Runtime or Sample Screen Hardcoding**:
   - Porting Claude's `.dc.html` / `support.js` runtime or rendering static/fake versions of the prototype's boards, charts, or tables that would make unimplemented features appear operational.

---

## Visual & Interaction Target (Constitution Principle II)

The prototype package at `docs/handoffs/azusa-handoff-v1.zip` is the binding visual and interaction reference for the F001 shell, typography, color tokens, and iconography (`prototype/Main.dc.html`, `prototype/Settings.dc.html`, `prototype/Icons.dc.html`, `screenshots/01-team-pi-board.png`, `screenshots/01b-team-pi-board-menu-open.png`, `screenshots/07-settings-locations-holidays.png`, `screenshots/08-icon-set.png`).

### Intentional, Justified Deviations from the Prototype in F001

| Area | Prototype Behavior | F001 Specified Behavior | Justification |
|---|---|---|---|
| **D1 — Navigation & action icons** | `Main.dc.html` and `Settings.dc.html` render temporary generic stroke glyphs in the header and menu. | Render the 25 **Kumiko line** icons (`icons/icons.json`, `icons/svg/*.svg`, `Icons.dc.html`), and replace the hardcoded `#FFFFFF` divider stroke in `delivery-flow` with `stroke="var(--kumiko-surface, #FFFFFF)"`. | Explicitly required by `docs/features/001-application-foundations.md` §2.3 and `AZUSA_HANDOFF.md` §15 (*"icons are designed but not yet applied to the screens"* and *"delivery-flow's white divider shows as a seam on non-white backgrounds"*). |
| **D2 — Font loading** | `.dc.html` files fetch fonts at runtime from `https://fonts.googleapis.com`. | Bundle `Zen Kaku Gothic New`, `IBM Plex Sans`, and `IBM Plex Mono` locally via `@fontsource`. | Required by Constitution Principle IV (local operation without external dependencies), Feature Brief §2.3, and `AZUSA_HANDOFF.md` §14.3. |
| **D3 — Today widget PI/Sprint & clocks** | Hardcodes `PI-2027.1 · Sprint 2706` on Line 1 and three sample clocks (`PHT`, `IST`, `CST`) on Line 2. | Displays `No active PI · No active Sprint` on Line 1 and only the viewer's local clock (`HHMMh ZONE` in `#C2650E`) on Line 2 (using the fixed-offset lookup table `PHT`/`IST`/`JST`/`SGT`/`UTC` and `UTC±offset` fallback, never `GMT`), with `aria-label="Current date, calendar week, PI and sprint status, and local time"`. | Required by Feature Brief §2.3 (*"Until ART and calendar configuration is implemented, the today widget must not invent an active PI or Sprint"*), AC03, and Operator Clarifications Q1 & OD2 (`2026-11-08`). |
| **D4 — Screen body content & title rows** | Renders sample Palawan PI boards, charts, and Settings location/holiday grids from inline JS arrays. | Renders route-specific placeholder views with the standardized page title row (`Zen Kaku Gothic New` `28px`), `asanoha` mark, roadmap milestone/feature badge (`docs/feature-roadmap.md`), non-operational status notice, and foundation health card. | Required by Feature Brief §2.3, §4, AC02 (*"Future functionality is not presented as operational"*), and Operator Clarifications Q2, Q3 & OD3 (`2026-11-08`). |
| **D5 — Disclosure navigation semantics, focus states, expanded-search overlap hiding & error alert banner** | Prototype uses `role="menu"` around plain `<a>` tags, omits visible focus indicators (`outline: none`), leaves the Today widget visible when expanded search overlaps on narrow screens, and shows no error banner. | Uses `<nav aria-label="Primary navigation">` with disclosure button semantics (`aria-expanded`, `aria-controls`) and `<a aria-current="page">` links so `Tab` and arrow keys work with zero axe violations; adds `:focus-visible` outlines (`2px solid #E07F24`) with `border: 0` at rest; keeps the single-row header at all widths while setting `visibility: hidden` on `TodayWidget` when search is expanded below `1100px` (restoring `visibility: visible` on collapse); renders `role="alert"` banner on DB/backup/migration errors. | Required by Constitution Principle VII, Feature Brief §2.2 & §2.3, AC05, AC08, SC-005, and Operator Clarifications OD1 & OD4 (`2026-11-08`). |

---

## User Behavior

### User Story 1 — Application Shell, Design System & Navigation (Priority: P1)

As the operator (Scrum Master), I want to launch Azusa locally and interact with its recognizable kumiko/asanoha visual shell, typography, floating header, expandable search, and navigation menu across all planned top-level destinations, while clearly seeing which screens are placeholders for future milestones.

**Why this priority**: The application shell and design system define the visual identity and layout container that every subsequent feature mounts into (AC01, AC02, AC08).

**Independent Test**: Start the application locally (`npm run dev` or production start), open it in a browser, verify that the warm `#F4F1EC` page background, top-right radial-masked `asanoha` lattice, locally bundled fonts, 60px Azusa logo, Kumiko icons, expandable search control, and `"SM"` profile badge render without external network requests; navigate through all 7 menu destinations using both mouse and keyboard (`Tab`, `Enter`/`Space`, `ArrowDown`/`ArrowUp`, `Escape`) and confirm each destination renders its title and explicit placeholder state with zero axe accessibility violations.

**Acceptance Scenarios**:

1. **Given** the application is running locally, **When** the operator opens the root URL (`/`), **Then** the application renders the single-row floating header, the top-right `asanoha` background lattice (`28 × 48.5` tile with radial fade), locally bundled `Zen Kaku Gothic New`, `IBM Plex Sans`, and `IBM Plex Mono` fonts, and the default placeholder view without making any external font or API requests.
2. **Given** the navigation dropdown is closed by default (`aria-expanded="false"`), **When** the operator clicks the 60px Azusa logo button (or activates it with `Enter` or `Space`), **Then** the `290px` white navigation dropdown opens (`aria-expanded="true"`) inside `<nav aria-label="Primary navigation">` displaying the 5 groups (`Plan`, `Capacity`, `Sprint`, `Insights`, and a divider before `Settings`) and 7 destinations with their corresponding Kumiko line icons (`team-board`, `art-board`, `pi-brief`, `capacity`, `iteration`, `dashboard`, `settings`).
3. **Given** the navigation dropdown is open, **When** the operator selects any of the 7 destinations (`Team PI board`, `ART program board`, `Team PI brief`, `Capacity planner`, `Iteration board`, `Team dashboard`, or `Settings`), **Then** the menu closes, the selected route loads its placeholder view with the matching page title in `Zen Kaku Gothic New` and the target milestone/feature badge from `docs/feature-roadmap.md`, the active menu item is marked with `aria-current="page"` and styled with the `#FCEFE2` tint and `#A65307` accent when reopened, and the view clearly states that the feature's functional implementation is not yet active.
4. **Given** the search control is in its collapsed `40px` circle state, **When** the operator activates the search button, **Then** it expands into a `280px` search input (`border-radius: 20px`) with automatic focus and placeholder `"Search settings…"` on the Settings route or `"Search stories, features…"` on all other routes (hiding the Today widget with `visibility: hidden` below `1100px` so it never overlaps); **When** the input loses focus or the operator presses `Escape`, **Then** it collapses back to the `40px` button and restores Today widget visibility.
5. **Given** the operator navigates using only a keyboard, **When** moving through the logo button (`Enter`/`Space` to toggle), navigation links (`Tab`/`Shift+Tab` as well as `ArrowDown`/`ArrowUp`/`Home`/`End` within the open menu), search control, and profile button, **Then** every interactive control displays a visible `:focus-visible` indicator, exposes an accessible name/role with zero axe-core violations, and supports closing open overlays (`navigation menu`, `expanded search`) with `Escape`.

---

### User Story 2 — Viewer-Local Today Widget & Unconfigured Calendar State (Priority: P1)

As the operator, I want the header's Today widget to accurately display my local date, ISO calendar week/weekday, local 24-hour clock with timezone label, and an honest representation of unconfigured PI/Sprint state on planning views, while hiding itself on Settings.

**Why this priority**: Accurate date, ISO week, and timezone handling is a core daily reference in the Azusa header and establishes the temporal display rules required before F002 introduces calendar configuration (AC03).

**Independent Test**: Load a non-Settings route (e.g., `/`) in a browser, verify Line 1 of the Today widget matches the viewer's current local date (`YYYY/MM/DD`), ISO week and weekday (`CWww.d`), and `"No active PI · No active Sprint"`, and verify Line 2 shows only the viewer's local clock (`HHMMh ZONE`) in `#C2650E` `IBM Plex Mono`; then navigate to `/settings` and verify the Today widget is not rendered.

**Acceptance Scenarios**:

1. **Given** the operator views any non-Settings route, **When** the header renders, **Then** the centered Today widget (`role="timer"`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`) displays Line 1 as `YYYY/MM/DD · CWww.d | No active PI · No active Sprint` (where `CWww` is the zero-padded ISO-8601 week number `01`–`53` and `d` is the ISO weekday `1` = Monday through `7` = Sunday).
2. **Given** the operator views any non-Settings route, **When** the header renders, **Then** Line 2 of the Today widget displays a single clock for the viewer's local timezone formatted as `HHMMh ZONE` in `18px` `IBM Plex Mono` semibold colored `#C2650E` with the timezone label (resolved via the fixed-offset IANA lookup table `PHT`/`IST`/`JST`/`SGT`/`UTC` or `UTC±offset` fallback, never `GMT`) in `10.5px` `#67635C`, refreshing every 15 seconds.
3. **Given** the operator navigates to the `Settings` route (`/settings`), **When** the header renders, **Then** the center Today widget is omitted while the logo button, expandable search control (with placeholder `"Search settings…"`), and `"SM"` profile badge remain in place.

---

### User Story 3 — Local Persistence, Migrations & Surfaced Foundation Health (Priority: P1)

As the operator, I want Azusa to persist records in a local PGlite + Drizzle database with standardized UUIDv4 and audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`), apply schema migrations reliably, retain data across application restarts, and visibly surface database/migration/backup status or failures.

**Why this priority**: Local data durability and transparent error handling are non-negotiable foundations under Constitution Principles III and IV (AC04, AC05).

**Independent Test**: Start Azusa locally, inspect the foundation status card on the placeholder screen (and health endpoint) confirming database connection and applied migrations, trigger or record a diagnostic check entry, stop the application process completely, restart it, and verify that the persisted record (with its UUIDv4, UTC timestamps, and `"local:sm"` actor fields) remains intact after restart.

**Acceptance Scenarios**:

1. **Given** a fresh local environment with no existing database directory, **When** Azusa starts or the migration command runs, **Then** PGlite acquires the cross-process lock via `proper-lockfile`, initializes the local filesystem database, applies all pending Drizzle migrations, records initial foundation metadata with a UUIDv4 primary key, UTC `created_at`/`updated_at`, and `created_by = "local:sm"` / `updated_by = "local:sm"`, writes `.azusa-last-healthy.json`, and reports a `"healthy"` state on the foundation status card.
2. **Given** a record has been written to the local PGlite infrastructure table (`app_metadata`), **When** the application server is stopped and restarted, **Then** the previously written record and all of its audit metadata remain present and queryable without data loss.
3. **Given** an existing local database containing persisted infrastructure records, **When** a subsequent schema migration is applied, **Then** the schema upgrades cleanly while preserving all pre-existing records.
4. **Given** database initialization, schema migration, or startup backup encounters an error (e.g., corrupted storage, lock contention, or invalid migration), **When** the application loads, **Then** the failure is logged with actionable diagnostics (`status: "error"`), cached for the process lifetime so subsequent page loads do not re-trigger startup backups or evict existing backups, `GET /api/health` and `POST /api/health/check` return `503 Service Unavailable`, and the failure is surfaced prominently in the UI via an accessible alert banner (`role="alert"`).

---

### User Story 4 — Automatic Backup-on-Start & Safe Developer Restore (Priority: P2)

As the operator, I want Azusa to automatically snapshot the local database on startup before applying migrations (pruning old backups only after startup and migrations succeed) and provide a documented, tested CLI restore procedure that enforces exclusive database ownership and recovers persisted data into a safe target path without silently overwriting my active database or overlapping paths.

**Why this priority**: Protects local planning data against accidental corruption or failed migrations from day one, satisfying Constitution Principle IV and AC06.

**Independent Test**: Write a known record to the local database, stop the server, restart the application (or run the backup CLI command while the server is stopped) to produce a timestamped backup snapshot, stop the server, run the restore CLI command targeting a separate restore directory, and verify that the restored database contains the exact persisted record (all fields intact) while the active database directory is byte-for-byte unchanged.

**Acceptance Scenarios**:

1. **Given** an existing initialized, healthy local PGlite database directory, **When** Azusa starts up, **Then** it acquires the exclusive database lock, creates at most one atomic timestamped backup snapshot of the database in the local backups directory (writing to `.tmp-<backupId>` first and renaming once `manifest.json` is written) before executing any pending migrations, and—**only after** PGlite mounts and all migrations succeed—prunes completed automatic `-startup` snapshots exceeding the 10-snapshot retention limit.
2. **Given** a valid local backup snapshot, **When** the operator runs the documented restore command specifying a disjoint, non-existing (or empty) target directory (or default staging path), **Then** the backup is copied and verified in a temporary staging directory (confirming `app_metadata` readability and full record field integrity) before being moved to the target directory, without modifying or replacing the active database.
3. **Given** the operator invokes `db:backup`, `db:migrate`, or `db:restore -- --force-overwrite-active` while another process holds the active database lock, or invokes `db:restore` pointing at the active database directory (without `--force-overwrite-active`), a directory overlapping the active database/source backup/backups root, or an existing populated target directory, **When** the command executes, **Then** it aborts before mutating any target or active files, prints a clear error message, exits with code `1`, and leaves both the source backup and active database byte-for-byte untouched.
4. **Given** the operator stops the server and runs `db:restore -- --to <activeDbDir> --force-overwrite-active`, **When** promotion executes, **Then** it holds the exclusive lock, records `.azusa-promote-journal.json`, moves the existing active directory to `db-replaced-<timestamp>`, moves the verified staging directory to `<activeDbDir>`, confirms PGlite readability on `<activeDbDir>`, preserves `db-replaced-<timestamp>` intact for operator inspection and audit (documenting cleanup), and removes the journal—automatically rolling back `db-replaced-<timestamp>` to `<activeDbDir>` if the move, confirmation, or process is interrupted.

---

### User Story 5 — Automated Quality Gates & Living Documentation (Priority: P2)

As a human developer or AI coding agent, I want documented, deterministic commands for linting, typechecking, unit/integration testing, building, and Playwright visual/E2E smoke testing, alongside complete foundational documentation (`README.md`, `REPO_MAP.md`, `CHANGELOG.md`, architecture, domain model, data dictionary, ADRs, and operations runbooks).

**Why this priority**: Enforces Constitution Principles V (Deterministic Testing) and VI (Documentation as a First-Class Deliverable) so subsequent features have verifiable guardrails and accurate architectural context (AC01, AC07, AC09).

**Independent Test**: From a clean setup following `README.md`, execute the documented commands for linting, TypeScript checks, Vitest tests, application build, and Playwright visual and E2E smoke tests (all exiting `0` against isolated test storage on port `3100` with `reuseExistingServer: false` and fixed timezone/clock), and verify all 8 required documentation artifacts exist, are linked from `README.md`, and match the implemented codebase and Data Model v0.4 rules.

**Acceptance Scenarios**:

1. **Given** a fresh development environment with documented prerequisites (including `npx playwright install chromium`), **When** the operator follows `README.md` to install dependencies and run the lint, typecheck, unit/integration test, build, visual-fidelity test, and Playwright smoke test commands, **Then** every command completes deterministically with exit code `0` and zero external cloud/API credentials, without mutating or pruning the developer's active `.azusa/data/` directory.
2. **Given** the repository documentation set, **When** inspected against Constitution Principle VI and Feature Brief §2.4, **Then** `README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/`, and `docs/operations/` all exist, are navigable from `README.md`, and accurately describe the F001 implementation and domain invariants.

---

## Acceptance Criteria

### Mapping to Feature Brief Acceptance Criteria (AC01–AC09)

| Brief AC | Requirement Summary | Verified by User Story |
|---|---|---|
| **AC01 — Local startup** | Install dependencies and start Azusa from a fresh environment using documented prerequisites, with no hosted infrastructure or API credentials. | US1, US5 |
| **AC02 — Application shell** | Display the approved Azusa visual language, logo, locally bundled typography, Kumiko icons, floating header, and navigation dropdown; clearly mark future destinations as placeholders rather than operational features. | US1 |
| **AC03 — Date and time** | Display accurate viewer-local date (`YYYY/MM/DD`), ISO calendar week/weekday (`CWww.d`), viewer-local time (`HHMMh ZONE` in `#C2650E`), and explicit `"No active PI · No active Sprint"` placeholder; omit Today widget on Settings. | US2 |
| **AC04 — Persistent storage** | A record written to the local PGlite database remains available with intact UUIDv4 and audit metadata after stopping and restarting the application. | US3 |
| **AC05 — Database migration** | The Drizzle migration workflow initializes a new database and upgrades an existing test database without losing existing records; failures are reported clearly in logs and UI. | US3 |
| **AC06 — Backup and recovery** | Produce a usable local backup on startup and via CLI (with exclusive lock enforcement and deferred post-migration pruning) containing persisted data; recover that data via a documented restore procedure into a safe target without silently replacing the active database. | US4 |
| **AC07 — Automated verification** | Linting, TypeScript checks, Vitest unit/integration tests, production build, and Playwright visual/E2E smoke tests run via documented commands, including automated tests for persistence and backup/recovery. | US3, US4, US5 |
| **AC08 — Accessibility** | Primary shell interactions (logo menu, navigation links, search expand/collapse, profile button) are keyboard-operable, display visible `:focus-visible` states, expose appropriate ARIA labels/roles, and pass axe-core scans with zero violations. | US1 |
| **AC09 — Documentation completeness** | Required foundation documentation (`README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/*`, `docs/operations/*`) exists, accurately describes the delivered implementation, and is navigable from `README.md`. | US5 |

### Functional Requirements

- **FR-001**: System MUST run as a single local Next.js application written in strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), bound to `127.0.0.1` by default, with `NEXT_TELEMETRY_DISABLED=1` and no runtime dependency on hosted services, external font CDNs, or paid APIs.
- **FR-002**: Codebase MUST enforce module boundaries separating presentation (`ui`/components/routes), application/domain logic, and persistence/infrastructure.
- **FR-003**: System MUST bundle `Zen Kaku Gothic New` (`500`, `700`), `IBM Plex Sans` (`400`–`700`), and `IBM Plex Mono` (`500`, `600`) locally via `@fontsource` and apply `font-variant-numeric: tabular-nums` to clocks, dates, and tabular numerics.
- **FR-004**: System MUST provide a reusable Kumiko line icon component rendering all 25 icons from `icons/icons.json` (`team-board`, `art-board`, `pi-brief`, `capacity`, `iteration`, `dashboard`, `settings`, `search`, `add`, `filter`, `export`, `present`, `refresh`, `warning`, `dependency`, `delivery-flow`, `calendar`, `location`, `clock`, `members`, `risk`, `objective`, `velocity`, `asanoha`, `chevron`) on a `24×24` grid with `1.75px` mitred stroke, `currentColor` ink, `#E07F24` accent details, supported size ramp (`16`, `20`, `24`, `32` px), and surface-safe divider handling (`stroke="var(--kumiko-surface, #FFFFFF)"`) for `delivery-flow`.
- **FR-005**: Application shell MUST render the warm `#F4F1EC` page background, the top-right radial-masked `asanoha` SVG lattice (`28 × 48.5` pattern tile, `#E2D9CC` stroke, `80%` width square), and the single-row floating header containing:
  - Left: `<nav aria-label="Primary navigation">` with the `60px` Azusa logo button (`64×64px` button container, `aria-expanded`, `aria-controls="azusa-primary-nav-menu"`) toggling the `290px` navigation dropdown.
  - Center: Today widget (`role="timer"`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`), rendered on all routes except `/settings`, and hidden via `visibility: hidden` when the search input is expanded at viewport widths below `1100px` so controls never overlap.
  - Right: Expandable search control (`40px` circle button expanding to `280px` input on click, collapsing on blur/`Escape`) and `40px` `"SM"` profile badge.
- **FR-006**: Navigation dropdown MUST group destinations under `Plan` (`Team PI board`, `ART program board`, `Team PI brief`), `Capacity` (`Capacity planner`), `Sprint` (`Iteration board`), `Insights` (`Team dashboard`), and a top-bordered `Settings` link, marking the active route with `aria-current="page"` and `#FCEFE2` background / `#A65307` icon+text, and routing each item to a dedicated placeholder page that displays its roadmap milestone/feature badge (`docs/feature-roadmap.md`) and clearly identifies the destination as not yet operational.
- **FR-007**: Today widget MUST compute and display:
  - Line 1: Viewer-local date as `YYYY/MM/DD`, ISO-8601 week and weekday as `CWww.d` (`01`–`53`, `1`=Mon…`7`=Sun), a vertical divider, and `"No active PI · No active Sprint"`.
  - Line 2: Viewer-local time in 24-hour format `HHMMh ZONE` in `18px` `IBM Plex Mono` semibold `#C2650E` (normalizing legacy IANA timezone aliases `Asia/Calcutta` → `Asia/Kolkata` and `US/Central` → `America/Chicago`; resolving fixed-offset named zones via lookup table `Asia/Manila` → `PHT`, `Asia/Kolkata` → `IST`, `Asia/Tokyo` → `JST`, `Asia/Singapore` → `SGT`, `UTC`/`Etc/UTC`/`Etc/GMT` → `UTC`; formatting all other valid zones via `Intl` `timeZoneName: 'shortOffset'` with `GMT` replaced by `UTC`, e.g. `UTC-6`, `UTC+1`, `UTC`; and on invalid or missing timezone IDs, computing **both** the formatted clock time and the timezone badge in `UTC`), refreshing every 15 seconds without SSR hydration mismatch or layout shift.
- **FR-008**: All interactive shell elements MUST be keyboard-operable (`Tab`, `Shift+Tab`, `Enter`/`Space`, `Escape`, and `ArrowDown`/`ArrowUp`/`Home`/`End` inside the open navigation dropdown), expose accessible labels (`aria-label`, `aria-expanded`, `aria-controls`, `aria-current="page"`, `role="timer"`, `role="alert"`), render visible `:focus-visible` outlines (`2px solid #E07F24`) while keeping `border: 0` at rest, and produce zero axe-core violations.
- **FR-009**: Persistence layer MUST integrate PGlite and Drizzle ORM using local filesystem storage, enforcing race-safe cross-process exclusive ownership via `proper-lockfile` using per-target canonical path sentinels (`<parent(dir)>/<basename(dir)>.azusa-lock`, keeping the `.lock` directory strictly empty to allow `rmdir` release/cleanup, storing any non-authoritative diagnostics in a separate file `<dir>.azusa-owner.json`, and providing an `onCompromised` handler that closes PGlite and returns 503 instead of throwing unhandled crashes) and maintaining a single database connection and once-per-process startup state on `globalThis.__azusaDbState`.
- **FR-010**: Persistence layer MUST provide a reusable identity and audit field convention—UUIDv4 primary keys generated by default via `crypto.randomUUID()`, UTC `created_at` and `updated_at` timestamps (with `$onUpdate(() => new Date())` automatic refresh on write), and `created_by` / `updated_by` text columns defaulting to `"local:sm"`—and apply it to the F001 infrastructure table (`app_metadata`). Actor overrides MUST be restricted to internal service/CLI calls and never accepted from public HTTP request bodies.
- **FR-011**: Migration workflow MUST support a configurable `migrationsFolder` path, initialize an empty local database, and upgrade an existing database with new migrations while preserving existing records, and MUST fail loudly with structured error details (`status: "error"`, `stage: "migration"`) if a migration is invalid or cannot be applied.
- **FR-012**: On application startup (when an initialized, healthy local database with `PG_VERSION` and `.azusa-last-healthy.json` exists), the system MUST acquire the exclusive database lock, recover any interrupted active-restore promotion first, and atomically create at most one timestamped backup snapshot per process (`backup-<YYYYMMDD-HHmmss-fff>-startup`, or `backup-<YYYYMMDD-HHmmss-fff>-01-startup` on same-millisecond tie) in the local backups folder before opening PGlite or running pending migrations. Pruning of completed `-startup` snapshots beyond the 10-snapshot retention limit MUST occur **only after** PGlite mounts and all migrations succeed. If the pre-migration backup fails, initialization MUST halt before opening PGlite or running migrations.
- **FR-013**: System MUST provide documented CLI commands for manual database backup and safe restore (`db:migrate`, `db:backup`, `db:restore`). `db:migrate`, `db:backup`, and active-target `db:restore -- --force-overwrite-active` MUST acquire the exclusive lock on `AZUSA_DB_DIR` (refusing with exit code `1` if another process holds the lock). `db:restore` MUST write to a non-active, non-overlapping, unpopulated target path by default (locking its own distinct target sentinel), validate schema and full `app_metadata` record integrity in `.restore-tmp-<uuid>` before moving into place, and when `--force-overwrite-active` is passed (with server stopped), execute a recoverable replacement sequence (`<activeDbDir>` → `db-replaced-<timestamp>`, `.restore-tmp-<uuid>` → `<activeDbDir>`, post-move PGlite verification, preserving `db-replaced-<timestamp>` intact on success for safety/audit and removing the journal, with automatic rollback on failure or startup recovery after interruption).
- **FR-014**: Placeholder views MUST include a compact foundation status card (backed by `GET /api/health` and `POST /api/health/check`) showing current database, migration, and backup status, and the shell MUST render a visible error banner (`role="alert"`) whenever database initialization, migration, or backup fails (`status: "error"`).
- **FR-015**: Repository MUST include and maintain `README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/`, and `docs/operations/`.

### Measurable Success Criteria

- **SC-001**: A developer on a clean machine with the documented Node.js prerequisites can install dependencies, initialize the local database, and start Azusa with zero network requests to external APIs or font CDNs at runtime.
- **SC-002**: 100% of records written to the local PGlite database before an application stop are retrievable with identical UUIDv4 IDs, payloads, UTC timestamps, and `"local:sm"` audit fields after restarting the application.
- **SC-003**: 100% of existing records in a populated test database remain intact after applying an incremental Drizzle migration.
- **SC-004**: Restoring a backup snapshot via the documented restore procedure recovers 100% of persisted records (with every column and JSON field intact) into a safe target directory while leaving the active database directory byte-for-byte unchanged.
- **SC-005**: All 7 navigation destinations, the expandable search control, and the logo menu are operable using keyboard navigation alone (`Tab`, `Enter`/`Space`, `ArrowDown`/`ArrowUp`, `Escape`) with zero `@axe-core/playwright` accessibility violations on primary shell controls.
- **SC-006**: All quality gate commands (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, and `test:e2e`) pass with exit code `0`.

---

## Edge Cases

- **Cold start with no existing database**: When Azusa starts for the first time and the local PGlite data directory does not yet exist (`PG_VERSION` absent), the startup sequence acquires the lock, creates the directory, skips the pre-migration backup step cleanly (`lastBackupTrigger: 'skipped_cold_start'`), runs initial migrations, seeds the initial `'foundation.init'` record, and writes `.azusa-last-healthy.json`.
- **Concurrent server/CLI lock contention & stale-lock takeover race (`L1`, `L2`, `L3`)**: Cross-process locking uses `proper-lockfile` targeting per-directory canonical sentinel files (`<parent(dir)>/<basename(dir)>.azusa-lock`, remaining outside directories moved during promotion and decoupling sibling restores). The library-owned `<sentinel>.lock` directory is kept strictly empty so `rmdirSync` clean release, stale takeover, and exit cleanup succeed without `ENOTEMPTY` errors (`L1`). Optional diagnostic metadata is written outside the lock directory to `<dir>.azusa-owner.json` and is strictly non-authoritative. A custom `onCompromised` handler closes PGlite, records error state, and serves 503 rather than crashing Next.js ungracefully on lost locks (`L2`). Following lock acquisition, a short grace check re-verifies ownership before opening PGlite. Under concurrent contention or stale reclamation (minimum stale threshold >= 2000ms), contenders fail closed (`ELOCKED`) before touching files.
- **Database initialization or migration failure & backup protection (`M1`)**: If the PGlite data directory is corrupted or a migration fails, the system catches the error, sets `status: "error"`, does **not** run startup backup retention pruning, removes `.azusa-last-healthy.json` (or leaves it absent so subsequent restarts never snapshot an unverified/corrupt cluster over good backups), caches the error state for the lifetime of the server process (so repeated page loads never re-run startup backup), returns `503` on `/api/health` and `/api/health/check`, and renders the `role="alert"` error banner.
- **Startup backup failure**: If the backup directory is unwritable or a snapshot fails on startup when an existing database is present, the system cleans up any `.tmp-*` partial backup folder, halts **before** opening PGlite or executing migrations to protect the existing database, sets `status: "error"` (`stage: "backup"`), and surfaces a backup failure alert in the UI and server logs.
- **Restore path overlap, populated targets, Windows path normalization & active promotion rollback (`C2`, `M3`, `L4`)**: `db:restore` normalizes all paths (case-insensitively on Windows, stripping trailing separators, resolving relative segments). It refuses any target path that:
  1. Equals the active database path without `--force-overwrite-active`,
  2. Strictly contains or sits inside the active database path (even with `--force-overwrite-active`),
  3. Overlaps the source backup snapshot or the backups root directory (even with `--force-overwrite-active`), or
  4. Points to an existing non-empty non-active directory.
  Restore copies and verifies the snapshot in `.restore-tmp-<uuid>` before moving it into place. When `--force-overwrite-active` is used (with the server stopped and lock held), promotion writes `.azusa-promote-journal.json`, moves `<activeDbDir>` to `db-replaced-<timestamp>`, moves `.restore-tmp-<uuid>` to `<activeDbDir>`, verifies PGlite readability, preserves `db-replaced-<timestamp>` intact on disk for safety/inspection (cleaning up only the journal, `L4`), and exits 0—automatically rolling back `db-replaced-<timestamp>` to `<activeDbDir>` if any step fails or on the next startup if interrupted partway.
- **Backup retention boundary & same-millisecond suffix format**: When creating backups, if `backup-<YYYYMMDD-HHmmss-fff>-<trigger>` already exists within the same millisecond, a zero-padded sequence number is inserted before the trigger suffix: `backup-<YYYYMMDD-HHmmss-fff>-01-<trigger>`, `backup-<YYYYMMDD-HHmmss-fff>-02-<trigger>`. Only completed automatic `-startup` backups containing both `PG_VERSION` and a valid `manifest.json` count toward `--from latest` and the 10-snapshot retention limit; incomplete `.tmp-*` folders are ignored and cleaned up, and `-manual` backups are never auto-pruned.
- **Next.js hot module replacement (HMR) in development**: Repeated server module reloads during `next dev` reuse the singleton state on `globalThis.__azusaDbState` so duplicate locks and duplicate startup backups never occur within the same server process.
- **ISO-8601 week year boundaries & Sundays**: For dates in late December or early January where the ISO week belongs to the adjacent year (e.g., `2026-12-31` or `2027-01-01`), and on Sundays (`ISO weekday = 7`, where JavaScript `getDay()` returns `0`), the Today widget computes `CWww.d` strictly per ISO-8601.
- **Legacy/invalid IANA timezone identifiers & UTC-offset labels (`OD2`, `L5`)**: Legacy aliases (`Asia/Calcutta`, `US/Central`) normalize to `Asia/Kolkata` and `America/Chicago`; fixed-offset zones in the lookup table map to `PHT`, `IST`, `JST`, `SGT`, `UTC`; all other valid zones format via `Intl` `shortOffset` with `GMT` replaced by `UTC` (`UTC-6`, `UTC+1`, `UTC`); invalid or missing timezone IDs fall back to computing **both** the displayed clock time and the badge label in `UTC` (`L5`).
- **Narrow viewports (`1024px`, `768px`) & expanded search (`OD4`)**: The floating header stays on a single row at all widths down to `768px`. When search is collapsed (`40px`), the centered Today widget and all controls fit without overlap. When search is expanded (`280px`) below `1100px`, the Today widget sets `visibility: hidden` (keeping its space) so the expanded search input never overlaps it, and restores `visibility: visible` on collapse.

---

## Data Considerations

### 1. Implemented F001 Persistence Schema (Infrastructure-Owned Only)

Per Feature Brief §2.2 and Clarification Session 2026-11-08 (Q3, Q5), F001 implements only minimal infrastructure-owned persistence in PGlite via Drizzle ORM and does **not** create domain tables prematurely:

- **Standard Identity & Audit Columns (`auditColumns()` in `src/persistence/schema/common.ts`)**:
  - `id`: UUIDv4 primary key (`text`, not null, default generated via `crypto.randomUUID()`).
  - `created_at`: UTC timestamp (`timestamp with time zone`, not null, default `now()`).
  - `updated_at`: UTC timestamp (`timestamp with time zone`, not null, default `now()`, automatically refreshed on update via Drizzle `$onUpdate(() => new Date())`).
  - `created_by`: Actor identifier (`text`, not null, default `"local:sm"`).
  - `updated_by`: Actor identifier (`text`, not null, default `"local:sm"`).
- **Infrastructure Table (`app_metadata`)**:
  - Stores key-value / structured diagnostic records (`'foundation.init'`, `'diagnostic.last_check'`) using the standard identity and audit columns above, validated at application boundaries with Zod schemas.

### 2. Pre-Authentication Local Actor Convention

- Until multi-user authentication (Better Auth) and RBAC (`Admin`, `RTE`, `SM`, `Team member`, `Business Owner`) are introduced in a later milestone, all local mutations record `"local:sm"` in `created_by` and `updated_by` by default.
- Internal service/CLI functions accept an optional actor override in their internal execution options so automated tests and future server-side authenticated sessions can supply explicit actor identifiers without changing table schemas. Public HTTP request bodies (`POST /api/health/check`) do **not** accept an `actor` field so external callers cannot spoof audit provenance.

### 3. Domain & Historical Integrity Architecture (`docs/architecture/domain-model.md`)

While domain tables are out of scope for F001's database schema, the conceptual domain model documented in `docs/architecture/domain-model.md` and `docs/architecture/overview.md` in F001 MUST codify the operator-approved rules from **Constitution Principle III**, **`docs/azusa-data-model.md` (v0.4)**, **`docs/feature-roadmap.md`**, and **`AZUSA_HANDOFF.md` (§§7–12, 20)** so all subsequent features build on a single source of truth:

1. **Strict Separation of Plan Versions, PI Commitments, Sprint Commitments, and Actuals**:
   - **PlanVersion (`v1`, `v2`, `v3`… — F010)**: User-created complete snapshot of the current PI planning state (including unchanged prior-version elements plus revisions). Versioning is never an official commitment.
   - **PICommitment (`Start PI` — F013)**: Official, immutable planning reference established when Admin/RTE executes **Start PI** for participating Teams. Never labeled *"Baseline the PI"* or conflated with manual Plan Versions.
   - **SprintCommitment (`Start Sprint` — F015)**: Official, immutable planning reference established when the SM reviews the current Team Sprint Plan and executes **Start Sprint** (committing the reviewed current plan even when started retroactively).
   - **SprintClosure / Actuals (`Close Sprint` — F017)**: Finalized actual Story and stretch-slice points and actual capacity confirmed when the SM executes **Close Sprint**, alongside continuous execution history.
2. **Three Distinct Sprint Lifecycle Date Concepts**:
   - **Scheduled dates**: Official Team Sprint start/end derived from the ART cadence plus the Team's optional `−1 / 0 / +1` working-day offset (`F002`).
   - **Effective lifecycle dates**: Dates selected by the SM in the **Start Sprint** / **Close Sprint** date picker (`F015`, `F017`), allowing retroactive start or early/late clerical close without rewriting scheduled dates.
   - **Action timestamps (`recorded_at`)**: Exact UTC timestamp when the action was confirmed in Azusa.
3. **Traceable Workflow History**:
   - Every work-item state transition records an immutable `StateChange` (`item`, `from_state`, `to_state`, `at`, `by`) event (`F014`).
4. **Work Hierarchy, Ownership & Overhead Rules (`F004`–`F009`)**:
   - `Project` (long-lived, participating teams derived) → `Feature` (single owning Team, single Project, single PI) → `Story` (single Project, single owning Team, optional Feature of matching Team/Project; committed = 1 Sprint slice, stretch = multiple `StorySlice` records within the same PI).
   - `Bug` is a separate work-item type (not a Story) with a required Project and Team, restricted to the `Bugs` work category.
   - `General Work`, `Training`, and `Retrospectives` are non-story time/capacity deduction records with no Project and no Story Points (`F004`, `F006`).
   - `BoardPlacement` (`x`, `y`) is view-scoped layout state (`Team PI board` `F008` vs `ART program board` `F012`) and never determines scheduling, capacity, or commitments.

### 4. Local Storage Paths, Exclusive Locking, Backup Snapshots & Recovery Safety

- **Database Storage & Lock File**: Local PGlite filesystem path configured via `AZUSA_DB_DIR` (defaulting to gitignored `.azusa/data/db`), coordinated across processes via `proper-lockfile` (`<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock`), with isolated temporary storage used during automated unit, integration, and Playwright tests.
- **Backup Storage & Retention**: Automatic startup backups and manual CLI backups write atomic timestamped snapshots into `AZUSA_BACKUP_DIR` (defaulting to `.azusa/data/backups`), executed *before* opening PGlite or running pending migrations, retaining the 10 most recent completed automatic `-startup` snapshots (pruned only after database mount and migrations succeed).
- **Safe Restore Target & Promotion**: The restore CLI procedure validates disjoint paths, verifies schema and full record integrity inside a temporary staging directory (`.restore-tmp-<uuid>`), restores into a separate target directory by default (`.azusa/data/restored-<timestamp>`), and uses a journaled `db-replaced-<timestamp>` swap with automatic rollback when `--force-overwrite-active` is explicitly requested while the server is stopped.
