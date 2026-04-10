import type { Signal, Position } from '@/types'

/** Snapshot of dashboard state used to detect narratable events */
export interface DashboardSnapshot {
  signal: Signal
  /** Raw base signal before filter pipeline */
  baseSignal: Signal
  /** Name of filter that vetoed the signal, if any */
  vetoedBy: string | undefined
  /** Human-readable veto reason, if any */
  vetoReason: string | undefined
  /** Last EMA 9 value (NaN if not enough data) */
  emaFast: number
  /** Last EMA 21 value (NaN if not enough data) */
  emaSlow: number
  /** Last RSI 14 value (NaN if not enough data) */
  rsi: number
  /** Most recent candle close price */
  candleClose: number
  /** Current open position, or null if flat */
  position: Position | null
  /** Average perpetual funding rate (decimal per 8h), or null if unavailable */
  fundingRate: number | null
  /** Crypto Fear & Greed Index 0–100, or null if unavailable */
  fearGreedIndex: number | null
}

// ── Event types ───────────────────────────────────────────────────────────────

interface BaseEvent {
  /** When the event was detected (ms since epoch) */
  timestamp: number
  /** Candle close price at the time of the event */
  candleClose: number
}

/** A BUY or SELL signal just fired */
export interface SignalChangeEvent extends BaseEvent {
  kind: 'signal-change'
  signal: Exclude<Signal, 'HOLD'>
  emaFast: number
  emaSlow: number
  rsi: number
}

/** A filter vetoed a BUY or SELL base signal */
export interface FilterVetoEvent extends BaseEvent {
  kind: 'filter-veto'
  baseSignal: Exclude<Signal, 'HOLD'>
  vetoedBy: string
  reason: string
  fundingRate: number | null
  fearGreedIndex: number | null
}

/** EMA 9 crossed above (golden) or below (death) EMA 21 */
export interface EmaCrossEvent extends BaseEvent {
  kind: 'ema-cross'
  crossType: 'golden' | 'death'
  emaFast: number
  emaSlow: number
  rsi: number
}

/** RSI entered an extreme zone (overbought >70 or oversold <30) */
export interface RsiZoneEnterEvent extends BaseEvent {
  kind: 'rsi-zone-enter'
  zone: 'overbought' | 'oversold'
  rsi: number
  emaFast: number
  emaSlow: number
}

/** RSI exited an extreme zone */
export interface RsiZoneExitEvent extends BaseEvent {
  kind: 'rsi-zone-exit'
  zone: 'overbought' | 'oversold'
  rsi: number
}

/** A new paper trade position was opened */
export interface PositionOpenEvent extends BaseEvent {
  kind: 'position-open'
  position: Position
  emaFast: number
  emaSlow: number
  rsi: number
}

/** An open paper trade position was closed */
export interface PositionCloseEvent extends BaseEvent {
  kind: 'position-close'
  entryPrice: number
  exitPrice: number
  /** P&L as a percentage of entry value (positive = profit) */
  pnlPercent: number
}

/** Funding rate crossed into or out of an extreme threshold */
export interface FundingThresholdCrossEvent extends BaseEvent {
  kind: 'funding-threshold-cross'
  fundingRate: number
  direction: 'into-extreme' | 'out-of-extreme'
  /** Which side is crowded */
  crowded: 'longs' | 'shorts'
}

export type CommentaryEvent =
  | SignalChangeEvent
  | FilterVetoEvent
  | EmaCrossEvent
  | RsiZoneEnterEvent
  | RsiZoneExitEvent
  | PositionOpenEvent
  | PositionCloseEvent
  | FundingThresholdCrossEvent

// ── Buffer entry ─────────────────────────────────────────────────────────────

/** A single entry in the live commentary buffer */
export interface CommentaryEntry {
  /** Unique stable ID for React key prop */
  id: string
  timestamp: number
  event: CommentaryEvent
  /** Short human-readable event label (e.g. "Golden cross") */
  label: string
  /** Streamed explanation text — grows token-by-token while streaming is true */
  text: string
  /** True while the LLM response is still streaming */
  streaming: boolean
}
