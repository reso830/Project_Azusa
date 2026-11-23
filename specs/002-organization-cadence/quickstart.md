# Quickstart & Verification Guide: Organization & PI Cadence (F002)

**Branch**: `002-organization-cadence` | **Date**: 2026-11-23 (Updated for Review Pass 1) | **Spec**: [spec.md](./spec.md)

---

## 1. Local Setup & Migration

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:3000`.

- On first boot against a fresh or existing F001 database, Azusa automatically creates a pre-migration startup backup (if upgrading an existing healthy DB), applies `0001_organization_cadence.sql`, writes synchronized `appVersion: '0.2.0'` to `.azusa-last-healthy.json`, and idempotently seeds:
  - 6 Locations (`PH`, `SG`, `AU-WA`, `IN`, `UK`, `US-TX`) with canonical IANA time zones
  - Public/bank holidays from `date-holidays` (ISC) for those Locations (with Islamic/Hijri moon-sighting holidays flagged `confirmed = false`)
  - 6 AbsenceTypes (`AL`, `SL`, `HD`, `BT`, `WFH`, `ON_SITE`)
- ARTs, Teams, Members, PIs, and Iterations start empty until created by the operator.

---

## 2. Manual Smoke Walkthrough

1. **Profile Menu & `/organization` Header (`US4`, `OD-6`)**:
   - On `/`, click the `"SM"` profile button in the top-right header.
   - Verify the subtitle says `"No ART or team configured"`, **`Organization`** is clickable, and **`Settings`** remains disabled.
   - Click **`Organization`** → navigates to `/organization`.
   - Verify the `/organization` header displays **only** the logo (no primary nav item active), expandable search (`"Search organization…"`), and profile menu — no `TodayWidget` and no `ART › Team › PI` breadcrumb.
2. **Locations Registry & Archive (`US3`, `OD-3`)**:
   - Open the **Locations** tab on `/organization`.
   - Verify `PH`, `SG`, `AU-WA`, `IN`, `UK`, and `US-TX` appear with IANA time zones, calendar sources, and seeded holiday counts; inspect a Location's read-only holiday list (confirming SG Chinese New Year is confirmed and SG Hari Raya Puasa is marked `(est.)`).
   - Create a custom Location (e.g., `JP` / `Japan` / `JP` / `Asia/Tokyo`), edit its name, reload to verify persistence, archive it (confirming it hides from the Member Location picker and appears behind `"Show archived"`), then reactivate it.
3. **ARTs, PIs & Weekday Iterations (`US1`, `US2`, `OD-1`)**:
   - Open **ARTs & PI Cadence**, create `Payments ART`, edit its name and reload to confirm persistence; create a PI spanning today's date, edit it and reload to confirm persistence; add Monday–Friday development Sprints plus an optional IP Sprint.
   - Attempt to add an Iteration starting or ending on a Saturday or Sunday and confirm `400 VALIDATION_ERROR`.
   - Click the optional **`YYWW`** suggestion helper on a Sprint, then rename it to a custom name and verify its dates do not change.
   - Attempt to add an overlapping PI in `Payments ART` or an Iteration outside the PI range and confirm `409 CONFLICT`.
   - Create a second ART (`Core Platform ART`) with overlapping PI dates and confirm acceptance.
4. **Teams, Offsets, Members & Team Moves (`US1`, `US2`, `OD-4`)**:
   - Open **Teams & Members**, create a Team under `Payments ART` with `sprint_offset_workdays = -1`, edit it and reload to confirm persistence, and verify Team-scheduled Sprint dates shift by 1 Mon–Fri weekday while canonical ART dates stay unchanged.
   - Add Members across multiple Locations with roles including `SM`, `PO`, and `Team member` and varied FTE values; edit a Member and reload to confirm persistence.
   - Move a Member to an active Team in `Core Platform ART` with a future `effectiveDate`, verify the roster stays unchanged until that date, cancel the pending move (verifying prior assignment reopens), test same-day Team correction, and verify archiving a Team with a pending incoming move is blocked (`409`).
   - Archive a Member, verify it remains inspectable via `"Show archived"`, reactivate it, and verify deleting a Team with Members is blocked while deleting an empty mistake ART succeeds.
5. **Faithful Header Context & Live Today Widget (`US4`, `OD-2`, `OD-5`, `OD-7`)**:
   - Navigate back to `/`.
   - Verify an ART with zero active Teams does not appear in the header; verify the header shows plain-text `<ART>` linking to `/program-board`, followed by the Team dropdown grouped under ART headings, and the PI dropdown for that ART.
   - Select a Team and PI; confirm the profile dropdown subtitle updates to `<Team> · <ART>` (on both `/` and `/organization`) and the Today widget on `/` displays `<PI> · Sprint <name>` (skipping `Sprint ` if `<name>` already begins with `"Sprint"`, matching Team-shifted dates, without implying commitment).
   - Reload the page and confirm the selected context persists.

---

## 3. Automated Quality Gates

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:run
npm run build
npm run test:visual
npm run test:e2e
```

All commands run 100% locally with zero external network requests.
