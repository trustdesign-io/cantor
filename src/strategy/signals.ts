import type { Candle, FilterContext, FilterFn, Signal, SignalResult } from '@/types'

/** EMA fast period — reacts quickly to price changes, captures short-term momentum */
export const EMA_FAST_PERIOD = 9
/** EMA slow period — tracks the longer-term trend, filters out short-term noise */
export const EMA_SLOW_PERIOD = 21
/** RSI look-back period — Wilder's original default, widely used in practice */
export const RSI_PERIOD = 14
/**
 * RSI overbought threshold. BUY signals are suppressed above this level to
 * avoid entering a long position when the asset is already stretched upward.
 */
export const RSI_OVERBOUGHT = 70
/**
 * RSI oversold threshold. SELL signals are suppressed below this level to
 * avoid entering a short position when the asset is already stretched downward.
 */
export const RSI_OVERSOLD = 30

/**
 * Compute the trading signal for the most recent bar given pre-computed
 * indicator arrays. All arrays must be aligned index-for-index with the
 * candle array (NaN-padded at the front, same as ema() and rsi() output).
 *
 * Signal rules:
 *   BUY  — EMA 9 crosses above EMA 21 (golden cross) AND RSI < 70
 *           The crossover confirms upward momentum; the RSI filter avoids
 *           buying into an already overbought market.
 *
 *   SELL — EMA 9 crosses below EMA 21 (death cross) AND RSI > 30
 *           The crossover confirms downward momentum; the RSI filter avoids
 *           selling into an already oversold market.
 *
 *   HOLD — All other conditions, including:
 *           · EMA already above/below slow EMA (trend established, no fresh cross)
 *           · BUY cross but RSI >= 70 (overbought — skip)
 *           · SELL cross but RSI <= 30 (oversold — skip)
 *           · Any indicator value is NaN (insufficient candle history)
 *           · Fewer than 2 bars available (crossover requires prev + curr bar)
 */
export function computeSignal(
  emaFast: readonly number[],
  emaSlow: readonly number[],
  rsiValues: readonly number[]
): Signal {
  const n = emaFast.length
  if (n < 2) return 'HOLD'

  const fastCurr = emaFast[n - 1]
  const fastPrev = emaFast[n - 2]
  const slowCurr = emaSlow[n - 1]
  const slowPrev = emaSlow[n - 2]
  const rsi = rsiValues[n - 1]

  // Guard against NaN — indicators not yet seeded due to insufficient history
  if (
    !isFinite(fastCurr) ||
    !isFinite(fastPrev) ||
    !isFinite(slowCurr) ||
    !isFinite(slowPrev) ||
    !isFinite(rsi)
  ) {
    return 'HOLD'
  }

  // Golden cross: EMA 9 crosses from at-or-below to above EMA 21
  if (fastPrev <= slowPrev && fastCurr > slowCurr && rsi < RSI_OVERBOUGHT) {
    return 'BUY'
  }

  // Death cross: EMA 9 crosses from at-or-above to below EMA 21
  if (fastPrev >= slowPrev && fastCurr < slowCurr && rsi > RSI_OVERSOLD) {
    return 'SELL'
  }

  return 'HOLD'
}

/**
 * Ordered array of filter functions applied to every non-HOLD base signal.
 * Each filter is a pure synchronous function — no network calls.
 * Wired into the live strategy and backtest via detectSignal().
 *
 * Starts empty (Phase 7.1). Populated by individual filter tickets (8.1+).
 */
export const DEFAULT_FILTERS: readonly FilterFn[] = []

/**
 * Compute the trading signal and run it through an ordered filter pipeline.
 *
 * Filters are only evaluated for BUY or SELL base signals — HOLD passes
 * through immediately. The first filter returning `{ ok: false }` wins:
 * the signal is downgraded to HOLD and the reason is recorded.
 *
 * @param emaFast  - Pre-computed fast EMA array (index-aligned with candles)
 * @param emaSlow  - Pre-computed slow EMA array
 * @param rsiValues - Pre-computed RSI array
 * @param candles  - Full candle series passed to filters for context
 * @param context  - Pre-fetched async data (funding rate, fear & greed, etc.)
 * @param filters  - Ordered filter pipeline (defaults to DEFAULT_FILTERS)
 */
export function detectSignal(
  emaFast: readonly number[],
  emaSlow: readonly number[],
  rsiValues: readonly number[],
  candles: readonly Candle[] = [],
  context: FilterContext = {},
  filters: readonly FilterFn[] = DEFAULT_FILTERS
): SignalResult {
  const baseSignal = computeSignal(emaFast, emaSlow, rsiValues)

  // HOLD always passes through — filters only guard actionable signals
  if (baseSignal === 'HOLD' || filters.length === 0) {
    return { signal: baseSignal, baseSignal }
  }

  for (const filter of filters) {
    const result = filter(candles, context)
    if (!result.ok) {
      return {
        signal: 'HOLD',
        baseSignal,
        vetoedBy: filter.name || 'unknown',
        reason: result.reason,
      }
    }
  }

  return { signal: baseSignal, baseSignal }
}
