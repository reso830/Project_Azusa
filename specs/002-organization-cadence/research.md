# Technical Research: Organization & PI Cadence (F002)

**Branch**: `002-organization-cadence` | **Date**: 2026-11-23 (Updated for Review Pass 2 — OD-1..OD-10 & R2-1..R2-4) | **Spec**: [spec.md](./spec.md)

---

## R1 — `date-holidays` Integration, Identity, Cutoff, Unconfirmed Rule & Jurisdiction Edits (`F3`, `F4`, `F5`, `F9`, `R2-1`, `R2-2`)

- **Decision**: Add `date-holidays` (npm, ISC licence) as a runtime dependency, add `'date-holidays'` to `serverExternalPackages` in `next.config.ts`, and run an idempotent reference-data seeder (`src/persistence/seed.ts`) inside `runMigrations()`.
- **Mapping of the 6 Initial Locations**:
  - `PH`: `new Holidays('PH')` → `Asia/Manila`
  - `SG`: `new Holidays('SG')` → `Asia/Singapore`
  - `AU-WA`: `new Holidays('AU', 'WA')` → `Australia/Perth`
  - `IN`: `new Holidays('IN', 'KA')` → `Asia/Kolkata` — verify `IN`/`KA` support in pinned `date-holidays` during `T006`; if `new Holidays('IN', 'KA')` yields empty/unsupported state, fall back cleanly to country-level `new Holidays('IN')`, change the seeded `IN` `calendar_source` label to `"Public holidays, IN"`, and document the result in ADR `0002` and `data-dictionary.md`.
  - `UK`: `new Holidays('GB', 'ENG')` → `Europe/London`
  - `US-TX`: `new Holidays('US', 'TX')` → `America/Chicago` *(calendar source labeled `"Federal holidays, US · TX"`; company-declared days are managed in F005, not seeded in F002).*
- **Location Code Immutability (`R2-2`)**:
  - `locations.code` is immutable after creation (omitted from Location `PATCH`) so startup seeding by case-insensitive `code` can never create duplicate rows for edited seeded Locations.
- **Explicit "Already Seeded" Definition, Cutoff Date & `last_refreshed_at` (`F4`, `R2-1`)**:
  - Each `locations` row stores `seeded_years` (`jsonb` sorted `number[]`, default `'[]'`) and `library_seed_cutoff_date` (`text` ISO `YYYY-MM-DD`, nullable).
  - Pure helper `getHolidaySeedYears(referenceYear: number): number[]` returns sorted unique years covering `[referenceYear - 1, referenceYear + 2] ∪ {2026, 2027, 2028}`. Used identically by startup seeding (`seedReferenceData`) and Location creation (`POST /api/organization/locations`).
  - **Already-seeded rule**: A year `Y` is considered already seeded for a Location iff `Y` is present in `locations.seeded_years` (recorded even when `date-holidays` returns zero holidays for that jurisdiction/year; a later library upgrade will not retroactively fill or refresh estimated dates automatically, which is acceptable because public-calendar refresh belongs to `F005`). On startup or year-rollover, compute `missingYears = targetYears.filter(y => !location.seededYears.includes(y))`. If `missingYears.length === 0`, skip seeding and do **not** update `last_refreshed_at`. If `missingYears.length > 0`, seed only `missingYears`, filtering out any holiday with `date < location.library_seed_cutoff_date` (when cutoff is set), merge `missingYears` into `seeded_years`, and update `last_refreshed_at`.
  - **Jurisdiction edit (`country_code` or `subdivision_code` changed on Location `PATCH`)**: Set `library_seed_cutoff_date = today` (server local date, injectable per `R2-3`), delete `source = 'library'` rows with `date >= today`, re-seed `targetYears` filtering `date >= today`, set `seeded_years = targetYears`, and update `last_refreshed_at`. Historical library rows (`date < today`) and all `company`/`manual` rows remain intact (`OD-3`), and future restarts/year-rollovers never insert library rows before `library_seed_cutoff_date`.
- **Holiday Identity & Override Semantics (`F3`)**:
  - **Library seed identity**: Partial unique index `holidays_library_identity_unique` on `(location_id, date, name) WHERE source = 'library'`.
  - **Override precedence**: When resolving effective holidays for a Location (`resolveEffectiveLocationHolidays`), any `company` or `manual` row on `(location_id, date)` **supersedes (replaces)** `library` row(s) on that same `(location_id, date)` without deleting the underlying `library` row. Cancelling a library holiday as a company working day is deferred to F005.
- **Concrete "Unconfirmed" Holiday Rule (`F5`)**:
  - Pure domain helper `isEstimatedHolidayRule(rule?: string): boolean` in `src/domain/organization/holidays.ts` returns `true` (`confirmed = false`) iff the `date-holidays` `rule` expression uses an Islamic/Hijri moon-sighting calendar (matching `/\bhijri\b|\bislamic\b|\b(?:muharram|safar|rabi|jumada|rajab|shaban|ramadan|shawwal|dhu al-qadah|dhu al-hijjah)\b/i`).
  - Computable solar, Gregorian, Easter, and Chinese lunisolar holidays (including SG `Chinese New Year` and `Chinese New Year (in lieu)`) evaluate to `confirmed = true`, matching Handoff §10.

---

## R2 — Timezone-Independent Calendar Dates & Weekday-Only Sprint Boundaries (`OD-1`, `OD-2`, `F2`)

- **Decision**: Store all calendar dates (`PI.start_date`, `PI.end_date`, `Iteration.start_date`, `Iteration.end_date`, `Holiday.date`, `Absence.date`, `MemberTeamAssignment.start_date`, `MemberTeamAssignment.end_date`) as ISO-8601 `YYYY-MM-DD` strings.
- **Weekday-Only Sprint Boundaries (`OD-1`)**:
  - Iteration `start_date` and `end_date` MUST both fall Monday–Friday (`isWeekday(isoDate)`). Saturday or Sunday is rejected with `400 VALIDATION_ERROR` in both domain validation and API.
  - Because Iterations in a PI (and active PIs in an ART) cannot overlap or touch and every Sprint boundary is a weekday, a ±1 Mon–Fri weekday shift strictly preserves chronological order and guarantees **no two shifted Sprints of one Team can ever share a day** (including across consecutive PIs in the same ART).
- **Weekday Offset Math (`Q2`, `OD-1`)**:
  - `shiftWorkdays(isoDate: string, offsetWorkdays: -1 | 0 | 1): string` in `src/domain/organization/cadence.ts`:
    - `0` → unchanged.
    - `-1` → Mon shifts to previous Fri; Tue–Fri shift back 1 day.
    - `+1` → Fri shifts to next Mon; Mon–Thu shift forward 1 day.
- **Today Widget Match & Label (`OD-2`, `OD-5`)**:
  - `resolveTodayCadenceStatus(todayIsoDate, selectedPi, teamSchedules)` matches `todayIsoDate` against each `TeamIterationSchedule`'s `[scheduledStartDate, scheduledEndDate]` — including days just outside the PI's canonical bounds (e.g., `-1` Team on the Friday before canonical PI start, `+1` Team on the Monday after canonical PI end).
  - Safety-net tie-break (only if crafted invalid data produces two shifted Sprints containing `todayIsoDate`): prefer the Sprint whose canonical `[canonicalStartDate, canonicalEndDate]` contains `todayIsoDate` (then earliest `canonicalStartDate`).
  - Label format (`OD-5`): `<PI> · Sprint <name>`, omitting `Sprint ` if `/^sprint\b/i.test(name)` (e.g., `2706` → `Sprint 2706`; `Sprint 5` → `Sprint 5`; no IP marker).

---

## R3 — Distinct Archive Flag (`record_status`), Date-Resolved Team Membership (`OD-8`, `OD-9`), Injectable `today` (`R2-3`) & Capacity-Only Absence Conflicts (`OD-10`)

- **Server Local "Today" (`R2-3`)**:
  - Define `"today"` for server-side domain/service operations as the **server's local calendar date** (`YYYY-MM-DD`, via `getServerTodayIsoDate(now?: Date)`).
  - Every service operation that depends on today (Member create/move/cancel-pending/list, Team archive guard, Location create/jurisdiction cutoff, reference seeding) accepts an optional `today?: string` (`YYYY-MM-DD`) parameter defaulting to server local today so tests are 100% deterministic.
- **Archive Flag Separation (`F6`)**:
  - Use `record_status` (`'active' | 'archived'`, default `'active'`) consistently on `trains`, `teams`, `members`, `pis`, and `locations`.
  - Keep `pis.lifecycle_status` (`'planning' | 'in_progress' | 'closed'`, default `'planning'`) as a separate column reserved for F012.
  - Reactivating any child (`Team`, `PI`, `Member`) whose parent is archived is rejected with `409 CONFLICT` (for a Member, checks the Member's current Team on `today`; a Member whose Location is archived **can** be reactivated and keeps their archived Location).
  - Archiving a Team that has pending incoming moves (`member_team_assignments.start_date > today`) is rejected with `409 CONFLICT` (`OD-8`).
- **Date-Resolved Member Team Membership (`OD-8`, `OD-9`)**:
  - `member_team_assignments` is the **sole source of truth** (`members.team_id` is removed). A Member's Team on date `D` (default `today`) is the row with `start_date <= D AND (end_date IS NULL OR end_date >= D)`.
  - At most one pending row (`start_date > today`) per Member. The latest row always has `end_date IS NULL` (enforced by partial unique index `WHERE end_date IS NULL`).
  - On move with `effectiveDate` (default `today`):
    - **No backdating (`OD-11`)**: If `effectiveDate < today` → reject with `400 VALIDATION_ERROR` (preventing retroactive edits to past rosters, matching Non-Goal 9).
    - If `latestRow.start_date > today` (a pending move exists) and `effectiveDate < latestRow.start_date` → reject with `400 VALIDATION_ERROR` stating that the existing pending move must be cancelled first.
    - **Unified cancel-pending-move check (before active-destination-Team check)**: If `latestRow.start_date > today`, `effectiveDate === latestRow.start_date`, and destination `teamId` equals the immediately preceding row's `team_id`, execute the exact same cancel-pending-move path as `DELETE /pending-move` (delete pending row and reopen preceding row with `end_date = NULL`), succeeding even if the original Team has since been archived.
    - Otherwise, destination Team must be active (`409`):
      - If `effectiveDate === latestRow.start_date` (`OD-9` same-day or pending correction to another active Team) → update `latestRow.team_id` in place.
      - If `effectiveDate > latestRow.start_date` → if `latestRow.start_date > today` (a pending move already exists), reject with `409 CONFLICT` (at most one pending move); otherwise close `latestRow` with `end_date = effectiveDate - 1 day` and insert a new open row (`start_date = effectiveDate, end_date = NULL`).
  - **Cancel pending move (`OD-8`)**: Deletes the future row (`start_date > today`) and reopens the immediately preceding row (`end_date = NULL`) atomically.
  - F004 MUST use date-aware membership lookups from `member_team_assignments` (recorded in ADR `0002` as required, no longer deferred).
- **Capacity-Only Absence Conflicts (`OD-10`)**:
  - Active Absence conflicts (`full` vs any other; duplicate `am`/`pm`) apply **only** among Absences whose `AbsenceType.affects_capacity = true` (`AL`, `SL`, `HD`). Attendance-only types (`WFH`, `ON_SITE`, `BT`) never conflict.
- **Case-Insensitive Uniqueness**:
  - Enforce case-insensitive uniqueness via expression unique indexes on `lower(trim(name))` / `lower(trim(code))` for `trains.name`, `(teams.train_id, teams.name)`, `(pis.train_id, pis.name)`, `(iterations.pi_id, iterations.name)`, `locations.code`, and `absence_types.code`.

---

## R4 — Active Header Context, Faithful `Main.dc.html` Breadcrumb & `/organization` Header (`OD-6`, `OD-7`, `F12`, `F13`)

- **App Metadata Isolation & Synchronized `APP_VERSION` (`F10`)**:
  - Keep `app_metadata` strictly infrastructure-owned (`foundation.init`, `diagnostic.last_check`). `foundation.init.schemaVersion` intentionally stays `'0000_foundation_init'` (initial seed label; acceptable after `0001_organization_cadence.sql`, as `drizzle.__drizzle_migrations` is authoritative for applied migrations).
  - Export a single `APP_VERSION = '0.2.0'` constant (`src/persistence/version.ts`) shared by `src/persistence/migrate.ts` and `src/persistence/backup.ts` so both migrations and restores write the synchronized version to `.azusa-last-healthy.json`.
  - Persist active `{ trainId, teamId, piId }` in `localStorage` (`azusa:active-context:v1`) via `OrganizationContextProvider`, reconciled against `GET /api/organization/context`.
- **Header Behavior (`OD-6`, `OD-7`)**:
  - On `/organization`: `FloatingHeader` omits `HeaderContextSelector` and `TodayWidget`, showing only logo, search (`"Search organization…"`), and profile (`prototype/Settings.dc.html#L24-L38`), while `ProfileMenu` still displays the current `Team · ART` subtitle.
  - On the 9 primary routes: `HeaderContextSelector` renders plain-text `<ART>` linking to `/program-board` (`prototype/Main.dc.html#L36`), a Team dropdown grouped under ART headings, and a PI dropdown for that ART; ARTs with zero active Teams do not appear in the header (omitting the entire breadcrumb when zero active Teams exist, preserving F001 empty-state fidelity).
