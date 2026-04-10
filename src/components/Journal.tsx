import { useState } from 'react'
import type { Trade } from '@/types'

interface JournalProps {
  trades: readonly Trade[]
}

type SortKey = 'date' | 'pnlAbsolute' | 'durationMs'
type SortDir = 'asc' | 'desc'

const NUM_FMT = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const DATE_FMT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'short', timeStyle: 'short' })

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${m}m`
}

function formatPnl(value: number): string {
  return value >= 0 ? `+${NUM_FMT.format(value)}` : NUM_FMT.format(value)
}

function formatPct(value: number): string {
  return value >= 0 ? `+${NUM_FMT.format(value)}%` : `${NUM_FMT.format(value)}%`
}

const MONO = { fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }

interface HeaderCellProps {
  label: string
  sortKey?: SortKey
  active: SortKey | null
  dir: SortDir
  onSort: (key: SortKey) => void
}

function HeaderCell({ label, sortKey, active, dir, onSort }: HeaderCellProps) {
  if (!sortKey) {
    return (
      <th
        scope="col"
        className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </th>
    )
  }

  const isActive = active === sortKey
  return (
    <th
      scope="col"
      role="columnheader"
      aria-sort={isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-3 py-2 text-left text-xs font-medium whitespace-nowrap cursor-pointer select-none"
      style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      onClick={() => onSort(sortKey)}
    >
      {label}
      <span className="ml-1 opacity-60">{isActive ? (dir === 'asc' ? '↑' : '↓') : '↕'}</span>
    </th>
  )
}

export function Journal({ trades }: JournalProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...trades].sort((a, b) => {
    let diff = 0
    if (sortKey === 'date') diff = a.exitTime - b.exitTime
    if (sortKey === 'pnlAbsolute') diff = a.pnlAbsolute - b.pnlAbsolute
    if (sortKey === 'durationMs') diff = a.durationMs - b.durationMs
    return sortDir === 'asc' ? diff : -diff
  })

  if (trades.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: 'var(--text-secondary)' }}
      >
        No completed trades yet
      </div>
    )
  }

  return (
    <div className="overflow-auto h-full" style={{ backgroundColor: 'var(--bg-base)' }}>
      <table className="w-full border-collapse text-sm" style={{ color: 'var(--text-primary)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            <HeaderCell label="Date"     sortKey="date"        active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="Pair"     sortKey={undefined}   active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="Entry"    sortKey={undefined}   active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="Exit"     sortKey={undefined}   active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="P&L (£)"  sortKey="pnlAbsolute" active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="P&L (%)"  sortKey={undefined}   active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="Duration" sortKey="durationMs"  active={sortKey} dir={sortDir} onSort={handleSort} />
            <HeaderCell label="Signal"   sortKey={undefined}   active={sortKey} dir={sortDir} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sorted.map(trade => {
            const isWin = trade.pnlAbsolute >= 0
            return (
              <tr
                key={trade.id}
                data-outcome={isWin ? 'win' : 'loss'}
                style={{
                  borderBottom: '1px solid var(--border)',
                  backgroundColor: isWin
                    ? 'color-mix(in srgb, var(--win) 8%, transparent)'
                    : 'color-mix(in srgb, var(--loss) 8%, transparent)',
                }}
              >
                <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--text-secondary)', ...MONO }}>
                  {DATE_FMT.format(new Date(trade.exitTime))}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {trade.pair}
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={MONO}>
                  {NUM_FMT.format(trade.entryPrice)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={MONO}>
                  {NUM_FMT.format(trade.exitPrice)}
                </td>
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  style={{ ...MONO, color: isWin ? 'var(--win)' : 'var(--loss)' }}
                >
                  {formatPnl(trade.pnlAbsolute)}
                </td>
                <td
                  className="px-3 py-2 whitespace-nowrap"
                  style={{ ...MONO, color: isWin ? 'var(--win)' : 'var(--loss)' }}
                >
                  {formatPct(trade.pnlPercent)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap" style={MONO}>
                  {formatDuration(trade.durationMs)}
                </td>
                <td className="px-3 py-2 text-xs max-w-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {trade.signalReason}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
