---
description: Plan and implement a new feature end-to-end
---

# New Feature: $ARGUMENTS

## Process

Follow these steps in order. Do not skip any step.

### 1. Understand
- Read `CLAUDE.md`, `docs/ARCHITECTURE.md`, and `docs/CONVENTIONS.md` to understand the codebase context
- Identify existing patterns relevant to this feature
- List any unclear requirements and ask before proceeding

### 2. Plan
Before writing any code, produce:

**Feature brief:**
- What this feature does (user-facing description)
- Affected files and directories
- New files to create
- Data changes (if any — local JSON schema, SQLite table, or Context shape)
- Logic functions to create or modify (in `src/lib/`)
- UI components to create or modify

**Ask the user to confirm the plan before proceeding.**

### 3. Data (if needed)
- Define or update data schemas in `src/lib/` using Zod
- If using SQLite, add the migration or schema change
- If using local JSON, document the expected shape in a comment

### 4. Logic layer
- Create pure functions in `src/lib/[feature].ts`
- Add Zod validation for all inputs
- Add error handling — return result objects, don't throw to the UI

### 5. UI layer
- Create components following `docs/CONVENTIONS.md`
- Use shadcn/ui components as building blocks
- Apply brand styles from `src/index.css` CSS variables
- Add loading states and error states

### 6. Tests
- Write unit tests for utilities and logic functions in `tests/`
- Write component tests for interactive UI
- Add E2E test if this is a user-facing flow

### 7. Verify
- Run `npm run lint && npm run type-check && npm run test && npm run build`
- Fix any errors before marking complete

### 8. Summary
Provide a brief summary of what was built, what files were changed, and any follow-up tasks.
