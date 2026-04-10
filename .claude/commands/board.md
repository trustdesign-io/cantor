---
description: Show the Mission Control board filtered to the current repo
---

# Board: $ARGUMENTS

Display open tickets on the Mission Control project board.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 1 — Detect current repo

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)
```

If `$ARGUMENTS` contains a repo name (e.g. `board starter-web` or `board all`),
use that instead. If `$ARGUMENTS` is `all`, show tickets from all repos.

---

## Step 2 — Fetch all project items

```bash
gh api graphql -f query='
  query($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        items(first: 100) {
          nodes {
            id
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field { ... on ProjectV2SingleSelectField { name } }
                }
                ... on ProjectV2ItemFieldRepositoryValue {
                  repository { nameWithOwner name }
                  field { ... on ProjectV2Field { name } }
                }
              }
            }
            content {
              ... on Issue {
                number
                title
                url
                assignees(first: 3) { nodes { login } }
                labels(first: 5) { nodes { name } }
              }
            }
          }
        }
      }
    }
  }
' -F org="$ORG" -F number="$PROJECT_NUMBER"
```

---

## Step 3 — Parse and filter

Use Python to parse the response. Build a list of tickets with:
- Issue number
- Title
- Status
- Priority
- Size
- Category
- Repository name
- Assignees

If not showing `all`, filter to only tickets where the repository name matches
`$REPO_NAME` OR where a label matches `$REPO_NAME`.

Exclude tickets with Status = `Done`.

---

## Step 4 — Display as a board summary

Group by Status in this order: `In Progress` → `In Review` → `Todo` → `Backlog`

Format:

```
📋  Mission Control — {repo_name}
    https://github.com/orgs/trustdesign-io/projects/3

● IN PROGRESS
  #7  Add Storybook section to HUMAN_GUIDE.md  [Documentation · S · Medium]

◑ IN REVIEW
  (none)

○ TODO
  #8  Set up global Claude Code auto-approval settings documentation  [Documentation · S · Medium]
  #9  TEST 2  [Feature · M · Medium]

○ BACKLOG
  (none)

  Total: 3 open tickets
  Run /take-task <number> or /take-task next to start working
```

Use these symbols:
- `●` In Progress
- `◑` In Review
- `○` Todo / Backlog
- `✓` Done (only show if $ARGUMENTS contains `--all` or `all`)

If there are no tickets for this repo, say so and suggest `/create-ticket`.

---

## Notes

- `/board` — shows current repo only, excludes Done
- `/board all` — shows all repos, excludes Done
- `/board --all` — shows all repos including Done
- `/board starter-web` — shows a specific repo by name
