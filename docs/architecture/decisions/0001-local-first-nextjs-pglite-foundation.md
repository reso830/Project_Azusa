# ADR 0001: Local-first Next.js and PGlite foundation

**Date:** 2026-11-21  
**Status:** Adopted for F001 under the approved specification; feature acceptance remains subject to Phase 08 conformance review/operator UAT.

## Context

Azusa is a personal, local Agile/SAFe learning project. The handoff specifies TypeScript, Next.js, PGlite/Drizzle, and local operation. The first feature must establish durable infrastructure and a faithful shell without prematurely implementing business tables, hosted services, authentication, or planning screens. Later features need explicit migrations, testable domain rules, and recoverable data ownership.

## Decision

Use a loopback-only Next.js 15 App Router runtime and React presentation, with pure domain contracts/calculations, application use cases, and server-side persistence. Bundle fonts locally and disable telemetry. Use persistent embedded PGlite through Drizzle, explicit reviewed SQL migrations and generation snapshots, UUIDv4/UTC audit conventions, and only infrastructure `app_metadata` in F001.

Protect each database directory with established `proper-lockfile` sentinels, a 2100 ms heartbeat grace wait, and explicit server/CLI compromise handling. Snapshot verified existing clusters before migrations; defer ten-startup-snapshot pruning until migration/seed succeeds. Restore through verified staging; active replacement requires explicit force, a recovery journal, and a preserved predecessor. See [architecture](../overview.md) and the [runbook](../../operations/database-and-recovery.md).

Keep full PI planning versions, official lifecycle commitments, Actuals, and state history conceptually distinct without building their tables now. The [domain blueprint](../domain-model.md) records settled rules for their owning features.

## Alternatives considered

- A separate local PostgreSQL service preserves PostgreSQL semantics but adds installation, service configuration, and operator management beyond this foundation's embedded direction.
- SQLite could offer a smaller storage baseline, but differs from the approved PGlite/PostgreSQL/Drizzle direction. A future engine change requires a scoped decision and migration/recovery assessment.
- Hosted database/backend services conflict with zero-cloud local operation. Custom lock infrastructure duplicates mature filesystem-locking behavior and adds correctness risk.
- Immediate post-copy pruning could evict recovery points before a migration succeeds. Direct active-directory overwrite without staging/journaling/predecessor preservation is not recoverable enough.

## Consequences

One local installation needs no database service or cloud credentials. Domain tests stay independent of the UI; explicit migrations and boundary validation support later features. PGlite remains a single-owner embedded cluster; active database CLI operations require a stopped server, while sibling restore can run independently.

The baseline cluster measured roughly 40 MB per snapshot during F001 verification, or about 400 MB for ten startup snapshots, before growth/manual backups/preserved predecessors. This is a disk-storage tradeoff, not a RAM measurement. Database initialization and full-cluster hashing make integration/browser tests costlier than pure unit tests; reuse fixtures, isolate storage, and run focused checks before final gates. Do not weaken durability or coverage silently to reduce that cost.

Windows filesystem sharing errors require bounded rename retries; force-killed browser servers require test-only stale-lock retry. Neither permits bypassing ownership or ignoring persistent errors. Backup storage and operator cleanup remain explicit operational responsibilities. Reassess proportionality through an approved future scope if storage/testing cost becomes unsuitable.
