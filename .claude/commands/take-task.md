---
description: Pick up a task from Mission Control, move it to In Progress, and complete it
---

# Take Task: $ARGUMENTS

Pick up a ticket from Mission Control, do the work on a feature branch, open a
PR, self-review it via sub-agent, and move the ticket to In Review — ready for
your final approval to merge.

> **Read `.claude/SHARED_CONFIG.md` first** — it defines ORG, PROJECT_ID,
> bot token usage, GraphQL quoting rules, and git workflow rules.

---

## Step 0 — PRD check

Before starting any work, check if `PRD.md` exists in the project root:

```bash
ls PRD.md 2>/dev/null || ls docs/PRD.md 2>/dev/null
```

If no PRD exists, **stop and warn the user**:

> "This project has no PRD.md. Without a product requirements document,
> there's no shared definition of what the product is, who it's for, or
> what the design direction should be. Run `/prd` first.
>
> Continue anyway? (y/n)"

Only proceed if the user explicitly confirms.

---

## Step 1 — Identify the ticket

Parse `$ARGUMENTS`:
- Number given (e.g. `7` or `#7`) — use that issue
- `next` or empty — fetch highest priority Todo ticket for current repo
  (Priority: Critical > High > Medium > Low; tiebreak: lowest number first)
- Multiple numbers (e.g. `7 8 9`) — queue them, complete one before starting next
- `auto` — work through all Todo tickets sequentially, merging each PR before
  starting the next to prevent merge conflicts

To find the next ticket, fetch the board and filter to Status = Todo and
Repository = current repo (or label matches repo name).

If no Todo tickets exist, check Backlog and ask the user before proceeding.

---

## Step 2 — Show the ticket and move to In Progress

```bash
gh issue view "$ISSUE_NUMBER" --repo "$REPO" --json number,title,body,labels
```

Print a summary, then immediately move the ticket to In Progress on the board
using `updateProjectV2ItemFieldValue` with single-quoted query strings.

---

## Step 3 — Create a feature branch

Branch naming:
- Feature / Documentation / Chore / Research: `feature/{number}-{slugified-title}`
- Bug: `fix/{number}-{slugified-title}`
- Design: `design/{number}-{slugified-title}`

Slugify: lowercase, hyphens, strip special chars, max 50 chars.

```bash
git checkout main && git pull origin main
git checkout -b feature/{number}-{slug}
```

---

## Step 4 — Do the work

Read `CLAUDE.md` first. Based on Category:

| Category      | Approach |
|---------------|----------|
| Feature       | Plan, implement, test following existing patterns |
| Bug           | Investigate root cause, fix, add regression note |
| Chore         | Make the change, keep it focused |
| Design        | **Read `DESIGN-CONTEXT.md` first.** Then ask the user one question: "What are the authenticated pages for this product?" (e.g. Orders/Account for e-commerce, Dashboard/Analytics for SaaS — do not assume). Then present a written plan covering: all public pages, sign-in, sign-up, and the confirmed authenticated pages — plus colour tokens, typography, and components. Wait for explicit user approval before touching any files. Verify in Storybook when done. |
| Documentation | Write or update the relevant documentation file |
| Research      | Investigate, write findings in docs/research/ |

Work autonomously. Only stop if the issue body is genuinely ambiguous about
what done means — ask the user one focused question then continue.

**Exception — Design tickets always require a plan approval step** before
any files are created or modified. This is non-negotiable regardless of how
clear the brief appears.

If the task turns out to be multi-day, stop: move ticket back to Todo, add a
comment on the issue explaining what is needed, and tell the user.

---

## Step 4b — Design verification checklist (Design tickets only)

Before committing any Design ticket, manually verify every item below.
Do not open a PR until all are checked.

**Fonts**
- [ ] Every font added to `src/app/layout.tsx` has a matching `setProperty` line in `.storybook/preview.ts`
- [ ] Every font added to `src/app/layout.tsx` has a matching `@import` in `.storybook/preview-head.html`
- [ ] Verify in Storybook that custom fonts are rendering — not falling back to system fonts

**Tokens**
- [ ] No duplicate or conflicting colour scales in `globals.css` (e.g. old shadcn grays alongside new brand neutrals)
- [ ] All semantic tokens (`--background`, `--foreground`, `--primary` etc.) mapped to brand palette values
- [ ] Dark mode tokens defined if the project supports dark mode

**Interactive states**
- [ ] Every interactive element has a hover state (`transition-colors duration-200` minimum)
- [ ] Focus rings visible on all focusable elements (keyboard navigation)
- [ ] Active/pressed state defined on buttons and links
- [ ] `cursor-pointer` applied to all clickable elements
- [ ] No layout shift on hover

**Responsive viewports**
- [ ] Tested at 375px (mobile), 768px (tablet), 1024px (desktop), 1440px (wide)
- [ ] No horizontal scroll at any viewport
- [ ] Typography readable at 375px (minimum 16px body)
- [ ] Touch targets at least 44px on mobile

**Accessibility (WCAG 2.1 AA)**
- [ ] Exactly one `<h1>` per page, always rendered (never conditional)
- [ ] No skipped heading levels (h1 → h2 → h3)
- [ ] Every visible region inside a landmark (`<header>`, `<main>`, `<nav>`, `<aside>`, `<footer>`, `<section aria-label>`)
- [ ] Clickable elements are `<button>` or `<a>` — no `onClick` on `<div>`/`<span>`
- [ ] All interactive elements have visible focus indicators
- [ ] Toggle elements have `aria-pressed` or `aria-expanded`
- [ ] Meaningful images have `alt` text; decorative images have `alt=""` or `aria-hidden="true"`
- [ ] Colour contrast meets 4.5:1 for normal text, 3:1 for large text and UI components
- [ ] No hardcoded hex colours — use theme CSS custom properties
- [ ] `prefers-reduced-motion` respected for all animations
- [ ] All `<iframe>` elements have a `title` attribute
- [ ] Run `/audit-a11y` and resolve all Critical and Major findings before PR

**Storybook**
- [ ] Every new or modified component has a story
- [ ] Stories include viewport variants at 375px and 1024px minimum
- [ ] All stories render without console errors

---

## Step 5 — Verify the build passes

Before committing, run all checks in this order:

```bash
npm ci
npm run type-check
npm run build
npm run lint
```

If `npm ci` fails with peer dependency errors, check `package.json` for version
conflicts and fix them before proceeding. Do NOT use `--legacy-peer-deps` or
`--force` to paper over real conflicts — fix the root cause.

If ANY of these commands fail, fix the errors before continuing.
Do not open a PR with a broken build under any circumstances.

`npm run type-check` runs `tsc --noEmit` — this catches TypeScript errors that
`npm run build` may miss in certain configurations. It MUST pass.

---

## Step 6 — Commit and push

```bash
git add -A
git commit -m "{type}: {short description}

{Brief explanation of what was done and why}

Refs #{ISSUE_NUMBER}"
git push -u origin HEAD
```

Commit type: feat, fix, docs, chore, design, refactor, or test.

---

## Step 7 — Open a Pull Request

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

Closes #{ISSUE_NUMBER}

---
This PR was created by Claude Code. Please review before merging." \
  --base main \
  --head "$(git branch --show-current)"
```

Capture PR URL and PR number.

---

## Step 8 — Link PR to the ticket

```bash
gh issue comment "$ISSUE_NUMBER" --repo "$REPO" \
  --body "PR opened: {PR_URL}"
```

---

## Step 9 — Self-review via sub-agent

Resolve `$TRUSTDESIGN_BOT_TOKEN` from the environment now, then substitute it
literally into the prompt so the sub-agent has the value.

Use the Task tool to spawn a sub-agent with this prompt (substitute real values):

```
You are a senior code reviewer. Review this pull request and post your findings
as a GitHub PR comment.

Repo: {REPO}
PR: {PR_NUMBER}
Bot token: {TRUSTDESIGN_BOT_TOKEN}

## CRITICAL — All gh commands must use the bot token
Prefix every gh command with GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} so comments
appear as trustdesign-bot, not the personal GitHub account.

1. Run: GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} gh pr diff {PR_NUMBER} --repo {REPO}
2. Run: GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} gh pr view {PR_NUMBER} --repo {REPO} --json title,body,files,additions,deletions
3. Read CLAUDE.md for project conventions
4. Review for:
   - Does it fully address the issue?
   - Follows conventions in CLAUDE.md?
   - Edge cases or missing error handling
   - Anything that could break the build or existing tests
   - Missing tests where applicable
   - Typos or unclear naming
5. Post review as a PR comment:
   GH_TOKEN={TRUSTDESIGN_BOT_TOKEN} gh pr review {PR_NUMBER} --repo {REPO} --comment --body "{your structured review}"
6. Return: APPROVED or NEEDS CHANGES, followed by bullet points
```

If sub-agent returns NEEDS CHANGES, fix the issues on the same branch, push,
and re-run the sub-agent. Repeat until APPROVED.

---

## Step 10 — Move ticket to In Review

Update Status to In Review on the board using `updateProjectV2ItemFieldValue`
with single-quoted query strings.

---

## Step 11 — Final summary

```
Task #{number} ready for your review

  Branch  : {branch-name}
  PR      : {PR_URL}
  Review  : APPROVED — {one-line summary}
  Status  : In Review on Mission Control

  To complete:
  - Review and merge the PR: {PR_URL}
  - Merging will automatically close #{number}
  - Run /take-task next to pick up the next ticket
```

**Always return to main after finishing:**

```bash
git checkout main && git pull origin main
```

Stop here and wait. Never merge the PR — the user always has final approval.

**`auto` mode:** When running in auto mode (working through multiple tickets
sequentially), after the self-review returns APPROVED:

1. **Do NOT merge the PR** — leave it open for the user to review and merge
2. Pull latest main:
   ```bash
   git checkout main && git pull origin main
   ```
3. Pick up the next Todo ticket and repeat from Step 1

In auto mode, do NOT stop and wait between tickets. Keep going until all
Todo tickets have open PRs ready for review.

---

## Hard rules

- Never push directly to main
- **Never merge PRs — the user always has final approval**
- Never mark a ticket Done manually — it closes via PR merge
- Fix failing tests/build before opening the PR
