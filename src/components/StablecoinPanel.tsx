import type { CSSProperties } from 'react'
import type { StablecoinSupplyData } from '@/data/stablecoinSupply'
import { detectLargeMint, LARGE_MINT_THRESHOLD_BILLIONS } from '@/data/stablecoinSupply'

interface StablecoinPanelProps {
  data: StablecoinSupplyData | null
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric' })
const SUPPLY_FMT = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DATE_FMT.format(new Date(y, m - 1, d))
}

const labelStyle: CSSProperties = {
  fontSize: 11,
  color: 'var(--text-secondary)',
}

export function StablecoinPanel({ data }: StablecoinPanelProps) {
  if (data === null) {
    return (
      <div
        role="figure"
        aria-label="Stablecoin supply — data unavailable"
        className="flex flex-col gap-1 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Stablecoin Supply
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Data unavailable
        </span>
      </div>
    )
  }

  const { snapshots } = data
  if (snapshots.length < 2) {
    return (
      <div
        role="figure"
        aria-label="Stablecoin supply — insufficient data"
        className="flex flex-col gap-1 px-3 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Stablecoin Supply
        </span>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Insufficient data
        </span>
      </div>
    )
  }

  // Compute 7-day deltas (day-over-day change)
  const deltas = snapshots.slice(1).map((snap, i) => ({
    date: snap.date,
    delta: snap.totalBillions - snapshots[i].totalBillions,
  }))

  const maxAbsDelta = Math.max(...deltas.map(d => Math.abs(d.delta)), 0.1)
  const latest = snapshots[snapshots.length - 1]
  const largeMint = detectLargeMint(data)

  return (
    <div
      role="figure"
      aria-label={`Stablecoin supply — last 7 days. Current total: ${SUPPLY_FMT.format(latest.totalBillions)}B`}
      className="flex flex-col gap-1 px-3 py-2"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          Stablecoin Supply
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            ${SUPPLY_FMT.format(latest.totalBillions)}B
          </span>
          {largeMint !== null && (
            <span
              title={`Large mint on ${formatDate(largeMint.date)}: +${LARGE_MINT_THRESHOLD_BILLIONS}B+ added`}
              className="text-xs px-1 py-0.5 rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, #22c55e 20%, var(--bg-surface))',
                color: '#15803d',
                border: '1px solid color-mix(in srgb, #22c55e 40%, transparent)',
                fontWeight: 600,
              }}
            >
              Mint
            </span>
          )}
        </div>
      </div>

      {/* Delta bar chart */}
      <div
        className="flex items-center gap-0.5"
        style={{ height: 36 }}
        aria-hidden="true"
      >
        {deltas.map(entry => {
          const isPositive = entry.delta >= 0
          const heightPct = (Math.abs(entry.delta) / maxAbsDelta) * 100
          return (
            <div
              key={entry.date}
              title={`${formatDate(entry.date)}: ${isPositive ? '+' : ''}${entry.delta.toFixed(1)}B`}
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

      {/* Date range */}
      <div className="flex justify-between" style={labelStyle}>
        <span>{formatDate(deltas[0].date)}</span>
        <span>{formatDate(deltas[deltas.length - 1].date)}</span>
      </div>
    </div>
  )
}
