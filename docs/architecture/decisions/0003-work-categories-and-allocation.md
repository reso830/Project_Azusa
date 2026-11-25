# ADR 0003: Work categories and allocation

**Date:** 2026-11-25
**Status:** Accepted (2026-11-25). Operator UAT is recorded in the [Phase 07 tasks](../../../specs/003-work-categories-allocation/tasks.md).

## Context

ARTs need editable category catalogs and Team/PI development percentages that feed capacity planning. Operators need to see where a value is inherited and how later catalog edits affect a working allocation. The v2 handoff distinguishes development work from overhead time and Bug type from category labels.

## Decision

- **Classification (D-3, D-4).** Development uses the semantic roles `feature`, `maintenance_bugs`, and `standard`. A partial unique index allows at most one active `maintenance_bugs` category per ART. Renaming a category preserves its role. F003 allows explicit role changes through the category editor. F007 owns the additional guard for categories referenced by work items. The operator accepted `Feature dev.` as the starter short label for `Feature development`, resolving v2 handoff update §21 item 7.
- **Lifecycle (D-2).** New development categories start at `0%`. Archive, unreferenced delete, reactivation, and allowed kind changes preserve the other percentages and flag invalid totals. An ART with zero active development categories displays **Not configured**. Any allocation reference prevents deletion and a kind change. Archived categories retain their stored defaults and overrides.
- **Allocation.** Use exact integer percentages from 0 to 100 and require complete active development sets on saves. Persist each explicit Team/PI override in a row, including `0%`. An absent row inherits the ART default. Reset-all clears active-category overrides and preserves archived-category rows.
- **Drift (D-1).** Defaults resolve live for working allocations. Warn for every invalid split on an active Team and active PI ending today or later, including fully inherited and fully overridden splits. Past allocations remain readable. F012 owns historical snapshots and commitments.
- **Configuration.** Order categories within each ART and kind. Catalogs start empty. The operator can apply the sample catalog explicitly in **Organization → Categories & Allocation**. The standalone Settings entry stays disabled.

## Alternatives considered

- Deriving semantic roles from labels makes Bug eligibility and Story layout depend on editable display text.
- Storing inherited percentages per Team duplicates ART defaults and creates synchronization work.
- Requiring operators to rebalance before archiving adds a workflow dependency. Showing the invalid total keeps the change visible and leaves reconciliation to the operator.

## Consequences

F004 can consume the resolved percentages for capacity budgets. F007 can build work-item classification on stable roles. F012 can capture the working split when it creates an immutable snapshot. Migration `0002_work_categories_allocation.sql` adds the catalog and override tables to existing installations. See the [F003 specification](../../../specs/003-work-categories-allocation/spec.md).
