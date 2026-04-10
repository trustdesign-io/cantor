import { cn } from '@/lib/utils'
import type { Pair } from '@/types'

interface HeaderProps {
  pair: Pair
  onPairChange: (pair: Pair) => void
  /** Live price — null while connecting */
  price: number | null
  /** 24-hour change percent — null while connecting */
  change24h: number | null
  /** Average perpetual funding rate as a decimal (e.g. 0.001 = 0.1% per 8h) — null while loading */
  fundingRate?: number | null
}

const PAIRS: Pair[] = ['XBT/USDT', 'ETH/USDT']

/** Format funding rate as a signed percentage string (e.g. "+0.0100%") */
function formatFunding(rate: number): string {
  const pct = (rate * 100).toFixed(4)
  return rate >= 0 ? `+${pct}%` : `${pct}%`
}

/** Funding colour: positive → red (longs crowded), negative → green (shorts crowded), near-zero → muted */
function fundingColor(rate: number): string {
  if (rate > 0.0005) return 'var(--loss)'    // positive and meaningful — longs crowded
  if (rate < -0.0002) return 'var(--win)'    // negative — shorts crowded
  return 'var(--text-secondary)'             // near-zero — neutral
}

export function Header({ pair, onPairChange, price, change24h, fundingRate }: HeaderProps) {
  const changePositive = change24h !== null && change24h >= 0

  return (
    <header
      className="flex items-center justify-between px-6 py-3 border-b"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Brand */}
      <div className="flex items-center gap-6">
        <div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Cantor
          </span>
          <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Personal algorithmic paper trading
          </span>
        </div>

        {/* Pair selector */}
        <div className="flex items-center gap-1 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          {PAIRS.map((p) => (
            <button
              key={p}
              onClick={() => onPairChange(p)}
              className={cn(
                'mono px-3 py-1 text-xs rounded transition-colors',
                p === pair ? 'font-medium' : 'hover:opacity-80'
              )}
              style={{
                backgroundColor: p === pair ? 'var(--accent)' : 'transparent',
                color: p === pair ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Live price + funding rate */}
      <div className="flex items-center gap-4">
        {/* Perpetual funding rate badge */}
        {fundingRate !== null && fundingRate !== undefined && (
          <div
            className="flex items-center gap-1 text-xs"
            title="Average perpetual funding rate (Binance + Bybit) per 8-hour period. Positive = longs paying shorts. Negative = shorts paying longs."
          >
            <span style={{ color: 'var(--text-secondary)' }}>Funding</span>
            <span
              className="mono"
              style={{ color: fundingColor(fundingRate) }}
              aria-label={`Funding rate ${formatFunding(fundingRate)} per 8 hours`}
            >
              {formatFunding(fundingRate)}
            </span>
            <span style={{ color: 'var(--text-secondary)' }}>/8h</span>
          </div>
        )}

        <span
          className="mono text-lg font-medium"
          style={{ color: 'var(--text-primary)' }}
        >
          {price !== null ? price.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </span>
        <span
          className="mono text-sm"
          style={{
            color: change24h === null ? 'var(--text-secondary)' : changePositive ? 'var(--win)' : 'var(--loss)',
          }}
        >
          {change24h !== null
            ? `${changePositive ? '+' : ''}${change24h.toFixed(2)}%`
            : '—'}
        </span>
      </div>
    </header>
  )
}
