---
description: Work through all Todo tickets sequentially — implement, merge, repeat
---

# Work All: $ARGUMENTS

Work through Todo tickets one at a time. For each ticket: implement it on a
feature branch, self-review, merge the PR into main, move the ticket to Done,
then start the next ticket from a clean main. This prevents merge conflicts
and ensures each task builds on the previous one.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Pre-check — PRD required

Before doing anything, check if `PRD.md` exists in the project root:

```bash
ls PRD.md 2>/dev/null || ls docs/PRD.md 2>/dev/null
```

If no PRD exists, **stop and warn the user**:

> "This project has no PRD.md. Without a product requirements document,
> tickets may not align with the product vision. Run `/prd` first.
>
> Continue anyway? (y/n)"

Only proceed if the user explicitly confirms.

---

## Step 0 — Recover dropped work and build the queue

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)
```

### 0a — Check for dropped In Progress tickets

Before building the Todo queue, check for tickets that are stuck in
**In Progress** or **In Review** status on the board for the current repo.
These are tickets that were started but never finished — likely from a
previous session that was interrupted, a context window that ran out, or a
`/take-task` that was abandoned.

Fetch all board items with Status = "In Progress" or "In Review" for the
current repo. For each one, check:

1. **Has an open PR?** → Check if the branch exists and has an open PR.
   - If PR exists and CI passes → resume from self-review step (1i)
   - If PR exists but CI fails → check out the branch, fix, and continue
2. **Has a branch but no PR?** → Check out the branch, assess what's done,
   continue the work from where it left off.
3. **No branch at all?** → The ticket was moved to In Progress but work never
   started. Treat it as a normal Todo ticket.

Display dropped tickets separately:

```
Dropped tickets found ({N}):

  # | Issue | Title                          | Status      | State
  1 | #5    | Add swipe gestures             | In Progress | Branch exists, no PR
  2 | #9    | Fix auth token refresh         | In Review   | PR open, CI failing

These will be completed first before moving to the Todo queue.
```

### 0b — Build the Todo queue

| Input                     | Behaviour                                           |
|---------------------------|-----------------------------------------------------|
| (empty)                   | Fetch all Todo tickets for the current repo, ordered by Priority (Critical > High > Medium > Low), tiebreak by lowest issue number |
| `7 12 3`                  | Work those specific tickets in the given order       |
| `--dry-run`               | List the tickets that would be worked but don't start |

**Exact query to fetch Todo tickets — COPY THIS VERBATIM:**

> ⚠️ **YOU MUST COPY-PASTE THE QUERY BELOW EXACTLY AS WRITTEN.**
> Do NOT rewrite it. Do NOT remove the `status:` and `priority:` aliases.
> Do NOT wrap this in Python or Node. Do NOT use `fieldValueByName` without
> the aliases — it WILL error with "has an argument conflict".
> The query below has been tested and works. Use it verbatim.

```bash
gh api graphql --paginate -f query='query($cursor: String) {
  node(id: "PVT_kwDODlnZic4BRn_o") {
    ... on ProjectV2 {
      items(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          status: fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          priority: fieldValueByName(name: "Priority") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
          content {
            ... on Issue {
              number
              title
              state
              repository { name }
            }
          }
        }
      }
    }
  }
}'
```

> **Note the aliases:** `status:` and `priority:` before each `fieldValueByName`.
> Without aliases, GraphQL rejects the query because the same field name appears
> twice with different arguments. **Do not remove the aliases.**

**Parsing the response — use jq, not Python:**

The `--paginate` flag may return multiple JSON objects (one per page). Pipe
through `jq -s` (slurp) to merge pages into a single array, then filter:

```bash
gh api graphql --paginate -f query='...(as above)...' | jq -s '
  [.[].data.node.items.nodes[]
   | select(
       (.status.name // "") == "Todo"
       and (.content.repository.name // "") == "REPO_NAME_HERE"
       and (.content.state // "") == "OPEN"
     )
   | {
       number: .content.number,
       title: .content.title,
       priority: (.priority.name // "Medium")
     }
  ]
'
```

Replace `REPO_NAME_HERE` with the actual repo name (from `$REPO_NAME`).

> **The jq fields match the GraphQL aliases:** `.status.name` and `.priority.name`
> (NOT `.fieldValueByName.name`). If you change the aliases in the query, update
> the jq filter to match.

**If the jq filter returns an empty array `[]`**, that means there are no
Todo tickets — show "No Todo tickets found" and stop. Do NOT assume the
query failed; check the raw response first with `gh api graphql ... | head -20`
before retrying.

Sort the results:
1. Priority order: Critical > High > Medium > Low
2. Tiebreak by lowest issue number
3. This is the Todo queue

**Do not use a smaller `first` value.** The query must use `first: 100` with
`--paginate` to ensure all tickets are fetched. A common failure mode is using
`first: 20` and silently missing tickets.

### 0c — Show the full work plan

Combine dropped tickets (first) and Todo tickets (after) into a single queue:

```
Work plan:

  RESUMING (dropped/stuck tickets — completed first):
  1 | #5    | Add swipe gestures             | In Progress | Has branch
  2 | #9    | Fix auth token refresh         | In Review   | PR open

  THEN (Todo queue by priority):
  3 | #7    | Fix navigation back buttons     | Critical    | S
  4 | #8    | Add safe area insets            | High        | S
  5 | #12   | Add quick-add task bar          | High        | M

Total: {N} tickets. Start working? (y/n)
```

Wait for confirmation before proceeding.

---

## Step 1 — For each ticket in the queue

### 1a — Ensure clean main

```bash
git checkout main && git pull origin main
```

If there are uncommitted changes, stash them:
```bash
git stash push -m "work-all: stashing before ticket #{number}"
```

### 1b — Show progress

```
────────────────────────────────────────
Working on ticket {current}/{total}: #{number} — {title}
────────────────────────────────────────
```

### 1c — Resume or start fresh

**If this is a dropped ticket being resumed:**

Check the state detected in Step 0a and skip ahead:

| State                        | Resume from              |
|------------------------------|--------------------------|
| PR open, CI passes           | Step 1i (self-review)    |
| PR open, CI fails            | Check out branch, fix build (Step 1f), then push and continue |
| Branch exists, no PR         | Check out branch, assess progress, continue work (Step 1e) |
| Branch exists, has commits but incomplete work | Check out branch, read the diff to understand what's done, continue from where it left off |
| No branch                    | Treat as new ticket (Step 1d) |

When resuming a branch, always pull latest main and rebase first:
```bash
git checkout {existing-branch}
git fetch origin main
git rebase origin/main
```

If the rebase has conflicts, resolve them before continuing.

**If this is a new Todo ticket:**

Move ticket to In Progress on the board using `updateProjectV2ItemFieldValue`
with single-quoted query strings.

### 1d — Create feature branch (new tickets only)

Branch naming (same as /take-task):
- Feature / Documentation / Chore / Research: `feature/{number}-{slug}`
- Bug: `fix/{number}-{slug}`
- Design: `design/{number}-{slug}`

```bash
git checkout -b {prefix}/{number}-{slug}
```

### 1e — Do the work

Read `CLAUDE.md` first. Follow the same implementation rules as `/take-task`
Step 4 (plan, implement, test, follow existing patterns).

**Design tickets still require a plan approval step** — stop and ask the user
before making changes. This is the ONE exception to the autonomous flow.

### 1f — Verify the build

```bash
npm ci
npm run type-check
npm run build
npm run lint
```

If ANY fail, fix before continuing. Do not proceed with a broken build.

### 1g — Commit and push

```bash
git add -A
git commit -m "{type}: {short description}

{Brief explanation}

Refs #{number}"
git push -u origin HEAD
```

### 1h — Open PR

```bash
gh pr create \
  --title "{type}: {issue title}" \
  --body "## Summary
- {what was done}
- {why}

## Changes
{files changed and reason}

## Testing
{how to verify}

Closes #{number}

---
This PR was created by Claude Code via /work-all." \
  --base main \
  --head "$(git branch --show-current)"
```

### 1i — Self-review via sub-agent

Same as `/take-task` Step 9 — spawn a sub-agent to review the PR using the
bot token. If NEEDS CHANGES, fix and re-review. Repeat until APPROVED.

### 1j — Merge the PR

**This is the key difference from `/take-task`.** After self-review passes:

```bash
gh pr merge "$PR_NUMBER" --repo "$REPO" --squash --delete-branch
```

Use `--squash` to keep main history clean. The `Closes #{number}` in the PR
body will automatically close the issue.

### 1k — Verify merge and update board

```bash
git checkout main && git pull origin main
```

Move ticket to Done on the board (it should auto-close from the PR merge, but
set it explicitly to be safe).

### 1l — Log progress

```
✓ #{number} — {title}
  PR: {PR_URL} (merged)
  {current}/{total} complete
```

### 1m — Continue to next ticket

Loop back to Step 1a for the next ticket in the queue.

---

## Step 2 — Final summary

After all tickets are complete:

```
──────────────────────────────
/work-all complete: {N}/{N} tickets done
──────────────────────────────

  # | Issue | Title                          | PR        | Status
  1 | #7    | Fix navigation back buttons     | #14 ✓     | Done
  2 | #8    | Add safe area insets            | #15 ✓     | Done
  3 | #12   | Add quick-add task bar          | #16 ✓     | Done

  Board: https://github.com/orgs/trustdesign-io/projects/3
```

---

## Error handling

If a ticket fails (build broken, tests failing, ambiguous requirements):

1. Move the ticket back to Todo
2. Add a comment on the issue explaining what went wrong
3. Log the failure:
   ```
   ✗ #{number} — {title}
     Reason: {why it failed}
     Skipping — moved back to Todo
   ```
4. Continue to the next ticket (don't stop the whole run)

At the end, the summary shows which succeeded and which were skipped.

---

## Hard rules

- Always start each ticket from a clean, up-to-date main
- Squash merge to keep history clean
- Design tickets still require user plan approval before implementation
- If a ticket fails, skip it and continue — don't block the queue
- Log everything clearly so the user can see what happened
- **NEVER stop early.** You MUST attempt every ticket in the queue before
  showing the final summary. If you have completed 2 tickets but there are
  5 more in the queue, you are NOT done. Keep going. The only valid reasons
  to stop are: (a) every ticket is done or skipped, (b) the user interrupts,
  or (c) you have hit an unrecoverable environment error (e.g. no git, no gh).
  Running out of motivation or losing track is NOT a valid reason to stop.
- **NEVER write Python or Node scripts to call `gh api graphql`** — always
  use the `gh` CLI directly with `jq` for parsing. Writing wrapper scripts
  is the #1 cause of `KeyError` and parsing failures.
- **Count your tickets.** At the start, note the total count. After each
  ticket, print `{completed}/{total}`. If completed < total, loop back.
