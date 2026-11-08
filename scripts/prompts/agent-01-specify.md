Create a Spec Kit specification for this feature.

Instructions:
- Read the feature brief (`docs/features/<roadmap-phase>/###-name.md`, per `docs/feature_roadmap.md`) and design reference before writing.
- Base the spec only on provided files and existing project context.
- Do not assume missing information.
- Do not implement code.

Write or update:
- `spec.md` in the feature directory (`specs/###-name/`)

Use this standard skeleton (match the structure of recent specs in `specs/`):
- Header block: `Feature Branch`, `Created`, `Status`, `Input: docs/features/<roadmap-phase>/###-name.md`
- `## Clarifications` — before finalizing the spec, actively scan the brief for
  ambiguities (scope boundaries, data shape, behavior on edge cases, runtime modes,
  non-goals). Ask the user up to 5 targeted, high-impact questions — never guess to
  fill a gap. Encode each answer as a dated `### Session YYYY-MM-DD` block of
  `Q: … → A: …` pairs. If the user is unavailable, list the unresolved items here as
  open questions that block the spec rather than assuming an answer.
- `## Problem Statement`
- `## Scope` — with explicit **In scope** and **Non-goals** lists. Be thorough with
  Non-goals; they are the primary scope-control tool and every feature needs them.
- User behavior
- Acceptance criteria
- Edge cases
- Data considerations

Requirements:
- Tie acceptance criteria to independently testable user stories. Each user story
  must have an **Independent Test** — the final Browser Smoke Test phase walks these,
  so a story without one cannot be verified.
- If the feature touches domain data, respect constitution Principle III: keep Plan
  Versions, PI Commitments, Sprint Commitments, and Actuals distinct; preserve commitment
  history through replanning; make state transitions traceable.
- If an approved prototype exists, reference it as the visual/interaction target
  (Principle II). Any intended deviation must be stated with its specific reason.

Keep the spec concise, testable, and aligned with the project constitution.
