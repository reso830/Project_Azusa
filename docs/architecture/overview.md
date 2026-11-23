# Architecture overview

F001 / 0.1.0 is one local Next.js 15 App Router application, React 19 presentation, strict TypeScript, and embedded PGlite with Drizzle. It serves on `127.0.0.1`, without a hosted backend, runtime font service, or authentication layer. [ADR 0001](decisions/0001-local-first-nextjs-pglite-foundation.md) records the tradeoffs.

## Components and flow

`src/app/` adapts routes/HTTP to `src/application/health/health-service.ts`. Services validate contracts and call persistence; UI presents the health model. Calendar functions remain independently testable. Database files/PGlite instances stay server-side. See the [repository map](../REPO_MAP.md) and [API contract](../../specs/001-application-foundations/contracts/api.md).

All nine pages load initial health server-side. The Foundation Status Card shows database, applied migrations, backup summary, and latest diagnostic. `POST /api/health/check` validates a strict body, upserts `diagnostic.last_check`, increments its count in SQL, and returns 201. Unknown body fields, including actor, are rejected. Reload reads the persisted record. Structured failures carry stage/message/recovery hint and use non-success HTTP status with `Cache-Control: no-store`; pages show an alert. Cached initialization/lock-loss errors take precedence over a later closed-client query failure.

The shell provides local fonts, 42 icons, nine placeholders, disclosure navigation, mutually exclusive navigation/profile overlays, and disabled Settings. Search supplies only expand/focus/collapse interaction. The Today widget sits in normal flow on the right immediately before Search, with both rows right-aligned per the v2 prototype. After mount, the browser's IANA zone drives date, ISO week, and clock together; invalid zones fall back entirely to UTC. This shell does not implement future planning functionality.

## Exclusive ownership

`getDbContext()` caches an initialization promise or failure in `globalThis.__azusaDbState` per process. `closeDbContext()` closes PGlite, releases ownership, and clears state. A cached startup failure needs a process restart after correction.

All holders first resolve filesystem aliases through the nearest existing ancestor, including when the database directory does not yet exist. Locking and backup/restore share `canonicalDbPath()` from `lock.ts`, so a symlink/junction and its real database use the same sentinel and owner file. All holders use `proper-lockfile`: `realpath: false`, `retries: 0`, **10-second stale threshold**, **2-second heartbeat**. For directory `dir`, the sentinel is `<parent(dir)>/<basename(dir)>.azusa-lock`; the library creates the empty sibling `<sentinel>.lock/` directory. Optional diagnostics live in `<dir>.azusa-owner.json`, never inside the lock folder. Every successful holder waits **2100 ms (> 2000 ms)** before opening, copying, or modifying database contents so an initial heartbeat failure can surface.

Server compromise caches an `init` error, closes its client, and makes health endpoints return 503. CLI operations check compromise across copying/validation/promotion, abort, clean staging, roll back moved active data when needed, report stderr failure, and exit 1. `db:migrate` uses the CLI role/handler through the shared context. Sibling restore locks its target instead of the active directory. Production contention remains fail-fast; only browser bootstrap retries `ELOCKED` for up to 15 seconds after a force-killed test server.

## Startup state machine

Initialization runs on the first database-backed request or explicitly through `db:migrate`.

| Step                              | Successful transition                                                                                                                                    | Failure                                                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Acquire ownership and wait        | Hold the lock throughout startup and server database use                                                                                                 | Contention/compromise reports `init`; no concurrent access                                                                    |
| Inspect version/recover promotion | Inspect `PG_VERSION` and parent `.azusa-promote-journal.json`; retain a healthy promotion or recover its valid preserved predecessor                     | Stop instead of silently reinitializing. Corrupt version detection reports `init`; recovery failures normally report `backup` |
| Snapshot decision                 | No `PG_VERSION`: `skipped_cold_start`. Existing cluster without marker: `skipped_unverified`. Existing marked cluster: copy/hash/verify/publish snapshot | Report `backup` before mounting PGlite; clean incomplete staging                                                              |
| Mount PGlite                      | Open selected cluster                                                                                                                                    | Report `init`                                                                                                                 |
| Migrate/seed                      | Remove healthy marker; apply explicit SQL; insert `foundation.init` only if absent; write healthy marker                                                 | Report `migration`; retain prior backups                                                                                      |
| Deferred prune                    | After successful migration/seed, retain newest ten startup snapshots; skip pruning for `skipped_unverified`                                              | Report `backup`; manual snapshots are never selected by startup retention                                                     |

`skipped_unverified` permits retrying an initial cluster whose migration failed without claiming it is a verified backup source. The healthy marker records migration/seed success and does not replace restore integrity checks. The low-level migration runner makes no backup decision; its caller must arrange ownership/recovery/backup first.

## Backup and restore

Snapshots copy the closed active filesystem, compare SHA-256 lists, write a manifest, and publish by rename. Manual backup acquires active ownership without opening PGlite or mutating its source. Startup backup precedes PGlite mounting and pending migrations. Retention follows successful initialization.

Restore validates the source manifest/hashes, copies to `.restore-tmp-<uuid>`, verifies the copy, opens only staging to validate metadata, and closes it before promotion. Sibling targets must be absent/empty and disjoint from source/backups/active paths. Active replacement requires `--force-overwrite-active`: journal the operation, preserve the old cluster at `db-replaced-<timestamp>-<uuid>`, move staging into place, verify again, then remove the journal. Errors roll the old cluster back; startup recovers interrupted journaled promotion. Successful replacement preserves its predecessor for inspection/manual cleanup.

On Windows, directory renames retry transient `EPERM`, `EACCES`, or `EBUSY` up to five attempts with 1.5 seconds total retry delay. Forward operations retain lock checks. Persistent errors propagate. Snapshot publication, restore, recovery, and rollback use this helper.

## Physical and verification scope

F001 creates only `app_metadata` as an application table, plus Drizzle migration bookkeeping. The [data dictionary](data-dictionary.md) describes physical structures; the [domain blueprint](domain-model.md) describes future concepts without authorizing new tables/screens.

Vitest covers rules, contracts, durability/upgrades, lock failures, backup/restore, and documentation. Playwright isolates port/output/storage for fidelity, E2E/keyboard, and Axe checks. Conformance review and operator UAT remain required for feature acceptance. See the [runbook](../operations/database-and-recovery.md) for commands, troubleshooting, storage, and cleanup.
