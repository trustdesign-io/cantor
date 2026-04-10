import type { EtfFlowEntry } from '@/data/etfFlows'

interface EtfFlowsPanelProps {
  flows: readonly EtfFlowEntry[] | null
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' })
const NUM_FMT = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, d))
}

export function EtfFlowsPanel({ flows }: EtfFlowsPanelProps) {
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-secondary)',
  }

  if (flows === null) {
    return (
      <div
        className="flex flex-col gap-1 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          BTC ETF Flows
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Data unavailable
        </span>
      </div>
    )
  }

  if (flows.length === 0) {
    return (
      <div
        className="flex flex-col gap-1 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          BTC ETF Flows
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          No data
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
