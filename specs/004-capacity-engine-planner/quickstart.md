# Quickstart & Manual Verification Guide: Capacity Engine & Capacity Planner (F004)

**Branch**: `004-capacity-engine-planner` | **Date**: 2026-11-26 (Review Pass 4 — atomic cross-ART header sync via `setSelection`, clamped breakdown formula throughout, invalid deep-link fallback; Review Pass 2 — R5/R6/R7/R8/m13)

---

## 1. Prerequisites

- Node.js 22.12+ (or 24.x / 26.x)
- Clean dependencies installed (`npm ci` / `npm install`)
- Ensure no stray local server is running on port `3000` or `3100` before running Playwright suites.

---

## 2. Database Migration & Automated Verification

Run the full quality gate sequence from the repository root:

```powershell
npm run db:migrate
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run build
npm run test:visual
npm run test:e2e
```

### Targeted F004 Test Suites (fast loop during development)

```powershell
npx vitest run tests/unit/capacity-golden.test.ts tests/unit/capacity-engine.test.ts
npx vitest run tests/integration/capacity-migration-backup.test.ts tests/integration/capacity-persistence.test.ts tests/integration/capacity-routes.test.ts
npx playwright test tests/visual/capacity-planner.spec.ts tests/e2e/capacity-planner.spec.ts
```

### CLI Backup & Restore Verification

```powershell
npm run db:backup
npm run db:restore -- --from <backupPath> --to .azusa/test-restore-f004
```

Verify the restored cluster contains all F001–F004 tables (`overhead_deductions` with `team_id` & `deducted_hours`, `team_pi_velocity_overrides`, updated `teams`) and `APP_VERSION = '0.4.0'`.

---

## 3. Manual Browser Walkthrough (`/capacity`)

1. Start the local server (`npm run dev` on `http://127.0.0.1:3000`).
2. In `/organization`:
   - Create an ART (`Payments ART`), Team (`Palawan`), PI (`PI-2027.1` with 2–5 Iterations), and Members across multiple Locations (e.g., `PH`, `SG`) including at least one `Team member` at `1.0` FTE, one `Team member` at `0.5` FTE, and one `SM` or `PO`.
   - Open the `Categories & Allocation` tab and click **Apply sample catalog** (`5` development categories totalling `100%` + `General work` and `Training` overhead categories).
3. Open the navigation menu (logo button) → **Capacity** → **Capacity planner** (`/capacity`).
4. Verify the **v2 prototype layout** at `1440px`:
   - Floating header shows `Payments ART › Palawan ⌄ › PI-2027.1 ⌄`.
   - Title row shows **Capacity planner**, **Deduction mode** toggle (`Fixed days` / `% of available`), **Hours per day** input (`8`, step `0.5`), and **Team calendar** link (`/calendar`).
   - Five KPI tiles render with exact `R7` labels: dark **Planned SP** (`—` / `Not yet available`), **Development capacity**, **Normalized velocity** (initially `Unset`), **Forecast SP**, and **Team FTE** (excluding `SM`/`PO`/`Admin`/`RTE`).
5. **Velocity & Forecast**:
   - Set Team seed NV to `0.92`, reload, and verify `Manual seed` badge, per-Sprint Forecast SP, PI Forecast SP (sum of displayed Sprint forecasts), and pinned integer largest-remainder Category Budgets in **Team allocation** (`Total 100% ✓`).
   - Set a Team PI velocity override (e.g., `1.05`), verify `PI override` badge and updated forecasts, then clear the override and confirm fallback to `0.92`.
6. **Team-Scoped Overhead Deductions & Fixed-Hour `Hours per day` Behavior**:
   - In `Fixed days` mode, bulk-apply `1.0` day `General work` and `0.5` day `Training` across the PI; verify **Deducted first** totals, pre-FTE expanded cells (`Days 10 | Leaves 0 | GW 1 | Tr 0.5 | Dev 4.25` for a `0.5` FTE member) and pre-FTE footer overhead totals (`R8`), and reload persistence.
   - Expand a Sprint column, adjust one Member's `General work` deduction to `0.5` day (and verify typing `0.1` day snaps to `0.75h` / displays `0.09` day), reload, and verify only that `(member, team, iteration, category)` row updated (with no "Adjusted" corner triangle per `R4`).
   - Change **Hours per day** from `8` to `7.5`, reload, and verify stored `deducted_hours` remained fixed (`8h` GW stays `8h`) and derived day values / dev days / Forecast SP updated predictably (`R6`).
   - Switch to `% of available` mode and bulk-apply `10%` `General work` and `5%` `Training`; verify updated `0.25h`-snapped `deducted_hours` persist.
7. **Calculation Transparency, URL-Only Archived Read-Only View & Navigation**:
   - Inspect a Member × Sprint calculation breakdown popover and confirm scheduled Sprint dates, working days, named holidays (including `est.` for unconfirmed holidays), active absences, stored overhead deductions in hours & days, explicit `max(0, Days − Leaves − deductions) × FTE = Dev` step (with `→ clamped to 0` alongside `'over_deducted'` when over-deducted, `R8`), and resulting dev days/hours are displayed clearly.
   - Open `/capacity?teamId=<archivedTeamId>&piId=<piId>` (URL-only archived view per `m13`) and confirm URL precedence, read-only banner (`"Return to active selection"` clears URL params), disabled mutations, and changing the header selector clears URL params.
   - Open `/capacity?teamId=<unknownUuid>&piId=<piId>` and confirm the header keeps its selection, the URL params are cleared, and the `"Link could not be opened — showing current selection"` notice appears.
   - Click the `/calendar` link and `/organization` link to confirm clean navigation.
8. **Invalid Allocation Guard**:
   - In `/organization`, archive one development category with `default_pct > 0` so the effective total ≠ `100%`; return to `/capacity` and verify the explicit invalid/drift warning banner replaces `Total 100% ✓`.
9. Stop the local dev server (`Ctrl+C`) before running Playwright suites.
