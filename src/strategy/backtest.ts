import { ema } from '@/indicators/ema'
import { rsi } from '@/indicators/rsi'
import { computeSignal, EMA_FAST_PERIOD, EMA_SLOW_PERIOD, RSI_PERIOD } from '@/strategy/signals'
import { onSignal, INITIAL_STATE } from '@/strategy/paperTrader'
import type { Candle, Pair, Trade } from '@/types'
import type { PaperTraderState } from '@/strategy/paperTrader'

export interface BacktestResult {
  /** Completed trades produced by the strategy (oldest first). */
  trades: readonly Trade[]
  /** Account balance at the end of the run. Includes any open position value at last-seen price. */
  finalBalance: number
}

/**
 * Runs the EMA crossover + RSI strategy over a full candle series in-memory.
 * Pure function — no async, no side effects, no mutations.
 *
 * The strategy requires at least EMA_SLOW_PERIOD + 1 (22) candles to compute
 * an indicator reading. Candles before that threshold are skipped silently.
 *
 * Performance: O(n²) indicator computation — acceptable for up to ~3,000 candles
 * in a synchronous call without blocking the UI for more than ~200ms on modern
 * hardware. For very large datasets, consider moving to a Web Worker.
 *
 * @param candles - Full historical candle series (oldest first). Not mutated.
 * @param pair    - Trading pair (used to label completed trades).
 * @returns       - BacktestResult with completed trades and final balance.
 *                  If a position is still open at the end, finalBalance is 0
 *                  (the balance was deployed into the position).
 */
export function runBacktest(candles: readonly Candle[], pair: Pair): BacktestResult {
  const MIN_CANDLES = EMA_SLOW_PERIOD + 1

  if (candles.length < MIN_CANDLES) {
    return { trades: [], finalBalance: INITIAL_STATE.balance }
  }

  let state: PaperTraderState = INITIAL_STATE

  for (let i = MIN_CANDLES - 1; i < candles.length; i++) {
    // Compute indicators over all candles up to and including this bar
    const closes = candles.slice(0, i + 1).map(c => c.close)
    const signal = computeSignal(
      ema(closes, EMA_FAST_PERIOD),
      ema(closes, EMA_SLOW_PERIOD),
      rsi(closes, RSI_PERIOD),
    )

    if (signal !== 'HOLD') {
      const candle = candles[i]
      state = onSignal(state, signal, candle.close, candle.time * 1000, pair)
    }
  }

  return {
    trades: state.trades,
    finalBalance: state.balance,
  }
}
