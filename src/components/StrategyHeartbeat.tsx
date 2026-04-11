import type { CSSProperties } from 'react'
import type { Signal } from '@/types'

interface StrategyHeartbeatProps {
  /** Current pre-filter base signal from the strategy (HOLD/BUY/SELL). */
  baseSignal: Signal
  /** Most recent fast-EMA value (NaN before enough history accumulates). */
  emaFast: number
  /** Most recent slow-EMA value (NaN before enough history accumulates). */
  emaSlow: number
  /** Most recent RSI value (NaN before enough history accumulates). */
  rsi: number
  /**
   * Wall-clock ms of the last time the strategy snapshot updated (i.e. the
   * last time a WS tick reached us and produced new indicator values).
   * `null` while the chart is still waiting for its first tick.
   */
  lastTickAt: number | null
  /**
   * Current wall-clock ms, updated on a ~1 Hz interval by the parent so
   * the "X seconds ago" label stays fresh between ticks. Passed in from
   * above instead of read via Date.now() so the component re-renders on
   * the parent's cadence rather than fighting React for its own clock.
   */
  now: number
  /**
   * Tick interval in milliseconds (OhlcInterval * 60_000). Used to decide
   * whether the feed is stale — if the last tick is older than twice the
   * interval, we dim the live dot so the user can see the feed has drifted.
   */
  intervalMs: number
}

const SIGNAL_COLORS: Record<Signal, string> = {
  BUY: 'var(--win)',
  SELL: 'var(--loss)',
  HOLD: 'var(--text-secondary)',
}

/** Format a price spread with thousands separators and 2 dp. */
function formatSpread(spread: number): string {
  const abs = Math.abs(spread).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return spread >= 0 ? `+${abs}` : `−${abs}`
}

/**
 * Render a "time since" label in whichever unit keeps the number small.
 * Returns e.g. "2s", "47s", "3m", "1h 12m".
 */
function formatAgo(ms: number): string {
  if (ms < 0) return '0s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM === 0 ? `${h}h` : `${h}h ${remM}m`
}

/**
 * Compact strategy status strip rendered above the Signal Log event table.
 *
 * The Signal Log itself only shows *events* (fresh crossovers and vetoes),
 * which means during a trending market it can show "No signals yet" for
 * many hours even though the strategy is running correctly. This strip
 * fixes that ambiguity by surfacing:
 *
 *   · a live/stale dot → "is the feed alive?"
 *   · current base signal → "what is the strategy thinking right now?"
 *   · EMA fast−slow spread → "how far are we from a fresh cross?"
 *   · current RSI → "are we overbought/oversold?"
 *   · "tick Xs ago" → concrete proof the pipeline is processing updates
 *
 * Together they answer the "is it broken or just quiet?" question without
 * having to reload or open devtools.
 */
export function StrategyHeartbeat({
  baseSignal,
  emaFast,
  emaSlow,
  rsi,
  lastTickAt,
  now,
  intervalMs,
}: StrategyHeartbeatProps) {
  // Feed staleness: any gap longer than 2× the candle interval counts as
  // stale. For a 1m interval that's 2 minutes; for 1h it's 2 hours. WS ticks
  // on sub-second cadence, so a real stall will trip this quickly.
  const ageMs = lastTickAt === null ? null : now - lastTickAt
  const isStale = ageMs === null || ageMs > intervalMs * 2

  const indicatorsReady = isFinite(emaFast) && isFinite(emaSlow) && isFinite(rsi)
  const spread = indicatorsReady ? emaFast - emaSlow : NaN

  const dotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: isStale ? 'var(--text-secondary)' : 'var(--win)',
    boxShadow: isStale ? 'none' : '0 0 4px var(--win)',
    flexShrink: 0,
  }

  const separatorStyle: CSSProperties = {
    color: 'var(--text-secondary)',
    opacity: 0.5,
  }

  return (
    <div
      role="status"
      aria-live="off"
      aria-label={`Strategy heartbeat. Base signal ${baseSignal}. ${isStale ? 'Feed stale.' : 'Feed live.'}`}
      className="flex items-center gap-2 px-4 py-2 text-xs"
      style={{
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        fontFamily: 'JetBrains Mono, monospace',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={dotStyle} aria-hidden="true" />
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {isStale ? 'stale' : 'live'}
      </span>

      <span style={separatorStyle}>·</span>

      <span>
        base{' '}
        <span style={{ color: SIGNAL_COLORS[baseSignal], fontWeight: 500 }}>
          {baseSignal}
        </span>
      </span>

      <span style={separatorStyle}>·</span>

      <span title="EMA 9 minus EMA 21 — distance to a fresh cross">
        spread{' '}
        <span style={{ color: 'var(--text-mono)' }}>
          {indicatorsReady ? formatSpread(spread) : '—'}
        </span>
      </span>

      <span style={separatorStyle}>·</span>

      <span title="14-period RSI on the current bar">
        rsi{' '}
        <span style={{ color: 'var(--text-mono)' }}>
          {indicatorsReady ? rsi.toFixed(1) : '—'}
        </span>
      </span>

      <span style={separatorStyle}>·</span>

      <span title="Time since the last WebSocket tick updated the strategy">
        tick{' '}
        <span style={{ color: isStale ? 'var(--loss)' : 'var(--text-mono)' }}>
          {ageMs === null ? '—' : `${formatAgo(ageMs)} ago`}
        </span>
      </span>
    </div>
  )
}
