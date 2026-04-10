# Architecture

## System Overview

starter-local is a Vite + React single-page application that runs entirely on the developer's machine. There are no hosted services, no database server, and no deployment target.

```
Browser
  └── Vite dev server (localhost:5173)
        └── React app
              ├── React Router v6 (client-side routing)
              ├── src/routes/    (page components)
              ├── src/components/ (shared UI)
              └── src/lib/       (utilities)
```

## Rendering Strategy

| Route type | Strategy | Reason |
|-----------|----------|--------|
| All routes | Client-side (CSR) | Local-only app — no server rendering needed |

All routes are public. React Router handles navigation in the browser. There is no middleware, no auth gating, and no server-side data fetching.

## Data Flow

1. User interacts with a React component
2. Component calls a pure function in `src/lib/` or a React Router loader
3. Data is returned as props or stored in React state / Context
4. For persistence: local JSON files or SQLite via `better-sqlite3` (if added)

## Key Architectural Decisions

| Decision | Choice | Alternatives considered | Rationale |
|----------|--------|------------------------|-----------|
| Bundler | Vite 5 | CRA, Parcel | Fast HMR, native ESM, modern defaults |
| Routing | React Router v6 | TanStack Router | Familiar, widely documented |
| Styling | Tailwind + shadcn/ui | CSS Modules, styled-components | Speed, AI-friendly, matches starter-web |
| Testing | Vitest + RTL | Jest | Native Vite integration, faster |
| E2E | Playwright | Cypress | Cross-browser, CI-friendly |

## No External Services

This starter intentionally has no integrations:

- No Supabase, no database server
- No Vercel, no EAS, no OTA
- No auth provider
- No analytics

If a forked project needs persistence, add `better-sqlite3` or a local JSON store.

## Performance Considerations

- Vite handles code splitting automatically via dynamic imports
- Keep bundle size in check with `npm run build` output
- Prefer lazy-loading heavy routes with `React.lazy()`

## Security Considerations

- No credentials or tokens stored in code or local storage
- User input validated with Zod before processing
- No same-origin fetch to external services (local only)
