---
description: Self-review a pull request using a sub-agent and post findings as a PR comment
---

# Review PR: $ARGUMENTS

Review a pull request, post a structured code review as a GitHub comment, and
report the verdict.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 1 — Identify the PR

Parse `$ARGUMENTS`:
- PR number given (e.g. `12` or `#12`) — use that PR
- PR URL given — extract the number
- Empty — fetch the PR for the current branch:
  ```bash
  gh pr view --json number,url
  ```

---

## Step 2 — Spawn a review sub-agent

Resolve `$TRUSTDESIGN_BOT_TOKEN` from the environment now (before spawning),
then substitute it literally into the prompt below so the sub-agent has the
value without needing shell variable expansion.

Use the Task tool to spawn a sub-agent with this prompt (substitute real values):

```
You are a senior code reviewer. Perform a thorough review of this pull request.

Repo: {REPO}
PR: {PR_NUMBER}
Bot token: {TRUSTDESIGN_BOT_TOKEN}

## CRITICAL — All gh commands must use the bot token
Set this at the start and use it for every gh call:
  export GH_TOKEN={TRUSTDESIGN_BOT_TOKEN}

This ensures all comments and reviews appear as trustdesign-bot, not the
personal GitHub account.

Steps:
1. Run: GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} gh pr view {PR_NUMBER} --repo {REPO} --json number,title,body,files,additions,deletions,baseRefName,headRefName
2. Run: GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} gh pr diff {PR_NUMBER} --repo {REPO}
3. Read CLAUDE.md for project conventions and patterns
4. Read any files that were changed to understand full context

Review for:
- Correctness: does the PR fully address the linked issue?
- Conventions: follows patterns in CLAUDE.md?
- Code quality: clean, readable, maintainable?
- Edge cases: missing error handling, null checks, loading states?
- Tests: are tests added or updated where needed?
- Build risk: could this break existing functionality?
- Naming: clear variable, function, and file names?
- Documentation: are relevant docs updated if behaviour changed?

Post your review as a structured comment on the PR:
GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} gh pr review {PR_NUMBER} --repo {REPO} --comment --body "
## Code Review

### Verdict: APPROVED / NEEDS CHANGES

### Summary
{2-3 sentence overview}

### Issues
{bullet list — only include if NEEDS CHANGES}

### Suggestions (non-blocking)
{optional improvements}

### Checklist
- [ ] Addresses the issue fully
- [ ] Follows project conventions
- [ ] No obvious bugs or edge cases
- [ ] Tests present where needed
- [ ] Build should pass
"

Return your verdict: APPROVED or NEEDS CHANGES, with a brief summary.
```

---

## Step 3 — Report to user

```
PR #{number} review complete

  PR      : {PR_URL}
  Verdict : APPROVED / NEEDS CHANGES
  Summary : {one-line from sub-agent}

  Full review posted as a comment on the PR.
  {If NEEDS CHANGES}: Run /take-task {issue_number} to fix and re-review.
```

---

## Notes

- Works on any PR in the current repo or any trustdesign-io repo
- Can be run standalone: `/review-pr 12`
- Or on current branch PR: `/review-pr`
- If NEEDS CHANGES is returned, fix on the same branch and re-run
