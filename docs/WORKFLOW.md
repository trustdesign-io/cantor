# Agentic Development Workflow

This document describes how development work flows through this project using Claude Code as the primary development agent.

---

## Overview

Work is tracked on **Mission Control** — a GitHub Projects board at `github.com/orgs/trustdesign-io/projects/3`. Claude Code handles the full loop: picking up tickets, implementing changes, opening PRs, self-reviewing them, and moving the ticket to In Review for human sign-off.

The human's role is to **define work** (create tickets), **review PRs**, and **merge**. Claude handles everything in between.

---

## The board

| Status | Meaning |
|--------|---------|
| Backlog | Defined but not yet prioritised for action |
| Todo | Ready to be picked up |
| In Progress | Claude is actively working on it |
| In Review | PR open, waiting for human review and merge |
| Done | Merged and closed |

---

## Slash commands

All workflow actions are available as slash commands inside Claude Code.

### Board and tickets

| Command | What it does |
|---------|-------------|
| `/board` | Show open tickets for this repo |
| `/create-ticket <title> [category:X] [priority:X] [size:X]` | Create an issue and add it to the board |
| `/update-ticket <number> [field:value ...]` | Update priority, size, category, or status |
| `/move-ticket <number> <status>` | Move a ticket to a different status column |

### Doing the work

| Command | What it does |
|---------|-------------|
| `/take-task [next\|<number>]` | Pick up a ticket, implement it, open a PR, self-review, move to In Review |
| `/review-pr <number>` | Run a self-review sub-agent on an existing PR |

### Development

| Command | What it does |
|---------|-------------|
| `/new-feature <name>` | Plan and implement a new feature end-to-end |
| `/new-page <name>` | Scaffold a new route component |
| `/new-component <name>` | Scaffold a reusable component |
| `/apply-brand` | Apply brand colours, typography, and design tokens |
| `/review` | Pre-PR code review checklist |

---

## End-to-end flow

```
Human                          Claude Code
  │                                │
  ├─ /create-ticket ───────────────┤  Creates GitHub issue + adds to board
  │                                │
  ├─ /take-task next ──────────────┤
  │                                ├─ Moves ticket to In Progress
  │                                ├─ Creates feature branch
  │                                ├─ Implements the change
  │                                ├─ Runs: lint → type-check → unit tests → build
  │                                ├─ Commits and pushes
  │                                ├─ Opens PR
  │                                ├─ Self-review via sub-agent → posts comment
  │                                └─ Moves ticket to In Review
  │                                │
  ├─ Reviews PR on GitHub ─────────┤
  ├─ Merges PR ────────────────────┤
  │                                │
  └─ /take-task next ──────────────┘
```

---

## Branch and commit conventions

**Branches** are named by category:
- Feature / Docs / Research → `feature/{number}-{slug}`
- Bug → `fix/{number}-{slug}`
- Chore → `chore/{number}-{slug}`

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org/):
```
feat: add items list page

Implements the items listing with local JSON data source.

Refs #7
```

Commit types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `design`.

PRs always target `main`. Never push directly to `main`.

---

## CI

Every PR (and every push to `main`) runs `.github/workflows/ci.yml`, which gates merge on:

1. `npm ci`
2. `npm run lint`
3. `npm run type-check`
4. `npm run test`
5. `npm run build`
6. `npm run test:e2e` (Playwright, Chromium only)

Claude will not open a PR with failing lint, type-check, or tests. Errors are fixed on the branch before pushing.

---

## Human checkpoints

Claude always stops for human input at:

1. **Before starting a Backlog ticket** — asks before touching a ticket not in Todo
2. **After opening a PR** — moves to In Review and waits; never merges
3. **Ambiguous requirements** — asks one focused question before continuing
