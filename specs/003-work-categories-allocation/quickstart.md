# Quickstart & Verification Guide: Work Categories & Allocation (F003)

**Branch**: `003-work-categories-allocation` | **Date**: 2026-11-24 (Updated for Review Pass 1) | **Spec**: [spec.md](./spec.md)

---

## 1. Local Setup & Migration

```powershell
# Apply migrations (including 0002_work_categories_allocation.sql)
npm run db:migrate

# Start local dev server (127.0.0.1:3000)
npm run dev
```

## 2. Manual Walkthrough (Matches US1–US4)

1. Open `http://127.0.0.1:3000/organization`. Confirm header shows logo, `"Search organization…"` search, and profile menu only (no `TodayWidget`, no `ART › Team › PI`, and `Settings` remains disabled in the profile menu).
2. On **ARTs & PI Cadence**, create `Payments ART` (with a past PI ending before today, e.g., `PI-2025.1`, a current/future PI ending on/after today, e.g., `PI-2027.1`, and a second future PI, e.g., `PI-2027.2` — adjusting years relative to the UAT date if run after early 2027) and `Core Platform ART`. On **Teams & Members**, create `Palawan` and `Cebu` under `Payments ART`.
3. Switch to the **`Categories & Allocation`** tab:
   - Select `Payments ART` → verify catalog starts empty (`"Not configured"`) → click **"Apply sample catalog"** → confirm 5 development (`49 / 20 / 14 / 10 / 7 = 100% ✓`, with `Feature dev.` short label) and 2 overhead (`General work`, `Training`) categories appear and survive page reload.
   - Rename `SW maintenance (bugs)` to `Bugs & Support` and confirm its `maintenance_bugs` role is preserved; verify a second active `maintenance_bugs` category is rejected.
   - Reorder two categories within the Development group and reload to confirm persistence; archive a category with `default_pct > 0` (`D-2`), confirm ART total is flagged without redistribution, reactivate it and confirm `100% ✓` restores; create and hard-delete an unreferenced category and confirm persistence across reload.
   - Edit `Feature development` default to `44%` (total `95%`) → attempt save → verify clear validation error and zero silent normalization.
   - Select `Palawan` + `PI-2027.1` → override to `56 / 15 / Inherit(14) / 8 / Inherit(7) = 100% ✓` → save and reload.
   - Override `Technical debt` to explicit **`0%`** (`63 / 15 / 14 / 8 / 0 = 100%`) → save, reload, confirm `0%` stays **`Override`** (never reverting to `7%`) → clear back to **`Inherit`** and restore `56 / 15 / 14 / 8 / 7`.
   - Switch to `Palawan` + `PI-2027.2` and `Cebu` + `PI-2027.1` → confirm both remain unaffected (`49 / 20 / 14 / 10 / 7`, all `Inherit`).
   - Change `Payments ART` defaults to `45 / 20 / 18 / 10 / 7 = 100%` → confirm save succeeds, `Palawan` / `PI-2027.1` is flagged with a drift warning (`104%`, invalid until adjusted), and past `PI-2025.1` (`end_date < today`) is **not** flagged (`D-1`).

## 3. Automated Verification & CLI Backup/Restore Commands

```powershell
# Static checks
npm run lint
npm run format:check
npm run typecheck

# Unit + real PGlite integration & route tests
npm run test:run

# Production build & browser suites (run sequentially; shared port 3100)
npm run build
npm run test:visual
npm run test:e2e

# Stop the dev server (`npm run dev`) first so db:backup can acquire exclusive database access.
# CLI backup & restore into a separate destination directory (verifying restored F003 values & appVersion 0.3.0)
# Note: the target folder (.azusa/restore-verify) must be absent or empty before running db:restore.
$backup = npm run db:backup --silent | ConvertFrom-Json
npm run db:restore -- --from $backup.backupPath --to .azusa/restore-verify
# (Alternative: npm run db:restore -- --from latest --to .azusa/restore-verify)
# Inspect .azusa/restore-verify/.azusa-last-healthy.json (appVersion === "0.3.0") and clean up .azusa/restore-verify
```
