---
description: Create a new reusable React component
---

# New Component: $ARGUMENTS

## Process

### 1. Clarify before building
- What does this component render?
- What props does it accept?
- Where will it live? (`src/components/` for shared, inline for page-specific)
- Does a similar shadcn/ui component already exist that should be extended instead?

### 2. Create the component

Follow the component anatomy in `docs/CONVENTIONS.md`:

```tsx
// src/components/[component-name].tsx

import { cn } from '@/lib/utils'

interface [ComponentName]Props {
  // props here
  className?: string  // always include className
}

export function [ComponentName]({ className, ...props }: [ComponentName]Props) {
  return (
    <div className={cn('', className)}>
      {/* content */}
    </div>
  )
}
```

### 3. Variant support (if needed)
Use `cva` from `class-variance-authority` for components with multiple visual variants.

### 4. Accessibility
- Use semantic HTML elements
- Add ARIA labels where needed
- Ensure keyboard navigability for interactive components
- Test with Tab key navigation

### 5. Apply brand styles
Use CSS variables from `src/index.css` for colours, spacing, and typography. Reference shadcn/ui semantic tokens (`bg-primary`, `text-muted-foreground`, etc.).

### 6. Write tests
- Add a test in `tests/` alongside the component
- Test: renders correctly, handles interactions, handles edge cases

### 7. Document with JSDoc
```tsx
/**
 * [Brief description of what this component does]
 *
 * @example
 * <ComponentName prop="value" />
 */
export function ComponentName(props: ComponentNameProps) {
```
