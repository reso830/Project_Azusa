# Quickstart & Verification Guide: Team Calendar & Availability (F005)

**Branch**: `005-team-calendar-availability` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

---

## 1. Local Setup & Run

```powershell
# Ensure branch is 005-team-calendar-availability
git status

# Install dependencies (zero new npm packages in F005)
npm install

# Run database migration (upgrades F004 -> F005, APP_VERSION = 0.5.0)
npm run db:migrate

# Start local development server (127.0.0.1:3000)
npm run dev
```

Open:
- Team Calendar: `http://127.0.0.1:3000/calendar`
- Provisional Holiday Management: `http://127.0.0.1:3000/calendar/holidays` (also linked from the **Holidays** card on `/calendar`)
- Capacity Planner (for reconciliation check): `http://127.0.0.1:3000/capacity`

---

## 2. Verification Commands

```powershell
# Static checks
npm run lint
npm run format:check
npm run typecheck

# Unit & real PGlite integration tests (engine, calendar domain, migration, backup/restore, routes)
npm run test:run

# Production build
npm run build

# Playwright visual geometry & E2E + axe accessibility tests (sequential on port 3100)
npm run test:visual
npm run test:e2e
```

---

## 3. Manual Smoke Walkthrough (Matches US1–US5 Independent Tests)

1. **Grid & Multi-Duration Sprints (US1)**:
   - On `/calendar`, switch ART › Team › PI › Sprint in the floating header.
   - Verify 2-week, 3-week, and 4-week Sprints render exact Team-scheduled dates (including `±1` offset Teams), ISO `CW##` headers, month dividers, and compact columns for 4-week Sprints.
   - Confirm commitment chips show `PI not started · capacity is live` and `Sprint not started` (no `vs PI` / `vs Sprint` columns yet).
2. **Absences & Planned Overtime (US2)**:
   - In `Days off` view, click an empty Member × Day cell → popover opens → log `AL` (`full`, planned) → reload to verify persistence.
   - Click the occupied cell again → popover opens without auto-cancelling → move date to another weekday → reload to verify both dates updated → open popover and click **Cancel** → verify `status = 'cancelled'` marker persists with `0` capacity impact.
   - Log `WFH` or `BT` and verify `0` capacity deduction.
   - Log planned overtime (default `2 h`, edited to `1.5 h` / `90 min`) on a weekday, a weekend, and on top of an active full-day `AL` (verifying the non-blocking overlap warning).
   - Confirm the Key/Legend dynamically lists F002's 6 `AbsenceType` codes (`AL`, `SL`, `HD`, `BT`, `WFH`, `ON_SITE`) plus Planned Overtime, Cancelled, and calendar markers.
3. **Ceremonies, Meetings & Milestones (US3)**:
   - In **Scrum ceremonies**, add a Daily stand-up (`Daily`, `15 min`) and dated ceremonies (`Sprint planning` `2 h`); verify `#F8CBAD` date headers.
   - In **Meetings**, add a `Whole team` meeting and a specific-attendee meeting; verify avatars/initials and attendee-only deductions.
   - Click a working date header that has a ceremony → add two milestones → verify solid red `#D00000` header (white text) overrides `#F8CBAD`, tooltip lists both milestones + ceremony, inline edit and `✕` remove work, and milestones deduct `0` hours.
4. **Dev Hours & F004 Reconciliation (US4)**:
   - Switch to `Dev hours`. For a `0.5` FTE Member on a day with `2 h` Sprint planning + `15 min` Daily stand-up, verify the cell deducts `2.25 h` clock time after FTE (`4.0 − 2.25 = 1.75 h`).
   - Verify Sprint-level `OverheadDeduction` is shown separately and the reconciled Sprint `Dev h` matches `/capacity` identically.
   - Verify `SM`/`PO` appear for attendance/meetings without inflating Team `Dev h` totals.
5. **Holiday Management & Override-Preserving Refresh (US5)**:
   - Click **Manage holidays ›** from the Holidays card → verify read-only F002 Locations overview (no `+ Location`, no `Hours / day`).
   - Add a `company` holiday, edit a `library` holiday (creating a `manual` override), remove another `library` holiday (suppressing it), click **Refresh from public calendars** → verify all overrides and suppressions survive with zero duplicates, then restore the suppressed holiday and verify it becomes effective again.
