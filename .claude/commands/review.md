---
description: Review code changes before a PR is opened
---

# Code Review

Review the current changes (or $ARGUMENTS if a specific file/area is specified) against the project's standards.

## Review Checklist

### Correctness
- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Is error handling complete and user-friendly?

### Conventions (`docs/CONVENTIONS.md`)
- [ ] Component structure follows the project pattern
- [ ] Naming conventions are consistent
- [ ] No `any` types
- [ ] Imports are ordered correctly
- [ ] Route components live in `src/routes/`, shared components in `src/components/`

### Security
- [ ] No credentials or tokens stored in code or local storage
- [ ] User input is validated with Zod before use
- [ ] No external API calls without user knowledge

### Performance
- [ ] No unnecessary re-renders (missing `useMemo`/`useCallback` where needed)
- [ ] Heavy components lazy-loaded if not above the fold
- [ ] No N+1 reads from local data sources

### Tests
- [ ] Unit tests for new utilities and logic functions
- [ ] Component tests for interactive UI
- [ ] Existing tests still pass: `npm run test`

### Build
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes
- [ ] `npm run build` passes

## Output Format

For each issue found, state:
1. **Severity:** 🔴 Blocker / 🟡 Warning / 🟢 Suggestion
2. **File and line**
3. **Issue description**
4. **Suggested fix**

Then provide an overall assessment: Ready to merge / Needs changes.
