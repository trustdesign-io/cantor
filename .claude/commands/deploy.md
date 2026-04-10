---
description: Build, push, and deploy to Vercel production
---

# Deploy

Verify the build passes, push to main, and deploy to Vercel production.

---

## Step 1 — Verify clean state

```bash
git status
```

If there are uncommitted changes, create a branch and PR:

```bash
git checkout -b chore/pre-deploy-cleanup
git add -A
git commit -m "chore: pre-deploy cleanup"
git push -u origin HEAD
gh pr create --title "chore: pre-deploy cleanup" --body "Pre-deploy changes" --base main
```

Then stop and wait for the user to review and merge the PR. **Never merge PRs — the user always has final approval.**

If already on main with no uncommitted changes, continue.

---

## Step 2 — Verify the build

```bash
npm ci
npm run type-check
npm run build
npm run lint
```

If ANY step fails, fix the errors before continuing. Do not deploy a
broken build.

---

## Step 3 — Ensure main is pushed

```bash
git push origin main
```

---

## Step 4 — Push database schema

If any Prisma schema changes exist since last deploy:

```bash
npx prisma db push
```

---

## Step 5 — Deploy to Vercel

```bash
vercel --prod --yes --scope dannychambers-projects
```

---

## Step 6 — Verify

Wait for the deployment URL to be returned, then confirm:

> "Deployed to production.
>
> Live: {deployment URL}
>
> Verify at: {alias URL}"

---

## Rules

- **Never push directly to main** — all changes go through a PR, even config and cleanup
- Never deploy a failing build
- Always push to git before deploying so Vercel and git stay in sync
- If deploying a branch (not main), use `vercel --yes` (no `--prod`) for a preview deploy
