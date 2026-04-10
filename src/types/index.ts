/** Trading pair available in Cantor v0.1 */
export type Pair = 'XBT/USDT' | 'ETH/USDT'

/** The four main tabs */
export type Tab = 'live' | 'backtest' | 'journal' | 'performance'

/** A single OHLC candle */
export interface Candle {
  time: number   // Unix timestamp (seconds)
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/** A completed paper trade */
export interface Trade {
  id: string
  pair: Pair
  entryPrice: number
  exitPrice: number
  entryTime: number   // Unix timestamp (ms)
  exitTime: number    // Unix timestamp (ms)
  pnlAbsolute: number // P&L in account currency (£)
  pnlPercent: number  // P&L as a percentage of entry value
  durationMs: number  // Trade duration in milliseconds
  signalReason: string // Human-readable signal description (e.g. "EMA 9 crossed above EMA 21, RSI=45")
  /** Position size multiplier applied at entry — 1.0 means full balance, 0.5 means half, etc. */
  sizeMultiplier: number
}

/** Signal emitted by the strategy engine */
export type Signal = 'BUY' | 'SELL' | 'HOLD'

/**
 * Pre-fetched async data available to signal filters at evaluation time.
 * Populated upstream in useLiveStrategy from the individual data modules.
 * Only include fields that are actually read by at least one registered filter.
 */
export interface FilterContext {
  /** Average perpetual funding rate across exchanges as a decimal per 8-hour period (e.g. 0.001 = 0.1%) */
  fundingRate?: number
  /** Crypto Fear & Greed Index 0–100 */
  fearGreedIndex?: number
  /**
   * Last N days of BTC spot ETF net flows (USD millions), oldest first.
   * Used by the optional `isEtfFlowNegativeStreak` filter.
   */
  etfFlows?: ReadonlyArray<{ date: string; netFlowUsd: number; byFund: Record<string, number> }>
}

/**
 * Return value from a signal filter function.
 * A discriminated union: reason is required when ok is false so veto log
 * entries are always human-readable.
 */
export type FilterResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * A signal filter — pure, synchronous, no network calls.
 * Must be a named function declaration or named function expression (not an
 * anonymous arrow function) so `filter.name` produces a useful label in the
 * filter contribution report (Phase 9).
 */
export type FilterFn = (candles: readonly Candle[], context: FilterContext) => FilterResult

/** Extended result from detectSignal including base signal and veto info */
export interface SignalResult {
  /** The effective signal after all filters have been applied */
  signal: Signal
  /** The raw signal before any filter veto */
  baseSignal: Signal
  /** Name of the filter that vetoed the signal (if any) */
  vetoedBy?: string
  /** Human-readable reason for the veto */
  reason?: string
}

/** An entry in the live Signal Log */
export interface SignalEvent {
  timestamp: number // Unix timestamp (ms)
  pair: Pair
  signal: Signal
  price: number
  /** Populated when a filter downgraded a BUY or SELL to HOLD */
  vetoReason?: string
}

/** Current open position held by the paper trader */
export interface Position {
  pair: Pair
  entryPrice: number
  entryTime: number  // Unix timestamp (ms)
  size: number       // Amount of base currency held
  unrealisedPnl: number
  /** Size multiplier applied at entry — preserved for accurate P&L accounting */
  sizeMultiplier: number
}
