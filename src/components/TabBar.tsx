import { cn } from '@/lib/utils'
import type { Tab } from '@/types'

interface TabBarProps {
  active: Tab
  onChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'live', label: 'Live' },
  { id: 'backtest', label: 'Backtest' },
  { id: 'journal', label: 'Journal' },
  { id: 'performance', label: 'Performance' },
]

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      className="flex items-center gap-1 px-6 border-b"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'px-4 py-3 text-sm border-b-2 transition-colors',
            id === active
              ? 'font-medium'
              : 'border-transparent hover:opacity-80'
          )}
          style={{
            borderBottomColor: id === active ? 'var(--accent)' : 'transparent',
            color: id === active ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
