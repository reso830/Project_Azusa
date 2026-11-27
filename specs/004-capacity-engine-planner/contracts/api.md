# HTTP API Contract: Capacity Engine & Capacity Planner (F004)

**Branch**: `004-capacity-engine-planner` | **Date**: 2026-11-26 (Review Pass 2 — R5/R6/R7/R8/m12/m13) | **Spec**: [spec.md](./spec.md)  
**Shared Conventions**: All routes under `src/app/api/capacity/` reuse `src/app/api/organization/http.ts` (`readQuery`, `readBody`, `organizationDb`, `organizationResponse`), return `Cache-Control: no-store`, validate inputs with strict Zod v4 schemas (rejecting unknown keys, duplicate query parameters, and actor fields), and return uniform error envelopes:

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

## 1. `GET /api/capacity`

Computes and returns the authoritative `TeamPiCapacityView` for a Team and PI.

### Query Parameters (strict)
- `teamId` (required, UUIDv4)
- `piId` (required, UUIDv4)

### Responses
- **`200 OK`**:
  ```json
  {
    "team": {
      "id": "uuid",
      "trainId": "uuid",
      "trainName": "Payments ART",
      "trainRecordStatus": "active",
      "name": "Palawan",
      "hoursPerDay": 8,
      "sprintOffsetWorkdays": 0,
      "deductionMode": "fixed_days",
      "seedNormalizedVelocity": 0.92,
      "recordStatus": "active"
    },
    "pi": {
      "id": "uuid",
      "trainId": "uuid",
      "name": "PI-2027.1",
      "startDate": "2027-01-04",
      "endDate": "2027-03-12",
      "lifecycleStatus": "planning",
      "recordStatus": "active"
    },
    "readOnly": false,
    "velocity": {
      "value": 0.92,
      "source": "manual_seed",
      "sprintCountUsed": 0,
      "totalCompletedSp": null,
      "totalActualDevDays": null,
      "piOverrideValue": null,
      "seedValue": 0.92
    },
    "kpi": {
      "plannedSp": null,
      "plannedSpStatus": "not_yet_available",
      "piDevDaysRaw": 291.25,
      "piDevDaysDisplay": 291.3,
      "piDevHours": 2330,
      "piForecastSpRaw": 267.95,
      "piForecastSpDisplay": 268,
      "eligibleFte": 7.5,
      "eligibleMemberCount": 8,
      "totalAssignedMemberCount": 10,
      "excludedMemberCount": 2
    },
    "iterations": [
      {
        "iterationId": "uuid",
        "name": "2702",
        "kind": "development",
        "canonicalStartDate": "2027-01-04",
        "canonicalEndDate": "2027-01-15",
        "scheduledStartDate": "2027-01-04",
        "scheduledEndDate": "2027-01-15",
        "scheduledWeekdays": 10,
        "offsetWorkdays": 0,
        "isCurrent": false,
        "eligibleFte": 7.5,
        "holidayLocations": [],
        "teamDevDaysRaw": 60.75,
        "teamDevDaysDisplay": 60.8,
        "teamDevHours": 486,
        "teamAvailableDaysRaw": 77,
        "teamAbsenceDaysRaw": 3,
        "overheadByCategory": [
          { "categoryId": "uuid", "hours": 64, "daysRaw": 8 }
        ],
        "forecastSpRaw": 55.89,
        "forecastSpDisplay": 56,
        "plannedSp": null,
        "load": null
      }
    ],
    "overheadCategories": [
      {
        "categoryId": "uuid",
        "name": "General work",
        "shortLabel": "General work",
        "color": "#A39C93",
        "sortOrder": 0,
        "recordStatus": "active",
        "piTotalHours": 320,
        "piTotalDaysRaw": 40,
        "byIteration": [
          {
            "iterationId": "uuid",
            "hours": 64,
            "daysRaw": 8
          }
        ]
      }
    ],
    "allocation": {
      "artConfigStatus": "valid",
      "artDefaultTotalPct": 100,
      "artDefaultsValid": true,
      "effectiveTotalPct": 100,
      "isValid": true,
      "hasDriftWarning": false,
      "rows": [
        {
          "categoryId": "uuid",
          "name": "Feature development",
          "shortLabel": "Feature dev.",
          "color": "#2E8B57",
          "semanticRole": "feature",
          "sortOrder": 0,
          "artDefaultPct": 49,
          "overridePct": 56,
          "effectivePct": 56,
          "source": "override",
          "piBudgetSpRaw": 150.052,
          "piBudgetSpDisplay": 149,
          "piPlannedSp": null,
          "byIteration": [
            {
              "iterationId": "uuid",
              "budgetSpRaw": 31.2984,
              "budgetSpDisplay": 31,
              "plannedSp": null,
              "load": null
            }
          ]
        }
      ]
    },
    "members": [
      {
        "memberId": "uuid",
        "fullName": "Andrea Santos",
        "nickname": "Andrea",
        "initials": "AS",
        "role": "Team member",
        "fteFactor": 1,
        "avatarColor": "#2F62C8",
        "recordStatus": "active",
        "location": { "id": "uuid", "code": "PH", "name": "Philippines", "timeZone": "Asia/Manila" },
        "piDevDaysRaw": 38.5,
        "piDevHours": 308,
        "piWorkingDaysRaw": 49,
        "piHolidayDaysRaw": 1,
        "piAbsenceDaysRaw": 3,
        "piOverheadDaysRaw": 7.5,
        "cells": [
          {
            "iterationId": "uuid",
            "assignedWeekdays": 10,
            "workingDaysRaw": 10,
            "holidayDaysRaw": 0,
            "absenceDaysRaw": 0,
            "availableDaysRaw": 10,
            "overheadDaysRaw": 1.5,
            "devDaysRaw": 8.5,
            "devMinutes": 4080,
            "devHours": 68,
            "hasEstimatedHoliday": false,
            "hasOverDeductedWarning": false,
            "holidays": [],
            "absences": [],
            "overheadDeductions": [
              {
                "categoryId": "uuid",
                "deductedHours": 8,
                "daysRaw": 1,
                "source": "pi_plan"
              }
            ]
          }
        ]
      }
    ],
    "excludedMembers": [
      {
        "memberId": "uuid",
        "fullName": "Maya Santos",
        "initials": "MS",
        "role": "SM",
        "locationCode": "PH",
        "exclusionReason": "role",
        "excludedIterationIds": ["uuid"]
      }
    ]
  }
  ```
  - `readOnly` is `true` whenever `team.trainRecordStatus === 'archived' || team.recordStatus === 'archived' || pi.recordStatus === 'archived'` (`m7`).
  - `kpi.eligibleFte` is the scheduled-weekday-weighted average eligible FTE across PI Iterations (`Σ (fteFactor × assignedWeekdaysInPi) / totalPiScheduledWeekdays`, or sum of currently assigned eligible FTE when `iterations.length === 0`) (`m8`).
  - `excludedMembers[].excludedIterationIds` lists the assigned Iterations where the Member was excluded for the reported reason. A partly counted archived Member appears in both `members` and `excludedMembers`. `kpi.excludedMemberCount` counts Members with no eligible Iteration, or currently assigned ineligible Members when there are no Iterations.
  - Per-Iteration load uses `forecastSpDisplay` for the Team and `budgetSpDisplay` for a category. The percentage and band use that same denominator. Load is `null` when planned SP or the displayed denominator is unavailable.
  - `overheadByCategory` and `overheadCategories` report sums of **stored pre-FTE deductions** (`R8`, e.g., `2702` GW = `64h` / `8` days).
- **`400 VALIDATION_ERROR`**: Invalid/missing UUID or unknown/duplicate query param.
- **`404 NOT_FOUND`**: Unknown `teamId` or `piId`.
- **`409 CONFLICT`**: `team` and `pi` belong to different ARTs.
- **`503 DB_UNAVAILABLE`**: Database unavailable.

---

## 2. `PATCH /api/capacity/team-settings`

Updates Team-level capacity configuration (`deductionMode`, `hoursPerDay`, and/or `seedNormalizedVelocity`). When `hoursPerDay` changes, stored `overhead_deductions.deducted_hours` remain fixed (`R6`), and derived day values / dev days / Forecast SP update on subsequent reads.

### Request Body (strict JSON, at least one editable field required)
```json
{
  "teamId": "uuid",
  "deductionMode": "fixed_days",
  "hoursPerDay": 8,
  "seedNormalizedVelocity": 0.92
}
```
- `deductionMode`: optional `'fixed_days' | 'percent'`
- `hoursPerDay`: optional finite number in `[1.0, 24.0]` with `Number.isInteger(hoursPerDay * 2)` (`0.5`-hour step, `M2`)
- `seedNormalizedVelocity`: optional finite number in `[0, 1000]` or `null` (clears manual seed)

### Responses
- **`200 OK`**: `{ "team": { "id", "trainId", "name", "hoursPerDay", "sprintOffsetWorkdays", "deductionMode", "seedNormalizedVelocity", "recordStatus", "updatedAt" } }`
- **`400 VALIDATION_ERROR`**: No fields supplied, out-of-range or off-step `hoursPerDay` (e.g., `0.001`, `7.25`, `25`), out-of-range `seedNormalizedVelocity`, `NaN`/non-numeric, or unknown keys.
- **`404 NOT_FOUND`**: Unknown `teamId`.
- **`409 CONFLICT`**: Team or parent ART is `archived`.
- **`503 DB_UNAVAILABLE`**: Database unavailable.

---

## 3. `PUT /api/capacity/velocity-override`

Sets or updates the Team-specific PI velocity override (`team_pi_velocity_overrides`).

### Request Body (strict JSON)
```json
{
  "teamId": "uuid",
  "piId": "uuid",
  "velocity": 1.05
}
```
- `velocity`: finite number in `[0, 1000]`

### Responses
- **`200 OK`**: `{ "override": { "id", "teamId", "piId", "velocity", "updatedAt" } }`
- **`400 VALIDATION_ERROR`**: Invalid UUIDs, negative/`> 1000`/non-finite `velocity`, or unknown keys.
- **`404 NOT_FOUND`**: Unknown `teamId` or `piId`.
- **`409 CONFLICT`**: Cross-ART mismatch, or ART/Team/PI is `archived`.
- **`503 DB_UNAVAILABLE`**: Database unavailable.

---

## 4. `DELETE /api/capacity/velocity-override`

Clears the Team-specific PI velocity override so resolution falls back to rolling NV / Team seed.

### Query Parameters (strict)
- `teamId` (required, UUIDv4)
- `piId` (required, UUIDv4)

### Responses
- **`200 OK`**: `{ "cleared": true, "teamId": "uuid", "piId": "uuid" }` (idempotent if no override existed)
- **`400 VALIDATION_ERROR`**: Invalid/missing query params.
- **`404 NOT_FOUND`**: Unknown `teamId` or `piId`.
- **`409 CONFLICT`**: Cross-ART mismatch, or ART/Team/PI is `archived`.
- **`503 DB_UNAVAILABLE`**: Database unavailable.

---

## 5. `POST /api/capacity/overhead-deductions/bulk`

Bulk-applies Team-scoped PI Planning `OverheadDeduction` rows (`source = 'pi_plan'`) across **all Iterations of the selected PI** for all active eligible `Team member`s assigned to `teamId` during each Iteration (`R2`, `R5`, `R6`, `m6`). Categories not listed in `entries`, other Teams' rows, and `sprint_adjusted` rows are left untouched. Response counts report only rows applied or cleared.

### Request Body (strict JSON)
```json
{
  "teamId": "uuid",
  "piId": "uuid",
  "mode": "fixed_days",
  "entries": [
    { "categoryId": "uuid", "value": 1.0 },
    { "categoryId": "uuid", "value": 0.5 }
  ]
}
```
- `mode`: `'fixed_days' | 'percent'` — **must match** the Team's persisted `deduction_mode` (`409 CONFLICT` otherwise, `m6`).
- `entries`: non-empty array of unique `{ categoryId: uuid, value: number }`:
  - In `fixed_days` mode: `0 <= value <= 31` (full-Sprint days; prorated per Member × Team × Iteration by `assignedWeekdays / sprintScheduledWeekdays`, converted to `value * hoursPerDay * ratio`, and snapped independently per Team to nearest `0.25h` with halves rounded up, `R2`, `R6`).
  - In `percent` mode: `0 <= value <= 100` (one-off `%` of that Member's assigned available hours on `teamId`, snapped to nearest `0.25h` with halves rounded up, `m5`, `R6`).
- **Pre-write `744h` cap check (atomic)**: Because F002 permits Iterations of arbitrary duration, `percent` bulk apply computes all Member × Iteration snapped `deductedHours` **before writing any row**. If any computed value exceeds `744h` (e.g., 32 available weekdays × `24h/day` × `100%` = `768h`), the entire request is rejected atomically with `400 VALIDATION_ERROR`, returning `{ memberId, memberName, iterationId, iterationName, categoryId, computedHours, maxHours: 744 }` in `error.details`, writing **zero rows** and leaving all existing `overhead_deductions` untouched.

### Responses
- **`200 OK`**: `{ "appliedCount": 80, "clearedCount": 0, "teamId": "uuid", "piId": "uuid", "mode": "fixed_days" }`
- **`400 VALIDATION_ERROR`**: Empty `entries`, duplicate `categoryId`, negative `value`, `value > 31` in `fixed_days`, `value > 100` in `percent`, any computed `percent` deduction `> 744h` (naming the Member and Iteration in `details`), or unknown keys (zero rows written; existing deductions untouched).
- **`404 NOT_FOUND`**: Unknown `teamId`, `piId`, or `categoryId`.
- **`409 CONFLICT`**: `mode !== team.deductionMode`, cross-ART mismatch, archived ART/Team/PI, non-`overhead` category, or `archived` category (zero rows written).
- **`503 DB_UNAVAILABLE`**: Database unavailable.

---

## 6. `PUT /api/capacity/overhead-deductions`

Upserts (or clears when `deductedHours === 0`) a single Team-scoped `(memberId, teamId, iterationId, categoryId)` `OverheadDeduction` row with `source = 'pi_plan'` (`R2`, `R5`, `R6`). A cell with a `sprint_adjusted` row returns `409 CONFLICT` on either operation. Other Teams' rows are outside the mutation scope.

### Request Body (strict JSON)
```json
{
  "teamId": "uuid",
  "memberId": "uuid",
  "iterationId": "uuid",
  "categoryId": "uuid",
  "deductedHours": 4
}
```
- `deductedHours`: finite number in `[0, 744]` with `Number.isInteger(deductedHours * 4)` (`0.25h` step, `R6`; `0` deletes any existing `pi_plan` row for sparse storage)

### Responses
- **`200 OK`**: `{ "deduction": { "memberId", "teamId", "iterationId", "categoryId", "deductedHours": 4, "source": "pi_plan" } }` (or `deductedHours: 0, source: null` when cleared)
- **`400 VALIDATION_ERROR`**: Off-step (e.g., `0.1`), negative, or `> 744` `deductedHours`, invalid UUIDs, or unknown keys.
- **`404 NOT_FOUND`**: Unknown `teamId`, `memberId`, `iterationId`, or `categoryId`.
- **`409 CONFLICT`**: Archived ART/Team/PI/Member, Iteration not in Team's ART, Category not active `overhead` in Team's ART, Member not `Team member`, or Member not assigned to `teamId` during that Iteration's scheduled window (`R2`).
- **`503 DB_UNAVAILABLE`**: Database unavailable.
