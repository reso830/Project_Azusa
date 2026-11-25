# API & UI Contracts: Work Categories & Allocation (F003)

**Branch**: `003-work-categories-allocation` | **Date**: 2026-11-24 (Updated for Review Pass 2 — error precedence order, `semanticRole: null` guard, reorder alignment) | **Spec**: [spec.md](./spec.md)

All HTTP endpoints are local Next.js App Router Route Handlers (`127.0.0.1`) reusing `src/app/api/organization/http.ts`. Every endpoint validates path UUIDs, query parameters, and strict JSON bodies via Zod v4 (rejecting unknown keys and **never** accepting `createdBy`/`updatedBy`/`actor`), returns `Cache-Control: no-store`, and uses the uniform error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | CONFLICT | NOT_FOUND | DB_UNAVAILABLE",
    "message": "Human-readable explanation",
    "details": []
  }
}
```

### Exact Status Code Mapping

| Status | Code | Exact Conditions |
|---|---|---|
| `200` / `201` | — | Success (`201` on `POST /api/categories` and `POST /api/categories/sample`; `200` on all other operations). |
| `400` | `VALIDATION_ERROR` | Malformed UUIDs, unknown JSON keys, actor-field injection, invalid query param values, non-integer / `< 0` / `> 100` percentages, non-null `defaultPct`/`semanticRole` on `overhead`, duplicate IDs in array payloads, missing active development categories in `PUT /api/categories/defaults` or `PUT /api/categories/allocations`, incomplete `orderedIds` in `POST /api/categories/reorder`, or active sum `!== 100`. |
| `404` | `NOT_FOUND` | Nonexistent `trainId`, `teamId`, `piId`, path category `[id]`, or any unknown `categoryId` in `reorder`, `defaults`, or `allocations` payloads. |
| `409` | `CONFLICT` | Duplicate ART-scoped `name`, second active `maintenance_bugs` category in ART, applying sample catalog to non-empty ART, archived parent ART/Team/PI on write, cross-ART mismatch (`team.trainId !== pi.trainId` or `category.trainId !== trainId`), targeting an `overhead` or `archived` category in `defaults`/`allocations` (or wrong `kind`/archived category in `reorder`), changing `kind` on a referenced category, or hard-deleting a referenced category/ART/Team/PI. |
| `503` | `DB_UNAVAILABLE` | Cached `FoundationError` from PGlite startup/lock failure. |

### Deterministic Error Precedence Order

When a request violates multiple rules simultaneously, handlers and services evaluate checks in this exact order so responses are deterministic:
1. **`400 VALIDATION_ERROR` (schema & shape)**: path UUIDs, query params, strict JSON body keys, actor-field rejection, integer `0..100` bounds, and duplicate IDs inside array payloads.
2. **`404 NOT_FOUND` (entity existence)**: parent entity (`trainId`, `teamId`, `piId`, path category `[id]`) and **every referenced `categoryId`** in `orderedIds` / `allocations` / `overrides` must exist in the database.
3. **`409 CONFLICT` (domain state & ownership)**: active parent ART/Team/PI, same-ART ownership (`team.trainId === pi.trainId`, `category.trainId === trainId`), valid target `kind`/`record_status` (`development` + `active` for defaults/allocations; matching `kind` + `active` for reorder), name/bugs uniqueness, and unreferenced guards.
4. **`400 VALIDATION_ERROR` (completeness, role-for-kind & arithmetic)**: full-set coverage of all active categories (no missing active IDs), non-null `semanticRole` required when resulting `kind === 'development'`, and exact integer `sum === 100`.

---

## 1. ART Work Category Endpoints

### `GET /api/categories?trainId=<uuid>&includeArchived=true|false`
Lists categories for an ART ordered by `kind ASC, sort_order ASC, name ASC`, along with ART default configuration status and every invalid active Team × active **current/future PI** (`pi.end_date >= today`, per `D-1`) split in that ART:
```json
{
  "trainId": "uuid",
  "categories": [
    {
      "id": "uuid",
      "trainId": "uuid",
      "name": "Feature development",
      "shortLabel": "Feature dev.",
      "color": "#2E8B57",
      "kind": "development",
      "semanticRole": "feature",
      "defaultPct": 49,
      "sortOrder": 0,
      "recordStatus": "active",
      "isReferenced": false
    }
  ],
  "totalCategoryCount": 7,
  "artConfigStatus": "valid",
  "activeDevelopmentTotalPct": 100,
  "artDefaultsValid": true,
  "driftedAllocations": [
    {
      "teamId": "uuid",
      "teamName": "Palawan",
      "piId": "uuid",
      "piName": "PI-2027.1",
      "piEndDate": "2027-03-12",
      "effectiveTotalPct": 104
    }
  ]
}
```
- `artConfigStatus`: `'not_configured'` when `0` active `development` categories exist; `'valid'` when `activeDevelopmentTotalPct === 100`; `'invalid'` otherwise.
- `driftedAllocations`: empty when `artConfigStatus === 'not_configured'`; otherwise lists **every** active Team × active PI with `pi.end_date >= today` whose resolved active development total `!== 100` (whether partially overridden, fully inheriting an invalid ART total, or fully overridden). Past PIs (`pi.end_date < today`) are excluded (`D-1`).
- `400` if `trainId` is missing/malformed or `includeArchived` is not `'true' | 'false'`.
- `404` if ART does not exist.

### `POST /api/categories`
Creates a category under an active ART.
- **Body (strict)** — `defaultPct` is **not** accepted on creation (percentages change only via `PUT /api/categories/defaults` or `POST /api/categories/sample`):
  - For `kind: 'development'`: `{ trainId: uuid, name: string, shortLabel: string, color: '#RRGGBB', kind: 'development', semanticRole: 'feature' | 'maintenance_bugs' | 'standard' }` → always initializes `default_pct = 0`.
  - For `kind: 'overhead'`: `{ trainId: uuid, name: string, shortLabel: string, color: '#RRGGBB', kind: 'overhead', semanticRole?: null }` → initializes `semantic_role = null`, `default_pct = null` (non-null `semanticRole` or any `defaultPct` key rejected with `400`).
- **Validation**: `404` if ART missing; `409` if ART is archived, trimmed `name` duplicates another category in the ART (case-insensitive), or `semanticRole === 'maintenance_bugs'` when an active `maintenance_bugs` category already exists in the ART. Assigns `sortOrder = max(sort_order for train_id & kind) + 1` (or `0` if first in that `kind` group).
- **Returns**: `201 Created` with created Category DTO.

### `PATCH /api/categories/[id]`
Updates a category's metadata, `kind` (unreferenced only), `semanticRole` (editable in F003 per `D-4`), or `recordStatus`.
- **Body (strict, partial)**: `{ name?: string, shortLabel?: string, color?: '#RRGGBB', kind?: 'development' | 'overhead', semanticRole?: 'feature' | 'maintenance_bugs' | 'standard' | null, recordStatus?: 'active' | 'archived' }`.
  - `trainId` is immutable (rejected as unknown key with `400`); `defaultPct` is edited only via `PUT /api/categories/defaults` (rejected as unknown key with `400`).
- **Rules**:
  - `404` if category does not exist; `409` if parent ART is archived.
  - Changing `kind`: `409` if category is referenced by any `team_category_allocations` row. When unreferenced: switching `development → overhead` clears `default_pct = null` and `semantic_role = null` (succeeds regardless of prior `default_pct`, flagging any resulting non-100% ART total per `D-2`) and appends `sort_order` to the `overhead` group; switching `overhead → development` requires a valid `semanticRole` (`400` if omitted/null), sets `default_pct = 0`, and appends `sort_order` to the `development` group.
  - Changing `semanticRole`: `400 VALIDATION_ERROR` if submitting a non-null `semanticRole` for an `overhead` category **or** submitting `semanticRole: null` for a `development` category (unless the same request switches `kind` to `'overhead'`, preventing a PostgreSQL `23514` check violation → `500`); `409 CONFLICT` if creating a second active `maintenance_bugs` category in the ART. Allowed in F003 even when `team_category_allocations` exist (`D-4`).
  - Archiving (`active → archived`): succeeds regardless of `default_pct` (`D-2`), preserving `default_pct` and any historical `team_category_allocations` rows without redistributing percentages; any resulting non-100% ART or current/future Team/PI total is flagged.
  - Reactivating (`archived → active`): `409` if parent ART is archived or if reactivating would create a second active `maintenance_bugs` category in the ART; **never** rejected solely because of total (`D-2`) — any kept overrides on this category re-enter active resolution and any resulting non-100% ART or current/future Team/PI total is flagged.
- **Returns**: `200 OK` with updated Category DTO.

### `DELETE /api/categories/[id]`
Hard-deletes an unreferenced category regardless of its `default_pct` (`D-2`).
- `404` if category does not exist; `409` if parent ART is archived or if any `team_category_allocations` row references the category.
- **Returns**: `200 OK` `{ deleted: true, id }`.

### `POST /api/categories/reorder`
Updates `sort_order` across all **active** categories of one `kind` group (`development` or `overhead`) within an active ART, placing archived categories of that `kind` after them at `sort_order >= orderedIds.length` in their existing relative order and leaving the other `kind` group untouched.
- **Body (strict)**: `{ trainId: uuid, kind: 'development' | 'overhead', orderedIds: uuid[] }` (`orderedIds` MUST be non-empty; submitting `orderedIds: []` — even when the group has zero active categories — is rejected with `400 VALIDATION_ERROR`).
- **Validation**:
  - `400` if `orderedIds` is empty (`[]`), contains duplicates, or omits any active category of `(trainId, kind)`.
  - `404` if ART does not exist or any ID in `orderedIds` does not exist in `categories`.
  - `409` if ART is archived, or any ID belongs to a different ART, has a different `kind`, or is `archived`.
- Assigns `sort_order = 0, 1, ..., orderedIds.length - 1` to `orderedIds` and preserves any archived categories of `(trainId, kind)` at `sort_order >= orderedIds.length` in their existing relative order.
- **Returns**: `200 OK` with updated `GET /api/categories` payload.

### `POST /api/categories/sample`
Applies the Payments ART 7-category starter template (`Feature development` / `Feature dev.` per `D-3`, etc.) to an empty active ART.
- **Body (strict)**: `{ trainId: uuid }`.
- `404` if ART missing; `409` if ART is archived or already has `>= 1` category (active or archived).
- **Returns**: `201 Created` with the `GET /api/categories` response shape.

---

## 2. ART Default Allocation Endpoint

### `PUT /api/categories/defaults`
Atomically saves integer default percentages across all active `development` categories of an active ART.
- **Body (strict)**:
  ```json
  {
    "trainId": "uuid",
    "allocations": [
      { "categoryId": "uuid", "defaultPct": 49 },
      { "categoryId": "uuid", "defaultPct": 20 }
    ]
  }
  ```
- **Validation**:
  - `404` if ART missing or any `categoryId` does not exist in `categories`.
  - `409` if ART is archived, or any `categoryId` belongs to another ART, has `kind = 'overhead'`, or is `archived`.
  - `400` if `allocations` has duplicate `categoryId`s, omits any active `development` category of the ART, has non-integer / out-of-range `defaultPct`, or has exact integer sum `!== 100` (returning `details: [{ currentTotal, requiredTotal: 100 }]` with zero mutations).
- **Returns**: `200 OK` with updated `GET /api/categories` payload including `driftedAllocations[]` for all invalid active Team × active current/future PI (`pi.end_date >= today`) splits.

---

## 3. Team PI Allocation Endpoints

### `GET /api/categories/allocations?teamId=<uuid>&piId=<uuid>`
Returns the resolved `TeamPiAllocationView` (snapshot-ready contract for F004 & F012):
```json
{
  "trainId": "uuid",
  "teamId": "uuid",
  "piId": "uuid",
  "piEndDate": "2027-03-12",
  "isCurrentOrFuturePi": true,
  "items": [
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
      "source": "override"
    }
  ],
  "artConfigStatus": "valid",
  "artDefaultTotalPct": 100,
  "artDefaultsValid": true,
  "effectiveTotalPct": 100,
  "isValid": true,
  "hasDriftWarning": false
}
```
- `400` on malformed UUIDs; `404` if Team or PI missing; `409` if `team.trainId !== pi.trainId`.
- Allowed read-only for archived ARTs, archived Teams, and archived PIs.

### `PUT /api/categories/allocations`
Atomically saves Team PI overrides for `(teamId, piId)`. Requires **every** active `development` category of the ART in `overrides[]` so the `100%` check always validates the exact state persisted.
- **Body (strict)**:
  ```json
  {
    "teamId": "uuid",
    "piId": "uuid",
    "overrides": [
      { "categoryId": "uuid", "overridePct": 56 },
      { "categoryId": "uuid", "overridePct": null },
      { "categoryId": "uuid", "overridePct": 0 }
    ]
  }
  ```
- **Validation**:
  - `404` if Team, PI, or any `categoryId` does not exist.
  - `409` if parent ART, Team, or PI is archived, `team.trainId !== pi.trainId`, or any `categoryId` belongs to another ART, has `kind = 'overhead'`, or is `archived`.
  - `400` if `overrides` has duplicate `categoryId`s, omits any active `development` category of the ART (partial submission rejected), has non-integer / out-of-range `overridePct`, or if exact resolved `Σ (overridePct ?? artDefaultPct) !== 100` (returning `details: [{ currentTotal, requiredTotal: 100 }]` with zero mutations).
- **Returns**: `200 OK` with updated `TeamPiAllocationView`.

### `DELETE /api/categories/allocations?teamId=<uuid>&piId=<uuid>`
Clears all Team overrides for **active** development categories of `(teamId, piId)` so every active development category reverts to `Inherit`, **preserving** any historical override rows on archived categories.
- **Validation**: `400` on malformed UUIDs; `404` if Team or PI missing; `409` if parent ART, Team, or PI is archived or `team.trainId !== pi.trainId`.
- **Behavior when ART defaults are invalid (`D-2`)**: Allowed; returns `200 OK` with the resulting `TeamPiAllocationView` (`isValid: false`, `hasDriftWarning: true` for current/future PIs) so the invalid split is visibly flagged.

---

## 4. UI Contract (`/organization` → `Categories & Allocation`)

- Mounted as the 4th underline tab in `OrganizationWorkspace.tsx` (`id="org-tab-categories"`, label `"Categories & Allocation"`).
- Profile-menu `Settings` remains disabled (`aria-disabled="true"`); `/organization` header remains unchanged from F002 (`prototype/Settings.dc.html#L24-L38` — no `TodayWidget`, no `ART › Team › PI`).
- **ART Work Categories section**:
  - Displays `"Not configured"` when `0` active development categories exist (offering `"Apply sample catalog"` only when `totalCategoryCount === 0`), `"100% ✓"` when valid, or `"NN% — must total 100%"` when invalid.
  - Groups active **Development** and **Overhead** categories separately with within-group up/down reorder buttons (archived categories revealed behind `"Show archived"` do not interfere with active reordering).
  - Surfaces an advisory banner listing any `driftedAllocations[]` (current/future PIs only).
- **Team PI Allocation section**:
  - The PI picker defaults to the current PI, using the same rule as the header context (`pickCurrentPi`: the first active PI by start date whose `end_date >= today`, otherwise the latest active PI).
  - Includes an optional `"Show archived Teams/PIs"` toggle (off by default); selecting an archived Team or PI renders the allocation table **read-only** with an `"Archived — read-only"` badge and disabled inputs/Save/Reset buttons.
  - When the ART has `0` active development categories, shows a clear `"Not configured"` empty state with Save/Reset disabled.
  - When ART defaults are currently invalid (`!== 100%`), shows a clear banner explaining the ART total is `NN%`, lets the operator either override to a valid `100%` Team split or click `"Reset all to ART defaults"` (which flags the resulting invalid split).
  - Every active development category row displays: colour swatch + full name, ART default (`NN%`, `IBM Plex Mono` tabular numerals), override input (`""` = `Inherit`, `"0"` = explicit `0%`, `"1"`–`"100"` = explicit override), explicit text badge **`Inherit`** or **`Override`** (never color alone), per-row **"Reset"** button when overridden, and resolved Effective `%`.
