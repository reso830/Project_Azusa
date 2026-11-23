# Feature Specification: Application Foundation

Operator alignment decision (2026-11-23): follow the v2 prototype. Place the Today widget in normal flow on the right, immediately before Search, with both rows right-aligned. This supersedes the earlier centering requirement and its base-handoff justification. Retain the viewer-local clock and layout-preserving search-overlap hiding below 1100px.

Operator decision (2026-11-21): use clock color `#A65307` from the v2 prototype. The v2 prototype overrides the base handoff's stale token table; the change also corrects clock-text contrast on the page background.

Accessibility clarification (2026-11-21): the profile trigger uses `aria-label="Account menu for SM"` so its accessible name includes the visible `SM` text, satisfying WCAG 2.5.3 (Label in Name). This records the approved Phase 06 accessibility correction.

**Feature Branch**: `001-application-foundations`  
**Created**: 2026-11-08  
**Updated**: 2026-11-20 (Regenerated against Feature Brief v0.2, Handoff v2, Data Model v0.6, and Roadmap v0.2)  
**Status**: Draft  
**Input**: `docs/features/001-application-foundations.md` (v0.2, 2026-11-20)  
**Design Reference**: `docs/handoffs/azusa-handoff-v2.zip` (`AZUSA_HANDOFF.md`, `AZUSA_HANDOFF_UPDATE_2026-11-20.md`, `docs/azusa-data-model.md` v0.6, `docs/azusa-sprint-planning-decisions.md`, `docs/azusa-work-item-view.md`, `prototype/Main.dc.html`, `prototype/LeaveCalendar.dc.html`, `prototype/TeamBacklog.dc.html`, `prototype/TeamIterationPlan.dc.html`, `prototype/Icons.dc.html`, `icons/icons.json` [42 icons], `icons/svg/*.svg`, `assets/azusa-logo.png`, `assets/azusa-logo-256.png`, `screenshots/01–15`)

---

## Clarifications

### Session 2026-11-20 (v0.2 Regeneration)

- **Q1 (Settings route in F001)**: *Brief v0.2 says a minimal `/settings` placeholder may be used to verify the profile-menu route without building a standalone Settings app. Should F001 include a `/settings` placeholder route or omit it?*  
  → **A1**: **Do not create a `/settings` route or standalone Settings page in F001.** The `Settings` entry appears in the profile dropdown as a **disabled, non-navigating placeholder**. Settings and configuration capabilities will be introduced incrementally alongside their respective owning features (`F002`–`F014`); there is no centralized Settings application. *(Supersedes the earlier 2026-11-08 `/settings` route decision. Consequently, Feature Brief v0.2's "Settings omits the Today widget" clause cannot be tested in F001 and is explicitly deferred to the first feature that introduces a Settings surface. F001's roadmap badges follow `docs/feature-roadmap.md` v0.2 `M0`–`M4` / `F001`–`F019` — currently marked `Proposed` in the repo, where its line 35 brief name `AZUSA_F001_APPLICATION_FOUNDATION_v0.2.md` refers to `docs/features/001-application-foundations.md`.)*
- **Q2 (Header context breadcrumb & profile dropdown identity)**: *Handoff v2's prototype header includes a sample context breadcrumb (`Payments ART › Palawan › PI-2027.1`) and profile dropdown subtitle (`Palawan · Payments ART`). Since ART/Team/PI do not exist until `F002`, how should F001 render these?*
  → **A2**: **Omit the header context breadcrumb until `F002`.** The profile dropdown header displays Title: **`Scrum Master`** and Subtitle: **`No ART or team configured`**. Keep `local:sm` strictly as an internal actor identifier for audit purposes rather than exposing it in the profile dropdown UI.
- **Q3 (Carry-forward of prior F001 technical safety & UX decisions)**: *Should F001 v0.2 carry forward all previously approved technical safety, architectural, and UX decisions from Pass 1–5 while updating stale handoff, icon, navigation, roadmap, and data-model references?*
  → **A3**: **Yes.** Carry forward all previously approved technical safety, architectural, and UX decisions from Pass 1–5 unchanged (including the `proper-lockfile` locking strategy, backup/recovery safeguards, and established UX/accessibility conventions), except where an earlier decision directly conflicts with the November 20 handoff v2 or these 2026-11-20 clarifications (in which case the latest approved requirements win and the change is documented).

### Session 2026-11-08 (Carried-Forward Baseline Decisions)

- **CF1 (Today widget clocks & timezone formatting — formerly Q1 / OD2 / L5)**: Show **only the viewer's local clock** (`HHMMh ZONE` in `#A65307`, refreshing every 15 seconds) and `"No active PI · No active Sprint"` on Line 1. Normalize legacy IANA timezone aliases (`Asia/Calcutta` → `Asia/Kolkata`, `US/Central` → `America/Chicago`), map fixed-offset named zones via lookup table (`Asia/Manila` → `PHT`, `Asia/Kolkata` → `IST`, `Asia/Tokyo` → `JST`, `Asia/Singapore` → `SGT`, `UTC`/`Etc/UTC`/`Etc/GMT` → `UTC`), format all other valid zones via `Intl` `timeZoneName: 'shortOffset'` with `GMT` replaced by `UTC` (e.g., `UTC-6`, `UTC+1`, `UTC` — **never `GMT`**), and on invalid or missing timezone IDs compute **both** the displayed clock time and the timezone badge in `UTC`.
- **CF2 (Placeholder routes & Foundation Status Card — formerly Q2 / Q3)**: Render route-specific placeholders across all 9 primary destinations with the standardized page title row (`Zen Kaku Gothic New`), `asanoha` empty-state mark, target milestone/feature badge from `docs/feature-roadmap.md` v0.2 (`M0`–`M4`, `F004`–`F019`), explicit non-operational notice, and a compact Foundation Status Card showing local DB, migration, and backup status plus a `"Record diagnostic check"` action.
- **CF3 (Backup-on-start, retention & safe restore — formerly Q4 / M1 / M3 / m1 / L4 / F2)**: Automatic pre-migration startup backup of an existing healthy PGlite cluster (at most once per process, atomic `.tmp-<backupId>` → `<backupId>`, rolling 10-snapshot retention of completed `-startup` backups pruned **only after** PGlite mounts and migrations succeed); non-mutating SHA-256-verified manual backup (`db:backup`); disjoint/Windows-normalized safe CLI restore (`db:restore`) with staged `.restore-tmp-<uuid>` verification; and recoverable journaled `--force-overwrite-active` promotion that **preserves `db-replaced-<timestamp>` intact on disk** for operator inspection and manual cleanup (deleting only `.azusa-promote-journal.json`, and rolling back automatically on error or interrupted startup).
- **CF4 (Cross-process locking — formerly C1 / M2 / L1 / L2 / L3 / F3 / G1)**: Enforce exclusive cross-process ownership via `proper-lockfile` using per-directory canonical sentinel paths (`<parent(dir)>/<basename(dir)>.azusa-lock`), keeping `<sentinel>.lock` strictly empty (optional non-authoritative diagnostics outside in `<dir>.azusa-owner.json`), waiting just over one heartbeat interval (`> 2000ms`, e.g., `2100ms`) across **every** lock holder (`server`, `db:migrate`, `db:backup`, `db:restore`) before opening PGlite or reading/copying/modifying the database folder, and providing custom `onCompromised` handlers for both server (close PGlite, mark `status: 'error'`, return `503`) and CLI (halt, clean up `.tmp-*`/`.restore-tmp-*`, roll back active promotion if underway, exit `1`).
- **CF5 (Accessibility, disclosure navigation & single-row header — formerly OD1 / OD4)**: Use `<nav aria-label="Primary navigation">` with disclosure button semantics (`aria-expanded`, `aria-controls`) and `<a aria-current="page">` links so both `Tab`/`Shift+Tab` and `ArrowDown`/`ArrowUp`/`Home`/`End` work with zero `@axe-core/playwright` violations; apply `:focus-visible` outlines (`2px solid #E07F24`) with `border: 0` at rest; keep the single-row floating header across `1440px`, `1024px`, and `768px`, setting `visibility: hidden` on `TodayWidget` when expanded search (`280px`) would overlap below `1100px` and restoring `visibility: visible` on collapse.
- **CF6 (Pre-auth actor & audit conventions — formerly Q5 / C12 / C13)**: Standardize on RFC 9562/4122 UUIDv4 primary keys (`crypto.randomUUID()`), UTC `created_at` and auto-updated `updated_at` timestamps, and `created_by`/`updated_by` defaulting to `"local:sm"` (overridable only in internal service/CLI calls, never accepted from public HTTP request bodies).

---

## Problem Statement

Azusa needs a clean, locally operated application foundation (`F001`) before any organizational, calendar, capacity, backlog, planning, execution, or reporting features (`F002`–`F019`) are built. Without a verified local Next.js + strict TypeScript runtime, durable embedded PostgreSQL (PGlite + Drizzle ORM) persistence with race-safe cross-process locking, atomic pre-migration backup and safe restore tooling, the approved Azusa visual shell (floating header, 9-destination regrouped navigation, profile dropdown, 42-icon Kumiko set, local typography), deterministic quality gates, and living documentation aligned with **Data Model v0.6** and **Roadmap v0.2**, subsequent features would risk inconsistent layouts, unrecoverable local data, architectural drift, or untestable code.

---

## Scope

### In Scope

1. **Local Application Runtime & Architecture**:
   - Single Next.js (App Router) application configured with strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), bound to `127.0.0.1` by default, with clear architectural boundaries separating presentation, application/domain logic, and persistence.
   - 100% local runtime operation with zero hosted services, cloud databases, external font CDNs, telemetry (`NEXT_TELEMETRY_DISABLED=1`), or paid APIs.
2. **Development Quality Gates & Verification Tooling**:
   - Zod validation conventions, ESLint, formatting checks, TypeScript type checking, Vitest unit/integration testing, production build verification, and Playwright visual-fidelity + end-to-end browser smoke tests (with `@axe-core/playwright` accessibility scanning, isolated test storage/build directories, dedicated port `3100`, and `reuseExistingServer: false`) executable via documented scripts.
3. **Local Persistence, Race-Safe Cross-Process Locking, Migrations & Audit Plumbing**:
   - Embedded PGlite database with Drizzle ORM backed by persistent local filesystem storage, protected across processes by `proper-lockfile` using per-directory canonical sentinels (`<parent(dir)>/<basename(dir)>.azusa-lock`), keeping `<sentinel>.lock` strictly empty, waiting `> 2000ms` (one heartbeat) across every lock holder before accessing database files, providing graceful `onCompromised` handlers for server and CLI, and maintaining a once-per-process `globalThis.__azusaDbState` singleton.
   - Explicit, version-controlled Drizzle SQL migrations (supporting configurable `migrationsFolder` for isolated testing) that initialize a fresh database and upgrade an existing database without data loss.
   - Reusable identity and audit-column conventions: UUIDv4 primary keys (`crypto.randomUUID()`), UTC `created_at` and auto-updated `updated_at` timestamps, and `created_by`/`updated_by` defaulting to `"local:sm"` (internal-only actor override).
   - Minimal infrastructure-owned persistence schema (`app_metadata`) to verify persistence across restarts and surface runtime health.
4. **Automatic Backup-on-Start & Safe Developer Restore**:
   - Atomic pre-migration snapshot of an existing healthy local PGlite cluster on startup (at most once per process, writing `.tmp-<backupId>` → `<backupId>` with `manifest.json`), with rolling 10-snapshot retention pruning of completed `-startup` backups deferred until **after** database mount and migrations succeed.
   - Documented and tested CLI commands for migration (`db:migrate`), non-mutating hash-verified manual backup (`db:backup`), and safe restore (`db:restore`) with disjoint-path and populated-target protection, staged `.restore-tmp-<uuid>` verification, and journaled `--force-overwrite-active` promotion that preserves `db-replaced-<timestamp>` intact on disk with automatic rollback and startup recovery.
   - Visible surfacing of database initialization, migration, locking, or backup failures via structured diagnostics (`GET /api/health`, `POST /api/health/check`) and an accessible UI error alert banner (`role="alert"`).
5. **Azusa Design System Foundations (Handoff v2)**:
   - Core warm-light palette, flat surfaces, ink/orange accents, semantic status/category/severity/pastel tokens, and focus-visible rules from `AZUSA_HANDOFF.md` §14.2 and `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §14.
   - Locally bundled typography via `@fontsource`: **Zen Kaku Gothic New** (`500`, `700`), **IBM Plex Sans** (`400`–`700`), and **IBM Plex Mono** (`500`, `600`) with `font-variant-numeric: tabular-nums`.
   - Supplied Azusa logo (`assets/azusa-logo.png`, `assets/azusa-logo-256.png`) and top-right radial-masked `asanoha` SVG lattice background (`28 × 48.5` pattern tile covering an `80%` width square).
   - Complete **42-icon Kumiko set** from `icons/icons.json` and `icons/svg/*.svg` exposed as reusable components: **35** `currentColor` Kumiko line icons (`24×24` viewBox, `1.75px` mitred stroke, butt caps, `currentColor` ink + `#E07F24` accent, `16 / 20 / 24 / 32` px ramp, with `delivery-flow`'s divider stroke fixed via `var(--kumiko-surface, #FFFFFF)`) and **7** fixed-colour glyphs (never `currentColor`): the `warning` plan-check triangle (`icons/icons.json` fixed orange triangle + `"!"`) plus the 6 solid status/commitment badges (`flag-missed`, `flag-aging`, `flag-blocked`, `commit-committed`, `commit-stretch`, `commit-buffer`).
6. **Application Shell, Regrouped 9-Destination Navigation & Profile Dropdown**:
   - Single-row floating header at all widths (`1440px`, `1024px`, `768px`; no conventional sidebar or full-width top bar):
     - **Left**: `<nav aria-label="Primary navigation">` with the `60px` Azusa logo button (`64×64px` hit target, `aria-expanded`, `aria-controls`) toggling the `290px` primary navigation dropdown containing **9 destinations** across 4 groups (`PI`: Team PI board, ART program board, Team PI brief; `Capacity`: Team calendar, Capacity planner; `Sprint`: Team backlog, Sprint planning, Iteration board; `Insights`: Team dashboard). *(Header context breadcrumb is omitted until `F002`.)*
     - **Right, before Search** (normal flex flow, `align-items: flex-end`): Today widget (`role="timer"`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`) reading the browser's IANA timezone on mount (`Intl.DateTimeFormat().resolvedOptions().timeZone`) to display viewer-local date (`YYYY/MM/DD`), ISO-8601 week/weekday (`CWww.d`), explicit unconfigured state (`No active PI · No active Sprint`), and viewer-local 24-hour clock (`HHMMh ZONE` in `#A65307`, refreshing every 15 seconds). Hidden via `visibility: hidden` when expanded search (`280px`) would overlap below `1100px`, restoring `visibility: visible` on collapse.
     - **Right, after the Today widget**: Expandable search control (`40px` white circle button expanding on activation to a `280px` search input with placeholder `"Search stories, features…"` and collapsing on blur/`Escape`) and local operator profile button (`40px` `#1A1B22` circle displaying `"SM"`, `aria-label="Account menu for SM"`, toggling a `250px` profile dropdown showing `"Scrum Master"` / `"No ART or team configured"` and a **disabled, non-navigating `Settings` placeholder** with `18px` `settings` Kumiko icon and visible `aria-describedby`-linked helper text).
   - Route-specific placeholder views for all **9 primary destinations** (`/`, `/program-board`, `/pi-brief`, `/calendar`, `/capacity`, `/backlog`, `/sprint-planning`, `/iteration`, `/dashboard`), displaying the page title row (`Zen Kaku Gothic New`), `asanoha` empty-state mark, target milestone/feature badge from `docs/feature-roadmap.md` v0.2 (`M0`–`M4`, `F004`–`F019`), clear notice that domain functionality is not yet operational, and the compact Foundation Status Card.
   - Keyboard accessibility (`Tab`, `Shift+Tab`, `Enter`/`Space`, `Escape`, `ArrowDown`/`ArrowUp`/`Home`/`End`), visible `:focus-visible` outlines, mutual exclusion between header dropdowns, zero `@axe-core/playwright` violations, and non-overlapping layout across `1440px`, `1024px`, and `768px`.
7. **Living Repository Documentation**:
   - Creation and alignment of `README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md` (codifying **Data Model v0.6** and Constitution Principle III), `docs/architecture/data-dictionary.md` (F001 physical structures only), `docs/architecture/decisions/`, and `docs/operations/`.

### Non-Goals (Out of Scope)

1. **No `/settings` Route or Standalone Settings Application**:
   - F001 does **not** create a `/settings` route or Settings screen. `Settings` is rendered only as a disabled, non-navigating placeholder inside the profile dropdown. Configuration is owned incrementally by `F002`–`F014` (`docs/feature-roadmap.md` v0.2).
2. **Organization, Cadence, Categories, Capacity & Team Calendar (`M0`: `F002`–`F005`)**:
   - Creating database tables, APIs, header context switchers (`ART › Team › PI`), or UI for Trains/ARTs, Teams, Members, Locations, Holidays, Absences, PIs, Sprints, ±1 working-day Team offsets (`F002`), Work Categories & Allocations (`F003`), Capacity Engine & Capacity Planner (`F004`), or Team Calendar, Ceremonies, Meetings, Milestones & Overtime (`F005`).
3. **Project/Feature Registry, Work Items, Backlog, PI Planning & Commitments (`M1`: `F006`–`F012`)**:
   - Implementing Project/Feature registry (`F006`), Stories/Bugs/light-story layouts, severity, repro steps, AC/DoR/DoD checklists, tags, discussions, or Removed lifecycle (`F007`), PO-ranked Team Backlog (`F008`), React Flow Team PI Board, StorySlices, Buffers, or OverheadReserves (`F009`), internal/external Dependencies (`F010`), Team PI Brief (`F011`), or Plan Versioning & `Start PI` (`F012`). *(These concepts are documented conceptually in `docs/architecture/domain-model.md` per Data Model v0.6, with zero physical tables in F001.)*
4. **Sprint Execution (`M2`: `F013`–`F015`)**:
   - Implementing Sprint Planning workspace, Owner/Distributed load rings, OverheadTickets, or `Start Sprint` (`F013`), dnd-kit Iteration Board, workflows, or Buffer draws (`F014`), or `Close Sprint` & Actuals (`F015`).
5. **Metrics Engine, Dashboards & ART-Level Planning (`M3`–`M4`: `F016`–`F019`)**:
   - Implementing metrics calculations or chart library selection (`F016`), Team Dashboard (`F017`), ART Dashboard & exports (`F018`), or ART Program Board (`F019`).
6. **Functional Search Indexing & Result Retrieval**:
   - Implementing backend search queries, indexing, or result dropdowns; F001 search is strictly limited to the header expand/focus/collapse shell interaction.
7. **Authentication, Multi-User Sessions & RBAC Enforcement**:
   - Integrating Better Auth, login flows, user switching UI, or role-based access enforcement.
8. **Interactive Backup/Export/Import UI**:
   - Building UI screens for backup/restore/export; F001 backup and restore are automatic on startup and CLI-driven.
9. **Porting Prototype Runtime or Sample Data Screens**:
   - Porting `.dc.html` / `support.js` runtime or rendering fake/sample boards, work items, charts, or calendars that make unimplemented features appear operational.

---

## Visual & Interaction Target (Constitution Principle II)

The handoff v2 package at `docs/handoffs/azusa-handoff-v2.zip` (`AZUSA_HANDOFF.md`, `AZUSA_HANDOFF_UPDATE_2026-11-20.md`, `prototype/Main.dc.html`, `prototype/LeaveCalendar.dc.html`, `prototype/TeamBacklog.dc.html`, `prototype/TeamIterationPlan.dc.html`, `prototype/Icons.dc.html`, `icons/icons.json`, `icons/svg/*.svg`, `assets/azusa-logo.png`, `screenshots/01–15`) is the binding visual and interaction target for the F001 shell, typography, color tokens, and 42-icon Kumiko system. Per `AZUSA_HANDOFF_UPDATE_2026-11-20.md`, where the November 20 update differs from the base `AZUSA_HANDOFF.md`, the November 20 update wins; older Dashboard and ART Program Board screenshots are reference material only and are rendered as honest placeholders in F001.

### Intentional, Justified Deviations from the Prototype in F001

| Area | Prototype v2 Behavior | F001 Specified Behavior | Justification |
|---|---|---|---|
| **D1 — `delivery-flow` icon seam fix** | `icons/icons.json` and `Icons.dc.html` provide the 42-icon Kumiko set, but `delivery-flow` still uses a hardcoded `#FFFFFF` divider stroke (`AZUSA_HANDOFF_UPDATE_2026-11-20.md` §15). | Render all 42 Kumiko icons (35 currentColor line icons + 7 fixed-colour status/commitment badges) as reusable components, replacing `delivery-flow`'s hardcoded `#FFFFFF` divider stroke with `stroke="var(--kumiko-surface, #FFFFFF)"`. | Explicitly called out as a remaining quirk in `AZUSA_HANDOFF_UPDATE_2026-11-20.md` §15 (*"delivery-flow's white divider still seams on non-white backgrounds"*). |
| **D2 — Local font loading** | `.dc.html` files load fonts from `https://fonts.googleapis.com`. | Bundle `Zen Kaku Gothic New`, `IBM Plex Sans`, and `IBM Plex Mono` locally via `@fontsource`. | Required by Constitution Principle IV and Feature Brief v0.2 §3.1, §3.3 (no external runtime font dependencies). |
| **D3 — Today widget PI/Sprint & clocks** | Hardcodes `PI-2027.1 · Sprint 2706` on Line 1 and three sample team clocks (`PHT`, `IST`, `CST`) on Line 2. | Displays `No active PI · No active Sprint` on Line 1 and only the viewer's local clock (`HHMMh ZONE` in `#A65307`, fixed-offset lookup + `UTC±offset`, never `GMT`, full UTC fallback on invalid IDs) on Line 2, with `aria-label="Current date, calendar week, PI and sprint status, and local time"`. | Required by Feature Brief v0.2 §3.6, AC05, and Clarification CF1. |
| **D4 — Placeholder route bodies** | Renders sample Palawan PI boards, calendars, backlogs, Sprint planning workspaces, and dashboards from inline JS arrays. | Renders route-specific placeholder views across all 9 primary destinations with the standardized page title row (`Zen Kaku Gothic New` `28px`), `asanoha` mark, roadmap milestone/feature badge (`docs/feature-roadmap.md` v0.2: `M0`–`M4`, `F004`–`F019`), non-operational notice, and Foundation Status Card. | Required by Feature Brief v0.2 §3.5, AC04 (*"clearly non-operational placeholder"*), and Clarification CF2. |
| **D5 — Disclosure navigation, disabled Settings item, focus outlines, overlap hiding & error banner** | Prototype right-aligns TodayWidget in normal flow before Search; uses `role="menu"` around plain links, links Settings to a page, omits focus outlines, unmounts TodayWidget whenever search opens, and shows no error banner. | Match v2 right-side placement with `align-items: flex-end`. Use disclosure navigation (`aria-expanded`, `aria-controls`, `aria-current="page"`), disabled non-navigating Settings with visible `aria-describedby` helper, `2px solid #E07F24` focus outlines, sticky single-row header, `visibility: hidden` below `1100px` when search expands, and `role="alert"` for database errors. | Right alignment follows the operator decision of 2026-11-23. Remaining deviations implement accessibility, AC03/AC06/AC09, and Clarifications Q1/CF5; the earlier centering override is superseded. |
| **D6 — Omitted header context breadcrumb & unconfigured profile subtitle** | Prototype header displays `Payments ART › Palawan › PI-2027.1` context switchers and profile dropdown subtitle `"Palawan · Payments ART"`. | Omits the header context breadcrumb until `F002`; displays Title `"Scrum Master"` and Subtitle `"No ART or team configured"` in the profile dropdown header (keeping `local:sm` internal-only for audit). | Required by Feature Brief v0.2 §3.4, §3.6, §5, and Clarification Q2 (`2026-11-20`). |

---

## User Behavior

### User Story 1 — Application Shell, Design System, 9-Destination Navigation & Profile Dropdown (Priority: P1)

As the operator (Scrum Master), I want to launch Azusa locally and interact with its recognizable kumiko/asanoha visual shell, local typography, 42-icon Kumiko set, single-row floating header, regrouped 9-destination navigation menu, expandable search, and profile dropdown, while clearly seeing that all 9 destinations and the disabled Settings menu entry are placeholders for future features.

**Why this priority**: Establishes the visual identity, icon system, and navigation container that every subsequent feature (`F002`–`F019`) mounts into (AC01, AC02, AC03, AC04, AC06).

**Independent Test**: Start Azusa locally, open `/` in a browser, verify warm `#F4F1EC` page background, top-right radial-masked `asanoha` lattice, locally bundled fonts (`Zen Kaku Gothic New`, `IBM Plex Sans`, `IBM Plex Mono`), `60px` Azusa logo button, expandable search control, and `"SM"` profile button with zero external network requests; open the logo menu and navigate through all 9 primary destinations (`PI`: Team PI board, ART program board, Team PI brief; `Capacity`: Team calendar, Capacity planner; `Sprint`: Team backlog, Sprint planning, Iteration board; `Insights`: Team dashboard) via mouse and keyboard (`Tab`, `Enter`/`Space`, `ArrowDown`/`ArrowUp`, `Escape`), confirming each displays its title, roadmap milestone/feature badge (`M0`–`M4`, `F004`–`F019`), and explicit placeholder state; open the `"SM"` profile dropdown and verify `"Scrum Master"`, `"No ART or team configured"`, and the disabled non-navigating `Settings` placeholder (and confirm `Settings` does not appear in the logo menu); verify zero `@axe-core/playwright` violations across tested states.

**Acceptance Scenarios**:

1. **Given** Azusa is running locally, **When** the operator opens `/`, **Then** the application renders the single-row floating header (without any conventional sidebar, top bar, or sample ART/Team/PI context breadcrumb), the top-right radial-masked `asanoha` lattice (`28 × 48.5` tile), locally bundled fonts, and the `Team PI board` placeholder with zero external font or API requests.
2. **Given** the primary navigation dropdown is closed by default (`aria-expanded="false"`), **When** the operator activates the `60px` Azusa logo button (click, `Enter`, or `Space`), **Then** the `290px` white dropdown opens (`aria-expanded="true"`) inside `<nav aria-label="Primary navigation">` displaying the 4 groups (`PI`, `Capacity`, `Sprint`, `Insights`) and **9 destinations** with their `18px` Kumiko line icons (`team-board`, `art-board`, `pi-brief`, `calendar`, `capacity`, `backlog`, `sprint-plan`, `iteration`, `dashboard`), and `Settings` is **not** present in this menu.
3. **Given** the primary navigation dropdown is open, **When** the operator selects any of the 9 destinations (`/`, `/program-board`, `/pi-brief`, `/calendar`, `/capacity`, `/backlog`, `/sprint-planning`, `/iteration`, `/dashboard`), **Then** the menu closes, the selected route renders its placeholder view with its page title in `Zen Kaku Gothic New`, `asanoha` mark, target roadmap badge (`M0`–`M4`, `F004`–`F019`), and non-operational notice, and reopening the menu marks the active route with `aria-current="page"`, `#FCEFE2` background, and `#A65307` icon/text.
4. **Given** the operator activates the `40px` `"SM"` profile button (`aria-label="Account menu for SM"`), **When** the `250px` profile dropdown opens, **Then** any open logo navigation menu closes, the dropdown displays `"Scrum Master"` and `"No ART or team configured"` (never exposing `local:sm` or sample ART/team names) above a **disabled, non-navigating `Settings` placeholder** with `18px` `settings` Kumiko icon (`aria-disabled="true"`), and pressing `Escape` closes the dropdown and returns focus to the `"SM"` button.
5. **Given** the search control is collapsed (`40px` white circle), **When** the operator activates it, **Then** it expands to a `280px` input (`border-radius: 20px`) with automatic focus and placeholder `"Search stories, features…"` (setting `visibility: hidden` on the Today widget below `1100px` so it never overlaps), and collapses back on blur or `Escape` (restoring Today widget visibility).
6. **Given** the operator navigates using only a keyboard, **When** operating the logo menu, all 9 navigation links, search control, and profile dropdown, **Then** every interactive control displays a visible `:focus-visible` outline (`2px solid #E07F24`), exposes valid accessible names/roles with zero `@axe-core/playwright` violations, and closes open overlays with `Escape`.

---

### User Story 2 — Viewer-Local Today Widget & Unconfigured Calendar State (Priority: P1)

As the operator, I want the header's Today widget to accurately display my local date, ISO-8601 calendar week/weekday, local 24-hour clock with timezone label, and an honest unconfigured PI/Sprint state without inventing sample PI, Sprint, or team-clock data.

**Why this priority**: Establishes accurate local temporal formatting and honest unconfigured state before `F002` introduces ART/PI/Sprint calendar configuration (AC05).

**Independent Test**: Load `/` (and verify on other primary routes) in a browser, confirm Line 1 displays viewer-local `YYYY/MM/DD · CWww.d | No active PI · No active Sprint` and Line 2 displays a single viewer-local 24-hour clock `HHMMh ZONE` in `#A65307` `IBM Plex Mono` (`tabular-nums`) with zero hydration warnings and zero layout shift; verify unit tests cover ISO week year boundaries, Sundays (`d=7`), legacy alias normalization, fixed-offset abbreviations (`PHT`/`IST`/`JST`/`SGT`/`UTC`), `UTC±offset` formatting (never `GMT`), and full UTC fallback (both time and label) on invalid timezone IDs.

**Acceptance Scenarios**:

1. **Given** the operator views any of the 9 primary routes, **When** the header renders, **Then** the right-aligned Today widget immediately before Search (`role="timer"`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`) displays Line 1 as `YYYY/MM/DD · CWww.d | No active PI · No active Sprint` (ISO-8601 week `01`–`53`, weekday `1`=Mon…`7`=Sun).
2. **Given** the operator views any of the 9 primary routes, **When** the header renders, **Then** Line 2 displays only the viewer's local clock formatted as `HHMMh ZONE` in `18px` `IBM Plex Mono` semibold `#A65307` with the timezone badge in `10.5px` `#67635C` (fixed-offset lookup table or `UTC±offset`, never `GMT`; invalid/missing IDs computing both time and badge in `UTC`), refreshing every 15 seconds without SSR hydration mismatch or layout shift.
3. **Given** the viewport width is `1024px` or `768px` (`< 1100px`), **When** the operator expands the `280px` search input, **Then** the Today widget sets `visibility: hidden` (preserving its layout box with zero shift) so controls never overlap, and restores `visibility: visible` when search collapses.

---

### User Story 3 — Local Persistence, Race-Safe Locking, Migrations & Surfaced Foundation Health (Priority: P1)

As the operator, I want Azusa to persist infrastructure records in a local PGlite + Drizzle database with standardized UUIDv4 and audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`), enforce race-safe cross-process locking, apply schema migrations reliably, retain data across restarts, and visibly surface database/migration/backup status or failures.

**Why this priority**: Local durability, exclusive ownership, and transparent error surfacing are non-negotiable under Constitution Principles III and IV (AC07, AC09).

**Independent Test**: Start Azusa locally, inspect the Foundation Status Card on `/` (and `GET /api/health`) confirming database initialization and applied migrations, click **"Record diagnostic check"** (`POST /api/health/check`), stop the server completely, restart it, and verify the persisted diagnostic record (UUIDv4, UTC timestamps, `created_by = "local:sm"`, incremented `checkCount`) survives intact; verify via automated tests that fresh initialization, incremental migration upgrades, real `init`-stage failures, and fault-injected UI error banners (`role="alert"`) all behave as specified.

**Acceptance Scenarios**:

1. **Given** a fresh local environment with no existing database directory, **When** Azusa starts or `db:migrate` runs, **Then** the process acquires the `proper-lockfile` lock on `<parent(dbDir)>/<basename(dbDir)>.azusa-lock` (keeping `.lock` empty), waits `> 2000ms` (one heartbeat) to confirm `onCompromised` has not fired, initializes PGlite, applies pending Drizzle migrations, seeds `'foundation.init'` in `app_metadata` with UUIDv4 `id`, UTC timestamps, and `created_by = "local:sm"` / `updated_by = "local:sm"`, writes `.azusa-last-healthy.json`, and reports `status: "healthy"`.
2. **Given** a diagnostic record has been persisted in `app_metadata`, **When** the server stops and restarts, **Then** the record and all of its UUIDv4 and audit fields remain intact and queryable.
3. **Given** an existing local database containing records, **When** an incremental Drizzle migration is applied (using a configurable `migrationsFolder`), **Then** the schema upgrades cleanly while preserving 100% of existing records.
4. **Given** database initialization, locking (`onCompromised` or `ELOCKED`), migration, or startup backup fails, **When** the application loads or handles requests, **Then** the error state is cached once per process (never re-triggering startup backups or evicting good backups on subsequent page loads), `GET /api/health` and `POST /api/health/check` return `503 Service Unavailable` with structured `{ stage, message, recoveryHint }`, and the shell renders `<ErrorAlertBanner role="alert" />`.

---

### User Story 4 — Automatic Backup-on-Start & Safe Developer Restore (Priority: P2)

As the operator, I want Azusa to automatically snapshot an existing healthy local database on startup before applying migrations (pruning old automatic backups only after startup and migrations succeed) and provide documented, tested CLI commands for manual backup and safe restore that protect the active database from accidental or silent replacement.

**Why this priority**: Protects local planning data against corruption or failed migrations from day one (Constitution Principle IV, AC08).

**Independent Test**: Persist a diagnostic record, stop the server, restart the server (confirming an automatic `backup-*-startup` snapshot is created and surfaced on the Foundation Status Card) or run `npm run db:backup` while the server is stopped, then run `npm run db:restore -- --from latest` into a disjoint staging target and verify 100% of persisted record fields are recovered while the active database directory is byte-for-byte unchanged (SHA-256 verified).

**Acceptance Scenarios**:

1. **Given** an existing initialized, healthy local PGlite cluster (`PG_VERSION` and `.azusa-last-healthy.json` present), **When** Azusa starts up, **Then** it acquires the exclusive lock, waits `> 2000ms` to confirm lock integrity, recovers any interrupted active-restore promotion first, creates at most one atomic timestamped snapshot per process (`.tmp-<backupId>` → `<backupId>` with `manifest.json`) before opening PGlite or running migrations, and **only after** PGlite mounts and all migrations succeed prunes completed `-startup` snapshots beyond the 10-snapshot retention limit.
2. **Given** a valid local backup snapshot, **When** the operator runs `db:restore` targeting a disjoint, non-existing (or empty) staging directory, **Then** the restore locks only the target's own sentinel (`<parent(target)>/<basename(target)>.azusa-lock`, allowing sibling restores while the server holds the active lock), validates `app_metadata` and full record integrity in `.restore-tmp-<uuid>`, and moves it into place without modifying the active database.
3. **Given** `db:backup`, `db:migrate`, or active-target `db:restore -- --force-overwrite-active` runs while another process holds the active DB lock, OR `db:restore` targets the active DB without `--force-overwrite-active`, overlaps the active DB/source backup/backups root, or points to a non-empty target directory, **When** executed, **Then** it aborts before mutating any files, prints an actionable error to stderr, exits with code `1`, and leaves source and active directories byte-for-byte untouched.
4. **Given** the server is stopped and the operator runs `db:restore -- --to <activeDbDir> --force-overwrite-active`, **When** promotion executes, **Then** it holds the exclusive lock (waiting `> 2000ms`), records `.azusa-promote-journal.json`, moves `<activeDbDir>` to `db-replaced-<timestamp>`, moves verified `.restore-tmp-<uuid>` to `<activeDbDir>`, confirms PGlite readability, **preserves `db-replaced-<timestamp>` intact on disk** for safety/inspection, and removes only the journal—automatically rolling back `db-replaced-<timestamp>` to `<activeDbDir>` on failure, lock loss (`onCompromised`), or interrupted startup.

---

### User Story 5 — Automated Quality Gates & Living Documentation (Priority: P2)

As a human developer or AI coding agent, I want documented, deterministic commands for linting, formatting, typechecking, unit/integration testing, building, and Playwright visual/E2E smoke testing, alongside complete foundational documentation aligned with **Data Model v0.6** and **Roadmap v0.2**.

**Why this priority**: Enforces Constitution Principles V (Deterministic Testing) and VI (Documentation as a First-Class Deliverable) so `F002`–`F019` build on verified guardrails and accurate architectural context (AC01, AC10).

**Independent Test**: From a clean setup following `README.md`, run `lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, and `test:e2e` (all exiting `0` against isolated port `3100` / `.azusa/test-playwright/` storage with zero cloud credentials), and verify all required documentation artifacts (`README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/`, `docs/operations/`, `docs/feature-roadmap.md`) exist, contain accurate non-placeholder content matching Data Model v0.6 and Roadmap v0.2, and are navigable from `README.md`.

**Acceptance Scenarios**:

1. **Given** a clean workstation with documented Node.js prerequisites (including `npx playwright install chromium`), **When** the operator runs all quality gate commands documented in `README.md`, **Then** every command exits `0` deterministically without external credentials or mutating `.azusa/data/`.
2. **Given** the repository documentation set, **When** inspected against Constitution Principle VI and Feature Brief v0.2 §3.9, **Then** every required documentation artifact exists, has no leftover placeholder text, accurately reflects the F001 implementation and Data Model v0.6 invariants, and links cleanly from `README.md` (with `F001` in `docs/feature-roadmap.md` remaining unchecked until conformance review and operator UAT acceptance).

---

## Acceptance Criteria

### Mapping to Feature Brief v0.2 Acceptance Criteria (AC01–AC10)

| Brief AC | Requirement Summary | Verified by User Story |
|---|---|---|
| **AC01 — Reproducible local setup** | Follow `README.md` on a clean workstation, install dependencies, initialize local DB, and start Azusa with zero cloud services, external runtime APIs, or secret credentials. | US1, US5 |
| **AC02 — Approved shell and design foundations** | Use supplied logo, `asanoha` motif, approved warm-light palette and local typography, single-row floating header, and complete **42-icon Kumiko set** (35 line + 7 fixed-colour badges); no sidebar or conventional top bar. | US1 |
| **AC03 — Navigation coverage** | All **9 primary destinations** available through `PI` / `Capacity` / `Sprint` / `Insights` groups; `Settings` in the profile dropdown (disabled placeholder in F001), never in primary navigation; active-page indication accurate. | US1 |
| **AC04 — Honest placeholder routes** | Every primary destination renders a clearly non-operational placeholder with its page title and Roadmap v0.2 reference (`M0`–`M4`, `F004`–`F019`); Dashboard and ART Program Board are not presented as functional screens; no `/settings` route or standalone Settings app. | US1 |
| **AC05 — Today widget correctness** | Shows viewer-local date (`YYYY/MM/DD`), ISO-8601 week/day (`CWww.d`), explicit `"No active PI · No active Sprint"`, and single viewer-local clock (`HHMMh ZONE`, never `GMT`, full UTC fallback on invalid IDs) derived from the browser's IANA timezone. *(Per Q1, the brief's "Settings omits the widget" clause is deferred to the first feature adding a Settings surface.)* | US2 |
| **AC06 — Responsive and accessible shell** | Single-row header usable at `1440px`, `1024px`, `768px`; expanded search hides Today widget via `visibility: hidden` below `1100px` with zero overlap; navigation, search, and profile dropdown keyboard-accessible with visible `:focus-visible`, valid ARIA semantics, and zero `@axe-core/playwright` violations. | US1, US2 |
| **AC07 — Persistent local storage and migrations** | Infrastructure test record (`app_metadata`) survives application restart with intact UUIDv4 and `"local:sm"` audit fields; fresh DB initializes cleanly; incremental migration preserves existing records; zero business-domain tables in F001. | US3 |
| **AC08 — Backup and restore safety** | Recoverable startup backup created before migrations (pruned only after mount + migrations succeed); manual backup and safe restore CLI documented and tested; active DB protected from accidental/silent replacement (`db-replaced-<timestamp>` preserved on explicit forced overwrite). | US4 |
| **AC09 — Health and failure visibility** | Operator can inspect foundation health on placeholder screens; critical init, lock, migration, or backup failures surface via structured diagnostics (`503`) and accessible UI alert banner (`role="alert"`). | US3 |
| **AC10 — Quality gates and documentation** | Documented `lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, and `test:e2e` pass (`0`); all required documentation artifacts exist, match F001 and Data Model v0.6 / Roadmap v0.2, and are linked from `README.md`. | US5 |

### Functional Requirements

- **FR-001**: System MUST run as a single local Next.js (App Router) application written in strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`), bound to `127.0.0.1` by default, with `NEXT_TELEMETRY_DISABLED=1` and zero runtime dependency on hosted services, external font CDNs, or paid APIs.
- **FR-002**: Codebase MUST enforce module boundaries separating presentation (`src/app/`, `src/ui/`), domain/application logic (`src/domain/`, `src/application/`), and persistence/infrastructure (`src/persistence/`, `scripts/db/`), keeping `src/domain/` free of framework and I/O imports.
- **FR-003**: System MUST bundle `Zen Kaku Gothic New` (`500`, `700`), `IBM Plex Sans` (`400`–`700`), and `IBM Plex Mono` (`500`, `600`) locally via `@fontsource` and apply `font-variant-numeric: tabular-nums` to clocks, dates, and tabular numerics.
- **FR-004**: System MUST provide a reusable Kumiko icon component covering all **42 icons** from `icons/icons.json` and `icons/svg/*.svg`. **All 42 icons MUST render inside the same shared `<svg>` wrapper as the supplied SVGs** (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linejoin="miter"`, `stroke-miterlimit="10"`, `stroke-linecap="butt"`, size ramp `16`, `18`, `20`, `24`, `32`, `40` px):
  - **35 `currentColor` line icons** (`team-board`, `art-board`, `pi-brief`, `capacity`, `backlog`, `sprint-plan`, `iteration`, `dashboard`, `settings`, `search`, `add`, `filter`, `export`, `present`, `refresh`, `chevron`, `expand`, `copy-link`, `more`, `edit`, `close-item`, `check`, `close`, `dependency`, `delivery-flow`, `objective`, `risk`, `velocity`, `calendar`, `info`, `lock`, `location`, `clock`, `members`, `asanoha`) inherit `currentColor` ink + `#E07F24` accent details, with surface-safe divider handling (`stroke="var(--kumiko-surface, #FFFFFF)"`) for `delivery-flow`.
  - **7 fixed-colour glyphs** (`warning`, `flag-missed`, `flag-aging`, `flag-blocked`, `commit-committed`, `commit-stretch`, `commit-buffer`) inherit `fill="none"`, `stroke-width="1.75"`, and mitre/butt geometry from the shared `<svg>` wrapper while keeping their fixed semantic colours through their own inner `<path>` attributes so `currentColor` never reaches them.
- **FR-005**: Application shell MUST render the warm `#F4F1EC` page background, the top-right radial-masked `asanoha` SVG lattice (`28 × 48.5` tile, `#E2D9CC` stroke, `80%` width square), and the sticky single-row floating header (`position: sticky; top: 0; z-index: 20` with the bottom linear-gradient fade backdrop per `Main.dc.html#L25-L26`) containing:
  - **Left**: `<nav aria-label="Primary navigation">` with the `60px` Azusa logo button (`64×64px` hit target, `aria-expanded`, `aria-controls="azusa-primary-nav-menu"`) toggling the `290px` navigation dropdown. *(No ART/Team/PI context breadcrumb in F001.)*
  - **Right, before Search**: Today widget (normal flex flow, `align-items: flex-end`, `role="timer"`, `aria-label="Current date, calendar week, PI and sprint status, and local time"`), hidden via `visibility: hidden` when expanded search (`280px`) would overlap below `1100px`.
  - **Right, after the Today widget**: Expandable search control (`40px` circle expanding to `280px` input with placeholder `"Search stories, features…"`, collapsing on blur/`Escape`) and `40px` `"SM"` profile button (`aria-label="Account menu for SM"`, `aria-expanded`, `aria-controls="azusa-profile-menu"`) toggling the `250px` profile dropdown showing `"Scrum Master"`, `"No ART or team configured"`, and a disabled non-navigating `Settings` placeholder (`aria-disabled="true"`) with visible helper text linked via `aria-describedby`.
- **FR-006**: Primary navigation dropdown MUST list exactly **9 destinations** across 4 groups in this exact order (excluding `Settings`):
  - **PI**: `Team PI board` (`/` — `M1 · F009`), `ART program board` (`/program-board` — `M4 · F019`), `Team PI brief` (`/pi-brief` — `M1 · F011`)
  - **Capacity**: `Team calendar` (`/calendar` — `M0 · F005`), `Capacity planner` (`/capacity` — `M0 · F004`)
  - **Sprint**: `Team backlog` (`/backlog` — `M1 · F008`), `Sprint planning` (`/sprint-planning` — `M2 · F013`), `Iteration board` (`/iteration` — `M2 · F014`)
  - **Insights**: `Team dashboard` (`/dashboard` — `M3 · F017`)
  Active destination MUST be marked with `aria-current="page"`, `#FCEFE2` tint, and `#A65307` icon/text. Non-menu routes (such as future work-item detail routes) MUST highlight no primary navigation item.
- **FR-007**: Today widget MUST read the browser's IANA timezone on mount (`Intl.DateTimeFormat().resolvedOptions().timeZone`, falling back to `UTC` only if discovery fails or yields an invalid zone) and pass it to the domain date/ISO-week/clock model to compute and display:
  - Line 1: Viewer-local date (`YYYY/MM/DD`), ISO-8601 week/weekday (`CWww.d`, `01`–`53`, `1`=Mon…`7`=Sun), vertical divider, and `"No active PI · No active Sprint"`.
  - Line 2: Viewer-local 24-hour time `HHMMh ZONE` in `18px` `IBM Plex Mono` semibold `#A65307` (normalizing legacy aliases `Asia/Calcutta` → `Asia/Kolkata` and `US/Central` → `America/Chicago`; fixed-offset lookup `Asia/Manila` → `PHT`, `Asia/Kolkata` → `IST`, `Asia/Tokyo` → `JST`, `Asia/Singapore` → `SGT`, `UTC`/`Etc/UTC`/`Etc/GMT` → `UTC`; all other valid zones via `Intl` `shortOffset` with `GMT` replaced by `UTC`, never `GMT`; invalid/missing timezone IDs computing **both** clock time and zone badge in `UTC`), refreshing every 15 seconds without SSR hydration mismatch or layout shift.
- **FR-008**: All interactive shell controls (logo nav menu, 9 nav links, expandable search, profile button and dropdown) MUST be keyboard-operable (`Tab`, `Shift+Tab`, `Enter`/`Space`, `Escape`, and `ArrowDown`/`ArrowUp`/`Home`/`End` inside the open navigation dropdown), mutually exclusive when opening header dropdowns, display `:focus-visible` outlines (`2px solid #E07F24`) with `border: 0` at rest, and produce zero `@axe-core/playwright` violations.
- **FR-009**: Persistence layer MUST integrate PGlite and Drizzle ORM using local filesystem storage, enforcing race-safe cross-process ownership via `proper-lockfile` on per-directory canonical sentinels (`<parent(dir)>/<basename(dir)>.azusa-lock`), keeping `<sentinel>.lock` strictly empty (optional non-authoritative diagnostics in `<dir>.azusa-owner.json`), waiting `> 2000ms` (one heartbeat) across **every** lock holder (`server`, `db:migrate`, `db:backup`, `db:restore`) before opening PGlite or reading/copying/modifying the database folder, providing custom `onCompromised` handlers for server (close PGlite, `status: 'error'`, `503`) and CLI (abort, clean up `.tmp-*`/`.restore-tmp-*`, roll back active promotion if underway, exit `1`), and maintaining a once-per-process `globalThis.__azusaDbState` singleton.
- **FR-010**: Persistence layer MUST provide a reusable identity and audit convention—UUIDv4 primary keys (`crypto.randomUUID()`), UTC `created_at` and auto-updated `updated_at` (`$onUpdate`), and `created_by`/`updated_by` defaulting to `"local:sm"`—applied to `app_metadata`. Actor overrides MUST be restricted to internal service/CLI calls and never accepted from public HTTP request bodies.
- **FR-011**: Migration workflow MUST support a configurable `migrationsFolder`, initialize an empty local database, upgrade an existing database while preserving all existing records, and fail loudly with structured diagnostics (`status: "error"`, `stage: "migration"`) on invalid migrations.
- **FR-012**: On startup (when `PG_VERSION` and `.azusa-last-healthy.json` exist), the system MUST acquire the exclusive lock, wait `> 2000ms` to confirm lock integrity, recover any interrupted active promotion, atomically create at most one timestamped snapshot per process (`.tmp-<backupId>` → `<backupId>` with `manifest.json`) before opening PGlite or migrating, and defer pruning of completed `-startup` snapshots beyond 10 until **after** PGlite mounts and all migrations succeed. Startup backup failure MUST halt initialization before opening PGlite or migrating.
- **FR-013**: System MUST provide documented CLI commands (`db:migrate`, `db:backup`, `db:restore`). `db:migrate`, `db:backup`, and active-target `db:restore -- --force-overwrite-active` MUST acquire the exclusive lock on `AZUSA_DB_DIR` and wait `> 2000ms` (exiting `1` if locked or compromised). `db:backup` MUST verify copied files via size/SHA-256 without mutating the backup in place. `db:restore` MUST lock its own canonical target sentinel (allowing sibling restores while the server runs), refuse overlapping/active-without-flag/populated targets before any mutation, validate full `app_metadata` integrity in `.restore-tmp-<uuid>`, and on `--force-overwrite-active` execute a journaled replacement (`<activeDbDir>` → `db-replaced-<timestamp>`, `.restore-tmp-<uuid>` → `<activeDbDir>`, post-move verification, **preserving `db-replaced-<timestamp>` intact on disk** and deleting only `.azusa-promote-journal.json`, with automatic rollback on failure, lock loss, or interrupted startup).
- **FR-014**: Placeholder views MUST include a compact Foundation Status Card (backed by `GET /api/health` and `POST /api/health/check`) showing database, migration, and backup status, and the shell MUST render `<ErrorAlertBanner role="alert" />` whenever initialization, locking, migration, or backup fails (`status: "error"`).
- **FR-015**: Repository MUST include and maintain `README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md` (Data Model v0.6), `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/`, `docs/operations/`, and `docs/feature-roadmap.md` (v0.2).

### Measurable Success Criteria

- **SC-001**: A developer on a clean workstation can install dependencies, initialize the local database, and start Azusa with zero runtime network requests to external APIs or font CDNs.
- **SC-002**: 100% of records written to `app_metadata` before an application stop are retrievable with identical UUIDv4 IDs, payloads, UTC timestamps, and `"local:sm"` audit fields after restarting.
- **SC-003**: 100% of existing records in a populated test database remain intact after applying an incremental Drizzle migration.
- **SC-004**: Restoring a backup snapshot via `db:restore` recovers 100% of persisted records (every column and JSON field intact) into a safe staging target while leaving the active database directory byte-for-byte unchanged (SHA-256 verified).
- **SC-005**: All 9 primary navigation destinations, the expandable search control, and the profile dropdown (including its disabled `Settings` item) are keyboard-operable with visible focus indicators and zero `@axe-core/playwright` violations.
- **SC-006**: All 7 quality gate commands (`lint`, `format:check`, `typecheck`, `test:run`, `build`, `test:visual`, `test:e2e`) pass with exit code `0`.

---

## Edge Cases

- **Cold start with no existing database**: Acquires lock, waits `> 2000ms`, creates directory, skips startup backup (`lastBackupTrigger: 'skipped_cold_start'` when no completed backup exists), runs initial migrations, seeds `'foundation.init'`, and writes `.azusa-last-healthy.json`.
- **Concurrent lock contention, stale-lock takeover race & lost-lock handling (`CF4`)**: Per-directory canonical sentinels (`<parent(dir)>/<basename(dir)>.azusa-lock`) decouple sibling restores from the active DB lock; `<sentinel>.lock` stays strictly empty so `rmdir`/`rmdirSync` never fails with `ENOTEMPTY`; every lock holder waits `> 2000ms` (one heartbeat) after acquisition before touching database files; custom `onCompromised` handlers shut down PGlite with `503` (server) or clean up `.tmp-*`/`.restore-tmp-*`, roll back active promotion if underway, and exit `1` (CLI); malformed lock artifacts fail closed (`ELOCKED`).
- **Startup init/migration failure & backup non-eviction (`CF3`)**: On corrupted cluster or failed migration, `.azusa-last-healthy.json` is left absent, retention pruning is skipped, error state is cached for the process lifetime (preventing repeated page loads from creating/evicting backups), `/api/health` and `/api/health/check` return `503`, and `<ErrorAlertBanner role="alert" />` renders.
- **Startup backup failure**: Unwritable backup path cleans up `.tmp-*`, halts **before** opening PGlite or migrating, caches `status: "error"` (`stage: "backup"`), and surfaces the UI alert banner.
- **Restore path overlap, populated targets, Windows path normalization & preserved `db-replaced-<timestamp>` (`CF3`)**: Normalizes paths case-insensitively on Windows; refuses active DB without `--force-overwrite-active`, any parent/child overlap with active DB/source/backups root, or populated non-active targets; verifies full `app_metadata` integrity in `.restore-tmp-<uuid>` before moving; preserves `db-replaced-<timestamp>` intact on disk after successful forced overwrite and recovers interrupted promotions on startup without deleting `db-replaced-<timestamp>` when active DB is healthy.
- **Same-millisecond backup naming & incomplete `.tmp-*` exclusion**: Same-ms ties insert a zero-padded counter before the trigger suffix (`backup-<YYYYMMDD-HHmmss-fff>-01-startup`); only completed snapshots with `PG_VERSION` and valid `manifest.json` count toward `--from latest` and the 10-snapshot retention limit; `-manual` snapshots are never auto-pruned.
- **Next.js HMR in development**: Repeated server module reloads reuse `globalThis.__azusaDbState` so duplicate locks and duplicate startup backups never occur.
- **ISO-8601 week year boundaries & Sundays**: Late December / early January dates and Sundays (`d=7`) compute `CWww.d` strictly per ISO-8601.
- **Legacy/invalid IANA timezones (`CF1`)**: Legacy aliases normalize (`Asia/Calcutta` → `Asia/Kolkata`, `US/Central` → `America/Chicago`); fixed-offset lookup table resolves `PHT`/`IST`/`JST`/`SGT`/`UTC`; all other valid zones use `UTC±offset` (never `GMT`); invalid/missing IDs compute **both** clock time and badge label in `UTC`.
- **Header overlay mutual exclusion & narrow viewports (`1024px`, `768px`)**: Opening the logo menu closes the profile dropdown and vice versa; `Escape` closes the active overlay and restores focus; expanding search (`280px`) below `1100px` sets `visibility: hidden` on `TodayWidget` (zero layout shift) and restores `visibility: visible` on collapse.

---

## Data Considerations

### 1. Implemented F001 Persistence Schema (Infrastructure-Owned Only)

F001 creates **only** the infrastructure-owned `app_metadata` table (plus reusable `auditColumns()` helper) in local PGlite storage (`AZUSA_DB_DIR`, defaulting to gitignored `.azusa/data/db`, coordinated via `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock`). Zero business-domain tables are created in F001.

- **`app_metadata`**:
  - `id`: UUIDv4 primary key (`crypto.randomUUID()`)
  - `key`: unique text (`'foundation.init'`, `'diagnostic.last_check'`)
  - `value`: JSONB payload validated by Zod
  - `created_at` / `updated_at`: UTC timestamps (`updated_at` auto-refreshed on write)
  - `created_by` / `updated_by`: text actor identifiers defaulting to `"local:sm"` (internal-only override; never accepted from public HTTP bodies)

### 2. Conceptual Domain Model & Constitution Principle III (`docs/architecture/domain-model.md`)

F001 documents the complete conceptual domain model aligned with **Data Model v0.6** (`docs/azusa-data-model.md` in `azusa-handoff-v2.zip`) and **Roadmap v0.2** (`M0`–`M4`, `F001`–`F019`) without prematurely creating physical domain tables:

- **Distinct Versioning, Commitment & Execution History (Principle III)**: Keeps `PlanVersion` (`F012`), `PICommitment` (`Start PI` `F012`), `SprintCommitment` (`Start Sprint` `F013`), `SprintClosure`/`Actuals` (`Close Sprint` `F015`), and `StateChange` (`F014`) strictly separate; preserves commitment history through replanning; keeps scheduled Sprint dates, SM-selected effective lifecycle dates, and action timestamps (`recorded_at`) distinct.
- **Data Model v0.6 Core Rules**: 8.0-hour workday with no separate focus factor (`F004`); `Team` `planning_style` (`owner` | `distributed`) snapshotted per Sprint (`F013`); dated `SprintCeremony`, `Meeting`, `Milestone` (team-level now, train-level reserved for `F019`), and `Absence` with planned overtime (`F005`); `OverheadReserve` + `OverheadTicket` (hours, never SP) distinct from `Buffer` + `BufferDraw` (SP placeholders outside commitment) (`F009`, `F013`, `F014`); `Story` (full vs light layout derived from category) distinct from `Bug` (severity S1–S4, environment/version/device-OS, ordered `ReproStep`, expected/actual, Bug workflow) with universal `Tag`, three-state `AC`/`DoR`/`DoD` `ChecklistItem` + per-kind `ChecklistTemplate`, `Removed` terminal state with reason (excluded from velocity/say-do), and backlog rank as priority (no priority field) (`F007`, `F008`).
