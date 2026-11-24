<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (Amended 2026-11-24)
- Bump rationale: new substantive rule — prototype fidelity baseline width.
- Modified principles:
  - II. Specification-Driven Development — prototype fidelity is guaranteed at 1440px only;
    narrower widths may adapt without per-deviation records but must stay usable/accessible
- Implications: existing specs listing 1440/1024/768px checkpoints remain valid; reviews judge
  1024px/768px on usability and accessibility (Principle VII), not prototype match.
- Templates / dependent files: none require change.

Previous: 0.2.0 (Draft) → 1.0.0 (Ratified 2026-11-08)
- Bump rationale: initial ratification by the operator; no principle text changed from 0.2.0.

Prior draft history (0.1.0 → 0.2.0):
- Modified principles:
  - II. Specification-Driven Development — prototypes changed from "intent only" to the
    binding visual/interaction target; deviations require justification + operator acceptance
- Modified sections:
  - Working Agreement → Requirement Precedence — clarified that precedence resolves
    conflicts only and does not make prototypes optional
  - Header — dates normalized to ISO format
- Added sections: none
- Removed sections: none
- Templates / dependent files:
  - ✅ .specify/templates/plan-template.md — Constitution Check gates + Visual-Fidelity Mode
  - ✅ .specify/templates/tasks-template.md — Visual-Fidelity Task Pattern, Release Prep,
    Browser Smoke Test phases
  - ✅ .specify/templates/spec-template.md — reviewed, no change needed
  - ✅ scripts/prompts/agent-01..07 — removed job-tracker and hosted-runtime rules; amendment
    numbers (1.3.0, 1.6.0) replaced with principle references
  - ✅ README.md — overview, workflow, layout, and docs navigation written; install/run/test
    sections pending tech-stack selection
- Deferred TODOs:
  - TODO(STACK): no tech stack defined yet; prompts still assume `npm run test:run` / `lint`
-->

# Azusa — Project Constitution

**Version:** 1.1.0  
**Ratified:** 2026-11-08  
**Last Amended:** 2026-11-24  
**Repository location:** `.specify/memory/constitution.md`

## I. Purpose and Scope

Azusa is a personal, local-first learning project for Team- and ART-level Agile/SAFe planning, execution, and reporting.

Engineering quality, understanding, maintainability, and a polished user experience take priority over shipping speed.

Do not introduce monetization, hosting, portfolio-management features, or enterprise complexity without an explicit requirement.

## II. Specification-Driven Development

Development follows a **Milestone → Feature** cadence.

Every Feature follows:

**Feature Brief → Specification → Implementation Plan → Tasks → Implementation → Verification/UAT**

- Approved specifications define functionality and acceptance criteria.
- Approved prototypes are the visual and interaction target. Implementations must match them
  as closely as practical. Prototypes are not immutable, but any deviation requires a
  documented, specific reason (e.g., an accessibility need, a conflict with the approved
  specification, or a real technical constraint) and operator acceptance. Convenience or
  framework preference is not a sufficient reason.
- Prototype fidelity is guaranteed at the `1440px` baseline width only. Below `1440px`,
  layouts may adapt (e.g., truncate, reflow, or visually hide secondary content) without a
  per-deviation record, provided they remain usable, collision-free, and accessible under
  Principle VII. Deviations visible at `1440px` still require justification and acceptance.
- Features should be coherent, independently testable slices.
- Avoid speculative abstractions, unnecessary decomposition, and ceremonial documentation.
- Changes outside approved Feature scope require explicit justification.

## III. Domain and Historical Integrity

Business rules must be enforced within the domain/application layer, not solely through UI controls.

- Maintain consistent capacity, scheduling, estimates, ownership, and dependency rules across the application.
- Treat **Plan Versions, PI Commitments, Sprint Commitments, and Actuals** as distinct concepts.
- Preserve commitment records and execution history independently of subsequent replanning.
- Ensure State transitions and commitment events are traceable.
- Calculate derived metrics through authoritative, documented rules rather than duplicated screen-specific logic.

## IV. Maintainable Architecture and Data Safety

Use the simplest architecture that satisfies current requirements.

- Maintain clear boundaries between domain logic, persistence, and presentation.
- Prefer established, maintained open-source solutions over unnecessary custom infrastructure.
- Operate locally without dependence on hosted services or paid APIs.
- Use explicit database migrations, data validation, tested backups, and recoverable error handling.
- Accommodate future multi-user capabilities without prematurely implementing their complexity.

## V. Deterministic Testing and Verification

Every implemented Feature must have verifiable acceptance criteria.

- Test domain invariants, boundary conditions, and failure scenarios.
- Use golden fixtures for capacity calculations and reporting metrics.
- Keep computational engines independently testable where practical.
- Cover important user workflows through integration or end-to-end tests.
- Address failing required tests, correctness regressions, and broken migrations before accepting a Feature.

Verification must demonstrate that the implemented behavior conforms to the approved specification.

## VI. Documentation as a First-Class Deliverable

**Code and documentation must evolve together.**

Documentation must be version-controlled, accurate, discoverable, and useful to both human developers and AI coding agents.

The repository must maintain the following artifacts:

| Artifact | Responsibility |
|---|---|
| `README.md` | Project overview, installation, configuration, local execution, testing, and documentation navigation. |
| `docs/REPO_MAP.md` | Major directories, modules, entry points, architectural boundaries, and common modification paths. |
| `CHANGELOG.md` | Application version history: additions, changes, fixes, and breaking changes. |
| `docs/architecture/overview.md` | System architecture, components, integration boundaries, persistence, and data flow. |
| `docs/architecture/domain-model.md` | Conceptual entities, relationships, invariants, and lifecycle rules. |
| `docs/architecture/data-dictionary.md` | Implemented fields, types, units, constraints, and derived values. |
| `docs/architecture/decisions/` | Architecture Decision Records for significant design choices and reversals. |
| `docs/features/` | Approved Feature Briefs. |
| `specs/<feature>/` | Specifications, implementation plans, tasks, and verification artifacts. |
| `docs/operations/` | Backup, restore, migration, and recovery procedures as implemented. |

**Documentation rules:**

- Update affected documentation within the same Feature implementation or pull request.
- Keep the repository map current whenever modules, directory structure, or responsibilities change.
- Update domain models when introducing or modifying entities, relationships, or invariants.
- Record significant architectural decisions with their rationale and trade-offs.
- Maintain a human-readable CHANGELOG, distinct from Azusa's internal PI Plan Versioning.
- Avoid duplicating specifications across documents.
- Prefer updating existing documentation over creating competing sources of truth.

Documentation should explain **why, what, and where**. Code and tests should demonstrate **how**.

## VII. Consistent and Accessible User Experience

Follow the approved Azusa visual language, terminology, and interaction conventions.

- Preserve the distinction between planning information and visual board placement.
- Present assumptions, calculations, dependencies, and commitment reviews clearly.
- Prefer advisory warnings over unnecessary hard restrictions on team planning.
- Include appropriate responsive behavior, accessibility, keyboard interaction, and empty/error states.
- Maintain visual and behavioral consistency across screens.

---

## Working Agreement

### Responsibilities

- **Claude:** Architecture, design guidance, and conformance review.
- **ChatGPT:** Feature Brief preparation.
- **Agy:** Specification, implementation planning, and task decomposition.
- **Codex:** Developer review and implementation.
- **Claude Code + Operator:** UAT and acceptance.

The operator retains final authority over requirements, scope, and design decisions.

### Requirement Precedence

When artifacts conflict, resolve them using the following hierarchy:

1. Project Constitution
2. Approved cross-feature decisions and domain model
3. Approved Feature Specification
4. Feature Brief
5. Prototype and design references

This order resolves genuine conflicts only. It does not make lower-ranked artifacts optional:
absent a conflict, the prototype remains the fidelity target under Principle II.

Existing implementation does not supersede approved requirements.

### Definition of Done

A Feature is complete only when:

- Approved acceptance criteria are satisfied.
- Relevant automated tests and quality checks pass.
- Conformance review and UAT are completed.
- Database migrations and data-recovery implications are addressed where applicable.
- Affected documentation is updated, including the repository map, domain model, README, and CHANGELOG when relevant.

Unaffected documentation need not be modified.

---

## Governance

This constitution applies to all Azusa Features and AI-assisted development activities.

Feature specifications may refine its principles but must not contradict them without an operator-approved amendment.

Amendments must document the change, rationale, and implications for existing specifications or implementation.

Constitution versioning follows semantic versioning:

- **Major:** Fundamental changes to governing principles.
- **Minor:** New substantive rules or responsibilities.
- **Patch:** Editorial changes and clarifications.

**Version:** 1.1.0 | **Ratified:** 2026-11-08 | **Last Amended:** 2026-11-24

**Status:** Ratified by the operator.