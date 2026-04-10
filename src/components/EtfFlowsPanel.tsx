import type { CSSProperties } from 'react'
import type { EtfFlowEntry } from '@/data/etfFlows'
import type { Pair } from '@/types'

interface EtfFlowsPanelProps {
  flows: readonly EtfFlowEntry[] | null
  /**
   * Active trading pair. ETF flows are only meaningful for XBT/USDT because
   * the underlying dataset is US-listed spot Bitcoin ETFs. When any other
   * pair is selected, the panel renders a holding message instead of stale
   * BTC data so the user doesn't mistake it for a signal that follows the
   * chart.
   */
  pair: Pair
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' })
const NUM_FMT = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, d))
}

export function EtfFlowsPanel({ flows, pair }: EtfFlowsPanelProps) {
  const labelStyle: CSSProperties = {
    fontSize: 11,
    color: 'var(--text-secondary)',
  }

  // Pair-applicability guard: the underlying dataset is spot BTC ETF net
  // flows, so for any non-BTC pair we show an explanatory placeholder rather
  // than stale BTC data the user might mistake for a pair-specific signal.
  if (pair !== 'XBT/USDT') {
    return (
      <div
        role="figure"
        aria-label={`BTC ETF net flows — not applicable for ${pair}`}
        className="flex flex-col gap-1 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          BTC ETF Flows
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Not applicable for {pair} — this panel tracks US-listed spot Bitcoin ETF flows.
        </span>
      </div>
    )
  }

  if (flows === null || flows.length === 0) {
    return (
      <div
        role="figure"
        aria-label="BTC ETF net flows — data unavailable"
        className="flex flex-col gap-1 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          BTC ETF Flows
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {flows === null ? 'Data unavailable' : 'No data'}
        </span>
      </div>
    )
  }

  const maxAbs = Math.max(...flows.map(f => Math.abs(f.netFlowUsd)), 1)

  return (
    <div
      className="flex flex-col gap-1 px-3 py-2"
      style={{ borderTop: '1px solid var(--border)' }}
      role="figure"
      aria-label="BTC ETF net flows — last 14 days"
    >
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        BTC ETF Flows <span style={{ fontWeight: 400 }}>(USD millions)</span>
      </span>

      <div
        className="flex items-end gap-0.5"
        style={{ height: 52 }}
        aria-hidden="true"
      >
        {flows.map(entry => {
          const isPositive = entry.netFlowUsd >= 0
          const heightPct = (Math.abs(entry.netFlowUsd) / maxAbs) * 100
          return (
            <div
              key={entry.date}
              title={`${formatDate(entry.date)}: ${isPositive ? '+' : ''}${NUM_FMT.format(entry.netFlowUsd)}M`}
              style={{
                flex: '1 1 0',
                height: `${Math.max(heightPct, 4)}%`,
                backgroundColor: isPositive ? 'var(--win)' : 'var(--loss)',
                opacity: 0.8,
                borderRadius: 1,
              }}
            />
          )
        })}
      </div>

      {/* Date labels — show first and last */}
      <div className="flex justify-between" style={labelStyle}>
        <span>{formatDate(flows[0].date)}</span>
        <span>{formatDate(flows[flows.length - 1].date)}</span>
      </div>
    </div>
  )
}
