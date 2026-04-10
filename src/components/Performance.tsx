import type { PerformanceMetrics } from '@/metrics/performance'

interface PerformanceProps {
  metrics: PerformanceMetrics
}

const NUM_FMT = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MONO = { fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)' }

type Colour = 'win' | 'loss' | 'neutral'

interface MetricCardProps {
  label: string
  value: string
  colour?: Colour
  /** Accessible context appended to aria-label: e.g. "above break-even" */
  ariaContext?: string
}

/** Renders a metric as a semantic dt/dd pair inside a visual card. */
function MetricCard({ label, value, colour = 'neutral', ariaContext }: MetricCardProps) {
  const valueColour =
    colour === 'win'  ? 'var(--win)'  :
    colour === 'loss' ? 'var(--loss)' :
    'var(--text-primary)'

  const ariaLabel = ariaContext ? `${label}: ${value}, ${ariaContext}` : undefined

  return (
    <div className="flex flex-col gap-1 p-4 rounded" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <dt className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </dt>
      <dd
        className="text-xl font-semibold m-0"
        data-colour={colour}
        aria-label={ariaLabel}
        style={{ ...MONO, color: valueColour }}
      >
        {value}
      </dd>
    </div>
  )
}

export function Performance({ metrics }: PerformanceProps) {
  const { totalReturnPct, winRate, avgWin, avgLoss, maxDrawdownPct, sharpeRatio, totalTrades, currentBalance } = metrics

  if (totalTrades === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-secondary)' }}>
        No trades yet
      </div>
    )
  }

  const returnColour: Colour = totalReturnPct > 0 ? 'win' : totalReturnPct < 0 ? 'loss' : 'neutral'
  const winRateColour: Colour = winRate >= 0.5 ? 'win' : winRate > 0 ? 'neutral' : 'neutral'

  // Zero return renders without + sign (0.00% is neutral)
  const returnStr =
    totalReturnPct > 0  ? `+${NUM_FMT.format(totalReturnPct)}%` :
    totalReturnPct < 0  ? `${NUM_FMT.format(totalReturnPct)}%`  :
    `${NUM_FMT.format(0)}%`

  // Win rate: 1 decimal place, en-GB grouping consistent with NUM_FMT
  const winRateStr = `${(winRate * 100).toFixed(1)}%`

  return (
    <div className="p-6 h-full overflow-auto" style={{ backgroundColor: 'var(--bg-base)' }}>
      <dl className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <MetricCard
          label="Total Return"
          value={returnStr}
          colour={returnColour}
          ariaContext={totalReturnPct > 0 ? 'positive return' : totalReturnPct < 0 ? 'negative return' : undefined}
        />
        <MetricCard
          label="Win Rate"
          value={winRateStr}
          colour={winRateColour}
          ariaContext={winRate >= 0.5 ? 'above break-even' : 'below break-even'}
        />
        <MetricCard label="Avg Win"      value={NUM_FMT.format(avgWin)}                    />
        <MetricCard label="Avg Loss"     value={NUM_FMT.format(avgLoss)}      colour={avgLoss > 0 ? 'loss' : 'neutral'} />
        <MetricCard label="Max Drawdown" value={`${NUM_FMT.format(maxDrawdownPct)}%`}      colour={maxDrawdownPct > 0 ? 'loss' : 'neutral'} />
        <MetricCard label="Sharpe Ratio" value={NUM_FMT.format(sharpeRatio)}               />
        <MetricCard label="Total Trades" value={String(totalTrades)}                       />
        <MetricCard label="Balance"      value={NUM_FMT.format(currentBalance)}            />
      </dl>
    </div>
  )
}
