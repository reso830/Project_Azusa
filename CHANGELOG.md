# Changelog

Application release history is independent of Azusa's internal PI Plan Versioning. This entry uses F001's planned version date; operator UAT completion was confirmed on 2026-11-23 and is recorded in the F001 Phase 08 task notes.

## [0.1.0] - 2026-11-20

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
