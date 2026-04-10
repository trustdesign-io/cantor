---
description: Move a ticket to a different status column on Mission Control, and optionally update Priority, Size, or Category
---

# Move Ticket: $ARGUMENTS

Update a GitHub issue's fields on the **Mission Control** project board.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 1 — Parse arguments

`$ARGUMENTS` formats accepted:

```
42 "In Progress"
42 done
42 review priority:High
#42 "In Progress" size:S category:Bug
42,43,44 "In Review"
```

Parse out:
- **Issue number(s)** — required (strip leading `#`; split on comma for multiple)
- **Status** — fuzzy-match: Backlog / Todo / In Progress / In Review / Done
- **priority:** — fuzzy-match: Critical / High / Medium / Low
- **size:** — fuzzy-match: XS / S / M / L / XL
- **category:** — fuzzy-match: Feature / Bug / Chore / Design / Documentation / Research

Fuzzy match is case-insensitive and partial — `done`, `DONE`, `review`, `prog` all work.

If issue number is missing, ask the user.

---

## Step 2 — Detect repo

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
```

---

## Step 3 — Find project item ID for each issue

```bash
gh api graphql -f query='
  query($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue { number url }
            }
          }
        }
      }
    }
  }
' -F org="$ORG" -F number="$PROJECT_NUMBER"
```

Parse to find the item whose `content.number` matches the issue number.
If not found, add it first:

```bash
ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" \
  --owner "$ORG" \
  --url "https://github.com/$REPO/issues/$ISSUE_NUMBER" \
  --format json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
```

---

## Step 4 — Fetch all field IDs and option IDs

```bash
gh api graphql -f query='
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
' -F org="$ORG" -F number="$PROJECT_NUMBER"
```

---

## Step 5 — Update each specified field

Only update fields explicitly provided in `$ARGUMENTS`. For each:

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

---

## Step 6 — Output a summary

Only show fields that were actually changed:

```
Ticket #42 updated

  Issue     : https://github.com/{repo}/issues/42
  Status    : In Progress
  Priority  : High              (if changed)

  Board     : https://github.com/orgs/trustdesign-io/projects/3
```

---

## Notes

- Works from any repo in trustdesign-io.
- If an issue is not yet on the board it is added automatically.
- For multiple tickets: `/move-ticket 42,43,44 done`
