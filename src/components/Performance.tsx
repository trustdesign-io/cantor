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
}

function MetricCard({ label, value, colour = 'neutral' }: MetricCardProps) {
  const valueColour =
    colour === 'win'  ? 'var(--win)'  :
    colour === 'loss' ? 'var(--loss)' :
    'var(--text-primary)'

  return (
    <div
      className="flex flex-col gap-1 p-4 rounded"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
    >
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </span>
      <span
        className="text-xl font-semibold"
        data-colour={colour}
        style={{ ...MONO, color: valueColour }}
      >
        {value}
      </span>
    </div>
  )
}

export function Performance({ metrics }: PerformanceProps) {
  const {
    totalReturnPct,
    winRate,
    avgWin,
    avgLoss,
    maxDrawdownPct,
    sharpeRatio,
    totalTrades,
    currentBalance,
  } = metrics

  const returnColour: Colour = totalReturnPct > 0 ? 'win' : totalReturnPct < 0 ? 'loss' : 'neutral'
  const winRateColour: Colour = winRate > 0 ? 'win' : 'neutral'

  const returnStr  = totalReturnPct >= 0 ? `+${NUM_FMT.format(totalReturnPct)}%` : `${NUM_FMT.format(totalReturnPct)}%`
  const winRateStr = `${(winRate * 100).toFixed(1)}%`

  return (
    <div className="p-6 h-full overflow-auto" style={{ backgroundColor: 'var(--bg-base)' }}>
      {totalTrades === 0 && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          No trades yet
        </p>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        <MetricCard label="Total Return"  value={returnStr}                          colour={returnColour}  />
        <MetricCard label="Win Rate"      value={winRateStr}                         colour={winRateColour} />
        <MetricCard label="Avg Win"       value={NUM_FMT.format(avgWin)}                                   />
        <MetricCard label="Avg Loss"      value={NUM_FMT.format(avgLoss)}                                  />
        <MetricCard label="Max Drawdown"  value={`${NUM_FMT.format(maxDrawdownPct)}%`}                     />
        <MetricCard label="Sharpe Ratio"  value={NUM_FMT.format(sharpeRatio)}                              />
        <MetricCard label="Total Trades"  value={String(totalTrades)}                                      />
        <MetricCard label="Balance"       value={NUM_FMT.format(currentBalance)}                           />
      </div>
    </div>
  )
}
