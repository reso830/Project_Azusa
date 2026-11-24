# API & Shell Contracts: Organization & PI Cadence (F002)

**Branch**: `002-organization-cadence` | **Date**: 2026-11-23 (Updated for Review Pass 2 — OD-1..OD-10 & R2-1..R2-4) | **Spec**: [spec.md](./spec.md)

All HTTP endpoints are local Next.js App Router Route Handlers (`127.0.0.1`), validate path params (UUIDv4), query params (`includeArchived` ∈ `{'true','false'}`, `year` ∈ `[1970, 2100]`, `asOf` ISO `YYYY-MM-DD`, UUIDv4 filters), and JSON bodies with strict Zod schemas (rejecting unknown keys and **never** accepting `createdBy`/`updatedBy`/`actor` from public request bodies), return `Cache-Control: no-store`, and format errors consistently:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | CONFLICT | NOT_FOUND | DB_UNAVAILABLE",
    "message": "Human-readable explanation",
    "details": []
  }
}
```

Status codes: `200 OK`, `201 Created`, `400 Bad Request` (`VALIDATION_ERROR`), `404 Not Found` (`NOT_FOUND`), `409 Conflict` (`CONFLICT` — duplicate name/code, overlap, containment violation, archived parent/Location/Team, cross-ART `teamId`, referenced delete, conflicting active absence), `503 Service Unavailable` (`DB_UNAVAILABLE` when `FoundationError` is cached).

---

## 1. Shell Context Endpoint (`OD-7`)

### `GET /api/organization/context`
Returns the active organizational hierarchy for the floating header context (`ART › Team › PI`), profile dropdown subtitle, and Today widget. Includes only `record_status = 'active'` ARTs that have **at least one active Team** (per `OD-7`, ARTs with zero active Teams do not appear in the header; their PIs remain managed on `/organization`):
```json
{
  "trains": [
    {
      "id": "uuid",
      "name": "Payments ART",
      "recordStatus": "active",
      "teams": [
        { "id": "uuid", "name": "Palawan", "sprintOffsetWorkdays": -1, "hoursPerDay": 8, "recordStatus": "active" }
      ],
      "pis": [
        {
          "id": "uuid",
          "name": "PI-2027.1",
          "startDate": "2027-01-04",
          "endDate": "2027-03-12",
          "lifecycleStatus": "planning",
          "recordStatus": "active",
          "iterations": [
            { "id": "uuid", "name": "2702", "kind": "development", "startDate": "2027-01-04", "endDate": "2027-01-15" }
          ]
        }
      ]
    }
  ]
}
```

---

## 2. ART (`Train`) Endpoints

- `GET /api/organization/trains?includeArchived=true|false` — Lists ARTs ordered by `name` with counts (`teamCount`, `piCount`).
- `POST /api/organization/trains` — Body: `{ name: string }` (strict, case-insensitively unique). Returns `201`.
- `PATCH /api/organization/trains/[id]` — Body: `{ name?: string, recordStatus?: 'active' | 'archived' }` (strict). Archiving does **not** archive child Teams/PIs. Returns `200`.
- `DELETE /api/organization/trains/[id]` — Hard-deletes only if `teamCount === 0 && piCount === 0`; otherwise `409 CONFLICT`.

---

## 3. Team Endpoints

- `GET /api/organization/teams?trainId=<uuid>&includeArchived=true|false` — Lists Teams with `memberCount` of active Members assigned as of server local `today`, `hoursPerDay`, `sprintOffsetWorkdays`, and `recordStatus`.
- `POST /api/organization/teams` — Body: `{ trainId: uuid, name: string, sprintOffsetWorkdays?: -1 | 0 | 1 }` (strict; `hoursPerDay` defaults to `8.0`). Rejects archived parent ART (`409`) or offset outside `{-1, 0, 1}` (`400`). Returns `201`.
- `PATCH /api/organization/teams/[id]` — Body: `{ name?: string, sprintOffsetWorkdays?: -1 | 0 | 1, recordStatus?: 'active' | 'archived' }` (strict). **`trainId` is immutable** after Team creation. Archiving does **not** archive child Members, and is **rejected (`409 CONFLICT`)** if the Team has any pending incoming moves (`member_team_assignments.start_date > today`, `OD-8`). Reactivating (`archived` → `active`) while parent ART is archived returns `409 CONFLICT`. Returns `200`.
- `DELETE /api/organization/teams/[id]` — Hard-deletes only if zero `member_team_assignments` rows (past, current, or pending) reference the Team (`OD-4`, `OD-8`); otherwise `409 CONFLICT`.

---

## 4. Member Endpoints (`OD-4`, `OD-8`, `OD-9`)

- `GET /api/organization/members?teamId=<uuid>&includeArchived=true|false&asOf=YYYY-MM-DD` — Lists Members resolved by date `asOf` (defaulting to server local `today`) from `member_team_assignments` (`start_date <= asOf AND (end_date IS NULL OR end_date >= asOf)`), including current `teamId`, optional `pendingMove` (`{ teamId, teamName, effectiveDate }`), Location summary, `contributesToDevCapacity: boolean`, and `recordStatus`.
- `POST /api/organization/members` — Body: `{ teamId: uuid, locationId: uuid, fullName: string, nickname?: string, initials: string, role: 'Admin' | 'RTE' | 'SM' | 'PO' | 'Team member', fteFactor?: number, avatarColor?: string }` (strict; `fteFactor` defaults to `1.0`, `0 < fteFactor <= 1.0`). Rejects archived parent Team (`409`) or archived Location (`409`). Opens initial `member_team_assignments` row starting on server local `today` (`end_date = null`) in the same transaction. Returns `201`.
- `PATCH /api/organization/members/[id]` — Body: partial strict update of `{ teamId?, effectiveDate?, locationId?, fullName?, nickname?, initials?, role?, fteFactor?, avatarColor?, recordStatus? }`:
  - Moving `teamId` (`OD-8`, `OD-9`, `OD-11`): `effectiveDate` (`YYYY-MM-DD`, defaults to server local `today`):
    - If `effectiveDate < today` → `400 VALIDATION_ERROR` (no backdating — past rosters cannot be rewritten).
    - If a pending move exists (`latestRow.start_date > today`) and `effectiveDate < latestRow.start_date` → `400 VALIDATION_ERROR` with a message instructing the operator to cancel the pending move first.
    - **Cancel-pending-move equivalence (checked BEFORE the active-destination-Team check)**: If a pending move exists (`latestRow.start_date > today`), `effectiveDate === latestRow.start_date`, and `teamId` equals the immediately preceding row's `team_id`, execute the exact same cancel-pending-move operation as `DELETE /api/organization/members/[id]/pending-move` (delete the pending row and reopen the preceding row with `end_date = null`). This succeeds **even if the preceding (original) Team has since been archived**, because the Member is already on that Team today.
    - Otherwise, destination Team must be `record_status = 'active'` (`409 CONFLICT` otherwise); cross-ART moves and moving an archived Member to an active Team are allowed:
      - If `effectiveDate === latestRow.start_date` (`OD-9` same-day or pending correction to another active Team) → updates `latestRow.team_id` in place. A correction of today's move back to the preceding active Team deletes today's row and reopens the preceding assignment.
      - If `effectiveDate > latestRow.start_date` → rejects (`409 CONFLICT`) if a pending row (`start_date > today`) already exists (at most one pending move per Member); otherwise closes `latestRow` with `end_date = effectiveDate - 1 day` and inserts a new open row (`start_date = effectiveDate, end_date = null`). Future-dated moves (`effectiveDate > today`) leave the Member's current Team unchanged until `effectiveDate`.
  - Changing `locationId`: destination Location must be `record_status = 'active'` (`409` otherwise).
  - Reactivating (`archived` → `active`): current Team (as of `today`) must be `record_status = 'active'` (`409` otherwise); a Member whose Location is archived **can** be reactivated and keeps their archived Location.
  - Returns `200`.
- `DELETE /api/organization/members/[id]/pending-move` (`OD-8`) — Cancels the Member's pending future move (`start_date > today`) inside a transaction: deletes the future row and reopens the immediately preceding row (`end_date = null`), succeeding even if the preceding (original) Team has since been archived (identical rule to `PATCH` redirecting a pending move back to the preceding Team). Returns `404 NOT_FOUND` if the Member has no pending move; `200` with updated Member DTO otherwise.
- `DELETE /api/organization/members/[id]` — Hard-deletes only if Member has zero `absences` (removing its own `member_team_assignments` rows inside the same transaction); otherwise `409 CONFLICT`.

---

## 5. PI & Iteration Endpoints (`F1`, `OD-1`, `F6`, `F7`)

### PIs
- `GET /api/organization/pis?trainId=<uuid>&includeArchived=true|false` — Lists PIs ordered by `start_date` with `lifecycleStatus`, `recordStatus`, and nested canonical `iterations[]`.
- `POST /api/organization/pis` — Body: `{ trainId: uuid, name: string, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }` (strict). Validates `startDate <= endDate`, active parent ART (`409`), and non-overlap with active PIs in the same ART (`409`). Sets `lifecycleStatus = 'planning'`, `recordStatus = 'active'`. Returns `201`.
- `PATCH /api/organization/pis/[id]` — Body: `{ name?: string, startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD', recordStatus?: 'active' | 'archived' }` (strict; `lifecycleStatus` is not editable in F002). Validates active parent ART on reactivation (`409`), active-PI non-overlap (`409`), and containment of all child Iterations within `[startDate, endDate]` (`409`). Returns `200`.
- `DELETE /api/organization/pis/[id]` — Hard-deletes only if `iterationCount === 0`; otherwise `409 CONFLICT`.

### Iterations (consistent `[id]` segment matching `pis/[id]` — `F1`)
- `GET /api/organization/pis/[id]/iterations?teamId=<uuid>` — Lists canonical Iterations ordered by `start_date`. Validates `[id]` is UUIDv4 (`400`) and PI exists (`404`). When `teamId` is provided: validates UUIDv4 (`400`), Team exists (`404`), and `team.trainId === pi.trainId` (`409 CONFLICT` on cross-ART Team), then includes derived `teamSchedule` (`scheduledStartDate`, `scheduledEndDate`, `offsetWorkdays`).
- `POST /api/organization/pis/[id]/iterations` — Body: `{ name: string, kind: 'development' | 'ip', startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }` (strict). Rejects Saturday/Sunday `startDate` or `endDate` (`400 VALIDATION_ERROR`, `OD-1`), rejects archived parent PI (`409`), rejects outside `[pi.startDate, pi.endDate]` (`409`), and rejects overlap with sibling Iterations (`409`). Returns `201`.
- `PATCH /api/organization/iterations/[id]` — Body: `{ name?: string, kind?: 'development' | 'ip', startDate?: 'YYYY-MM-DD', endDate?: 'YYYY-MM-DD' }` (strict). Re-validates weekday dates (`400`), containment (`409`), and non-overlap (`409`). Editing `name` never alters dates. Returns `200`.
- `DELETE /api/organization/iterations/[id]` — Hard-deletes the Iteration (`200`).

---

## 6. Location, Holiday & Absence Reference Endpoints (`OD-3`, `F3`, `F4`)

### Locations
- `GET /api/organization/locations?year=2027&includeArchived=true|false` — Lists shared Locations ordered by `code`, including `recordStatus`, `memberCount` (all associated Members, including archived), `holidayCount` (effective holidays for requested year or all seeded years), `lastRefreshedAt`, `seededYears`, and `librarySeedCutoffDate`.
- `POST /api/organization/locations` — Body: `{ code: string, name: string, countryCode: string, subdivisionCode?: string | null, timeZone: string, calendarSource: string }` (strict; case-insensitively unique `code`, valid ISO codes, supported holiday subdivision if supplied, valid IANA `timeZone`). Seeds `date-holidays` public/bank holidays across `getHolidaySeedYears(referenceYear)` (`[referenceYear - 1, referenceYear + 2] ∪ {2026, 2027, 2028}`) if supported, records `seededYears` and `lastRefreshedAt`. Returns `201`.
- `PATCH /api/organization/locations/[id]` — Body: partial strict update of `{ name?, countryCode?, subdivisionCode?, timeZone?, calendarSource?, recordStatus? }` (**`code` is immutable** after creation and omitted from `PATCH`, `R2-2`). If `countryCode` or `subdivisionCode` changes, rejects unsupported non-null subdivisions (`400`), then sets `librarySeedCutoffDate = today`, deletes future (`date >= today`) `library` holidays for this Location, re-seeds future `library` holidays for the new jurisdiction across `targetYears` (`date >= today`), sets `seededYears = targetYears`, preserves historical library rows and all `company`/`manual` overrides, and updates `lastRefreshedAt` (`F3`, `R2-1`). Returns `200`.
- `DELETE /api/organization/locations/[id]` — Hard-deletes only if zero Members and zero Holidays reference the Location; otherwise `409 CONFLICT`.

### Holidays (Read-only UI in F002; Service/Persistence Contract for F004/F005)
- `GET /api/organization/locations/[id]/holidays?year=2027` — Lists Holiday records for a Location ordered by `date`, exposing `date`, `name`, `portion`, `source`, `confirmed`, and `effective` flag (indicating when a `company`/`manual` override supersedes a `library` row on the same date).

### AbsenceTypes & Absences (Domain/Service/Persistence Contract for F004/F005)
- Exposed as typed application services (`src/application/organization/calendar-reference-service.ts`) and validated by strict Zod schemas (`src/domain/organization/schemas.ts`) for F004/F005 consumption and integration testing (no operational Absence CRUD UI in F002).
- Dated Absence records may be created for archived Members, subject to the same conflict checks.
- Manual Holiday creation accepts `company` and `manual` sources. The seeder writes `library` rows.

---

## 7. Shell & UI Contracts (`OD-2`, `OD-5`, `OD-6`, `OD-7`)

1. **Profile Dropdown (`src/ui/shell/ProfileMenu.tsx`)**:
   - Header identity (all routes including `/organization`): Title `"Scrum Master"`, Subtitle `"<Team Name> · <ART Name>"` (falling back to `"No ART or team configured"` when no active Team/ART is selected).
   - Item 1 (enabled link): **`Organization`** (`href="/organization"`, Kumiko `members` `18px` icon, `aria-current="page"` when on `/organization`).
   - Item 2 (disabled placeholder): **`Settings`** (`aria-disabled="true"`, `aria-describedby="settings-help"`, non-navigating, unchanged from F001).
2. **Primary Navigation Menu (`src/ui/shell/NavigationMenu.tsx`)**:
   - Unchanged 9 destinations across `PI`, `Capacity`, `Sprint`, `Insights`. On `/organization`, **no** primary navigation destination has `aria-current="page"`.
3. **Header on `/organization` (`OD-6`)**:
   - Matches `prototype/Settings.dc.html#L24-L38`: displays **only** logo menu, expandable search (with page-specific placeholder `"Search organization…"`), and profile menu. Omits `HeaderContextSelector` and `TodayWidget`.
4. **Header Context Breadcrumb on Primary Routes (`OD-7`)**:
   - Matches `prototype/Main.dc.html#L35-L39`: hidden when zero active Teams exist across active ARTs.
   - Renders plain-text `<ART>` linking to `/program-board`, `›`, **Team dropdown** listing active Teams grouped under ART headings (selecting a Team updates its ART and PI list), `›`, and **PI dropdown** listing that ART's active PIs. ARTs with zero active Teams do not appear in the header.
   - Persists `{ trainId, teamId, piId }` in `localStorage` (`azusa:active-context:v1`). A valid saved PI takes precedence. Without one, the header uses the viewer-local date to prefer the current PI, then the next upcoming PI, then the most recent past PI. An automatic fallback does not become a saved PI choice.
5. **Today Widget on Primary Routes (`OD-2`, `OD-5`)**:
   - Line 1: `YYYY/MM/DD · CWww.d | <piSprintText>` where `<piSprintText>` is computed in `src/domain/organization/cadence.ts`:
     - `"No active PI · No active Sprint"` when no PI is selected;
     - `"<PI Name> · Sprint <name>"` (omitting `Sprint ` when `<name>` already starts with `"Sprint"`, case-insensitive; no IP marker) when today's viewer-local date falls within a **Team-shifted** Sprint of the selected PI (including days just outside canonical PI bounds, with canonical-range safety-net tie-break);
     - `"<PI Name> · No active Sprint"` when today falls outside any **Team-shifted** Sprint of the selected PI.
   - Never implies formal PI/Sprint commitment. Line 2 retains the single viewer-local clock (`HHMMh ZONE` in `#A65307`).
