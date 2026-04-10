# Setup

This is a local-only project. There are no hosted services, no environment variables to configure, and no deployment target. Setup is just installing dependencies and running the dev server.

---

## Prerequisites

- Node.js 20+
- npm 10+

---

## First-time setup

```bash
# Clone the repo
git clone https://github.com/trustdesign-io/starter-local.git
cd starter-local

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Available scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | TypeScript compile + Vite production build |
| `npm run preview` | Preview the production build locally |
| `npm run test` | Run Vitest unit/component tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright E2E tests (requires a build) |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier format all files |
| `npm run type-check` | TypeScript strict type check (no emit) |

---

## Environment variables

None required. The `.env.example` file is intentionally empty — see its comments for details.

If you fork this starter and add env vars, add them to `.env.example` and document them in this file.

---

## Adding local data persistence

If your project needs to persist data locally:

- **JSON files:** read/write with Node's `fs` module (via Vite's `import.meta.env.DEV` guard)
- **SQLite:** add `better-sqlite3` — `npm install better-sqlite3 @types/better-sqlite3`
- **IndexedDB:** use `idb` for browser-native key-value or object store persistence

All data access should go through `src/lib/` — never directly in components.

---

## Shadcn/ui components

To add a new shadcn/ui component:

```bash
npx shadcn@latest add button
```

Components are added to `src/components/ui/`. Do not edit them directly — extend via wrapper components in `src/components/`.
