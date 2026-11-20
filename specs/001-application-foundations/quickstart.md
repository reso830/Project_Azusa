# Quickstart: Application Foundation (F001)

**Feature**: `001-application-foundations`  
**Date**: 2026-11-20 (Regenerated against Feature Brief v0.2, Handoff v2, and Roadmap v0.2)  
**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Contracts**: [contracts/api.md](./contracts/api.md)

This guide walks through installing, running, backing up, restoring, and verifying the Azusa Application Foundation locally.

---

## 1. Prerequisites

- **Node.js**: v20.x LTS or newer (`node -v`)
- **npm**: v10.x or newer (`npm -v`)
- **External Services**: **None.** Azusa runs 100% locally on `127.0.0.1` using embedded PGlite (WASM Postgres) and locally bundled `@fontsource` typography.

### Optional Environment Overrides

No `.env` file is required for local development or testing. Defaults are used automatically:

| Variable | Default Value | Purpose |
|---|---|---|
| `AZUSA_DB_DIR` | `.azusa/data/db` | Local filesystem directory for persistent PGlite database |
| `AZUSA_BACKUP_DIR` | `.azusa/data/backups` | Local filesystem directory for automatic startup and manual CLI backups |
| `AZUSA_ACTOR_ID` | `local:sm` | Pre-authentication internal actor recorded in `created_by` / `updated_by` |
| `AZUSA_NEXT_DIST_DIR` | `.next` | Next.js build output directory (Playwright uses `.next-playwright` for isolation) |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disables Next.js external telemetry |

---

## 2. Install & Initialize

```powershell
# 1. Install npm dependencies
npm install

# 2. Install Playwright Chromium browser for visual & E2E smoke tests
npx playwright install chromium

# 3. Initialize / migrate the local PGlite database
npm run db:migrate

# 4. Start the local development server (bound to 127.0.0.1:3000)
npm run dev
```

Open `http://127.0.0.1:3000` in your browser.

---

## 3. Database Backup & Safe Restore Commands

> **Exclusive Ownership Rule**: Because PGlite is an embedded single-writer filesystem database protected across processes by `proper-lockfile` (`<parent(dir)>/<basename(dir)>.azusa-lock`, with a `> 2000ms` post-acquisition heartbeat wait on every lock holder), **stop the running Azusa server (`Ctrl+C`) before running `db:backup`, `db:migrate`, or `db:restore -- --force-overwrite-active`**. Running these CLI commands while the server holds the active database lock safely refuses with exit code `1`. Restoring into a disjoint sibling staging directory (e.g., `.azusa/data/restored-<timestamp>`) uses its own independent target sentinel and can safely run while the server is active.

```powershell
# 1. Stop the running Next.js server first (Ctrl+C in the server terminal)

# 2. Create a manual timestamped snapshot in .azusa/data/backups/
npm run db:backup

# 3. Restore the latest backup into a safe non-active target directory (.azusa/data/restored-<timestamp>)
npm run db:restore -- --from latest

# 4. Restore a specific backup into an explicit unpopulated staging path
npm run db:restore -- --from backup-20261120-153000-000-manual --to .azusa/data/verify-restore

# 5. Restart the local server when finished
npm run dev
```

> **Safety & Promotion Note (`AC08`)**:
> - Running `npm run db:restore -- --from latest --to .azusa/data/db` without `--force-overwrite-active` is rejected with exit code `1` so the active database is never silently replaced.
> - Targets that overlap the source backup, the backups root, or sit inside/around `.azusa/data/db`, as well as existing non-empty directories, are always rejected before any files are modified.
> - To promote a verified backup into the active database path (with the server stopped), run:
>   `npm run db:restore -- --from <backup-id> --to .azusa/data/db --force-overwrite-active`
>   This executes a journaled replacement (`db-replaced-<timestamp>` swap + post-move verification + automatic rollback on error, lock loss, or interrupted startup). The previous active database is **preserved intact as `db-replaced-<timestamp>`** for operator inspection and manual cleanup.

---

## 4. Quality Gates & Automated Verification

Run all verification suites from the repository root (Playwright suites automatically start an isolated server on `http://127.0.0.1:3100` with `reuseExistingServer: false`, `.next-playwright`, `.azusa/test-playwright/`, and a fixed clock/timezone so `.azusa/data/` and port `3000` are never affected):

```powershell
# ESLint static analysis
npm run lint

# Code formatting check
npm run format:check

# Strict TypeScript type checking
npm run typecheck

# Vitest unit & integration tests (ISO week, actor plumbing, PGlite restart durability, migrations, lock contention, lost-lock handling, backup/restore/promotion)
npm run test:run

# Production Next.js build check
npm run build

# Playwright Tier-1 visual-fidelity geometry, non-overlap & token checks (1440px, 1024px, 768px)
npm run test:visual

# Playwright E2E browser smoke & @axe-core/playwright accessibility tests (US1–US5 Independent Tests)
npm run test:e2e
```

---

## 5. Independent Test Walk-Through (Browser Smoke Test)

1. **US1 — Application Shell, Design System, 9-Destination Navigation & Profile Dropdown**:
   - Open `http://127.0.0.1:3000/`.
   - Confirm warm `#F4F1EC` background, top-right radial-masked `asanoha` lattice, locally loaded `Zen Kaku Gothic New`, `IBM Plex Sans`, and `IBM Plex Mono` fonts, `60px` Azusa logo button, no sample ART/Team/PI context breadcrumb, and `"SM"` profile button.
   - Click (or press `Enter`/`Space` on) the Azusa logo button to open the `290px` primary navigation dropdown (`PI`, `Capacity`, `Sprint`, `Insights` with `18px` Kumiko line icons; confirm `Settings` is **not** in this menu).
   - Navigate through all **9 primary routes** (`/`, `/program-board`, `/pi-brief`, `/calendar`, `/capacity`, `/backlog`, `/sprint-planning`, `/iteration`, `/dashboard`) via mouse and keyboard (`Tab`, `ArrowDown`/`ArrowUp`, `Enter`, `Escape`). Confirm each displays its route title, `asanoha` mark, Roadmap v0.2 badge (`M0`–`M4`, `F004`–`F019`), and non-operational placeholder notice.
   - Click the `"SM"` profile button; confirm the `250px` profile dropdown opens (closing any open logo menu), displays `"Scrum Master"` and `"No ART or team configured"` (no `local:sm` shown), and displays `Settings` as a disabled, non-navigating placeholder (`aria-disabled="true"`).
   - Click the `40px` search button; verify it expands to `280px` with autofocus and placeholder `"Search stories, features…"` (hiding the Today widget with `visibility: hidden` below `1100px`) and collapses on blur or `Escape` (restoring Today widget visibility).
2. **US2 — Viewer-Local Today Widget & Unconfigured Calendar State**:
   - On `/`, verify the centered Today widget displays `YYYY/MM/DD · CWww.d | No active PI · No active Sprint` on Line 1 and your local 24-hour clock `HHMMh ZONE` in `#C2650E` on Line 2.
3. **US3 — Local Persistence & Restart Durability**:
   - Click **"Record diagnostic check"** on the Foundation Status Card, note the UUIDv4 and `checkCount: 1`, stop the server (`Ctrl+C`), restart (`npm run dev`), reload `/`, and confirm the record survives intact.
4. **US4 — Automatic Backup-on-Start & Safe Restore**:
   - Confirm the Foundation Status Card reports `backupCount >= 1` and `lastBackupTrigger: "startup"` after restart.
   - While the server is running, confirm `npm run db:backup` safely refuses with exit code `1`.
   - Run `npm run db:restore -- --from latest` (targeting a sibling `.azusa/data/restored-<timestamp>` folder) while the server is running, confirming sibling restore succeeds without locking `.azusa/data/db` and recovers all records while `.azusa/data/db` remains untouched.
5. **US5 — Quality Gates & Documentation**:
   - Verify all 7 quality gate commands exit `0` and all required documentation files exist and are navigable from `README.md`.
