# Azusa — Feature Brief 004: Capacity Engine & Capacity Planner

**Milestone:** M0 — Foundations  
**Feature ID:** F004  
**Version:** 0.1 — Draft for SDD  
**Date:** November 26, 2026  
**Dependencies:** F001 — Application Foundation; F002 — Organization & PI Cadence; F003 — Work Categories & Allocation

**Canonical references:**
- `AZUSA_ROADMAP_v2.md`
- `AZUSA_HANDOFF.md` — §8 Capacity Model, §8.1 Units, §13.3 Capacity Planner
- November 20 revised handoff and supporting design decisions
- `docs/azusa-data-model.md` — v0.6
- F002 — Organization & PI Cadence, including subsequent clarifications
- F003 — Work Categories & Allocation, including all five clarification decisions
- Azusa Constitution

## 1. Objective

Establish Azusa's capacity calculation engine and the Team-level Capacity Planner.

The engine calculates available development capacity based on:

- Team Sprint schedules and working days.
- Member locations and their applicable holidays.
- Member absences and availability.
- Member FTE factors.
- Team-level overhead deduction rules.
- Normalized velocity.

It then derives:

- Member development days.
- Team development days.
- Forecast Story Points (SP).
- Development-category SP budgets.
- Capacity and load indicators for downstream planning features.

**User outcome:** As a Scrum Master, I can inspect a Team's capacity for an entire PI and its individual Sprints, understand how member availability and overhead affect development capacity, review the normalized velocity used for forecasting, and see how the resulting forecast is distributed across development categories.

The Capacity Planner must make calculations transparent. The operator should be able to understand where every displayed number comes from rather than treating the engine as a black box.

## 2. Functional Scope

### 2.1 Capacity Calculation Engine

Implement the capacity engine as a pure TypeScript module.

- No database access, filesystem operations, network calls or UI dependencies inside the calculation engine.
- Inputs must consist of explicit organizational, calendar, availability, deduction and velocity data.
- Outputs must contain calculated values and sufficient breakdowns to explain the results.
- The same calculation logic must be reusable by the Capacity Planner, Team PI Board, ART Program Board and future dashboards.

The engine must calculate capacity at two levels:

1. Member × Iteration.
2. Team × Iteration, with PI-level aggregation.

### 2.2 Working Days and Member Availability

Working days are calculated individually for each Member, using the Member's Location and applicable holiday calendar.

The conceptual calculation is:

`working_days = NETWORKDAYS(team_sprint_start, team_sprint_end, member_location_holidays)`

Rules:

- Monday through Friday are working days.
- Saturday and Sunday are excluded.
- Full-day holidays reduce working days by 1.
- Half-day holidays reduce working days by 0.5.
- Holidays are associated with Locations, not Teams.
- A Team can contain Members from multiple Locations.
- A holiday affecting one Member must not shift the entire Team's Sprint schedule.
- Use the Team-specific scheduled Sprint boundaries established in F002, including its permitted −1, 0 or +1 working-day offset.

The Team offset itself is calculated using weekdays only. Member-specific public holidays are applied separately during capacity calculation.

### 2.3 Absences

Use the Absence and AbsenceType records established in F002.

The calculation must consider:

- Member association.
- Date.
- Portion (`full`, `am`, `pm`).
- Absence type.
- Planned/unplanned classification.
- Status (`active`, `cancelled`).
- The AbsenceType's `affects_capacity` setting.

Rules:

- Cancelled absences do not reduce capacity.
- Active full-day absences reduce availability by 1 day.
- Active half-day absences reduce availability by 0.5 day.
- AM/PM portions each represent half a working day.
- Absence types with `affects_capacity: false` do not reduce availability.

Initial AbsenceType behavior from F002:

| Code | Description | Capacity impact |
|---|---|---|
| AL | Annual Leave | Reduces |
| SL | Sick Leave | Reduces |
| HD | Half Day | Depends on portion |
| BT | Business Trip | No reduction |
| WFH | Work From Home | No reduction |
| ON_SITE | On-site attendance | No reduction |

The engine must consume the configured `affects_capacity` value rather than hardcoding behavior based on the display name or code.

### 2.4 Member Eligibility and FTE

Members with the following roles are excluded from development capacity:

- Product Owner (PO)
- Scrum Master (SM)

Other eligible Members contribute according to their `fte_factor`.

Examples:

- 1.0 FTE = full capacity.
- 0.5 FTE = half capacity.

The calculation follows:

`member_dev_days = fte_factor × (available_days − overhead_days)`

The FTE factor applies after availability and overhead deductions, consistent with the original handoff formula.

The engine must preserve the distinction between:

- Total Team membership.
- Members counted toward development capacity.
- Total eligible FTE.

A Member's FTE must not be inferred from their assigned hours or avatar/profile information.

### 2.5 Overhead and Capacity Deductions

Overhead deductions reduce available development capacity before normalized velocity is applied.

F003 establishes the overhead category catalog. F004 implements the calculation of their capacity impact.

The model must support the two deduction modes established in the handoff.

**A. Percentage mode (`percent`)**

Overhead deductions are calculated as a percentage of available days.

Example:

- Available days: 10
- Overhead deduction: 20%
- Overhead days: 2
- Remaining days before FTE: 8

**B. Fixed-days mode (`fixed_days`)**

Overhead deductions use a configured number of days per Member per Iteration.

Example:

- Available days: 10
- General Work: 1 day
- Training: 0.5 day
- Total overhead: 1.5 days
- Remaining days before FTE: 8.5

Rules:

- Deduction mode is configured per Team.
- At PI level, deductions are expressed in days.
- Overhead categories are deducted before development capacity is calculated.
- Different overhead categories must remain distinguishable in the calculation breakdown.
- The default sample uses General Work and Training, but the model must not assume these are the only overhead categories.
- PO and SM are excluded from development capacity calculations.
- Do not create Story Points or velocity credit for overhead activities.
- Training and Retrospective activities remain non-story capacity/activity records without Projects.

The engine must expose the overhead deduction per Member and Iteration, as well as the aggregated Team total.

### 2.6 Hours per Day

- Default: 8 hours per working day.
- Team-level override is supported.
- The configured value is used when translating development days into available hours for downstream Sprint Planning.
- Per-location hours/day configuration is deferred.

PI-level capacity remains expressed in days.

Sprint Planning and individual task allocation use hours. Story Points must never be converted directly into hours.

### 2.7 Normalized Velocity

Normalized Velocity (NV) is the bridge between development capacity and forecast Story Points.

Unit:

`SP / development day`

Calculation:

`normalized_velocity = sum(completed_development_SP) / sum(actual_development_days)`

Rules:

- Use a rolling window of four completed Sprints.
- Use a ratio of sums, not an average of individual Sprint velocity ratios.
- If fewer than four Sprints of history exist, use the available completed history.
- If no usable Sprint history exists, use a manually entered seed value.
- The manual seed supports initial forecasting before sufficient execution history exists.
- PO and SM capacity must not enter the denominator.
- Overhead-category work is excluded from the numerator.
- Only development-category work contributes to velocity.

Actual development SP must follow the established execution rules:

- Committed development Stories reaching Done.
- Unplanned development Stories reaching Done.
- Actual Stretch slice points recorded at Sprint closure.

Actual development days must reflect actual availability, including real absences and unplanned deductions.

Sprint closure and actual recording belong to later execution features. F004 must establish the calculation contract and support the initial manual seed.

### 2.8 Forecast Story Points

For each Team and Iteration:

`team_dev_days = sum(eligible_member_dev_days)`

`forecast_sp = team_dev_days × normalized_velocity`

The forecast represents the suggested development capacity of the Team for that Sprint.

Rules:

- Forecasts are calculated independently for each Iteration.
- PI forecast is derived from its constituent Iterations.
- The optional IP Iteration has capacity and is treated as an ordinary planned Iteration.
- Different Sprints can have different forecasts due to absences, holidays and overhead.
- A Team's normalized velocity is applied to its available development days.

The engine must retain sufficient precision internally. Rounding is a presentation concern.

### 2.9 Development Category Budgets

Consume the effective Team/PI category allocation established by F003.

For each development category:

`category_budget_sp = forecast_sp × effective_allocation_pct`

Rules:

- ART defaults and Team/PI overrides are resolved by F003.
- Unset Team overrides inherit the ART default.
- Explicit 0% overrides remain distinguishable from inheritance.
- Development allocations use whole-number percentages and must total exactly 100%.
- The effective allocation is fixed per PI.
- Category budgets are calculated independently for each Iteration using that Iteration's forecast SP.
- PI category budgets are derived from the Iteration budgets.
- Overhead categories do not receive SP budgets.
- Overhead is deducted before development capacity and forecast SP are calculated.

If the effective Team/PI allocation is invalid, the Capacity Planner must display the validation issue and must not present the category breakdown as a valid 100% allocation.

F003 remains the authority for allocation configuration and validation.

### 2.10 Load Calculation

Provide the reusable calculation:

`load = planned_sp / forecast_sp × 100`

Rules:

- Planned SP includes all allocated StorySlice points, including Stretch allocations.
- Stretch consumes capacity even though it is not committed.
- Load is calculated per Team and Iteration.
- Load may also be calculated per development category.
- Overhead work is not included in development SP load.

Default visual thresholds from the handoff:

| Load | Indicator |
|---|---|
| Below 85% | Amber |
| 85–115% | Green |
| Above 115% | Red |

The thresholds should remain configurable in the broader application design. F004 must not introduce an independent threshold system that conflicts with future Metrics and Reporting.

Actual Story allocations and the Team PI Board are implemented in later features. F004 establishes the calculation capability and exposes the results for those features.

## 3. Capacity Planner UI

### 3.1 Overview and Controls

The Capacity Planner is a dedicated screen accessible through the Capacity navigation group.

Controls:

- Team selector.
- PI selector.
- Deduction mode selector (`Fixed days` / `% of available`).
- Hours per day input.
- Relevant Team/PI context.

Configuration changes must be reflected in the calculations immediately, subject to validation.

The screen must use the established Azusa design system and Kumiko icon set.

### 3.2 KPI Summary

Display the following:

| KPI | Description |
|---|---|
| Development days | Total Team development days across the selected PI |
| Normalized velocity | Current Team NV in SP/day |
| Forecast commitment | Total forecast SP across the selected PI |
| Team FTE | Total eligible development FTE |

The NV indicator should identify its source:

- Four-Sprint rolling history.
- Available historical Sprints.
- Manual seed value.

The operator should not have to guess whether the displayed velocity is calculated or manually supplied.

### 3.3 Member × Iteration Capacity Table

Display Members as rows and Iterations as columns.

Member information:

- Avatar and initials.
- Name.
- Role.
- FTE factor.
- Location badge.

Iteration information:

- Working days.
- Holidays.
- Absences.
- Overhead deductions.
- Resulting development days.

Example presentation:

| Member | Location | FTE | Sprint 1 | Sprint 2 |
|---|---|---:|---:|---:|
| Andrea Santos | PH | 1.0 | 8.0 | 6.0 |
| Ben Cruz | PH | 1.0 | 7.0 | 9.0 |
| Carlo Reyes | SG | 1.0 | 8.5 | 7.5 |
| Hana Villanueva | PH | 0.5 | 4.25 | 4.25 |

Illustrative values only.

The table must expose the deductions contributing to the displayed development days.

Footer rows:

- Total overhead deductions per category.
- Team development days.
- Forecast SP per Iteration.
- PI totals.

Holidays and absences must be visually distinguishable.

The Capacity Planner displays these records but does not replace the Team Calendar as their operational management interface.

### 3.4 Category Split Card

Display the development allocation as a category breakdown.

Expected information:

- Category name and colour.
- ART default percentage.
- Effective Team percentage.
- Inheritance/override indicator.
- Calculated SP budget.
- Total allocation percentage and validation status.

A donut or equivalent visualization may be used to show the category distribution.

Overhead categories must be presented separately under a **Deducted first** section, showing their contribution to capacity deductions rather than treating them as part of the development SP split.

### 3.5 Calendar Integration

The Capacity Planner must provide visibility into the availability data used by the engine.

- Display member-specific holidays and absences.
- Identify which Locations have holidays during an Iteration.
- Show the effect of those records on member capacity.
- Provide navigation to the Team Calendar for editing availability records.

Do not implement a separate days-off editor or duplicate the Team Calendar's functionality.

### 3.6 Calculation Explanations

The Capacity Planner must make calculations inspectable.

Examples:

- Why a Member has fewer available days.
- Which holiday or absence reduced availability.
- How overhead deductions were applied.
- Which FTE factor was used.
- Whether NV came from history or a manual seed.
- How forecast SP was calculated.
- How the effective category percentage was resolved.

The purpose is to make the numbers explainable, not merely display a collection of totals.

## 4. Domain Invariants

1. Capacity is expressed in days at PI Planning level.
2. Sprint Planning uses hours.
3. Story Points are never converted directly into hours.
4. Member holidays are calculated using the Member's Location.
5. Team Sprint offsets are independent of member-specific holidays.
6. Only active, capacity-affecting absences reduce available days.
7. PO and SM are excluded from development capacity.
8. FTE is applied to the remaining capacity after availability and overhead deductions, following the approved formula.
9. Overhead deductions occur before development capacity is calculated.
10. Overhead categories are not included in the 100% development allocation.
11. Normalized velocity uses development-category actual SP and actual development days.
12. Normalized velocity uses a rolling ratio of sums, not an average of ratios.
13. Forecast SP is derived from Team development days multiplied by NV.
14. Development category budgets use F003's effective Team/PI allocation.
15. Stretch allocations consume load.
16. Calculations retain full precision internally; rounding is for presentation.
17. Capacity calculations must be deterministic and independently testable.

## 5. Acceptance Criteria

**AC01 — Pure calculation engine**

Given valid organizational, calendar, availability and allocation inputs, the capacity engine produces deterministic results without requiring database or UI access.

**AC02 — Member working days**

Given a Team-specific Sprint schedule and a Member's Location, the engine calculates working days excluding weekends and applicable Location holidays.

**AC03 — Absence deductions**

Given active absences, the engine deducts full and half-day absences according to their configured capacity impact. Cancelled and non-capacity-affecting records do not reduce availability.

**AC04 — Multi-location Teams**

Given a Team with Members across multiple Locations, each Member's capacity uses their own Location holiday calendar. A holiday in one Location does not shift the Team's Sprint schedule or automatically reduce another Member's availability.

**AC05 — Team schedule offsets**

Given a Team with a configured −1, 0 or +1 working-day offset, capacity uses the resulting Team-specific Sprint boundaries established by F002.

**AC06 — Member eligibility and FTE**

Given a Team roster containing PO, SM and eligible Members with different FTE factors, only eligible Members contribute to development capacity, with their FTE factors applied correctly.

**AC07 — Overhead deduction modes**

Given a Team configured for percentage or fixed-days deductions, the engine calculates per-member overhead and remaining development days correctly.

**AC08 — Hours per day**

Given the default or a Team-specific hours-per-day value, the system correctly converts development days into available hours for downstream Sprint Planning.

**AC09 — Normalized velocity**

Given four completed Sprints, the engine calculates NV using the ratio of total completed development SP to total actual development days.

Given fewer than four completed Sprints, it uses available history.

Given no usable historical data, it uses the manual seed value.

**AC10 — Forecast SP**

Given Team development days and normalized velocity, the engine calculates forecast SP for each Iteration and the selected PI.

**AC11 — Category budgets**

Given a valid effective Team/PI allocation from F003, the engine calculates development-category SP budgets correctly. Overhead categories are excluded.

**AC12 — Invalid category allocation**

Given an invalid or incomplete effective development allocation, the Capacity Planner displays the issue and does not represent the category split as a valid 100% allocation.

**AC13 — Capacity Planner**

The operator can select a Team and PI and inspect KPI summaries, member-level capacity, overhead deductions, category budgets and the calculation breakdown.

**AC14 — Golden tests**

The engine includes deterministic tests reproducing the handoff's capacity worked example and additional boundary scenarios.

**AC15 — Documentation**

The domain model, data dictionary, calculation definitions, repository map and relevant architecture decisions are updated alongside implementation.

## 6. Out of Scope

- ART, Team, Member, PI and Iteration management — F002.
- Location, Holiday and Absence management interfaces — F005, with foundational records established in F002.
- Work Category creation, editing, semantic roles and allocation configuration — F003.
- Team Calendar, ceremonies, meetings, milestones and planned overtime management — F005.
- Project, Feature, Story and Bug management — F006/F007.
- StorySlice allocation and PI board load visualization — F009.
- PI Plan Versioning and PI Commitments — F012.
- Sprint Planning, task-hour allocation and planning-style behavior — F013.
- Iteration execution and unplanned deduction entry — F014.
- Sprint Closure and finalized Actuals — F015.
- Metrics Engine and dashboards — F016 onward.
- ART-level reporting and aggregation — F018/F019.
- Per-location workday-hours configuration.
- Self-service Member absence management.
- Authentication and RBAC enforcement.
- A standalone Settings application.

## 7. Implementation Guidance

These are architectural constraints and considerations for the Specify/Plan stages.

### 7.1 Calculation Architecture

- Keep the capacity engine pure TypeScript.
- Separate input normalization, calculation and presentation formatting.
- Do not place capacity formulas inside React components or database queries.
- Expose calculation results and their contributing values so the UI can explain them.
- Keep the engine independent of the persistence implementation.

### 7.2 Precision and Units

- Retain full precision throughout calculations.
- Avoid intermediate rounding.
- The original handoff recommends storing durations using a canonical integer unit such as minutes, converting to days/hours for presentation.
- Evaluate this approach during Plan and document the chosen representation.
- Story Points remain a separate unit.

### 7.3 Historical Inputs

- F004 initially relies on manually seeded NV where no execution history exists.
- Later Sprint Closure functionality supplies actual SP and actual development-day history.
- Do not implement a parallel actuals or commitment-history system in F004.
- Do not allow changes to F003's current category allocations to rewrite future F012 snapshots.

### 7.4 Canonical Test Dataset

Use a consistent dataset for the capacity engine's golden tests.

The original handoff explicitly warns that its sample data is not fully reconciled across screens. Do not maintain independent hardcoded examples for the Capacity Planner and other screens.

Use a canonical fixture and derive screen-specific presentation data from it.

### 7.5 Visualizations

The category split may use a lightweight visualization, but F004 must not force a premature application-wide charting-library decision.

The broader charting evaluation belongs to M3 — Metrics & Reporting.

## 8. Specify/Plan Questions to Resolve

The following details should be explicitly resolved by Agy during Specify/Plan. Do not silently invent rules.

1. **Percentage deduction semantics:** Confirm how percentage deductions are distributed across overhead categories and how their values are configured. Preserve the handoff's distinction between percentage of available days and fixed days per Member per Iteration.

2. **FTE and fixed-day deductions:** Confirm that the existing formula applies FTE after overhead deductions, including when deductions are expressed as fixed days. The handoff's formula indicates this ordering.

3. **Unconfirmed holidays:** F002 preserves unconfirmed/estimated public holidays. Determine whether these reduce forecast capacity immediately or are presented as provisional capacity deductions pending confirmation.

4. **Overlapping absences and holidays:** Establish how the engine avoids double-counting when a Member has an absence on a public holiday or weekend.

5. **Over-allocation of deductions:** Determine behavior when absences and overhead deductions exceed available working days. Negative development capacity must not silently produce misleading forecasts.

6. **Role eligibility:** The handoff explicitly excludes PO and SM. Confirm whether Admin and RTE Members can contribute to development capacity or require separate treatment.

7. **Normalized velocity and IP Iterations:** Confirm whether the rolling four-Sprint window includes completed IP Iterations, given that IP Iterations have capacity and are planned like other Iterations.

8. **Zero-history and zero-denominator cases:** Define behavior when actual development days are zero or completed development SP are zero. Avoid division-by-zero behavior and distinguish a genuine zero velocity from missing history.

9. **PI forecast aggregation and rounding:** The handoff's worked example shows PI forecast SP of 268 by summing displayed Sprint forecasts, while `291.25 × 0.92 = 267.95`. Define the authoritative aggregation and presentation rule so PI and Sprint totals remain understandable.

10. **Overhead persistence:** Reconcile the calculation inputs with the exact `OverheadReserve` and `OverheadTicket` structures in Data Model v0.6. Do not recreate older `Deduction` entities if the revised model supersedes them.

## 9. Feature Exit Criteria

F004 is complete when:

- The capacity engine independently calculates Member and Team development capacity.
- Location-specific holidays and Member absences are accounted for correctly.
- FTE and overhead deductions are applied consistently.
- Normalized velocity and manual seed behavior are implemented.
- Forecast SP and category budgets are calculated from the effective F003 allocation.
- The Capacity Planner presents the results with transparent calculation breakdowns.
- Golden tests reproduce the approved calculation examples.
- The engine is ready for consumption by Team PI Planning and subsequent execution features.
- Documentation accurately describes the implemented calculation model.

**Next dependency:** F005 — Team Calendar & Availability.

**Downstream consumers:** F009 — Team PI Board & Allocation; F011 — Team PI Brief; F013 — Sprint Planning & Start Sprint; F016 — Metrics Engine & Charting Evaluation.