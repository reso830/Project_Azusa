# Azusa

Azusa is a personal, local-first learning project for Team- and ART-level Agile/SAFe planning, execution, and reporting. Version **0.1.0** provides Next.js 15, React 19, strict TypeScript, embedded PGlite/PostgreSQL with Drizzle, local fonts, and the Azusa shell. No cloud services, credentials, paid APIs, or external runtime fonts are required.

The nine destinations currently show honest feature placeholders and database diagnostics. Organization, capacity/calendar, work items, planning/execution, and reporting belong to F002–F019. Search only expands/focuses/collapses; Settings is a disabled profile-menu item. The operator personally completed the Phase 08 tests and confirmed completion on 2026-11-23; the acceptance and review follow-up are recorded in the F001 task notes.

## Install and run

Use Node.js **22.12+ within 22.x, 24.x, or 26+**, and npm **10+**. The exact Node engine range in `package.json` is `^22.12.0 || ^24.0.0 || >=26.0.0`. Run from the repository root:

```powershell
npm install
npx playwright install chromium
npm run db:migrate
npm run dev
```

Open [Azusa locally](http://127.0.0.1:3000). Both `dev` and production `start` bind to `127.0.0.1`. No separate database service is needed. Stop the server with Ctrl+C before a production build or a CLI command requiring the active database lock.

## Configuration

No environment file is required. Set optional variables in the launching shell; relative paths resolve from the working directory, normally the repository root.

| Variable                  | Default               | Purpose                                                           |
| ------------------------- | --------------------- | ----------------------------------------------------------------- |
| `AZUSA_DB_DIR`            | `.azusa/data/db`      | Active PGlite directory                                           |
| `AZUSA_BACKUP_DIR`        | `.azusa/data/backups` | Startup and manual snapshots; keep disjoint from the database     |
| `AZUSA_ACTOR_ID`          | `local:sm`            | Internal audit actor, not authentication or an HTTP request field |
| `AZUSA_NEXT_DIST_DIR`     | `.next`               | Next.js output; browser tests use `.next-playwright`              |
| `NEXT_TELEMETRY_DISABLED` | `1`                   | Disable Next.js telemetry; also configured by the project         |

For an isolated development experiment, set both database and backup paths:

```powershell
$env:AZUSA_DB_DIR = '.azusa/sandbox/db'
$env:AZUSA_BACKUP_DIR = '.azusa/sandbox/backups'
npm run dev
```

## Database commands

Stop the server before `npm run db:migrate` or `npm run db:backup`. Verified existing clusters are backed up before startup migrations. Retention prunes to ten startup snapshots after successful verified startup; manual backups and replaced active directories require separate operator cleanup.

```powershell
# Stop the server first (Ctrl+C).
npm run db:backup

# New sibling target; also safe while the server runs.
npm run db:restore -- --from latest

# Explicit sibling target must be absent or empty.
npm run db:restore -- --from latest --to .azusa/data/verify-restore

# Server stopped: replace <backup-id> with the selected, verified recovery snapshot ID.
npm run db:restore -- --from <backup-id> --to .azusa/data/db --force-overwrite-active
```

For active recovery, select a known-good backup ID deliberately: the newest startup snapshot may contain the problem state you are replacing. The final command preserves the predecessor as `db-replaced-<timestamp>-<uuid>`. If using `AZUSA_DB_DIR`, substitute that configured active path for `.azusa/data/db`. Sibling restore locks its target and leaves the active cluster untouched. Read the [recovery runbook](docs/operations/database-and-recovery.md) before active replacement or manual cleanup.

## Quality gates

Run from the repository root, sequentially. Stop the default development server before `build`; development and production builds must not share a live output directory.

```powershell
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run build
npm run test:visual
npm run test:e2e
```

Vitest uses temporary database/backup defaults and reusable fixtures. Playwright starts its own server on `127.0.0.1:3100`, uses `.next-playwright` and `.azusa/test-playwright/`, and resets only that test storage. It does not reuse the development server. Run browser suites sequentially; bootstrap tolerates a previous force-killed test server's stale lock for up to 15 seconds. Visual tests check shell fidelity; E2E tests cover keyboard interaction, local time, persistence, errors, sibling restore, external-request isolation, and Axe accessibility. Documentation tests check files, README links, release metadata, and roadmap coverage without opening a database.

For a production-mode local run, use `npm run build` followed by `npm run start` with the development server stopped.

## Documentation

Start with the repository map to find relevant modules before making changes.

| Document                                                                             | Responsibility                                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| [Repository map](docs/REPO_MAP.md)                                                   | Entry points, boundaries, focused change paths                     |
| [Changelog](CHANGELOG.md)                                                            | Application history, separate from PI Plan Versions                |
| [Architecture overview](docs/architecture/overview.md)                               | Runtime, startup state machine, data flow                          |
| [Conceptual domain model](docs/architecture/domain-model.md)                         | Data Model v0.6 blueprint; future business capabilities            |
| [Physical data dictionary](docs/architecture/data-dictionary.md)                     | Implemented F001 fields, files, constraints                        |
| [ADR 0001](docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md) | Foundation decision, alternatives, consequences                    |
| [Database and recovery](docs/operations/database-and-recovery.md)                    | Initialization, migration, backup, restore, cleanup                |
| [Feature roadmap](docs/feature-roadmap.md)                                           | Roadmap v0.2, M0–M4 and F001–F019; acceptance checklist            |
| [F001 feature brief](docs/features/001-application-foundations.md)                   | Foundation scope and acceptance criteria                           |
| [Design handoff v2](docs/handoffs/azusa-handoff-v2.zip)                              | Current prototype, icons, Data Model v0.6, cross-feature decisions |
| [Design handoff v1](docs/handoffs/azusa-handoff-v1.zip)                              | Historical reference, superseded by v2 where they differ           |
| [F001 specification](specs/001-application-foundations/spec.md)                      | Functionality and operator clarifications                          |
| [Implementation plan](specs/001-application-foundations/plan.md)                     | Technical design                                                   |
| [Tasks and verification](specs/001-application-foundations/tasks.md)                 | Phase scope and recorded checks                                    |
| [Quickstart](specs/001-application-foundations/quickstart.md)                        | Setup and acceptance walkthrough                                   |
| [API contract](specs/001-application-foundations/contracts/api.md)                   | Health, diagnostic, CLI contracts                                  |
| [Project constitution](.specify/memory/constitution.md)                              | Governing principles and acceptance rules                          |

## Development workflow

Work follows **Milestone → Feature** and **Feature Brief → Specification → Implementation Plan → Tasks → Implementation → Verification/UAT**. [Spec Kit templates](.specify/templates/) and [agent prompts](scripts/prompts/) support the workflow. The operator retains final authority over scope, requirements, design, and acceptance.

| Role                   | Responsibility                                    |
| ---------------------- | ------------------------------------------------- |
| ChatGPT                | Feature Brief preparation                         |
| Agy                    | Specification, plan, task decomposition           |
| Claude                 | Architecture, design guidance, conformance review |
| Codex                  | Developer review and implementation               |
| Claude Code + operator | UAT and acceptance                                |
