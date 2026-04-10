# Coding Conventions

This document is the authoritative reference for how code is written in this project.

## Component Anatomy

Every React component follows this order:

```tsx
// 1. External imports
import { useState } from 'react'
import { cn } from '@/lib/utils'

// 2. Internal imports
import { Button } from '@/components/ui/button'

// 3. Type imports
import type { Item } from '@/types'

// 4. Local types (if needed only in this file)
interface ItemCardProps {
  item: Item
  onSelect?: (id: string) => void
  className?: string
}

// 5. Component (named export)
export function ItemCard({ item, onSelect, className }: ItemCardProps) {
  // a. Hooks first
  const [isExpanded, setIsExpanded] = useState(false)

  // b. Derived state / computations
  const label = item.name.toUpperCase()

  // c. Handlers
  function handleSelect() {
    onSelect?.(item.id)
  }

  // d. Render
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      {/* ... */}
    </div>
  )
}
```

## TypeScript Rules

```ts
// ❌ Never use `any`
function process(data: any) {}

// ✅ Use unknown for truly unknown types, then narrow
function process(data: unknown) {
  if (typeof data === 'string') { /* ... */ }
}

// ✅ Use satisfies for config objects
const config = {
  theme: 'dark',
} satisfies AppConfig
```

## Data Functions

All data access lives in `src/lib/`. No fetch calls or file I/O inside components.

```ts
// src/lib/items.ts
import { z } from 'zod'

const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type Item = z.infer<typeof ItemSchema>

export function getItems(): Item[] {
  // Read from local storage, SQLite, or JSON file
  return []
}
```

## Error Handling

```ts
// Data functions: return result objects, don't throw to UI
export function loadData(path: string): { success: true; data: Item[] } | { success: false; error: string } {
  try {
    // ...
    return { success: true, data: [] }
  } catch (error) {
    console.error('Failed to load data:', error)
    return { success: false, error: 'Failed to load data. Please try again.' }
  }
}
```

## Tailwind & shadcn/ui

```tsx
// Use cn() for conditional classes
import { cn } from '@/lib/utils'

<div className={cn('base-classes', isActive && 'active-classes', className)} />

// Variant pattern for components with multiple visual states
const variants = cva('base-classes', {
  variants: {
    intent: {
      primary: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
    },
  },
  defaultVariants: { intent: 'primary' },
})
```

## Routing

Routes live in `src/routes/`. All routes are public — no auth gating.

```tsx
// src/routes/Settings.tsx
export function Settings() {
  return <main>...</main>
}

// Add to App.tsx Routes:
// <Route path="/settings" element={<Settings />} />
```

Use React Router loaders for data fetching at the route level:

```tsx
// src/routes/Items.tsx
import { useLoaderData } from 'react-router-dom'
import { getItems } from '@/lib/items'

export function loader() {
  return getItems()
}

export function Items() {
  const items = useLoaderData() as ReturnType<typeof loader>
  return <ul>{items.map(i => <li key={i.id}>{i.name}</li>)}</ul>
}
```

## Testing

```tsx
// Unit/component tests co-located or in tests/
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByRole('heading')).toBeInTheDocument()
  })
})
```

## File Organisation Rules

- One component per file
- Keep files under 300 lines — if larger, split into subcomponents
- Shared types go in `src/types/`
- Utility functions go in `src/lib/`
- Route components go in `src/routes/`
- Shared components go in `src/components/`
