# Physical data dictionary

F001–F003 / application 0.3.0. This describes implemented persistence. The [domain model](domain-model.md) also covers future concepts. Drizzle manages migration bookkeeping separately. Paths below use the default configuration unless overridden. Source entry points are in the [repository map](../REPO_MAP.md).

## `app_metadata` and `auditColumns()`

`src/persistence/schema/app-metadata.ts` spreads `auditColumns()` from `schema/common.ts`. The migration stores identifiers as **text**, with UUIDv4 generation in the ORM, not a PostgreSQL UUID column/default. Restore validates UUIDv4 format.

| SQL field    | Drizzle property/type                        | Default and constraint                                             |
| ------------ | -------------------------------------------- | ------------------------------------------------------------------ |
| `id`         | `id`, text                                   | Primary key, non-null; ORM `$defaultFn` uses `crypto.randomUUID()` |
| `created_at` | `createdAt`, timestamp with time zone / Date | Non-null, SQL `now()`                                              |
| `updated_at` | `updatedAt`, timestamp with time zone / Date | Non-null, SQL `now()`; ORM `$onUpdate` supplies Date on update     |
| `created_by` | `createdBy`, text                            | Non-null, SQL default `local:sm`                                   |
| `updated_by` | `updatedBy`, text                            | Non-null, SQL default `local:sm`                                   |
| `key`        | `key`, text                                  | Non-null, unique (`app_metadata_key_unique`)                       |
| `value`      | `value`, JSONB                               | Non-null; application validates against the schema for its key     |

Timestamps represent UTC instants and serialize as ISO strings (`Z`) in generated API responses. `$onUpdate` is an ORM hook, not a SQL trigger; raw SQL must maintain audit fields. Diagnostic conflict updates explicitly use SQL `now()` and the resolved actor. Actor precedence is trimmed explicit internal value, then `AZUSA_ACTOR_ID`, then `local:sm`; HTTP bodies cannot set actor. Creation identity/timestamps survive updates.

| Key                     | `value` payload                                                                                                           | Write semantics                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `foundation.init`       | `schemaVersion` (`0000_foundation_init`), `appVersion` (`0.3.0` for new rows), `initializedAt` ISO datetime | Insert only if absent after migration. Upgrades preserve the whole original row. The seed label remains constant across migrations. |
| `diagnostic.last_check` | `note` nonempty string up to 280 characters, `checkCount` nonnegative integer, `checkedAt` ISO datetime                   | Strict request trims note, defaults to `Manual diagnostic check`; blank/unknown fields rejected. First count 1; SQL-side increment on subsequent writes preserves ID/creation audit. |

`AppMetadataEntrySchema` ties key to payload. `app_metadata` can contain only foundation metadata in a fresh cluster; the diagnostic row appears after a manual check. Health is a derived response, not an extra persisted table.

## F002 organization and cadence tables

All ten tables include the shared audit columns above. Date fields below are inclusive ISO calendar dates (`YYYY-MM-DD`) stored as text without a time zone. SQL checks enforce date shape and ordered ranges. Domain validation checks actual calendar dates and business rules. Every F002 foreign key uses `ON DELETE RESTRICT`.

| Table | Columns besides shared audit columns | Constraints and meaning |
| --- | --- | --- |
| `trains` | `name`, `record_status` | ART name is nonblank and case-insensitively unique. |
| `teams` | `train_id`, `name`, `hours_per_day` (default 8), `sprint_offset_workdays` (default 0), `record_status` | Nonblank name unique per ART. Hours are greater than 0 up to 24. Offset is −1, 0, or +1 weekday. |
| `members` | `location_id`, `full_name`, `nickname` (default empty), `initials`, `role`, `fte_factor` (default 1), `avatar_color` (default `#2F62C8`), `record_status` | Nonblank name, 1–4 trimmed initials, six-digit hex color, and FTE greater than 0 up to 1. Roles are Admin, RTE, SM, PO, and Team member. |
| `member_team_assignments` | `member_id`, `team_id`, `start_date`, nullable `end_date` | Partial unique index allows one open-ended row per Member. Services maintain date-resolved, non-overlapping history. |
| `pis` | `train_id`, `name`, `start_date`, `end_date`, `lifecycle_status` (default `planning`), `record_status` | Nonblank name unique per ART. Lifecycle permits `planning`, `in_progress`, and `closed`. Services check cadence overlaps. |
| `iterations` | `pi_id`, `name`, `kind` (default `development`), `start_date`, `end_date` | Nonblank name unique per PI. Kind is `development` or `ip`. Services check weekday boundaries, PI containment, and overlap. |
| `locations` | `code`, `name`, `country_code`, nullable `subdivision_code`, `time_zone`, `calendar_source`, nullable `last_refreshed_at`, `seeded_years` (JSON array, default empty), nullable `library_seed_cutoff_date`, `record_status` | Immutable unique nonblank code, nonblank name, two uppercase country letters, and optional one-to-three-character uppercase alphanumeric subdivision. The application normalizes IANA zones and validates subdivisions. Refresh time is an instant. |
| `holidays` | `location_id`, `date`, `name`, `portion` (default `full`), `source` (default `library`), `confirmed` (default true) | Nonblank name. Portion is `full` or `half`. Source is `library`, `company`, or `manual`. `holidays_library_identity_unique` constrains `(location_id, date, name)` only for library rows. |
| `absence_types` | `code`, `name`, `color`, `affects_capacity` | Nonblank unique code, nonblank name, and six-digit hex color. |
| `absences` | `member_id`, `absence_type_id`, `date`, `portion` (default `full`), `planned` (default true), `status` (default `active`), nullable `extra_hours`, nullable `note` | Portion is `full`, `am`, or `pm`. Status is `active` or `cancelled`. Extra hours are nonnegative. Services reject overlapping active capacity-reducing absences on the same Member and date. |

Name and code uniqueness above uses `lower(trim(...))` where specified, including the scoped Team, PI, and Iteration names and the Location and Absence Type codes. The SQL checks constrain `record_status` to `active` or `archived`, with `active` as the default. PI lifecycle and archival are independent. `TeamIterationSchedule` derives Team boundaries from the canonical Iteration and the Team offset by counting Mon–Fri weekdays. It has no table.

### Holiday and reference seeding

- `runMigrations()` fills missing default Locations and Absence Types by code, then seeds each Location's missing years. The year set is the server-local year minus one through plus two, union 2026–2028. `seeded_years` records completed years even when no eligible holidays are returned. Library inserts and seed tracking commit together. Startup leaves recorded years and existing reference edits intact.
- `date-holidays` 3.39.2 supplies public and bank holidays offline. Karnataka (`IN`/`KA`) is supported by that version. If the seed probe yields no regional calendar, the default falls back to country-level India and records `Public holidays, IN` with no subdivision. Islamic/Hijri rule strings set `confirmed = false`.
- Company and manual rows suppress library rows for the same Location and date when resolving effective holidays. Jurisdiction edits replace only library holidays from the server-local edit date onward. The stored `library_seed_cutoff_date` keeps later seeding from applying that jurisdiction to earlier dates. Operational refresh belongs to F005.

## F003 category and allocation tables

Both tables include shared audit columns. All foreign keys use `ON DELETE RESTRICT`.

| Table | Columns and constraints |
| --- | --- |
| `categories` | `train_id` references `trains.id`. `name` and `short_label` are nonempty text. `color` is six-digit hex. `kind` is `development` or `overhead`. Nullable `semantic_role` and `default_pct` are governed by the kind check below. `sort_order` is a nonnegative integer, default `0`, scoped to ART and kind. `record_status` is `active` (default) or `archived`. |
| `team_category_allocations` | `team_id`, `pi_id`, and `category_id` reference their respective tables and form a unique tuple. `override_pct` is a non-null integer checked between 0 and 100. Rows only store explicit overrides, including `0`. A missing row means inheritance. |

`categories_kind_fields_valid` explicitly checks that development rows have non-null `semantic_role` (`feature`, `maintenance_bugs`, or `standard`) and non-null integer `default_pct` from 0 to 100. Overhead rows require both fields to be null. Names are unique per ART using `lower(trim(name))`. The partial unique index `categories_train_active_bugs_unique` permits at most one active `maintenance_bugs` row per ART. `categories_train_kind_sort_idx` covers ordered catalog reads by ART and kind. `team_cat_alloc_unique` also serves Team/PI lookups, and `team_cat_alloc_category_idx` serves reference checks by category. The application validates ART ownership and active development targets when writing overrides.

`TeamPiAllocationView` is derived from the ART's active development categories and sparse overrides. It exposes the ART, Team, PI, PI end date and current/future flag, ordered category metadata, each row's ART default, override, effective percentage and source, plus configuration status, totals, validity, and a drift flag. The effective value is `overridePct ?? artDefaultPct`. Archived categories and their overrides remain stored. The derived view has no backing table.

## Migration structures

- `src/persistence/migrations/0000_foundation_init.sql`: initial table and constraints.
- `src/persistence/migrations/0001_organization_cadence.sql` and `meta/0001_snapshot.json`: F002 tables, checks, foreign keys, indexes, and updated generation snapshot.
- `src/persistence/migrations/0002_work_categories_allocation.sql` and `meta/0002_snapshot.json`: F003 tables, checks, foreign keys, indexes, and generation snapshot.
- `meta/_journal.json`: Drizzle migration tags and `when` timestamps; keep ordering metadata intact.
- `meta/0000_snapshot.json`: generation baseline, required for future schema diffs.
- `drizzle.__drizzle_migrations`: Drizzle-managed application history. Health reads applied rows/count and maps the latest `created_at` timestamp to the journal tag. Do not infer current migration state from the initial foundation record.

Schema changes require reviewed generated SQL and metadata, plus fresh and upgrade tests. Story, Bug, capacity, commitment, and reporting tables belong to later features.

## Database-adjacent files

| Structure                                     | Fields, units, and purpose                                                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<parent(dir)>/<basename(dir)>.azusa-lock`    | Sentinel derived from the canonical database path (shared across symlinks/junctions, including missing database leaves) and passed to `proper-lockfile`; not an authoritative application record.                                                                                                                                   |
| `<sentinel>.lock/`                            | Empty library-managed lock directory, heartbeat via filesystem modification time. Stale threshold 10000 ms, heartbeat 2000 ms, grace wait 2100 ms. Never put metadata inside it.                                          |
| `<dir>.azusa-owner.json`                      | Optional non-authoritative `pid` (process number), `processType` (`server`, `cli:migrate`, `cli:backup`, `cli:restore`), `acquiredAt` ISO instant. Best-effort write/removal; may remain stale after a crash.             |
| `<dbDir>/PG_VERSION`                          | PGlite/PostgreSQL cluster version text; existing values must contain a numeric version.                                                                                                                                   |
| `<dbDir>/.azusa-last-healthy.json`            | `verifiedAt` ISO instant and `appVersion`; written after successful migration/seed and during verified restore. Removed before migration; absence suppresses startup snapshot/pruning for an existing unverified cluster. |
| `<parent(dbDir)>/.azusa-promote-journal.json` | `activeDbDir`, `replacedDir`, `stagingDir` absolute paths; `startedAt` ISO instant. Describes recoverable active replacement; recovery validates paths and clusters before choosing the valid active/predecessor.         |
| `.restore-tmp-<uuid>/`                        | Staged restore beside target; verified before promotion, cleaned on handled failure.                                                                                                                                      |
| `db-replaced-<timestamp>-<uuid>/`             | Preserved predecessor after successful active replacement; no automatic retention.                                                                                                                                        |

## Backup manifest and directories

Backups live under `AZUSA_BACKUP_DIR` (default `.azusa/data/backups`). IDs start `backup-<UTC timestamp>`, optionally include a collision suffix, and end `-startup` or `-manual`. An incomplete copy uses `.tmp-<backupId>`; a completed directory contains the cluster and `manifest.json`. Incomplete/invalid entries do not appear as completed backup summaries.

| Manifest field | Type/unit                                                                                                         |
| -------------- | ----------------------------------------------------------------------------------------------------------------- |
| `backupId`     | Nonempty string matching directory ID                                                                             |
| `trigger`      | `startup` or `manual`                                                                                             |
| `createdAt`    | ISO datetime instant                                                                                              |
| `sourceDbDir`  | Nonempty canonical absolute source path                                                                           |
| `actor`        | Nonempty resolved audit actor                                                                                     |
| `pgVersion`    | Cluster version string, checked against copied `PG_VERSION` during restore                                        |
| `fileCount`    | Nonnegative integer; cluster files excluding `manifest.json`                                                      |
| `totalBytes`   | Nonnegative byte count, sum of file sizes                                                                         |
| `files[]`      | Per-file `relativePath` (forward-slash normalized), `sizeBytes` (nonnegative bytes), `sha256` (64 hex characters) |

Startup retention keeps ten newest completed **startup** snapshots; manual backups are separate. Health `backupCount` counts startup snapshots, while latest ID/time/trigger may identify a manual backup. With no completed backup, the trigger may report `skipped_cold_start` or `skipped_unverified`. Operational steps and cleanup policy are in the [runbook](../operations/database-and-recovery.md).
