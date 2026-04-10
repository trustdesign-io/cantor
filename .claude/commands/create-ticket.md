---
description: Create a GitHub issue and add it to Mission Control (trustdesign-io project board)
---

# Create Ticket: $ARGUMENTS

Create a GitHub issue in the current repository and automatically add it to the
**Mission Control** project board for trustdesign-io.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 0 — PRD check

Before creating any tickets, check if `PRD.md` exists in the project root:

```bash
ls PRD.md 2>/dev/null || ls docs/PRD.md 2>/dev/null
```

If no PRD exists, **stop and warn the user**:

> "This project has no PRD.md. Tickets should be driven by the product
> requirements document to avoid building the wrong thing. Run `/prd` first
> to define what this product is, who it's for, and what it should do.
>
> Continue anyway? (y/n)"

Only proceed if the user explicitly confirms. This prevents tickets being
created without a product definition.

---

## Step 1 — Gather ticket details

### Batch mode (multiple tickets)

If `$ARGUMENTS` contains **multiple tickets** (separated by `---` or formatted
as numbered blocks with Title/Category/Priority/Size/Body sections), switch to
**batch mode**:

1. Parse all tickets from the input
2. Show a numbered summary table of all tickets (Title, Category, Priority, Size)
3. Ask the user to confirm: "Create all {N} tickets? (y/n)"
4. If confirmed, create them all sequentially (Steps 2–7 for each)
5. At the end, show a single batch summary with all issue URLs

The expected format for each ticket in batch mode:

```
### {Title}

- **Category:** {Category}
- **Priority:** {Priority}
- **Size:** {Size}
- **Status:** {Status} (optional — defaults to Backlog)

## Overview
{description}

## Acceptance Criteria
- [ ] {criterion}

## Notes
{optional notes}
```

Multiple tickets are separated by `---`.

**When a ticket body is provided in full, use it as-is.** Do not rewrite,
summarise, or regenerate the Overview, Acceptance Criteria, or Notes sections.
These were written by the user (or by Cowork) with specific intent. Only
generate a body if the input is just a title with no body.

### Single ticket mode

If `$ARGUMENTS` is non-empty but contains only a single ticket, parse it as
the ticket **title** (and any provided fields). For all other fields, use
sensible defaults unless the user provided them.

Ask the user for the following (all optional — use defaults shown):

| Field        | Options                                                       | Default    |
|--------------|---------------------------------------------------------------|------------|
| **Title**    | Short imperative sentence                                     | (required) |
| **Category** | Feature / Bug / Chore / Design / Documentation / Research              | Feature    |
| **Priority** | Critical / High / Medium / Low                                | Medium     |
| **Size**     | XS / S / M / L / XL                                          | M          |
| **Status**   | Backlog / Todo / In Progress / In Review / Done               | Backlog    |
| **Assignee** | GitHub username                                               | (none)     |

If `$ARGUMENTS` looks like a description with a type prefix (e.g. "Bug: login
button unresponsive on mobile"), parse Category and Title from it, then confirm
with the user before proceeding.

**Only generate the issue body if one wasn't provided.** If the user pasted a
full ticket with Overview and Acceptance Criteria, use it verbatim. If only a
title was given, generate a body using this format:

```
## Overview
{2-3 sentences explaining what this is and why it's needed}

## Acceptance Criteria
- [ ] {specific, testable criterion}
- [ ] {specific, testable criterion}
- [ ] {add more as needed}

## Notes
{Any relevant context, links, constraints, or implementation hints — omit section if none}
```

Use your knowledge of the codebase to write meaningful, specific criteria.
For example, a ticket titled "Add CI GitHub Actions workflow" should list
criteria like "lint passes", "type-check passes", "build succeeds", not just
"workflow is added".

---

## Step 2 — Detect the current repo

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
REPO_NAME=$(echo "$REPO" | cut -d'/' -f2)
```

If this fails (not in a git repo), ask the user which repo to use:
```bash
gh repo list trustdesign-io --json nameWithOwner -q '.[].nameWithOwner'
```

---

## Step 2b — Ensure repo label exists

Check:
```bash
gh label list --repo "$REPO" --json name -q '.[].name' | grep -x "$REPO_NAME" || \
  gh label create "$REPO_NAME" --repo "$REPO" --color "0075ca" \
    --description "Issues from the $REPO_NAME repository"
```

---

## Step 3 — Create the GitHub issue

```bash
gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "$BODY" \
  --label "$REPO_NAME"
```

Add `--assignee "$ASSIGNEE"` only if an assignee was specified.
Capture the issue URL. Extract the issue number from the URL.

---

## Step 4 — Add issue to Mission Control

```bash
ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" \
  --owner "$ORG" \
  --url "$ISSUE_URL" \
  --format json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
```

---

## Step 5 — Fetch all field IDs and option IDs

```bash
FIELDS=$(gh api graphql -f query='
  query($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        fields(first: 30) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name }
            }
          }
        }
      }
    }
  }
' -F org="$ORG" -F number="$PROJECT_NUMBER")
```

Parse with Python into a dict: `{field_name: {id, options: {option_name: option_id}}}`.

---

## Step 6 — Set Status, Priority, Size, and Category fields

For each field, call (using single-quoted query string — required):

```bash
gh api graphql -f query='
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
' -F projectId="$PROJECT_ID" \
  -F itemId="$ITEM_ID" \
  -F fieldId="$FIELD_ID" \
  -F optionId="$OPTION_ID"
```

Repeat for Status, Priority, Size, and Category. Skip any field whose option
cannot be found (log a warning, do not abort).

---

## Step 7 — Output a summary

### Single ticket

```
Ticket created

  Title     : {title}
  Repo      : {repo}
  Issue     : {issue_url}
  Label     : {repo_name}
  Status    : {status}
  Priority  : {priority}
  Size      : {size}
  Category  : {category}

  Board     : https://github.com/orgs/trustdesign-io/projects/3
```

### Batch summary (when multiple tickets were created)

```
{N} tickets created

  # | Title                          | Status  | Priority | Size | Issue
  1 | {title}                        | {status}| {priority}| {size}| {url}
  2 | {title}                        | {status}| {priority}| {size}| {url}
  ...

  Board: https://github.com/orgs/trustdesign-io/projects/3
```

---

## Notes

- Works from any repo in trustdesign-io. Prompts for repo if not in a git dir.
- **Batch mode**: paste multiple tickets separated by `---` and they'll all be created in one go after confirmation.
- **Preserve provided bodies**: when a ticket is pasted with a full body (Overview, Acceptance Criteria), use it as-is. Only auto-generate bodies when just a title is given.
