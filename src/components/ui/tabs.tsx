import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef, ElementRef } from 'react'
import { forwardRef } from 'react'

const Tabs = TabsPrimitive.Root

const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex items-center gap-0 border-b',
      className
    )}
    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'px-3 py-2 text-xs font-medium transition-colors',
      'border-b-2 border-transparent -mb-px',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
      'data-[state=active]:border-b-[var(--accent)]',
      'data-[state=inactive]:opacity-60 data-[state=inactive]:hover:opacity-100',
      className
    )}
    style={{
      color: 'var(--text-primary)',
      outlineColor: 'var(--accent)',
    }}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('flex-1 min-h-0 overflow-hidden', className)}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
