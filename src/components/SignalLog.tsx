import type { Position, SignalEvent } from '@/types'

interface SignalLogProps {
  events: readonly SignalEvent[]
  position: Position | null
  balance: number
}

const SIGNAL_STYLES: Record<SignalEvent['signal'], { label: string; color: string }> = {
  BUY:  { label: 'BUY',  color: 'var(--win)' },
  SELL: { label: 'SELL', color: 'var(--loss)' },
  HOLD: { label: 'HOLD', color: 'var(--text-secondary)' },
}

function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function SignalLog({ events, position, balance }: SignalLogProps) {
  // Most recent event at top
  const reversed = [...events].reverse()

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 text-xs font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}
      >
        Signal Log
      </div>

      {/* Event list — scrollable */}
      <div className="flex-1 overflow-y-auto" role="log" aria-label="Live signal events" aria-live="polite">
        {reversed.length === 0 ? (
          <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            No signals yet
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th className="px-4 py-2 text-left font-normal">Time</th>
                <th className="px-4 py-2 text-left font-normal">Signal</th>
                <th className="px-4 py-2 text-right font-normal">Price</th>
              </tr>
            </thead>
            <tbody>
              {reversed.map(event => {
                const { label, color } = SIGNAL_STYLES[event.signal]
                return (
                  <tr
                    key={`${event.timestamp}-${event.signal}`}
                    style={{ borderBottom: '1px solid var(--border)' }}
                  >
                    <td
                      className="px-4 py-2 tabular-nums"
                      style={{ color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {formatTime(event.timestamp)}
                    </td>
                    <td className="px-4 py-2 font-medium" style={{ color }}>
                      {label}
                    </td>
                    <td
                      className="px-4 py-2 text-right tabular-nums"
                      style={{ color: 'var(--text-mono)', fontFamily: 'JetBrains Mono, monospace' }}
                    >
                      {formatPrice(event.price)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Position and balance footer */}
      <div
        className="px-4 py-3 text-xs space-y-2"
        style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        {position ? (
          <div>
            <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Open position
            </div>
            <div className="flex justify-between">
              <span>{position.pair}</span>
              <span
                className="tabular-nums"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-mono)' }}
              >
                @ {formatPrice(position.entryPrice)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Size</span>
              <span
                className="tabular-nums"
                style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-mono)' }}
              >
                {position.size.toFixed(6)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Unrealised P&amp;L</span>
              <span
                className="tabular-nums"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  color: position.unrealisedPnl >= 0 ? 'var(--win)' : 'var(--loss)',
                }}
              >
                {position.unrealisedPnl >= 0 ? '+' : ''}
                {formatPrice(position.unrealisedPnl)}
              </span>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)' }}>No open position</div>
        )}

        <div className="flex justify-between pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <span>Balance</span>
          <span
            className="tabular-nums"
            style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-mono)' }}
          >
            {formatPrice(balance)} USDT
          </span>
        </div>
      </div>
    </div>
  )
}
