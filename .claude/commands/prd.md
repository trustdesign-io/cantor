---
description: Generate a Product Requirements Document (PRD.md) and PLAN.md for a new project or feature
---

# PRD: $ARGUMENTS

Generate a structured `PRD.md` and `PLAN.md` for a new project or feature.
These documents become the source of truth for all subsequent design and
development work. All agents must read them before starting any ticket.

> Use the `brainstorming` and `writing-plans` skills from superpowers to
> produce these documents. Read them from:
> `~/.claude/skills/superpowers/brainstorming/SKILL.md`
> `~/.claude/skills/superpowers/writing-plans/SKILL.md`

---

## CRITICAL — Step-by-step collaborative process

**Do NOT batch all questions at once or generate the full PRD in one go.**

This is a collaborative, conversational process. Work through it one section
at a time:

1. Ask the **Product** questions → wait for answers → confirm understanding
2. Ask the **Pages** questions → wait for answers → confirm understanding
3. Ask the **Brand** questions → wait for answers → confirm understanding
4. Ask the **Technical** questions → wait for answers → confirm understanding
5. Present a **summary of all answers** → wait for user approval
6. Generate `PRD.md` → show it to the user → wait for approval
7. Generate `PLAN.md` → show it to the user → wait for approval
8. Offer to create tickets

At each step, pause and wait for the user before proceeding. If the user
corrects or changes anything, incorporate it before moving on. Never assume
— always confirm.

---

## Step 1 — Gather requirements (one section at a time)

### 1a — Product (ask these first, wait for answers)

### Product
1. **What is the product?** (one sentence description)
2. **Who is it for?** (target audience)
3. **What problem does it solve?**
4. **What type of product is it?** (e-commerce, SaaS, content platform, booking, lifestyle brand, etc.)

### Pages
5. **What are the authenticated pages?** (do not default to "dashboard" — ask explicitly)
   - Reference the examples in `DESIGN-CONTEXT.md` if available
   - Every project always includes: `/`, `/sign-in`, `/sign-up`, `/forgot-password`, `/settings`
   - What additional authenticated pages does this product need?

### Brand
6. **What is the brand name?**
7. **What is the brand personality?** (adjectives: e.g. bold, minimal, playful, luxury)
8. **What is the colour direction?** (e.g. dark base with neon accents, clean white with earth tones)
9. **What is the typography feel?** (e.g. brutalist, editorial, friendly, corporate)
10. **Are there any reference brands or sites for inspiration?**
11. **What tone of voice?** (e.g. rebellious, professional, warm, witty)

### Technical
12. **Is this a new repo or an existing one?**
13. **Are there any third-party integrations required?** (payments, CMS, analytics, etc.)
14. **What is the primary target device?** (desktop-first, mobile-first, or equal)

---

## Step 2 — Generate PRD.md

Write `PRD.md` in the project root (or current directory if no project exists yet).

```markdown
# PRD: {Product Name}

**Version:** 1.0
**Date:** {today}
**Status:** Draft

---

## Overview
{2-3 sentence description of what the product is and why it exists}

## Problem Statement
{What problem does this solve? Who experiences it?}

## Target Audience
{Who is this for? Be specific.}

## Product Type
{e-commerce / SaaS / content platform / lifestyle brand / booking / other}

---

## Pages & Routes

### Public pages (always required)
| Route | Page | Notes |
|-------|------|-------|
| `/` | Homepage / Landing | Primary marketing surface |
| `/sign-in` | Sign in | Email/password via Supabase |
| `/sign-up` | Sign up | Email/password via Supabase |
| `/forgot-password` | Password recovery | Reset via Supabase |

### Authenticated pages (project-specific)
| Route | Page | Notes |
|-------|------|-------|
{list authenticated pages defined by user}

### Settings (always required)
| Route | Page | Notes |
|-------|------|-------|
| `/settings` | Account settings | Profile, password, preferences |

---

## Brand

### Identity
- **Name:** {brand name}
- **Personality:** {adjectives}
- **Tone of voice:** {description}
- **References:** {any inspiration brands/sites}

### Visual direction
- **Colour:** {colour direction}
- **Typography:** {typography feel}
- **Aesthetic:** {overall aesthetic — what to avoid as well as aim for}

### Design constraints
- No generic SaaS patterns unless explicitly appropriate
- All interactive elements must have hover, focus, active states
- Responsive at 375px, 768px, 1024px, 1440px minimum
- Custom fonts must be registered in `.storybook/preview.ts` AND `.storybook/preview-head.html`

---

## Features & Requirements

### Must have (MVP)
{list core features required for launch}

### Should have
{list features important but not blocking launch}

### Nice to have
{list future/v2 features}

---

## Technical Requirements
- **Stack:** Next.js, TypeScript, Tailwind, shadcn/ui, Supabase
- **Target device:** {desktop-first / mobile-first / equal}
- **Third-party integrations:** {list or "none"}
- **Performance targets:** Core Web Vitals green, LCP < 2.5s

---

## Success Criteria
- [ ] All pages listed above designed and implemented
- [ ] Brand tokens applied consistently across all surfaces
- [ ] CI passing (lint, type-check, tests, build)
- [ ] Storybook stories for all components
- [ ] Responsive at all breakpoints
```

---

## Step 3 — Generate PLAN.md

Using the `writing-plans` skill, break the project into a sequenced list of
tickets. Each ticket should be 2-5 hours of work maximum.

Write `PLAN.md` in the project root:

```markdown
# Plan: {Product Name}

Generated from PRD.md on {today}.
Each item maps to one GitHub issue on Mission Control.

## Phase 1 — Foundation
{tickets for setup, repo, base config}

## Phase 2 — Brand & Design
{design ticket first — reads PRD.md brand section for all decisions}
{individual bug/polish tickets after}

## Phase 3 — Features
{feature tickets in dependency order}

## Phase 4 — Launch readiness
{performance, accessibility, SEO, final QA}
```

---

## Step 4 — Create tickets from PLAN.md

Ask the user: "Shall I create all tickets from PLAN.md on Mission Control now?"

If yes, use `/create-ticket` to create each ticket, in order, with:
- Full description and acceptance criteria generated from the PRD
- Correct Category, Priority, Size
- Status: Backlog (unless Phase 1 items — those go to Todo)

---

## Step 5 — Summary

```
PRD and plan generated

  PRD    : {path}/PRD.md
  Plan   : {path}/PLAN.md
  Tickets: {number} created on Mission Control

  Next step: Review PRD.md, then run /take-task to begin Phase 1.
```

---

## Rules

- Never skip the brand section — it is what prevents generic AI aesthetics
- Never default authenticated pages to "dashboard" without asking
- PRD.md must be committed to the repo — it is read by all agents
- Design tickets must reference PRD.md for all brand decisions
