import { cn } from '@/lib/utils'
import { TeachMeButton } from '@/components/TeachMeButton'
import { useTheme } from '@/hooks/useTheme'
import type { FearGreedData } from '@/data/fearGreed'
import type { OhlcInterval, Pair } from '@/types'

interface HeaderProps {
  pair: Pair
  onPairChange: (pair: Pair) => void
  /** Active OHLC interval in minutes */
  interval: OhlcInterval
  onIntervalChange: (interval: OhlcInterval) => void
  /** Live price — null while connecting */
  price: number | null
  /** 24-hour change percent — null while connecting */
  change24h: number | null
  /** Average perpetual funding rate as a decimal (e.g. 0.001 = 0.1% per 8h) — null while loading */
  fundingRate?: number | null
  /** Current Fear & Greed index data — null while loading */
  fearGreed?: FearGreedData | null
}

const PAIRS: Pair[] = ['XBT/USDT', 'ETH/USDT', 'XRP/USDT']

const INTERVALS: { value: OhlcInterval; label: string }[] = [
  { value: 1,   label: '1m' },
  { value: 5,   label: '5m' },
  { value: 15,  label: '15m' },
  { value: 60,  label: '1h' },
  { value: 240, label: '4h' },
]

/** Format funding rate as a signed percentage string (e.g. "+0.0100%") */
function formatFunding(rate: number): string {
  const pct = (rate * 100).toFixed(4)
  return rate >= 0 ? `+${pct}%` : `${pct}%`
}

/**
 * Funding colour: positive → red (longs crowded), negative → green (shorts crowded), near-zero → muted.
 * Warning threshold (0.05%) is intentionally lower than the veto threshold (0.1%)
 * so the badge warns before the filter actually fires.
 */
function fundingColor(rate: number): string {
  if (rate > 0.0005) return 'var(--loss)'    // positive and meaningful — longs crowded
  if (rate < -0.0002) return 'var(--win)'    // negative — shorts crowded
  return 'var(--text-secondary)'             // near-zero — neutral
}

/** Fear & Greed badge colour: extreme zones are highlighted, neutral is muted */
function fearGreedColor(value: number): string {
  if (value >= 75) return 'var(--loss)'         // greed zone — risk of veto at 80
  if (value <= 25) return 'var(--win)'          // fear zone — risk of veto at 20
  return 'var(--text-secondary)'                // neutral
}

export function Header({ pair, onPairChange, interval, onIntervalChange, price, change24h, fundingRate, fearGreed }: HeaderProps) {
  const changePositive = change24h !== null && change24h >= 0
  const { theme, toggleTheme } = useTheme()

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

        {/* Interval picker */}
        <div className="flex items-center gap-1 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }}>
          {INTERVALS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onIntervalChange(opt.value)}
              aria-label={`${opt.label} interval`}
              className={cn(
                'mono px-3 py-1 text-xs rounded transition-colors',
                opt.value === interval ? 'font-medium' : 'hover:opacity-80'
              )}
              style={{
                backgroundColor: opt.value === interval ? 'var(--accent)' : 'transparent',
                color: opt.value === interval ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live price + signal context badges */}
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
            <TeachMeButton topicId="funding-rate" currentValue={`${formatFunding(fundingRate)} per 8 hours`} />
          </div>
        )}

        {/* Fear & Greed badge */}
        {fearGreed !== null && fearGreed !== undefined && (
          <div
            className="flex items-center gap-1 text-xs"
            title={`Fear & Greed Index: ${fearGreed.value} — ${fearGreed.classification}. Composite sentiment indicator from alternative.me. Lagging and noisy, but extreme readings (>80 greed / <20 fear) are used as contrarian filters.`}
          >
            <span style={{ color: 'var(--text-secondary)' }}>F&G</span>
            <span
              className="mono"
              style={{ color: fearGreedColor(fearGreed.value) }}
              aria-label={`Fear and Greed index ${fearGreed.value}, ${fearGreed.classification}`}
            >
              {fearGreed.value}
            </span>
            <TeachMeButton topicId="fear-greed" currentValue={`${fearGreed.value} (${fearGreed.classification})`} />
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-pressed={theme === 'light'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="flex items-center justify-center w-7 h-7 rounded transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{
            color: 'var(--text-secondary)',
            outlineColor: 'var(--accent)',
          }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
            </svg>
          )}
        </button>

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
