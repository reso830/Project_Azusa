# ADR 0002: Organization cadence and holiday seeding

**Date:** 2026-11-24
**Status:** Implemented for F002 under the approved specification. Operator acceptance is tracked in Phase 08.

## Context

Capacity and planning need a consistent ART cadence, date-resolved Team rosters, and local holiday data that survives jurisdiction changes and archiving. The application operates offline and has a single local audit actor in F002.

## Decision

- **Cadence (OD-1, OD-2).** Store inclusive ISO calendar dates (`YYYY-MM-DD`) and require Monday–Friday Sprint boundaries. A Team applies the same −1, 0, or +1 weekday shift to each canonical boundary. On the weekday sequence that shift is strictly order-preserving, so non-overlapping Sprints cannot share a shifted day, including across consecutive PIs of the same ART. Today matches the viewer-local date against the selected Team schedule, including spillover beyond the canonical PI. After RBAC, it will use the signed-in user's own Team. A Scrum Master handling several offset Teams follows the canonical schedule.
- **Dated membership (OD-4, OD-8, OD-9, OD-11).** `member_team_assignments` is the sole source of membership, with no `members.team_id`. Resolve membership from the inclusive start and end dates, defaulting to server-local today. A move closes the preceding assignment the day before the new row starts. Allow one pending future move per Member. Correct an assignment starting today or in the future in place. Correcting it back to the preceding Team removes the redundant row and reopens the preceding assignment. Cancelling a pending move also reopens that assignment. Reject backdated moves and require cancellation before inserting a move earlier than an existing pending move. F004 must use date-aware membership lookups.
- **Archival and lifecycle (OD-3).** Keep referenced Locations and holidays through soft archive so later live capacity recalculation can use historical holidays. Existing Members retain their Location. New Members and Location changes require an active Location. `record_status` controls visibility and reactivation independently of `pis.lifecycle_status`, which represents PI planning, progress, and closure.
- **Holiday identity and seeding (R2-1, R2-2).** Seed missing reference codes and years from bundled `date-holidays` data. The partial unique index `holidays_library_identity_unique` protects library rows by Location, date, and name. Persist `seeded_years` even for empty results. Keep Location code immutable. Company and manual records suppress library holidays for the same Location and date. Mark Islamic/Hijri-derived dates unconfirmed. The pinned library supports `IN`/`KA`. If its regional probe fails, seed India country-level data and set the label to `Public holidays, IN`. A jurisdiction edit replaces library rows from the edit date forward and records `library_seed_cutoff_date` so later seeding preserves historical rows.
- **Absences (OD-10).** Apply overlapping full-day and half-day conflicts only to active capacity-reducing Absences for the same Member and date. Attendance-only types can coexist with them.
- **Context and metadata.** Reconcile Team and PI choices from browser `localStorage` against active records. Keep `app_metadata` infrastructure-owned and retain the original `foundation.init` row on upgrade. Its `schemaVersion` intentionally stays `0000_foundation_init`. Migration and restore write the running `APP_VERSION` to the healthy marker.

## Alternatives considered

- A current Team foreign key duplicates state and can disagree with dated rosters on a scheduled move.
- Persisting shifted Sprint rows duplicates canonical cadence and creates synchronization work whenever dates or offsets change.
- Refreshing every library year on startup can overwrite historical jurisdiction data and repeatedly process empty calendars.

## Consequences

Downstream capacity and calendar work share the same dated roster and canonical cadence. F005 owns operational holiday refresh, holiday overrides, and Absence editing. Editing or backdating past membership and a membership history UI remain deferred.
