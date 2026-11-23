# Database and recovery runbook

F001 / 0.1.0. Run commands from the repository root. Defaults are active `.azusa/data/db` and backups `.azusa/data/backups`; substitute configured `AZUSA_DB_DIR` / `AZUSA_BACKUP_DIR` paths consistently. Keep database, backups, and sibling restore targets disjoint. [Architecture](../architecture/overview.md) explains startup; [dictionary](../architecture/data-dictionary.md) describes files/fields.

## Initialize and migrate

1. Install the supported runtime/dependencies from [README](../../README.md).
2. Stop Azusa (Ctrl+C in its server terminal) and any other command using the active cluster.
3. Run `npm run db:migrate`. A fresh cluster is created, explicit migrations applied, `foundation.init` inserted, and `.azusa-last-healthy.json` written. The command returns JSON `{ "ok": true, "dbDir": "..." }`; failures use stderr and exit 1.
4. Run `npm run dev`, open `http://127.0.0.1:3000`, and inspect Foundation status. Database initialization also occurs on the first database-backed request if not run explicitly.

For schema work, edit `src/persistence/schema/`, run `npx drizzle-kit generate --name <description>`, review the generated SQL plus journal/snapshot, and test fresh/upgrade paths before applying to valued data. Commit generation metadata with SQL; do not hand-edit migration timestamps or discard the baseline snapshot. The low-level runner does not arrange ownership or backups: use `db:migrate` for operational migration.

## Ownership and startup backups

The active sentinel is `<parent(dir)>/<basename(dir)>.azusa-lock`; `proper-lockfile` creates its empty `.lock/` directory. Its stale threshold is **10 seconds**, heartbeat **2 seconds**, and every holder waits **2100 ms (> 2000 ms)** after acquisition before touching database contents. Ownership diagnostics in `<dir>.azusa-owner.json` are optional and can be stale. Never put metadata inside `.lock/`, or remove a live process's lock to bypass contention.

`db:migrate`, `db:backup`, and active overwrite need exclusive active ownership. Contention exits 1 with **“Database is currently locked. Stop the running Azusa server before running this command.”** Stop the holder first. Following a crash, allow the stale interval to expire; an immediate production command may still refuse. Browser-test bootstrap alone retries this contention for up to 15 seconds.

At startup, while holding ownership:

1. Recover an interrupted journaled promotion and reject invalid cluster/version state.
2. With no `PG_VERSION`, report `skipped_cold_start`; there is no cluster to snapshot.
3. With an existing cluster but no healthy marker, report `skipped_unverified` and skip snapshot/pruning. Preserve the folder while diagnosing a failed first migration; absence of a marker is not permission to destroy data.
4. With an existing marked cluster, copy/hash/verify it into `.tmp-<backupId>`, write manifest, then rename to `backup-...-startup` before opening PGlite or applying migrations. Failure halts startup with `backup` stage.
5. Remove the healthy marker for migration, migrate/seed, and rewrite it on success. Only then prune older completed startup snapshots to ten, except on the unverified path. Failed migrations do not evict earlier recovery points.

Snapshot creation ignores incomplete entries in summaries and removes `.tmp-*` entries older than one hour when making another snapshot. Windows snapshot/restore directory renames retry transient sharing/permission errors up to five attempts (1.5 seconds total delay), retaining lock checks. Persistent errors still fail.

## Manual backup

Stop the server, then run:

```powershell
npm run db:backup
```

Save the returned `backupId`/`backupPath`, `filesCopied`, and `createdAt`. This makes a `-manual` snapshot under the configured backup root, hashes both source/copy, and does not open PGlite or mutate source files. Manual snapshots are not pruned by startup retention. For an important recovery point, copy the completed snapshot directory with its manifest to separate storage under your own retention policy.

## Verify by sibling restore

This can run while Azusa holds the active lock because the target has its own sentinel. Choose an absent or empty target outside the active directory, backup root, and source snapshot:

```powershell
npm run db:restore -- --from latest
npm run db:restore -- --from latest --to .azusa/data/verify-restore
```

These are alternative commands; do not repeat the second against an already populated target. `--from` accepts `latest`, a backup ID, or snapshot directory path. `latest` selects the newest completed entry by manifest time; choose an explicit known backup ID when needed. Without `--to`, the target is `.azusa/data/restored-<timestamp>` beside the configured active cluster.

Restore verifies source version/manifest/SHA-256 list, copies into `.restore-tmp-<uuid>`, verifies staging, then opens staging to validate `foundation.init`, all metadata payloads, UUIDv4 IDs, and audit fields. It returns `ok`, `backupId`, `restoredTo`, `recordCount`, and `foundationRecordId`. Inspect those values and the intended records before promotion. The source backup and running active cluster stay unchanged. A sibling restore does not switch the running server to the restored directory.

## Recoverable active replacement

1. Select and, preferably, test a known backup by sibling restore.
2. Stop the server and other active-database commands. Confirm the configured active/backup paths and identify the backup ID to use.
3. For default paths, replace `<backup-id>` with the selected, verified recovery snapshot ID and run:

```powershell
npm run db:restore -- --from <backup-id> --to .azusa/data/db --force-overwrite-active
```

4. Capture `replacedDbPreserved` from the result. The old active cluster remains intact at `db-replaced-<timestamp>-<uuid>` beside the active directory.
5. Restart Azusa and verify health, migrations, and expected diagnostic/business records as applicable. Keep the preserved predecessor until recovery is accepted.

Choose the recovery ID deliberately rather than using `latest` for active replacement. The newest startup snapshot may contain the same problem state as the active database you are replacing.

Active replacement without `--force-overwrite-active` is refused. Source/backup overlaps and ancestor/descendant overlaps with the active cluster are refused; nonempty sibling targets are refused. Paths are canonicalized for comparison (case-insensitive on Windows) while preserving actual path casing.

Promotion writes parent `.azusa-promote-journal.json`, moves old active to its preserved path, moves verified staging into active, validates again, then removes the journal. Handled failure/lock loss rolls back the predecessor and cleans staging. If interrupted, the next startup validates journal paths and clusters: a healthy promoted cluster is kept with predecessor preserved; an invalid/missing active cluster is replaced from a valid preserved predecessor. Failed recovery remains an error instead of creating a fresh database. Preserve journal/cluster directories for investigation if recovery cannot finish.

## Retention, disk usage, and cleanup

During F001 verification the baseline PGlite cluster was measured at roughly **40 MB per snapshot**, so ten startup snapshots occupy around **400 MB** before data growth. This is disk storage, not a measured startup RAM requirement. Manual backups, active data, sibling restores, and preserved predecessors add storage separately. Failed starts may temporarily leave more than ten snapshots because pruning is deferred.

After recovery is accepted, stop relevant processes, inspect exact absolute paths, confirm they are not active/source/backup paths needed for recovery, and manually remove only the chosen obsolete sibling restore or `db-replaced-*` directory. Preserve another known recovery point first when data matters. Manual backup deletion is also an operator decision; keep each retained snapshot's cluster and manifest together. Do not clean a pending promotion's journal or referenced directories blindly. Abandoned unreferenced restore staging after a force-kill may need manual inspection/cleanup; it has no general automatic retention policy.

## Troubleshooting the error banner

| Stage/symptom                                     | Action                                                                                                                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`: lock held                                 | Stop the actual holder and retry; allow a crashed holder's stale interval. Owner JSON is only a hint.                                                                                                            |
| `init`: lock lost / client closed                 | Stop processes, verify exclusive access and filesystem permissions, restart. Cached lock-loss errors intentionally take precedence over secondary query errors.                                                  |
| `init`: invalid version/corrupt cluster           | Preserve the cluster; verify a known backup by sibling restore before active recovery. Never silently reinitialize valued data.                                                                                  |
| `backup`: copy/hash/rename/prune/recovery failure | Check free disk, permissions, directory overlaps, source/manifest integrity, and journal state. Persistent Windows sharing failures require stopping the holder; bounded retries do not bypass it.               |
| `migration`                                       | Preserve data/backups, inspect the failing SQL/journal/snapshot and test an upgrade on an isolated copy. Correct migration failure before retrying; do not prune recovery points manually to make startup green. |
| `query`: malformed metadata/read failure          | Inspect the reported database/migration metadata and payloads; preserve evidence and recover known valid data if needed.                                                                                         |

Use `GET /api/health` for structured status/errors and `POST /api/health/check` for a deliberate diagnostic write. Healthy health reads return 200; health failures return 503; valid diagnostic writes return 201. Restart after correcting a cached startup failure. Test fault injection belongs only to the isolated non-production harness and is not a recovery mechanism.
