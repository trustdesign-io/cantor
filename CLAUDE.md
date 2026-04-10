# starter-local

Vite + React starter template for local-only trustdesign projects. No authentication, no hosted services, no deployment target. `npm run dev` is the entire runtime.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Vite 5 + React 18 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Routing | React Router v6 |
| State | React Context / local state |
| Testing | Vitest + React Testing Library |
| E2E | Playwright |
| Deployment | None — `npm run dev` only |

## Spec exemptions

This starter is a **local-only** starter per `trustdesign-setup/docs/STARTER_SPEC.md`. The following sections of the spec are **exempt**:

- **§1 Authentication** — No sign in, sign up, sign out, session persistence, auth guard, or onboarding flow. All routes are public.
- **§3 Shared code integration (auth-related parts)** — No Supabase client factory, no user/role types from shared, no auth-related Zod schemas. `@trustdesign/shared` is still used for design tokens, non-auth Zod schemas, and ESLint config.
- **§8 Deployment** — No dev/staging/prod environments, no Vercel, no EAS, no OTA. See `docs/SETUP.md` for local install and run only.

## Directory Structure

```
src/
├── routes/           # React Router route components
├── components/       # Shared reusable components
│   └── ui/           # shadcn/ui base components (do not edit directly)
├── lib/              # Utilities and helpers
│   └── utils.ts      # cn() helper
└── index.css         # Tailwind directives + CSS variable theme
tests/
└── smoke.test.tsx    # Vitest unit/component tests
e2e/
└── smoke.spec.ts     # Playwright E2E tests
```

## Local only — no authentication

All routes are public. No authentication. Data persists to local JSON or SQLite via `better-sqlite3` if needed.

## Shared package usage

`@trustdesign/shared` is used for:
- Design tokens
- Non-auth Zod schemas
- ESLint base config

Explicitly **excluded**: Supabase client factory, user/role types, auth-related Zod schemas.

## No deploy target

No deployment target. `npm run dev` is the runtime. Local install and run only — see `docs/SETUP.md`.

## Running the project

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (localhost:5173)
npm run build     # Production build
npm run test      # Run Vitest unit tests
npm run test:e2e  # Run Playwright E2E tests
npm run lint      # ESLint check
npm run format    # Prettier format
npm run type-check  # TypeScript strict check
```

## Coding conventions

- **Components:** Functional components with TypeScript. Named exports only.
- **Types:** No `any`. Full type coverage. Use `interface` for object shapes, `type` for unions.
- **Imports:** Group in order: external packages → internal paths (`@/`) → types → styles.
- **Error handling:** Use try/catch in data functions. Always show user-friendly messages in UI.
- **Accessibility:** Semantic HTML, ARIA where needed, keyboard navigability, WCAG AA contrast.

## Naming conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `user-profile.tsx` |
| React components | PascalCase | `UserProfile` |
| Hooks | camelCase + "use" prefix | `useLocalData` |
| Utilities | camelCase | `formatDate` |
| Types / Interfaces | PascalCase | `UserProfile` |
| Constants | UPPER_SNAKE_CASE | `MAX_ITEMS` |

## Git conventions

- **Branches:** `feature/{number}-{slug}`, `fix/{number}-{slug}`, `chore/{number}-{slug}`
- **Commits:** Conventional commits — `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- **PRs:** Always open a PR. Never push directly to `main`. PRs must pass CI.

## Key links

| Resource | Link |
|----------|------|
| GitHub repo | https://github.com/trustdesign-io/starter-local |
| Mission Control | https://github.com/orgs/trustdesign-io/projects/3 |
