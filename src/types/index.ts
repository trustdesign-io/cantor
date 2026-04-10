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
}

/** Signal emitted by the strategy engine */
export type Signal = 'BUY' | 'SELL' | 'HOLD'

/** An entry in the live Signal Log */
export interface SignalEvent {
  timestamp: number // Unix timestamp (ms)
  pair: Pair
  signal: Signal
  price: number
}

/** Current open position held by the paper trader */
export interface Position {
  pair: Pair
  entryPrice: number
  entryTime: number  // Unix timestamp (ms)
  size: number       // Amount of base currency held
  unrealisedPnl: number
}
