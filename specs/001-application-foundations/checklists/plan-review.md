# Pre-Implementation Plan Review Checklist: Application Foundation (F001)

**Gate result**: PASS — CHK001–CHK017 verified. Review date: 2026-11-08. G1 (post-acquisition heartbeat wait across all lock holders) and G2 (lost-lock test suite in T016) verified; all criteria satisfied.

**Purpose**: Pre-implementation review gate verifying spec/plan scope alignment, architecture soundness, data-model integrity, contract completeness, test strategy, and constitution compliance before any code is written.  
**Created**: 2026-11-08  
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [research.md](../research.md) · [data-model.md](../data-model.md) · [contracts/api.md](../contracts/api.md) · [quickstart.md](../quickstart.md) · [tasks.md](../tasks.md)

---

## 1. Spec & Plan Scope Alignment

- [x] CHK001 Every in-scope item and acceptance criterion (`AC01`–`AC09`, `FR-001`–`FR-015`, `SC-001`–`SC-006`) in `spec.md` is mapped to concrete components, files, and self-contained phase validation steps in `plan.md` and `tasks.md`, with `docs/feature-roadmap.md` completion gated on quality gates, conformance review, and operator UAT (`T040`).
- [x] CHK002 Every non-goal in `spec.md` (`F002` ART/calendar, `F003` people/availability, `F004` categories/overhead, `M1` `F005`–`F007` work items/capacity/sprint allocation, `M2`–`M4` `F008`–`F017` boards/dependencies/versioning/commitments/workflows, `M5` `F018`–`F021` metrics/reporting/dashboards, Better Auth/RBAC, Settings backup UI, search indexing) is aligned with `docs/feature-roadmap.md` and explicitly excluded from `plan.md`'s `Affected Areas`.
- [x] CHK003 All operator clarifications from `spec.md` (`Session 2026-11-08`, including `Q1`–`Q5` and `OD1`–`OD4`) and the technical planning decisions (`PC1` flat routes, `PC2` Tailwind + CSS variables, `PC3` `/api/health` + `/api/health/check` endpoints, race-safe `proper-lockfile` locking, disclosure `<nav>` semantics, fixed-offset timezone lookup table + `UTC±offset` fallback with invalid-ID `'UTC'` fallback, and single-row header with `visibility: hidden` on `TodayWidget` when expanded search would overlap below `1100px`) are consistently reflected across `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, `quickstart.md`, and `tasks.md`.

## 2. Prototype Fidelity & UX Compliance (Constitution Principles II & VII)

- [x] CHK004 `plan.md` declares `Visual-Fidelity Mode: Mixed` and references `docs/handoffs/azusa-handoff-v1.zip` (`prototype/Main.dc.html`, `prototype/Settings.dc.html`, `prototype/Icons.dc.html`, `icons/icons.json`, `assets/azusa-logo.png`).
- [x] CHK005 Every planned deviation from the prototype (`D1` Kumiko icons + `delivery-flow` seam fix, `D2` local `@fontsource` fonts, `D3` Today widget `"No active PI · No active Sprint"` + single viewer-local clock with fixed-offset lookup table & `UTC±offset` fallback, `D4` standardized title row + placeholder views + roadmap badges + Foundation Status Card, `D5` disclosure `<nav>` semantics + `:focus-visible` outlines + single-row header hiding `TodayWidget` via `visibility: hidden` when expanded search would overlap below `1100px` + error alert banner) is documented with a specific justification and recorded operator acceptance.
- [x] CHK006 All 7 navigation destinations (`/`, `/program-board`, `/pi-brief`, `/capacity`, `/iteration`, `/dashboard`, `/settings`), their menu groups (`Plan`, `Capacity`, `Sprint`, `Insights`, divider + `Settings`), Kumiko icon mappings, roadmap milestone badges (`docs/feature-roadmap.md`), Today widget visibility rules (hidden on `/settings`), and route-specific search placeholders (`"Search settings…"` on `/settings`) are specified without ambiguity in `contracts/api.md` and `plan.md`.
- [x] CHK007 Keyboard operability (`Tab`, `Shift+Tab`, `Enter`/`Space`, `ArrowDown`/`ArrowUp`/`Home`/`End`, `Escape`), ARIA roles/attributes (`<nav aria-label="Primary navigation">`, `aria-expanded`, `aria-controls`, `aria-current="page"`, `role="timer"`, `role="alert"`), `@axe-core/playwright` zero-violation checks (`SC-005`), and responsive non-overlapping viewport checkpoints (`1440px`, `1024px`, `768px`) are planned in `plan.md` and covered by verification suites (`T027`, `T028`).

## 3. Architecture & Layer Boundaries (Constitution Principle IV)

- [x] CHK008 Module boundaries in `plan.md` strictly separate presentation (`src/app/`, `src/ui/`), domain/application logic (`src/domain/`, `src/application/`), and persistence/infrastructure (`src/persistence/`, `scripts/db/`), keeping `src/domain/` free of I/O and framework imports.
- [x] CHK009 Every external dependency in `plan.md` is open-source, actively maintained, explicitly justified, and operates 100% locally on `127.0.0.1` (`NEXT_TELEMETRY_DISABLED=1`) without hosted services, external font CDNs, or paid APIs.
- [x] CHK010 Next.js PGlite integration risks (WASM bundling via `serverExternalPackages: ['@electric-sql/pglite']`, race-safe cross-process ownership via `proper-lockfile` targeting canonical per-directory `<parent(dir)>/<basename(dir)>.azusa-lock` sentinels with strictly empty `.lock` directory per `L1`, custom `onCompromised` handler closing PGlite and serving 503 per `L2`, post-acquisition grace re-check per `L2`, and once-per-process `globalThis.__azusaDbState` caching) are addressed in `research.md`, `data-model.md`, and `plan.md`.

## 4. Data Model, Persistence & Recovery Safety (Constitution Principles III & IV)

- [x] CHK011 Physical persistence in `data-model.md` is restricted to the infrastructure-owned `app_metadata` table and reusable `auditColumns()` helper (`id` UUIDv4 via `crypto.randomUUID()`, UTC `created_at` and `$onUpdate` `updated_at`, and `created_by`/`updated_by` defaulting to `"local:sm"` with internal-only actor overrides), introducing no speculative domain tables.
- [x] CHK012 `data-model.md` and `plan.md` specify that `docs/architecture/domain-model.md` codifies the Constitution Principle III and Data Model v0.4 rules: keeping `PlanVersion` (`F010`), `PICommitment` (`Start PI` `F013`), `SprintCommitment` (`Start Sprint` `F015`), `SprintClosure`/`Actuals` (`Close Sprint` `F017`), and `StateChange` (`F014`) distinct, and preserving the 3 Sprint lifecycle date concepts (scheduled, effective, and `recorded_at`).
- [x] CHK013 Pre-migration automatic startup backup mechanics (acquiring the `proper-lockfile` lock on `<parent(AZUSA_DB_DIR)>/<basename(AZUSA_DB_DIR)>.azusa-lock` with empty `.lock` directory per `L1`, recovering any interrupted promotion via `.azusa-promote-journal.json`, atomically snapshotting verified `AZUSA_DB_DIR` clusters via `.tmp-<backupId>` → `<backupId>` at most once per process before opening/migrating, skipping cleanly on cold start or unverified `.azusa-last-healthy.json`, and deferring pruning of completed `-startup` snapshots beyond 10 until after mount and migrations succeed) and safe CLI restore rules (decoupled sibling restore sentinels per `L3`, disjoint source/backup/active/target paths, Windows case-insensitive path normalization, populated target refusal, staged verification in `.restore-tmp-<uuid>`, recoverable `db-replaced-<timestamp>` swap, and preservation of `db-replaced-<timestamp>` intact on disk per `L4` with startup recovery when `--force-overwrite-active` is used with a stopped server) are specified in `data-model.md` (§1.3–§1.5) and `contracts/api.md` (§2).
- [x] CHK014 Error handling for database initialization, migration, and backup failures (`status: 'error'`, caching the failed startup state once per process so page loads never re-run startup backups or evict existing good backups, halting before opening PGlite/migrating on backup failure, returning `503` on `/api/health` and `/api/health/check`, and releasing the database lock sentinel `<parent(dbDir)>/<basename(dbDir)>.azusa-lock`) is designed to surface structured diagnostics (`stage`, `message`, `recoveryHint`) in both `GET /api/health` (`503`) and the UI `ErrorAlertBanner` (`role="alert"`).

## 5. Contracts, Testing Strategy & Documentation Deliverables (Constitution Principles V & VI)

- [x] CHK015 HTTP contracts (`GET /api/health`, `POST /api/health/check` with strict `DiagnosticCheckRequestSchema` excluding `actor`) and CLI contracts (`db:migrate`, non-mutating hash-verified `db:backup`, and `db:restore` with per-directory sentinel lock scope decoupling sibling restores per `L3`, empty lock directory per `L1`, graceful `onCompromised` handler per `L2`, and recoverable active replacement preserving `db-replaced-<timestamp>` on disk per `L4`) in `contracts/api.md` define clear request/response schemas, status codes, and failure behaviors aligned with `spec.md` and `quickstart.md`.
- [x] CHK016 Validation strategy in `plan.md` and `tasks.md` covers deterministic unit tests (ISO-8601 week boundaries, Sundays, legacy timezone aliases, fixed-offset lookup table + `UTC±offset` fallback, invalid timezone ID `'UTC'` fallback, actor resolution, strict Zod schemas, documentation completeness), integration tests (PGlite restart durability `AC04`, real `init`-stage failure `M1`, configurable-folder migration preservation & error reporting `AC05`, child-process lock contention & multi-process stale-lock takeover race `M2`, deferred pruning & backup non-eviction under failed startups `M1`, non-mutating manual backup `m1`, disjoint/populated/case-insensitive restore refusal `C2`, active promotion rollback & interrupted-promotion startup recovery `M3`, SHA-256 byte-for-byte active-DB preservation `SC-004`, full recovered record field verification `AC06`, and cross-platform backup failure simulation `C14`), Tier-1 `test:visual` geometry/non-overlap/expanded-search-hiding checks in Phase 05, and strictly isolated Playwright E2E + `@axe-core/playwright` smoke tests (`port 3100`, `reuseExistingServer: false`, `.next-playwright`, pre-seeded `.azusa/test-playwright/` via `scripts/test/start-playwright-server.ts`) for US1–US5 in Phase 06.
- [x] CHK017 All 8 required Constitution Principle VI documentation artifacts (`README.md`, `docs/REPO_MAP.md`, `CHANGELOG.md`, `docs/architecture/overview.md`, `docs/architecture/domain-model.md`, `docs/architecture/data-dictionary.md`, `docs/architecture/decisions/0001-local-first-nextjs-pglite-foundation.md`, and `docs/operations/database-and-recovery.md`) are included in `plan.md`'s `Affected Areas` and verified in `T035`, with `docs/feature-roadmap.md` checked off only in `T040` after quality gates, conformance review, and operator UAT acceptance.

---

## Resolution Log for Pass 2 Review Findings (2026-11-08)

- **MAJOR M1 — Prevent failed startups from evicting good backups**:
  - `ensureDatabaseInitialized()` runs at most once per process (`globalThis.__azusaDbState` caches both `'healthy'` and `'error'` outcomes, and `startupBackupTaken` ensures at most one startup backup per process).
  - Pre-migration startup backup checks for `.azusa-last-healthy.json` (skipping redundant snapshots if the previous startup/migration left the cluster unverified) and **defers `pruneCompletedStartupBackups(backupDir, 10)` until after PGlite mounts, all migrations succeed, and `.azusa-last-healthy.json` is written**.
  - Added a real `init`-stage failure test in `T013` (`tests/integration/persistence-restart.test.ts`) and a non-eviction test across repeated failed startups/restarts in `T016` (`tests/integration/backup-restore.test.ts`).
- **MAJOR M2 (Codex RR1) — Race-safe stale-lock reclamation via `proper-lockfile` & child-process contention tests**:
  - Replaced the custom PID-unlink lock with `proper-lockfile` (`^4.1.2`, MIT) in `src/persistence/lock.ts` (`<parent(dbDir)>/.azusa-db.lockfile`, `retries: 0, stale: 10000, update: 2000`), failing closed if the lock artifact is malformed/unreadable or held by an active owner.
  - Added child-process lock contention and multi-process stale-lock takeover race tests (`>= 4` concurrent child processes racing on an expired lock, asserting `winners.length === 1`) in `T016`.
- **MAJOR M3 (Codex RR2) — Recoverable active-database replacement protocol, rollback & startup recovery**:
  - Specified the journaled active promotion sequence in `data-model.md` (§1.5), `contracts/api.md` (§2.3), `plan.md`, and `tasks.md` (`T014`, `T016`): write `.azusa-promote-journal.json` → move `activeDbDir` to `db-replaced-<timestamp>` → move verified `.restore-tmp-<uuid>` to `activeDbDir` → confirm PGlite readability → delete `db-replaced-<timestamp>` and the journal, with automatic rollback on Step 3/4 failure and automatic startup recovery (`recoverInterruptedPromotionIfNeeded`) if interrupted partway.
- **MINOR m1 — Non-mutating manual backup verification**:
  - Updated `contracts/api.md` (§2.2) and `T014`/`T016` so `createManualBackup()` verifies copied file sizes and SHA-256 digests against the quiescent locked source without opening PGlite in place on the backup snapshot.
- **MINOR m2 & m3 — Pre-seeded Playwright test lifecycle & strict server isolation**:
  - Added `scripts/test/start-playwright-server.ts` (`T015`) and updated `playwright.config.ts` (`T008`) to pin `reuseExistingServer: false`, run on dedicated port `3100` (`http://127.0.0.1:3100`), use `AZUSA_NEXT_DIST_DIR=.next-playwright`, and reset + pre-seed `.azusa/test-playwright/db` before booting `next dev` so a real `backup-*-startup` snapshot (`backupCount: 1`) is created on server startup for US4 E2E verification (`T028`).
- **MINOR m4 (Codex RR3) — Roadmap completion gated on quality gates, conformance review & operator UAT**:
  - Updated `T040` (`tasks.md`) and `plan.md` so all 7 quality gates run first, and `F001` remains unchecked in `docs/feature-roadmap.md` until post-implementation conformance review (`agent-06-check-implementation.md`) and explicit operator UAT acceptance complete.
- **MINOR m5 — Timezone label formatting (`OD2`)**:
  - Updated `spec.md`, `research.md` (`R8`), `data-model.md` (§2.1), `plan.md` (`D3`), and `tasks.md` (`T006`, `T033`) to use the fixed-offset lookup table (`PHT`, `IST`, `JST`, `SGT`, `UTC`), format all other valid zones (including Chicago and London) via `Intl` `shortOffset` with `GMT` replaced by `UTC` (never `GMT`), and fall back deterministically to `'UTC'` on invalid/missing timezone IDs.
- **MINOR m6 & INFO — Single-row header with `visibility: hidden` on expanded search overlap (`OD4`), non-clashing decision labels (`PC1`–`PC3`, `OD1`–`OD4`), `Status: Draft`, same-ms suffix format (`-01-startup`), and CLI lock scope wording**:
  - Updated `spec.md` (`Status: Draft`), `plan.md`, `research.md`, `data-model.md`, `contracts/api.md`, and `tasks.md` (`T021`, `T022`, `T027`) accordingly.

---

## Codex Verification of Latest Remediation (2026-11-08)

**Prior finding status**: RR2 (recoverable active promotion) is addressed at the planning level by the journal, old-cluster retention, rollback, startup recovery, and T016 fault tests. RR3 (conformance review and explicit operator UAT before roadmap completion) is addressed by T040. RR1's custom stale-PID unlink algorithm has been replaced with an established library and child-process tests, but its new integration still has the concrete defects below. The remaining updated clarification, visual-deviation, failure-caching, backup-pruning, and test-isolation items were verified against the revised artifacts.

- **MAJOR LR1 — owner.json makes the proper-lockfile directory non-removable** (`tasks.md:155`, `data-model.md:109`, `plan.md:167`, `research.md:42`; CHK010, CHK013, CHK016). The plan requires writing diagnostic owner metadata inside `<sentinelPath>.lock/owner.json`. In proper-lockfile v4.1.2, normal unlock, stale takeover, and process-exit cleanup use non-recursive `rmdir`/`rmdirSync` on that directory. With owner.json present they fail because the directory is non-empty. This can block startup immediately after the documented db:migrate command or leave a crashed database permanently locked. Keep the library-owned lock directory empty and store optional diagnostics outside it, without allowing stale diagnostic metadata to control ownership. Assign clean release/reacquire and killed-owner recovery tests using the actual wrapper. Align the stale fixture with the library's minimum stale interval of 2000ms (T016 currently requests 500ms), and keep the winning child holding ownership until all contenders have attempted acquisition.
- **MINOR LR2 — Parent-scoped sentinel aliases the staging restore lock to the active lock** (`tasks.md:155`, `plan.md:374`, `data-model.md:110`, `contracts/api.md:146`; CHK010, CHK013, CHK015, CHK016). Lock identity is fixed as `<parent(dbDir)>/.azusa-db.lockfile`, while non-active restore promises to lock only its target and run without locking the active database. The E2E target `.azusa/test-playwright/restored` and running database `.azusa/test-playwright/db` share the same parent, so applying the prescribed helper to the target acquires the server's exact lock and fails with ELOCKED. Define a lock identity derived from each canonical full database/target path, remaining outside directories moved during promotion. Test a disjoint sibling restore while the active server holds its lock, plus contention between two restores to the same target.

**Primary dependency evidence**: proper-lockfile v4.1.2 `lib/lockfile.js`, removeLock (lines 80–88), exit cleanup (302–309), and stale interval normalization (200–202): https://github.com/moxystudio/node-proper-lockfile/blob/v4.1.2/lib/lockfile.js .

**Artifacts reviewed**: Revised spec/clarifications, plan, tasks, research, data model, HTTP/CLI/route contracts, quickstart, and checklist/remediation log; previously established constitution, roadmap, feature-brief, and prototype scope. This remains an artifact review with no application implementation or runtime tests. Only this worksheet was edited.
---

## Resolution Log for Pass 3 Review Findings (2026-11-08)

- **MAJOR L1 — Keep proper-lockfile directory empty & support clean release / killed-owner recovery**:
  - Removed writing `owner.json` inside proper-lockfile's `.lock` directory across all specs, plans, data model, and tasks (`T010`, `T016`). In `proper-lockfile` v4.1.2, `removeLock` uses non-recursive `rmdir`/`rmdirSync`, which fails with `ENOTEMPTY` if any files exist inside the lock directory.
  - Diagnostic owner metadata (PID, processType, timestamp) is now written outside the lock directory to `<dir>.azusa-owner.json` and is strictly non-authoritative (never decides ownership).
  - Assigned tests in `T016`: clean lock release followed by immediate re-acquisition; recovery after the lock holder is killed (`SIGKILL`); and aligned the stale-lock test fixture to `>= 2000ms` (matching `proper-lockfile`'s minimum interval, updating `T016` from 500ms).
- **MAJOR L2 — Lost-lock graceful handling (`onCompromised`) & race-safe acquisition**:
  - Configured `proper-lockfile` with a custom `onCompromised: (err) => { ... }` callback in `src/persistence/lock.ts`. When heartbeat detects the lock was lost or stolen, it closes PGlite, sets `globalThis.__azusaDbState` to `status: 'error'`, and serves `503 Service Unavailable` instead of throwing an unhandled exception that crashes Next.js mid-request.
  - Added an immediate post-acquisition grace verification check before instantiating PGlite.
  - Updated child-process lock tests in `T016`: keep the winning child holding the lock until all contender processes have attempted acquisition, and assert that any process failing lock acquisition halts cleanly before writing anything to the database directory.
- **MINOR L3 — Per-target canonical sentinel path decouples sibling restores**:
  - Replaced the parent-scoped lock sentinel (`<parent(dbDir)>/.azusa-db.lockfile`) with a per-directory canonical sentinel: `path.resolve(path.dirname(dir), `${path.basename(dir)}.azusa-lock`)` in `research.md`, `data-model.md`, `contracts/api.md`, `plan.md`, and `tasks.md` (`T010`, `T014`, `T016`).
  - Sibling restore targets (e.g. `.azusa/data/restored-*` or `.azusa/test-playwright/restored`) acquire their own distinct lock sentinels outside directories moved during promotion, enabling non-active restore to execute without `ELOCKED` collisions while the active server holds its lock.
  - Added tests in `T016` for sibling restore while active server holds its lock, plus lock contention between concurrent restores targeting the same directory.
- **MINOR L4 — Preserve replaced active database on forced restore**:
  - Updated Step 5 of the active promotion protocol in `data-model.md` (§1.5), `contracts/api.md` (§2.3), `plan.md`, and `tasks.md` (`T014`, `T016`): upon promotion success, `db-replaced-<timestamp>` is preserved intact on disk for operator inspection, audit, and manual cleanup, and only `.azusa-promote-journal.json` is deleted.
  - Documented retention and manual cleanup procedures in CLI contracts, quickstart, and `docs/operations/database-and-recovery.md` (`T034`).
- **MINOR L5 — Invalid timezone ID computes both clock time and zone badge in UTC**:
  - Specified in `spec.md` (FR-007), `research.md` (R8), `data-model.md` (§2.1), `plan.md`, and `tasks.md` (`T006`) that when an invalid or unparseable timezone identifier is provided, `formatViewerClock` and `getTodayWidgetModel` compute **both** the displayed clock time (`HHMMh`) and the timezone badge in `UTC` (`timeZone: 'UTC'`).
  - Added test in `tests/unit/iso-week.test.ts` verifying that invalid timezone IDs output the exact UTC formatted time and `'UTC'` zone badge.
- **INFO — Stale lock interval operational note**:
  - Documented in `docs/operations/database-and-recovery.md` (`T034`) that the lock stale threshold is 10,000ms with 2,000ms heartbeats, noting event-loop considerations for operations runbooks.

---

## Codex Follow-up Verification (2026-11-08)

**Prior finding status**: LR1 and LR2 are addressed at the planning level. The active design now keeps the proper-lockfile directory empty, moves optional non-authoritative diagnostics outside it, assigns release/reacquire and killed-owner recovery tests, uses a stale fixture >= 2000ms, and keeps the winning child holding its lock during contention. Canonical per-directory sentinels separate sibling restore targets from the active database, with T016 tests for concurrent sibling restore and same-target contention. The additional lost-lock handling, preserved replaced database, and UTC fallback clarifications are reflected in the detailed design. No additional functional design gap was identified in this follow-up.

- **MINOR FP1 — Current artifacts still prescribe the superseded lock path** (CHK003, CHK013). Nine non-historical references still use `.azusa-db.lockfile`, conflicting with the accepted `<parent(dir)>/<basename(dir)>.azusa-lock` design: `plan.md:10`, `plan.md:18`, `plan.md:98`, `plan.md:290`, `plan.md:339`, `data-model.md:126`, `spec.md:305`, `tasks.md:463`, and `tasks.md:521`. In particular, the active-replacement lock rule in data-model.md and operational smoke instructions in T039 still name the old lock, allowing implementation/documentation to diverge or checks to inspect the wrong sentinel. Replace these current references with the canonical per-directory convention (and update CHK014's old lock name in this worksheet when reconciling); historical review/resolution entries may retain old names when clearly historical. This is a bounded consistency cleanup, not a request to redesign locking.

**Artifacts reviewed**: Revised spec, plan, tasks, research, data model, API/CLI contracts, quickstart, and review/remediation worksheet, within the previously established constitution, roadmap, brief, and prototype scope. Only this worksheet was edited. No runtime tests were run; findings concern pre-implementation artifacts.

**Follow-up verification (2026-11-08)**: FP1 remains open. Re-read the current package: all nine superseded .azusa-db.lockfile references listed in FP1 remain present at the same locations. CHK003 and CHK013 remain unchecked and the gate remains FAIL. No additional findings identified in this follow-up. Only this worksheet was edited; no runtime tests were run.

---

## Resolution Log for Pass 4 Review Findings (2026-11-08)

- **MINOR F1 — Replace superseded lock name (.azusa-db.lockfile) across all current references**:
  - Replaced all 9 remaining references to `.azusa-db.lockfile` with the canonical per-directory sentinel path `<parent(dir)>/<basename(dir)>.azusa-lock` (or `<dbDir>.azusa-lock` / `<basename(dbDir)>.azusa-lock`):
    1. `data-model.md:126` (forced-restore active lock rule)
    2. `plan.md:10` (summary)
    3. `plan.md:18` (storage architecture metadata)
    4. `plan.md:98` (data dictionary affected area)
    5. `plan.md:290` (file tree comment)
    6. `plan.md:339` (risk & mitigations table)
    7. `spec.md:305` (database storage & lock file specification)
    8. `tasks.md:463` (T033 data dictionary description)
    9. `tasks.md:521` (T039 manual smoke check instructions)
    10. `checklists/plan-review.md` (CHK014 checklist criterion text).
  - Historical review findings and previous resolution logs intentionally retain original names for audit history.
- **MINOR F2 — Correct T014 interrupted-promotion recovery to preserve replaced database**:
  - Updated `T014` in `tasks.md` (`recoverInterruptedPromotionIfNeeded`) so that when the active database is already healthy, it cleans up only the leftover `.azusa-promote-journal.json` while **preserving** `replacedDir` (`db-replaced-<timestamp>`) intact on disk for operator inspection and audit, perfectly matching `L4` and `data-model.md:142`.
- **MINOR F3 — Post-acquisition > 2000ms heartbeat grace verification & CLI lost-lock handling**:
  - **Re-check timing**: Specified in `research.md` (R4), `data-model.md` (§1.5 item 1), `plan.md`, and `tasks.md` (`T010`) that because `proper-lockfile` detects stale-lock races via heartbeat timestamp updates rather than process-ownership inspection APIs, the server waits just over one heartbeat interval (> 2000ms, e.g. 2100ms) after acquisition to confirm that the update heartbeat completes and `onCompromised` has not fired before instantiating PGlite.
  - **CLI lost-lock handling**: Defined `onCompromised` handlers in `contracts/api.md` (§2), `research.md`, `data-model.md`, `plan.md`, and `tasks.md` (`T010`, `T015`) for `db:migrate`, `db:backup`, and `db:restore`. If the lock is lost or stolen mid-operation, the CLI script immediately halts, cleans up active staging folders (`.tmp-*`, `.restore-tmp-*`), rolls back active promotion if underway (`db-replaced-<timestamp>` back to `activeDbDir`, removing journal), prints error diagnostics to stderr, and exits with code 1.

---

## Final Codex Follow-up Verification (2026-11-08)

FP1 is resolved: all nine previously identified non-historical `.azusa-db.lockfile` references now use the canonical per-directory sentinel convention, and CHK014 is aligned. A package-wide search excluding historical worksheet entries found no remaining superseded lock-path references. Checked the F2 recovery change preserves the replaced database on successful recovery, and F3 specifies server heartbeat grace verification and CLI lost-lock handling consistently with the detailed lock contract. Prior LR1/LR2 fixes and assigned tests remain in place. No new non-INFO findings identified. All 17 checklist items are checked; the pre-implementation package verdict is Ready.

**Artifacts reviewed**: Updated spec, plan, tasks, data model, CLI contracts, and checklist/remediation history, against the previously reviewed research, quickstart, constitution, roadmap, feature brief, and prototype scope. Only this worksheet was edited. This PASS is for the pre-implementation requirements gate; no runtime tests or implementation/UAT acceptance are claimed.
---

## Resolution Log for Pass 5 Review Findings (2026-11-08)

- **MINOR G1 — Post-acquisition heartbeat wait applies to every lock holder**:
  - Made it explicit across all artifacts (`tasks.md:155` T010, `research.md` R4, `plan.md` Data Flow 1.2, `data-model.md` §1.5 item 1, and `contracts/api.md` §2) that **every** lock holder (`server`, `db:migrate`, `db:backup`, and `db:restore`) waits just over one heartbeat interval (`> 2000ms`, e.g. `2100ms`) after acquiring the lock.
  - Confirms `onCompromised` has not fired before opening PGlite or reading, copying, or modifying the database folder, eliminating stale takeover race collisions across server and CLI processes alike.
- **MINOR G2 — Comprehensive lost-lock test suite assigned to T016**:
  - Added dedicated Test 2b in `tasks.md` (`T016`) and updated `plan.md` validation strategy to simulate a lost lock by deleting `<sentinel>.lock` or altering its `mtime`, explicitly asserting:
    1. **Server lost-lock**: Closes PGlite, `GET /api/health` and `POST /api/health/check` return `503 Service Unavailable`, and the error stage is `'init'`.
    2. **db:backup lost-lock**: Removes partial `.tmp-*` folder and exits `1`.
    3. **db:restore lost-lock**: Removes `.restore-tmp-*` during staging, or rolls back `db-replaced-<timestamp>` to `activeDbDir` during active promotion, and exits `1`.
    4. **Heartbeat wait lost-lock**: Any lock holder losing the lock during the `> 2000ms` post-acquisition heartbeat wait aborts immediately and never opens PGlite or reads/writes the database folder.
