---
description: Update any field on a Mission Control ticket — priority, size, category, status, title, or body
---

# Update Ticket: $ARGUMENTS

Update one or more fields on a GitHub issue in the Mission Control project board.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 1 — Parse arguments

`$ARGUMENTS` formats accepted:

```
42 priority:High
42 size:S
42 category:Bug
42 status:done
42 priority:Critical size:XL
42 title:"New title for this ticket"
#42 priority:low size:xs category:chore
```

Parse out:
- **Issue number** — required (strip leading `#`)
- **priority:** — fuzzy-match: Critical / High / Medium / Low
- **size:** — fuzzy-match: XS / S / M / L / XL
- **category:** — fuzzy-match: Feature / Bug / Chore / Design / Documentation / Research
- **status:** — fuzzy-match: Backlog / Todo / In Progress / In Review / Done
- **title:** — new issue title (quoted string)
- **body:** — new issue body (quoted string)

All field arguments are optional but at least one must be provided.
Fuzzy match is case-insensitive and partial — `crit`, `high`, `xs`, `chore` all work.

If no issue number is given, ask the user which ticket to update.
If no fields are given, show the current ticket state and ask what to change.

---

## Step 2 — Detect repo

```bash
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
```

---

## Step 3 — Show current ticket state

Fetch the issue to confirm it exists and show what is changing:

```bash
gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json number,title,labels,state
```

Print a brief summary:
```
Updating #42: "Add Storybook section to HUMAN_GUIDE.md"
  priority: Medium -> High
  size:     M -> S
```

Then proceed — do not ask for confirmation.

---

## Step 4 — Update GitHub issue fields (title/body)

Only if title or body was specified:

```bash
gh issue edit "$ISSUE_NUMBER" --repo "$REPO" --title "$NEW_TITLE"
gh issue edit "$ISSUE_NUMBER" --repo "$REPO" --body "$NEW_BODY"
```

---

## Step 5 — Find project item ID

```bash
gh api graphql -f query='
  query($org: String!, $number: Int!) {
    organization(login: $org) {
      projectV2(number: $number) {
        items(first: 100) {
          nodes {
            id
            content {
              ... on Issue { number }
            }
          }
        }
      }
    }
  }
' -F org="$ORG" -F number="$PROJECT_NUMBER"
```

If not found in project, add it:

```bash
ITEM_ID=$(gh project item-add "$PROJECT_NUMBER" \
  --owner "$ORG" \
  --url "https://github.com/$REPO/issues/$ISSUE_NUMBER" \
  --format json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
```

---

## Step 6 — Fetch field IDs and option IDs

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

## Step 7 — Update each specified project field

For each field provided (Status, Priority, Size, Category):

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

Only update fields explicitly provided in `$ARGUMENTS`.

---

## Step 8 — Output a summary

```
Ticket #42 updated

  priority: Medium -> High
  size:     M -> S

  Issue : https://github.com/{repo}/issues/42
  Board : https://github.com/orgs/trustdesign-io/projects/3
```

---

## Notes

- Works from any repo in trustdesign-io.
- To update multiple tickets to the same value: `/update-ticket 42,43 priority:High`
- If a field value is already what you specified, skip it silently.
