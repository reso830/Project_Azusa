# Changelog

Application release history is independent of Azusa's internal PI Plan Versioning.

## [0.4.0] - 2026-11-27

The operator accepted F004 on 2026-11-27 at PR #7 head `79d9472`. See the [Phase 07 verification record](specs/004-capacity-engine-planner/tasks.md).

### Added

- F004 Capacity Planner at `/capacity` shows Team and Sprint development capacity, forecast SP, category budgets, and per-Member calculation breakdowns. It supports bulk and individual overhead edits, workday settings, and Team and Team/PI velocity inputs.
- A shared capacity engine calculates development days from dated assignments, holidays, absences, overhead deductions, and FTE. Team-scoped overhead deductions persist as fixed hours in 0.25-hour increments.

### Changed

- Only Members with the `Team member` role contribute to development capacity. `Admin` and `RTE` now also show the **Excluded from dev capacity** badge on `/organization`.
- `teams.hours_per_day` now accepts 1.0–24.0 hours in 0.5-hour increments. Migration `0003_capacity_engine_planner.sql` rounds legacy values to the nearest supported half-hour and clamps values below 1.0.

## [0.3.0] - 2026-11-25

F003 operator UAT acceptance was confirmed on 2026-11-25 and recorded in the F003 Phase 07 task notes.

### Added

- **Categories & Allocation** under Organization. Manage ART development and overhead categories, reorder them by kind, and apply an optional sample catalog.
- Edit ART default percentages and Team/PI overrides with live totals, explicit inheritance and zero-percent states, and drift warnings for current and future PIs.
- Additive migration `0002_work_categories_allocation.sql` and CLI backup and restore coverage for categories and overrides.

### Changed

- ART, Team, and PI deletion conflicts explain when categories or allocations prevent deletion.

## [0.2.0] - 2026-11-24

F002 operator UAT acceptance was confirmed on 2026-11-24 and recorded in the F002 Phase 08 task notes.

### Added

- Organization workspace and local APIs for ARTs, Teams, Members, PIs, Iterations, and Locations, with read-only holiday inspection.
- Dated Team membership with future moves, same-day corrections, and pending-move cancellation.
- Team and PI header selection and Today widget Sprint resolution using Team workday offsets.
- Migration `0001_organization_cadence.sql` and idempotent offline Location, holiday, and Absence Type seeding.

### Changed

- Synchronized migration and restore marker versions with application release metadata. Existing foundation initialization records are preserved.

## [0.1.0] - 2026-11-20

F001 operator UAT completion was confirmed on 2026-11-23 and recorded in the F001 Phase 08 task notes.

### Added

- Local Next.js 15 / React 19 runtime with strict TypeScript, loopback serving on `127.0.0.1`, local fonts, disabled telemetry, and no cloud runtime dependency.
- Embedded PGlite and Drizzle ORM, explicit SQL migrations with generation metadata, UUIDv4/UTC/audit columns, and infrastructure-only `app_metadata` using the `local:sm` actor convention.
- Cross-process `proper-lockfile` ownership and heartbeat grace waits, structured health/diagnostic APIs, restart durability, and visible error diagnostics.
- SHA-256-verified pre-migration startup snapshots with deferred ten-snapshot retention; manual CLI backup; staged sibling restore; journaled active promotion with rollback and preserved `db-replaced-<timestamp>-<uuid>` directories.
- Handoff v2 design tokens, local `@fontsource` typography, all 42 Kumiko icons, nine route placeholders, viewer-local date/week/time, search interaction, and profile dropdown.
- Unit/integration, visual, E2E, accessibility, lint, formatting, typecheck, build, and documentation gates.
- Repository map, architecture, Data Model v0.6 conceptual blueprint, physical data dictionary, ADR, and recovery runbook aligned with Roadmap v0.2.

### Scope

Business-domain tables, operational planning screens, authentication/RBAC, and search results remain owned by later features. Navigation placeholders do not imply delivered business functionality.
