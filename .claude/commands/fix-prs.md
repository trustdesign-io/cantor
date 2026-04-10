---
description: Review all open PRs — rebase conflicts, fix build failures, and force-push
---

# Fix PRs

Review every open PR in the current repo, rebase onto latest main, fix any
build failures, and force-push. This command runs autonomously — no user
input needed between PRs.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 1 — List all open PRs

```bash
gh pr list --repo "$REPO" --state open --json number,title,headRefName,baseRefName
```

If no open PRs, tell the user and stop.

---

## Step 2 — For each PR, in order (lowest number first)

### 2a — Fetch and checkout the branch

```bash
git checkout main && git pull origin main
git fetch origin
git checkout {branch}
git pull origin {branch}
```

### 2b — Rebase onto main

```bash
git rebase main
```

If the rebase has conflicts:
1. Examine each conflicting file
2. Resolve the conflict intelligently — prefer the branch's changes for
   feature code, prefer main's changes for config/lock files
3. `git add {resolved files} && git rebase --continue`
4. If a conflict is genuinely ambiguous, skip this PR, leave a comment
   on the PR explaining the conflict, and move to the next one

### 2c — Verify the build

```bash
npm ci
npm run type-check
npm run build
npm run lint
```

If any step fails:
1. Read the error output carefully
2. Fix the issue on the branch
3. `git add -A && git commit --author="trustdesign-bot <bot@trustdesign.io>" -m "fix: resolve build failure after rebase"`
4. Re-run the failing step to confirm it passes
5. If the fix is non-trivial or unclear, skip this PR, leave a comment
   explaining the failure, and move to the next one

### 2d — Force-push the rebased branch

```bash
git push --force-with-lease origin {branch}
```

### 2e — Comment on the PR

```bash
gh pr comment {number} --repo "$REPO" \
  --body "Rebased onto latest main and verified build passes. Ready for review."
```

---

## Step 3 — Summary

After processing all PRs, print a summary:

```
PR Fix Summary

  Total open PRs : {count}
  Fixed          : {count} (rebased + build passing)
  Skipped        : {count} (manual intervention needed)

  Fixed:
  - #{number} {title}
  - #{number} {title}

  Skipped (needs manual fix):
  - #{number} {title} — {reason}
```

---

## Rules

- Always use `--force-with-lease` (not `--force`) when pushing
- Never merge PRs — only rebase and fix
- If a PR's branch no longer exists, skip it
- Process PRs in order (lowest number first) to minimise cascading conflicts
- After rebasing one PR, go back to main and pull before starting the next
