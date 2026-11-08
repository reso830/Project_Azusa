# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]
**Prototype / Design Reference**: [path(s) to the approved prototype, or N/A]
**Visual-Fidelity Mode**: [Visual-fidelity | Mixed | Functional-only — any feature with an
approved prototype is Visual-fidelity or Mixed (constitution Principle II)]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] **I. Purpose & Scope** — no monetization, portfolio-management, or enterprise
  complexity introduced without an explicit requirement.
- [ ] **II. Spec-Driven / Prototype Fidelity** — work stays within approved Feature scope; UI
  matches the approved prototype as closely as practical; every planned deviation is listed
  with its specific reason for operator acceptance.
- [ ] **III. Domain & Historical Integrity** — business rules live in the domain/application
  layer; Plan Versions, PI Commitments, Sprint Commitments, and Actuals stay distinct;
  commitment history is preserved through replanning; state transitions are traceable;
  derived metrics come from one authoritative rule.
- [ ] **IV. Architecture & Data Safety** — simplest viable architecture; clear
  domain/persistence/presentation boundaries; runs fully locally with no paid APIs; schema changes use explicit migrations with validation, backup, and recovery
  addressed; each new dependency is justified (established, maintained, open source).
- [ ] **V. Deterministic Testing** — acceptance criteria are verifiable; tests planned for
  domain invariants, boundaries, and failure cases; golden fixtures for capacity and
  reporting metrics; key workflows covered by integration/E2E tests.
- [ ] **VI. Documentation** — affected docs identified (README, REPO_MAP, CHANGELOG,
  architecture overview, domain model, data dictionary, ADRs, operations).
- [ ] **VII. UX & Accessibility** — follows Azusa visual language and terminology; responsive,
  keyboard-operable, empty/loading/error states, status not conveyed by color alone;
  advisory warnings preferred over hard restrictions.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
