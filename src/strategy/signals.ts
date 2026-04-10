import type { Signal } from '@/types'

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
