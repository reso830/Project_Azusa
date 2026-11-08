Create a technical plan for this Spec Kit feature.

Instructions:
- Read the spec before writing the plan.
- Use the design reference only if one is provided.
- Do not assume missing information.
- Do not implement code.
- Keep the plan practical and scoped to the feature.

Write or update:
- `plan.md` in the feature directory (`specs/###-name/`)
- Supporting artifacts by this heuristic: if the feature adds/changes data or has
  more than ~2 phases, produce `data-model.md`, `contracts/api.md`, `research.md`,
  `quickstart.md`, and `checklists/plan-review.md`. Trivial UI-only tweaks may skip
  these.

`checklists/plan-review.md` is a **pre-implementation plan-review gate** — it is read
and verified before any code is written. Scope its items to things checkable against
the plan itself: spec/plan scope alignment, architecture soundness, data-model risks,
contract correctness, test strategy, and constitution compliance. Do NOT include items
that can only be confirmed after implementation (e.g. "Release Prep done", "no remaining
imports of X", "grep confirms…", "full test suite passes") — those are post-implementation
verification and belong to the final review/verification step, not this checklist.

Include:
- architecture
- data flow
- affected components
- risks and tradeoffs
- validation approach

If the feature touches the data layer, address explicit migrations, data validation,
backup/recovery impact, and recoverable error handling (constitution Principle IV).

If an approved prototype exists, declare **Visual-Fidelity Mode** (`Visual-fidelity`,
`Mixed`, or `Functional-only`) and the prototype path(s). List every planned deviation
from the prototype with its specific reason for operator acceptance (Principle II).

Add a constitution compliance note covering:
- domain-integrity impact (Principle III): Plan Versions / PI Commitments / Sprint
  Commitments / Actuals kept distinct, history preserved, traceable state transitions
- business rules and derived metrics enforced in the domain layer through single,
  authoritative, reusable rules — not duplicated per screen
- justification for any new dependency (established, maintained, open source; runs fully
  locally with no paid APIs)
- documentation impact (Principle VI)

Add this required section:

## Affected Areas

Include:
- files/components likely to be inspected
- files/components likely to be modified
- tests likely to be added or updated
- areas explicitly out of scope

Token/context discipline:
- Prefer precise affected areas over broad repo exploration.
- Do not list unrelated files just to be exhaustive.
- If uncertain, mark the area as "inspect only" rather than "modify".
