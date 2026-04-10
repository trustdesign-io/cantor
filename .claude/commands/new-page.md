---
description: Scaffold a new route in React Router v6
---

# New Page: $ARGUMENTS

## Process

### 1. Determine the route
- Confirm the URL path (e.g., `/settings`, `/items/:id`)
- Does it need data loaded on entry? Use a React Router loader.
- All routes are public — no auth gating.

### 2. Create the route component
Following this project's conventions:

```
src/routes/
└── [PageName].tsx     # Route component
```

**Route component pattern:**
```tsx
// src/routes/[PageName].tsx

export function [PageName]() {
  return (
    <main className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">[Page Title]</h1>
      {/* content */}
    </main>
  )
}
```

**With a loader (for data-driven routes):**
```tsx
import { useLoaderData } from 'react-router-dom'
import { getItems } from '@/lib/items'

export function loader() {
  return getItems()
}

export function [PageName]() {
  const items = useLoaderData() as ReturnType<typeof loader>
  return (
    <main className="container mx-auto px-4 py-16">
      {/* render items */}
    </main>
  )
}
```

### 3. Register the route
Add to `src/App.tsx`:

```tsx
import { [PageName], loader as [pageName]Loader } from './routes/[PageName]'

// Inside <Routes>:
<Route path="/[path]" element={<[PageName] />} loader={[pageName]Loader} />
```

### 4. Add to navigation (if needed)
Update the `<Nav>` component in `src/App.tsx` with a new `<NavLink>`.

### 5. Verify
- `npm run build` to check for errors
- Test on mobile viewport
- Check accessibility with keyboard navigation
