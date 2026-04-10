import type { Pair, Position, Signal, Trade } from '@/types'

/** Starting paper trading balance in USDT */
export const INITIAL_BALANCE = 10_000

export interface PaperTraderState {
  /** Available USDT balance — 0 when fully invested in a position */
  balance: number
  /** Currently open position, or null if flat */
  position: Position | null
  /** All completed (closed) trades, oldest first */
  trades: readonly Trade[]
}

export const INITIAL_STATE: PaperTraderState = {
  balance: INITIAL_BALANCE,
  position: null,
  trades: [],
}

/**
 * Pure state-machine step for the paper trader. Returns a new state object;
 * the input is never mutated.
 *
 * Signal handling:
 *   BUY  — Open a long position using the entire available balance.
 *           Ignored if a position is already open or balance is zero.
 *   SELL — Close the open position, realise P&L, append completed trade.
 *           Ignored if no position is open.
 *   HOLD — No state change.
 *
 * Position sizing simplification:
 *   100% of the available balance is deployed on each BUY signal.
 *   In a real strategy you would use fractional sizing (e.g. fixed-fraction
 *   or Kelly criterion) to limit risk. For a paper-trading lab the all-in
 *   approach keeps the P&L maths simple and ensures at most one open
 *   position at any time.
 */
export function onSignal(
  state: PaperTraderState,
  signal: Signal,
  price: number,
  timestamp: number,
  pair: Pair
): PaperTraderState {
  if (signal === 'HOLD') return state

  if (signal === 'BUY') {
    if (state.position !== null) return state  // already in a position
    if (state.balance <= 0) return state       // nothing to invest

    /** Size in base currency (e.g. BTC for XBT/USDT): balance / price */
    const size = state.balance / price

    const position: Position = {
      pair,
      entryPrice: price,
      entryTime: timestamp,
      size,
      unrealisedPnl: 0,
    }

    return { ...state, balance: 0, position }
  }

  if (signal === 'SELL') {
    if (state.position === null) return state  // flat, nothing to close

    const { position } = state
    const exitValue = position.size * price
    const entryValue = position.size * position.entryPrice
    const pnlAbsolute = exitValue - entryValue
    const pnlPercent = (pnlAbsolute / entryValue) * 100

    const trade: Trade = {
      id: `${pair}-${position.entryTime}-${timestamp}`,
      pair,
      entryPrice: position.entryPrice,
      exitPrice: price,
      entryTime: position.entryTime,
      exitTime: timestamp,
      pnlAbsolute,
      pnlPercent,
      durationMs: timestamp - position.entryTime,
      signalReason: `EMA 9/21 crossover, exit price ${price.toFixed(2)}`,
    }

    return {
      ...state,
      balance: exitValue,
      position: null,
      trades: [...state.trades, trade],
    }
  }

  return state
}
