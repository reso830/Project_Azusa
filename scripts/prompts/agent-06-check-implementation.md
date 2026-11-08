Review one implemented Spec Kit phase.

Instructions:
- Read the workflow ledger, phase tasks, plan, spec, and changed files.
- Scope the review to the diff this phase introduced (per the ledger / phase commit range), not the whole branch.
- Run `npm run test:run` and `npm run lint`. A phase must leave the tree green — treat any test or lint failure as CRITICAL. Confirm no earlier-phase behavior regressed.
- Judge this phase against its declared tasks only. Do NOT flag as missing any work the plan or a later phase explicitly defers — incompleteness a subsequent phase will fill is expected, not a finding.
- Honor user notes, accepted findings, and prior review history unless they conflict with the project constitution.
- This is a read-only review of source. Do not edit source files, tests, specs, tasks, or the workflow ledger (running tests and lint is allowed).

Review for:
- correctness
- maintainability
- validation logic
- data model quality
- test coverage
- UX risks
- missed phase tasks
- unintended out-of-scope changes — verify changed files match the phase tasks' target files and the plan's `Affected Areas`; flag any file modified that no task in this phase authorized

Constitution-specific checks, when the relevant files changed:
- Domain or validation logic changed → confirm business rules live in the domain layer (not only the UI) and tests cover domain invariants, boundary conditions, failure scenarios, and state transitions; capacity and reporting metrics use golden fixtures (Principles III, V).
- Commitment or history data changed → confirm Plan Versions, PI Commitments, Sprint Commitments, and Actuals stay distinct and commitment history survives replanning (Principle III).
- Data layer changed → confirm explicit migrations, data validation, and backup/recovery impact are handled (Principle IV).
- UI changed → confirm it matches the approved prototype or each deviation is documented with a specific reason and operator acceptance (Principle II); empty / loading / error states are handled, status is not color-only, and the surface is keyboard-navigable (Principle VII).

The first line of your response must be exactly one of:
Pass
Needs Changes

Use `Needs Changes` if there are any `CRITICAL`, `MAJOR`, or `MINOR` findings.
Use `Pass` only when all findings are `INFO` or there are no findings.

Use only these severity labels:
- `CRITICAL` - app-breaking issue or major conflict with constitution that needs to be addressed. Current phase cannot proceed.
- `MAJOR` - app-breaking or major bug. Must be resolved before moving forward.
- `MINOR` - non-breaking issue that can still cause problems, including UI/UX. Must be resolved before moving forward.
- `INFO` - FYIs based on findings.

After the verdict, list findings concisely. Include file paths and line references when useful.
