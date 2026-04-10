import type { Pair, Position, Signal, Trade } from '@/types'

/** Starting paper trading balance in USDT */
export const INITIAL_BALANCE = 10_000

export interface PaperTraderState {
  /** Available USDT balance — reduced by the deployed amount on each BUY */
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
 *   BUY  — Open a long position deploying `balance * sizeMultiplier` USDT.
 *           The `sizeMultiplier` is capped at 1.0 (cannot invest more than
 *           available balance without leverage). With sizeMultiplier = 1.0
 *           (the default), behaviour is identical to the original all-in trader.
 *           Ignored if a position is already open or balance is zero.
 *   SELL — Close the open position, realise P&L, append completed trade.
 *           Ignored if no position is open.
 *   HOLD — No state change.
 */
export function onSignal(
  state: PaperTraderState,
  signal: Signal,
  price: number,
  timestamp: number,
  pair: Pair,
  sizeMultiplier = 1.0
): PaperTraderState {
  if (signal === 'HOLD') return state

  if (signal === 'BUY') {
    if (state.position !== null) return state  // already in a position
    if (state.balance <= 0) return state       // nothing to invest

    // Cap at 1.0 — paper trading has no leverage. Values above 1.0 are reserved
    // for future margin-aware implementations.
    const effectiveMultiplier = Math.min(1.0, sizeMultiplier)
    const deployedAmount = state.balance * effectiveMultiplier
    const size = deployedAmount / price

    const position: Position = {
      pair,
      entryPrice: price,
      entryTime: timestamp,
      size,
      unrealisedPnl: 0,
      sizeMultiplier: effectiveMultiplier,
    }

    return {
      ...state,
      balance: state.balance - deployedAmount,
      position,
    }
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
      sizeMultiplier: position.sizeMultiplier,
    }

    return {
      ...state,
      balance: state.balance + exitValue,
      position: null,
      trades: [...state.trades, trade],
    }
  }

  return state
}
