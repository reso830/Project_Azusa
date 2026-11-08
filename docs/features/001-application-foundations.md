# Azusa — Feature Brief 001: Application Foundation

**Milestone:** M0 — Foundations  
**Feature ID:** F001  
**Status:** Draft for specification  
**Date:** November 8, 2026

**References:** Azusa Constitution v0.1.0 (draft), Revised Design Handoff, Data Model v0.4.

## 1. Objective

Establish a reliable, locally running Azusa application with the approved visual shell, persistence infrastructure, development quality gates, and living repository documentation.

Subsequent features must be able to introduce domain entities and functionality without rebuilding these foundations.

**User outcome:** As the developer/operator, I can clone the repository, follow the README, start Azusa locally, see its recognizable application shell, confirm that data persists, and recover local data from a tested backup.

**Relationship to core requirements:** F001 enables all eight core wants identified in the handoff but does not directly implement planning, execution, capacity management, or analytics.

## 2. Functional Scope

### 2.1 Application Foundation

- Initialize a single Next.js application using strict TypeScript.
- Establish maintainable boundaries between presentation, application/domain logic, and persistence.
- Configure Zod validation conventions, linting, formatting, Vitest, and Playwright.
- Establish reproducible local development, build, and testing workflows.
- Run without hosted services, paid APIs, or cloud dependencies at runtime.
- Avoid speculative modules for features that have not yet been implemented.

### 2.2 Local Persistence and Data Safety

- Integrate PGlite with Drizzle ORM using persistent local filesystem storage.
- Establish database initialization and migration conventions.
- Verify that persisted records survive application restarts.
- Define consistent record identity and audit-field conventions, including `created_at`, `updated_at`, `created_by`, and `updated_by` where applicable.
- Use a documented local actor convention until authentication becomes necessary.
- Provide automatic local backup-on-start and a tested developer-facing restore procedure.
- Surface initialization, migration, and backup failures rather than silently ignoring them.

Database validation should use minimal infrastructure-owned test records. Actual ART, Team, Story, and related domain tables belong to later features.

### 2.3 Application Shell and Design System

Implement the common application shell using the supplied Azusa design assets.

**Design foundations:**

- Warm off-white background, white surfaces, black ink, and orange accents.
- Zen Kaku Gothic New, IBM Plex Sans, and IBM Plex Mono, bundled locally.
- Reusable design tokens and Kumiko icon components.
- Supplied Azusa logo and asanoha motif.
- Flat surfaces and restrained visual decoration consistent with the approved prototype.

**Application shell:**

- Floating header without a conventional sidebar or top bar.
- Left: logo button opening the navigation dropdown.
- Center: today widget with date, calendar week, and local clock.
- Right: expandable search control and profile placeholder.
- Page title region reserved for page-specific controls.

The navigation includes Plan, Capacity, Sprint, Insights, and Settings. Unimplemented destinations must be clearly identified as unavailable or placeholders.

Until ART and calendar configuration is implemented, the today widget must not invent an active PI or Sprint.

Search functionality is limited to the shell interaction; actual indexing and search results are excluded.

Support keyboard-accessible navigation, visible focus states, accessible labels, and reasonable layout behavior on narrower screens.

### 2.4 Repository Documentation

Establish the documentation conventions required by the constitution.

| Artifact | Required content |
|---|---|
| `README.md` | Project overview, prerequisites, setup, run/test commands, and documentation navigation |
| `docs/REPO_MAP.md` | Major modules, directories, entry points, and responsibilities |
| `CHANGELOG.md` | Initial project version history |
| `docs/architecture/overview.md` | Architecture, components, boundaries, persistence, and data flow |
| `docs/architecture/domain-model.md` | Initial conceptual domain model based on approved Azusa requirements |
| `docs/architecture/data-dictionary.md` | Actual implemented fields and persistence structures |
| `docs/architecture/decisions/` | Significant architectural decisions and rationale |
| `docs/operations/` | Local database, migration, backup, and recovery procedures |

Documentation must reflect implemented behavior and remain version-controlled.

The repository map is an architectural navigation guide, not an exhaustive list of files.

## 3. Acceptance Criteria

**AC01 — Local startup**

Given a fresh development environment with the documented prerequisites, the operator can install dependencies and start Azusa without hosted infrastructure or API credentials.

**AC02 — Application shell**

The application displays the approved Azusa visual language, logo, typography, Kumiko icons, floating header, and navigation. Future functionality is not presented as operational.

**AC03 — Date and time**

The today widget displays the correct viewer-local date, ISO calendar week, and time. Unconfigured PI/Sprint values are represented accurately.

**AC04 — Persistent storage**

A record written to the local database remains available after stopping and restarting the application.

**AC05 — Database migration**

The migration workflow initializes a new database and upgrades an existing test database without losing existing records. Failures are reported clearly.

**AC06 — Backup and recovery**

Azusa can produce a usable local backup containing persisted data. A documented restore procedure can recover that data into a safe target without silently replacing the active database.

**AC07 — Automated verification**

Linting, TypeScript checks, unit tests, application build, and Playwright smoke tests execute through documented commands. Persistence and backup/recovery behavior have automated verification.

**AC08 — Accessibility**

Primary shell interactions are keyboard-operable, have visible focus states, and expose appropriate accessible labels.

**AC09 — Documentation completeness**

Required foundation documentation exists, accurately describes the delivered implementation, and is navigable from the README.

## 4. Out of Scope

- ART, Team, Member, PI, Sprint, and holiday configuration.
- Projects, Features, Stories, Bugs, and Tasks.
- Capacity and normalized velocity calculations.
- PI boards, ART boards, dependency management, and Kanban execution.
- Plan versioning, PI/Sprint Commitments, and Actuals implementation.
- Authentication, RBAC, and multi-user collaboration.
- Functional search, dashboards, metrics, and reporting.
- Settings-based backup/export/import UI.
- Pixel-perfect implementation of future prototype screens.

The conceptual domain model should acknowledge future functionality without implementing its database structures prematurely.

## 5. Implementation Guidance

These are considerations for the Specify and Plan stages, not prescribed implementation tasks.

- Validate PGlite's local persistence behavior early, especially database initialization and Next.js development restarts.
- Keep database migrations and backups recoverable and independently testable.
- Prefer simple, reusable UI primitives over a speculative component framework.
- Maintain the distinction between domain concepts such as Plan Versions, Commitments, and Actuals in the architecture documentation.
- Use the supplied design assets and prototype as design references rather than porting Claude's `.dc.html` runtime.
- Keep documentation updates within the same implementation changeset.

## 6. Feature Exit Criteria

F001 is complete when Azusa is:

- Locally runnable.
- Visually identifiable.
- Durably persisted and recoverable.
- Covered by foundational quality checks.
- Documented sufficiently for both human and AI-assisted development.

**Next dependency:** F002 can introduce ART and calendar configuration without replacing the application shell or persistence foundation.