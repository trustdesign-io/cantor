import { ema } from '@/indicators/ema'
import { rsi } from '@/indicators/rsi'
import { detectSignal, EMA_FAST_PERIOD, EMA_SLOW_PERIOD, RSI_PERIOD, DEFAULT_FILTERS } from '@/strategy/signals'
import { onSignal, INITIAL_STATE } from '@/strategy/paperTrader'
import { sizeForSignal } from '@/strategy/sizing'
import type { Candle, FilterContext, FilterFn, Pair, Trade } from '@/types'
import type { PaperTraderState } from '@/strategy/paperTrader'

export interface BacktestResult {
  /** Completed trades produced by the strategy (oldest first). */
  trades: readonly Trade[]
  /**
   * Cash balance at the end of the run.
   * If a position is still open when the series ends, this represents the
   * un-deployed cash — the position is not marked-to-market.
   */
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
 * @param context - Filter context to use for every bar (e.g. for ablation tests).
 *                  In live backtests this is typically empty (no real-time data).
 * @param filters - Filter pipeline. Defaults to DEFAULT_FILTERS. Pass a subset
 *                  to run ablation tests (Phase 9).
 * @returns       - BacktestResult with completed trades and cash balance.
 */
export function runBacktest(
  candles: readonly Candle[],
  pair: Pair,
  context: FilterContext = {},
  filters: readonly FilterFn[] = DEFAULT_FILTERS
): BacktestResult {
  const MIN_CANDLES = EMA_SLOW_PERIOD + 1

  if (candles.length < MIN_CANDLES) {
    return { trades: [], finalBalance: INITIAL_STATE.balance }
  }

  let state: PaperTraderState = { ...INITIAL_STATE, trades: [] }

  for (let i = MIN_CANDLES - 1; i < candles.length; i++) {
    // Compute indicators over all candles up to and including this bar
    const candlesUpToBar = candles.slice(0, i + 1)
    const closes = candlesUpToBar.map(c => c.close)
    const result = detectSignal(
      ema(closes, EMA_FAST_PERIOD),
      ema(closes, EMA_SLOW_PERIOD),
      rsi(closes, RSI_PERIOD),
      candlesUpToBar,
      context,
      filters,
    )

    if (result.signal !== 'HOLD') {
      const candle = candles[i]
      const sizeMultiplier = sizeForSignal(result.signal, context)
      state = onSignal(state, result.signal, candle.close, candle.time * 1000, pair, sizeMultiplier)
    }
  }

  return {
    trades: state.trades,
    finalBalance: state.balance,
  }
}
