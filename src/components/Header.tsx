import { cn } from '@/lib/utils'
import type { Pair } from '@/types'

interface HeaderProps {
  pair: Pair
  onPairChange: (pair: Pair) => void
  /** Live price — null while connecting */
  price: number | null
  /** 24-hour change percent — null while connecting */
  change24h: number | null
}

const PAIRS: Pair[] = ['XBT/USDT', 'ETH/USDT']

export function Header({ pair, onPairChange, price, change24h }: HeaderProps) {
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

      {/* Live price */}
      <div className="flex items-center gap-4">
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
