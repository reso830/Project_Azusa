# HTTP API Contract: Team Calendar & Availability (F005)

**Branch**: `005-team-calendar-availability` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)  
**Shared Conventions**: All routes under `src/app/api/calendar/` reuse `src/app/api/organization/http.ts` (`readQuery`, `readBody`, `organizationDb`, `organizationResponse`), return `Cache-Control: no-store`, validate inputs with strict Zod v4 schemas (rejecting unknown keys, duplicate query parameters, and actor fields), and return uniform error envelopes:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | DB_UNAVAILABLE | INTERNAL_ERROR",
    "message": "Human-readable explanation",
    "details": []
  }
}
```

---

## 1. `GET /api/calendar`

Returns the authoritative `TeamSprintCalendarView` for one Team, PI, and Iteration, computed by the extended F004 capacity engine.

### Query Parameters (strict)
- `teamId` (required, UUIDv4)
- `piId` (required, UUIDv4)
- `iterationId` (required, UUIDv4)

### Responses
- **`200 OK`**:
  ```json
  {
    "team": { "id": "uuid", "trainId": "uuid", "trainName": "Payments ART", "name": "Palawan", "hoursPerDay": 8, "sprintOffsetWorkdays": 0, "recordStatus": "active" },
    "pi": { "id": "uuid", "name": "PI-2027.1", "lifecycleStatus": "planning", "recordStatus": "active" },
    "iteration": {
      "iterationId": "uuid",
      "name": "2706",
      "kind": "development",
      "canonicalStartDate": "2027-02-01",
      "canonicalEndDate": "2027-02-12",
      "scheduledStartDate": "2027-02-01",
      "scheduledEndDate": "2027-02-12",
      "calendarStartDate": "2027-02-01",
      "calendarEndDate": "2027-02-14",
      "scheduledWeekdays": 10,
      "weeksCount": 2,
      "compact": false
    },
    "readOnly": false,
    "today": "2027-02-08",
    "commitments": {
      "pi": { "committed": false, "committedAt": null },
      "sprint": { "committed": false, "committedAt": null }
    },
    "absenceTypes": [
      { "id": "uuid", "code": "AL", "name": "Annual Leave", "color": "#C00000", "affectsCapacity": true }
    ],
    "days": [
      {
        "date": "2027-02-01",
        "dayOfWeek": "Mon",
        "isoWeek": "CW05",
        "isWeekend": false,
        "isToday": false,
        "isMonthBoundary": false,
        "hasCeremony": true,
        "hasMeeting": false,
        "milestones": [{ "id": "uuid", "name": "Release 27.2 code freeze" }],
        "ceremonies": [{ "id": "uuid", "name": "Sprint planning", "durationMinutes": 120 }]
      }
    ],
    "members": [
      {
        "memberId": "uuid",
        "fullName": "Hana Villanueva",
        "nickname": "Hana",
        "initials": "HV",
        "role": "Team member",
        "contributesToDevCapacity": true,
        "fteFactor": 0.5,
        "avatarColor": "#5F6F86",
        "recordStatus": "active",
        "location": { "id": "uuid", "code": "PH", "name": "Philippines", "timeZone": "Asia/Manila" },
        "dailyCells": [
          {
            "date": "2027-02-01",
            "assigned": true,
            "holiday": null,
            "absences": [],
            "overtime": null,
            "ceremonyMinutes": 135,
            "meetingMinutes": 0,
            "devMinutes": 105,
            "devHours": 1.75,
            "warnings": []
          }
        ],
        "sprintOverheadHours": 12,
        "sprintOverheadPostFteHours": 6,
        "sprintOvertimeMinutes": 0,
        "sprintDevHours": 29.5,
        "sprintDevDaysRaw": 3.6875,
        "warnings": [],
        "vsPiHours": null,
        "vsSprintHours": null,
        "isNewSincePiCommitment": false,
        "isNewSinceSprintCommitment": false
      }
    ],
    "teamDailyTotals": [{ "date": "2027-02-01", "devHours": 44.5 }],
    "teamSprintOverheadHours": 96,
    "teamSprintOverheadPostFteHours": 90,
    "teamSprintOvertimeMinutes": 120,
    "teamSprintDevHours": 420.5,
    "teamSprintDevDaysRaw": 52.5625,
    "teamHasClampedMember": false,
    "teamVsPiHours": null,
    "teamVsSprintHours": null,
    "holidays": [
      {
        "id": "uuid",
        "date": "2027-02-08",
        "name": "Chinese New Year (in lieu)",
        "locationId": "uuid",
        "locationCode": "SG",
        "portion": "full",
        "source": "library",
        "confirmed": true,
        "devDaysLost": 1.0
      }
    ],
    "milestones": [{ "id": "uuid", "teamId": "uuid", "date": "2027-02-10", "name": "Release 27.2 code freeze", "scope": "team" }],
    "ceremonies": [
      { "id": "uuid", "teamId": "uuid", "iterationId": "uuid", "isRecurringDaily": true, "date": null, "name": "Daily stand-up", "durationMinutes": 15 },
      { "id": "uuid", "teamId": "uuid", "iterationId": "uuid", "isRecurringDaily": false, "date": "2027-02-01", "name": "Sprint planning", "durationMinutes": 120 }
    ],
    "meetings": [
      {
        "id": "uuid",
        "teamId": "uuid",
        "date": "2027-02-02",
        "name": "ART sync",
        "durationMinutes": 30,
        "wholeTeam": false,
        "attendees": [{ "memberId": "uuid", "fullName": "Andrea Santos", "initials": "AS", "avatarColor": "#2F62C8" }]
      }
    ]
  }
  ```
- **Commitment comparisons (`vsPiHours`, `vsSprintHours`, `teamVsPiHours`, `teamVsSprintHours`)**: Computed strictly for the **selected Iteration `i`**:
  - When `pi.byIteration.has(i)`: `vsPiHours = liveSprintHours(m, i) − piCommittedSprintHours(m, i)`, and **`teamVsPiHours = teamSprintDevHours(i) − (Σ_{minutes ∈ pi.byIteration.get(i).values()} minutes / 60)`** (summing the **immutable snapshot's roster**, including Members who later transferred out or were archived; live-only Members not in the snapshot add only to `teamSprintDevHours(i)` and are flagged `isNewSincePiCommitment: true`). Identically for `vsSprintHours` and `teamVsSprintHours`.
  - When `!pi.byIteration.has(i)` (Iteration absent from the PI snapshot, e.g., added after PI commitment): `vsPiHours = null`, `teamVsPiHours = null`, and `isNewSincePiCommitment = false` for all Members (UI shows `—` with tooltip `"Sprint not in PI commitment"`, never `New`). Identically when `!sprint.byIteration.has(i)`. All are `null` until F012/F013 create immutable commitments.
- **Non-dev roles (`Admin`, `RTE`, `SM`, `PO`)**: Included in `members[]` with `contributesToDevCapacity: false`, `dailyCells[].devMinutes: null`, `dailyCells[].devHours: null`, `sprintDevHours: null`, `sprintDevDaysRaw: null`. They appear muted in `Dev hours` with **`—`** cells and contribute `0` to Team totals.
- **Holiday `devDaysLost`**: Computed by `engine.ts` as FTE-weighted `Σ m.fteFactor × effectivePortion` across eligible assigned `Team member`s in that Location on that weekday (including unconfirmed `est.` holidays; `0` on weekends; holiday takes precedence over overlapping absences per F004 so neither is double-counted). When multiple effective holidays share `(locationId, date)`, the date's effective loss (`1.0` if any `full`, else `0.5`) is attributed once to the primary row (`full` > `half`, then `company` > `manual` > `library`, then `name` asc, then `id` asc) and `0` to secondary rows so `Σ holidays[].devDaysLost === Σ over eligible Members m of (m.fteFactor × m.holidayDaysRaw)` (`R7`).
- **`400 VALIDATION_ERROR`**: Missing/invalid UUIDs or unknown/duplicate query params.
- **`404 NOT_FOUND`**: Unknown `teamId`, `piId`, or `iterationId`.
- **`409 CONFLICT`**: `team` and `pi` belong to different ARTs, or `iteration` does not belong to `pi`.

---

## 2. Absences (`POST /api/calendar/absences`, `PATCH /api/calendar/absences/[id]`)

*(Note: `absences` are Member-level records; API writes reject archived Members with `409 CONFLICT`, while archived Team/PI read-only mode is enforced in the `/calendar` UI when `readOnly === true`.)*

### `POST /api/calendar/absences`
Creates a dated absence (`status = 'active'`).
- **Request Body (strict)**: `{ "memberId": "uuid", "absenceTypeId": "uuid", "date": "YYYY-MM-DD", "portion": "full | am | pm", "planned": true, "note": "optional string | null" }`
- **Domain/Application Guards**:
  - `date` MUST be a Mon–Fri weekday (`400 VALIDATION_ERROR` on Sat/Sun).
  - `portion` (`full` | `am` | `pm`) and `AbsenceType.affects_capacity` govern deductions without hardcoding any `AbsenceType.code` (`D2`).
  - `memberId` MUST have a dated `member_team_assignments` row covering `date` (`409 CONFLICT` if unassigned on that date).
- **Responses**:
  - **`201 Created`**: `{ "absence": { ... }, "warnings": [] }` (includes `'overlaps_planned_overtime'` if an active full-day absence overlaps existing planned overtime on that date).
  - **`400 VALIDATION_ERROR`**: Missing/invalid ISO date (no floating leave), weekend date, invalid portion, unknown keys.
  - **`404 NOT_FOUND`**: Unknown `memberId` or `absenceTypeId`.
  - **`409 CONFLICT`**: Archived Member, unassigned Member on `date`, or overlapping active capacity-affecting absence on `(memberId, date)` (e.g., duplicate `am`, or `full` overlapping existing `am`/`pm`/`full`).

### `PATCH /api/calendar/absences/[id]`
Edits an absence's `date` (moves placeholder date), `absenceTypeId`, `portion`, `planned`, `note`, or explicitly cancels it (`status: "cancelled"`).
- **Guard matrix (`R5`)**:
  - **Active edit / date move / reactivate** (resulting `status === 'active'`): enforces active Member (`409`), Mon–Fri weekday (`400`), dated `member_team_assignments` covering target `date` (`409`), and non-overlapping active capacity-affecting absence (`409`).
  - **Cancel-only** (`{ status: 'cancelled', note? }` with zero `date`/`absenceTypeId`/`portion`/`planned` fields): enforces active Member (`409`) and **skips** the dated-assignment and overlap checks. On an **already-cancelled** absence, `{ status: 'cancelled' }` (no `note`) returns **`200 OK` as an idempotent no-op**, and `{ status: 'cancelled', note }` returns **`200 OK` updating `note` only**.
  - **Combined edit + cancel** (`status: 'cancelled'` alongside any `date`, `absenceTypeId`, `portion`, or `planned` field): **rejected with `400 VALIDATION_ERROR`** (`"Cancel an absence separately from changing its date, type, portion, or planned flag."`) so it cannot bypass edit guards.
  - **Other edits on an already-cancelled absence without reactivating** (`current.status === 'cancelled'` and `status` is neither `'active'` nor `'cancelled'`): **rejected with `409 CONFLICT`** (`"Cancelled absences cannot be edited; reactivate first or create a new absence."`).
- **Request Body (strict, at least one field)**: `{ "date"?, "absenceTypeId"?, "portion"?, "planned"?, "status"?: "active | cancelled", "note"? }`
- **Responses**:
  - **`200 OK`**: `{ "absence": { ... }, "warnings": [] }`
  - **`400` / `404` / `409`**: Same validation and conflict guarantees (cancelling never hard-deletes).

---

## 3. Planned Overtime (`PUT /api/calendar/overtime`, `DELETE /api/calendar/overtime`)

*(Note: `planned_overtime` is Member-level; API writes reject archived Members with `409 CONFLICT`, while archived Team/PI read-only mode is enforced in the `/calendar` UI. F002's `CreateAbsenceSchema` rejects non-null `extraHours` with `400 VALIDATION_ERROR` so this route is the sole overtime write path.)*

### `PUT /api/calendar/overtime`
Creates or updates planned overtime for `(memberId, date)` on any calendar date (weekday, weekend, or holiday) (`A3`).
- **Request Body (strict)**: `{ "memberId": "uuid", "date": "YYYY-MM-DD", "durationMinutes": 120, "note": "optional | null" }`
  - `durationMinutes`: integer in `[15, 1440]` with `durationMinutes % 15 === 0`.
- **Responses**:
  - **`200 OK`**: `{ "overtime": { "id", "memberId", "date", "durationMinutes", "note", "updatedAt" }, "warnings": Array<"overlaps_full_day_absence" | "outside_sprint_window"> }` (non-blocking advisory warnings when an active full-day absence exists on `(memberId, date)` and/or when `date` falls in a gap outside every active Team Iteration's contiguous calendar window `[calendarStartDate .. calendarEndDate]`).
  - **`400 VALIDATION_ERROR`**: Off-step (`% 15 !== 0`), `<= 0`, `> 1440`, invalid date, or unknown keys.
  - **`404 NOT_FOUND`**: Unknown `memberId`.
  - **`409 CONFLICT`**: Archived Member.

### `DELETE /api/calendar/overtime?memberId=<uuid>&date=<YYYY-MM-DD>`
Removes planned overtime for `(memberId, date)` (idempotent).
- **Responses**: **`200 OK`** `{ "deleted": true, "memberId", "date" }` | `400` | `404` | `409`.

---

## 4. Sprint Ceremonies (`POST /api/calendar/ceremonies`, `PATCH|DELETE /api/calendar/ceremonies/[id]`)

### `POST /api/calendar/ceremonies`
- **Request Body (strict)**:
  - Recurring Daily: `{ "teamId": "uuid", "iterationId": "uuid", "isRecurringDaily": true, "date": null, "name": "Daily stand-up", "durationMinutes": 15 }`
  - Dated ceremony: `{ "teamId": "uuid", "iterationId": "uuid", "isRecurringDaily": false, "date": "2027-02-01", "name": "Sprint planning", "durationMinutes": 120 }`
- **Responses**: **`201 Created`** `{ "ceremony": { ... } }` | `400` (off-step duration, invalid date, or `date` outside Team's scheduled Iteration weekdays) | `404` | `409` (archived ART/Team/PI, cross-ART mismatch, or duplicate Daily stand-up for `(teamId, iterationId)`).

### `PATCH /api/calendar/ceremonies/[id]` & `DELETE /api/calendar/ceremonies/[id]`
- `PATCH` updates `name`, `date` (for non-daily), or `durationMinutes` (`200 OK`).
- `DELETE` removes the ceremony (`200 OK` `{ "deleted": true, "id" }`).

---

## 5. Meetings (`POST /api/calendar/meetings`, `PATCH|DELETE /api/calendar/meetings/[id]`)

### `POST /api/calendar/meetings`
- **Request Body (strict)**: `{ "teamId": "uuid", "date": "2027-02-02", "name": "ART sync", "durationMinutes": 30, "wholeTeam": false, "attendeeMemberIds": ["uuid1", "uuid2"] }`
  - `date` MUST be a Mon–Fri weekday (`400 VALIDATION_ERROR` on Sat/Sun).
  - When `wholeTeam === true`, `attendeeMemberIds` must be omitted or `[]`.
  - When `wholeTeam === false`, `attendeeMemberIds` must contain ≥ 1 unique UUID assigned to `teamId` on `date`.
- **Responses**: **`201 Created`** `{ "meeting": { ... } }` | `400` | `404` | `409`.

### `PATCH /api/calendar/meetings/[id]` & `DELETE /api/calendar/meetings/[id]`
- `PATCH` updates `date`, `name`, `durationMinutes`, `wholeTeam`, and/or `attendeeMemberIds` atomically (`200 OK`).
- `DELETE` removes the meeting and cascades `meeting_attendees` (`200 OK`).

---

## 6. Milestones (`POST /api/calendar/milestones`, `PATCH|DELETE /api/calendar/milestones/[id]`)

### `POST /api/calendar/milestones`
- **Request Body (strict)**: `{ "teamId": "uuid", "date": "2027-02-10", "name": "Release 27.2 code freeze" }` (`scope` defaults to `'team'`).
- **Responses**: **`201 Created`** `{ "milestone": { "id", "teamId", "date", "name", "scope": "team", ... } }` | `400` | `404` | `409` (archived ART/Team).

### `PATCH /api/calendar/milestones/[id]` & `DELETE /api/calendar/milestones/[id]`
- `PATCH` updates `name` and/or `date` (`200 OK`).
- `DELETE` removes the milestone (`200 OK`).

---

## 7. Holiday Management (`GET|POST /api/calendar/holidays`, `PATCH|DELETE /api/calendar/holidays/[id]`, `POST /api/calendar/holidays/refresh`, `DELETE /api/calendar/holidays/suppressions/[id]`)

### `GET /api/calendar/holidays?year=2027`
Returns read-only active F002 Locations, effective annual holidays for the requested year (`year` integer `2000..2100`), and any suppressed library holidays for that year (`suppressions`) so operators can restore them.
- **Responses**: **`200 OK`** `{ "year": 2027, "locations": [...], "holidays": [...], "suppressions": [{ "id", "locationId", "librarySourceKey", "originalDate", "originalName" }], "totalCount": 68 }`.

### `POST /api/calendar/holidays`
Creates a `company` or `manual` holiday for an active Location.
- **Request Body (strict)**: `{ "locationId": "uuid", "date": "YYYY-MM-DD", "name": "Day after Thanksgiving", "portion": "full | half", "source": "company | manual", "confirmed": true }`
- **Responses**: **`201 Created`** `{ "holiday": { ... } }` | `400` | `404` | `409` (archived Location).

### `PATCH /api/calendar/holidays/[id]`
Edits a holiday (`A4`):
- If the target row has `source = 'company'` or `'manual'`, updates it in place.
- If the target row has `source = 'library'`:
  - If a `manual` override with `overrides_library_key = makeLibrarySourceKey(orig.date, orig.name)` already exists for that Location, returns **`409 CONFLICT`** (`"This public holiday already has a manual override; edit the manual override directly."`).
  - Otherwise, **creates a new `source = 'manual'` override** with `overrides_library_key = makeLibrarySourceKey(orig.date, orig.name)` without modifying the original library row.
- **Request Body (strict, at least one field)**: `{ "date"?, "name"?, "portion"?, "confirmed"? }`
- **Responses**: **`200 OK`** `{ "holiday": { ... }, "createdManualOverride": true | false }` | `400` | `404` | `409`.

### `DELETE /api/calendar/holidays/[id]` (optional query `?suppressLibrary=true`)
Removes a holiday (`A4`):
- If `source = 'company'`, deletes the row.
- If `source = 'manual'`:
  - If `overrides_library_key` is null, deletes the row.
  - If `overrides_library_key` is set and `suppressLibrary` is omitted/`false`, deletes the `manual` override — **reverting** to the underlying `library` holiday (`revertedToLibrary: true`).
  - If `overrides_library_key` is set and `suppressLibrary=true`, atomically deletes the `manual` override **and** inserts a `holiday_suppressions` row for `overrides_library_key` so the holiday is removed completely and stays suppressed across refreshes (`suppressedLibraryHoliday: true`).
- If `source = 'library'`, atomically deletes any existing `manual` override linked to `makeLibrarySourceKey(orig.date, orig.name)` and inserts a `holiday_suppressions` record so it is excluded immediately and never reappears on refresh (`suppressedLibraryHoliday: true`).
- **Responses**: **`200 OK`** `{ "deleted": true, "revertedToLibrary": true | false, "suppressedLibraryHoliday": true | false, "id": "uuid" }`.

### `DELETE /api/calendar/holidays/suppressions/[id]`
Restores (un-suppresses) a previously removed library holiday by deleting its `holiday_suppressions` row for an active Location and checking the stored `library` row directly (no regeneration step, since refresh retains suppressed library rows in storage) (`R8`):
- Stored `library` row exists and is effective after un-suppression → `libraryRowAvailable: true, effective: true, effectiveReason: null, warning: null`.
- Stored `library` row exists but is shadowed by a `company` or `manual` holiday on the same `(locationId, date)` (or a `manual` override) → `libraryRowAvailable: true, effective: false, effectiveReason: "overridden_by_company_or_manual", warning: null`.
- Stored `library` row no longer exists (e.g., after a Location's jurisdiction/calendar source changed) → stale suppression row is still deleted cleanly as a no-op with an advisory warning (`libraryRowAvailable: false, effective: false, effectiveReason: "library_row_missing", warning: "library_holiday_no_longer_generated"`), preserving all other overrides and suppressions.
- **Responses**: **`200 OK`** `{ "restored": true, "id": "uuid", "locationId": "uuid", "librarySourceKey": "2027-03-10|hari raya puasa", "libraryRowAvailable": true | false, "effective": true | false, "effectiveReason": null | "overridden_by_company_or_manual" | "library_row_missing", "warning": null | "library_holiday_no_longer_generated" }` | `400` | `404` | `409` (archived Location).

### `POST /api/calendar/holidays/refresh`
Refreshes `library`-sourced holidays offline via `date-holidays` for `{ "year": 2027, "locationId"?: "uuid" }`. Replaces only `source = 'library'` rows (retaining suppressed library rows in storage so `DELETE /holidays/suppressions/[id]` can restore them cleanly after any refresh, while `resolveEffectiveLocationHolidays` continues excluding them from effective reads), and preserves all `company`, `manual`, and `holiday_suppressions` rows untouched (`A4`).
- **Responses**: **`200 OK`** `{ "year": 2027, "refreshedLocationIds": [...], "insertedLibraryCount": 12, "preservedOverrideCount": 3, "suppressedActiveCount": 1 }`.
