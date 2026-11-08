# Azusa

Azusa is a personal, local-first learning project for Team- and ART-level Agile/SAFe
planning, execution, and reporting. It runs entirely on your machine with no paid APIs.

Engineering quality, maintainability, and a polished user experience take priority over
shipping speed. The governing rules are in the
[project constitution](.specify/memory/constitution.md) (v1.0.0).

> **Status:** Pre-implementation. The constitution and development workflow are in place;
> no application code or tech stack has been chosen yet. The setup sections below will be
> filled in by the first Feature that introduces the stack.

## Getting Started

### Prerequisites

_To be defined when the tech stack is selected._

### Installation

_To be defined._

### Configuration

_To be defined._

### Running Locally

_To be defined._

### Testing

_To be defined._ The constitution (Principle V) requires automated tests for domain
invariants, boundary conditions, and failure scenarios, plus golden fixtures for capacity
and reporting metrics.

## How Development Works

Work follows a **Milestone → Feature** cadence. Every Feature moves through:

**Feature Brief → Specification → Implementation Plan → Tasks → Implementation → Verification/UAT**

The workflow uses [Spec Kit](https://github.com/github/spec-kit). Feature Briefs live in
`docs/features/`, and each Feature's spec, plan, and tasks live in `specs/<feature>/`.

| Role | Responsibility |
|---|---|
| Claude | Architecture, design guidance, conformance review |
| ChatGPT | Feature Brief preparation |
| Agy | Specification, implementation planning, task decomposition |
| Codex | Developer review and implementation |
| Claude Code + Operator | UAT and acceptance |

The operator has final authority over requirements, scope, and design decisions.

The prompts each agent uses at each step are in [`scripts/prompts/`](scripts/prompts/).

## Repository Layout

| Path | Contents |
|---|---|
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md) | Project constitution: principles, working agreement, governance |
| [`.specify/templates/`](.specify/templates/) | Spec Kit templates for specs, plans, tasks, and checklists |
| [`.claude/skills/`](.claude/skills/) | Spec Kit commands for Claude Code (`/speckit-specify`, `/speckit-plan`, …) |
| [`scripts/prompts/`](scripts/prompts/) | Per-step agent prompts (specify, plan, tasks, reviews, implement) |
| [`docs/features/`](docs/features/) | Approved Feature Briefs |
| [`docs/handoffs/`](docs/handoffs/) | Handoff notes between agents |

## Documentation

The constitution (Principle VI) requires these documents. Each is created by the Feature
that first needs it, so most do not exist yet.

| Document | Purpose |
|---|---|
| `docs/REPO_MAP.md` | Directories, modules, entry points, architectural boundaries |
| `CHANGELOG.md` | Application version history |
| `docs/architecture/overview.md` | System architecture, persistence, and data flow |
| `docs/architecture/domain-model.md` | Entities, relationships, invariants, lifecycle rules |
| `docs/architecture/data-dictionary.md` | Fields, types, units, constraints, derived values |
| `docs/architecture/decisions/` | Architecture Decision Records |
| `docs/operations/` | Backup, restore, migration, and recovery procedures |
