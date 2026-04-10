/**
 * Position sizing layer for the signal engine.
 *
 * Returns a size multiplier in [0.25, 2.0] based on corroborating signals.
 * The multiplier scales the fraction of balance deployed on the trade.
 * Multipliers from individual signals compose by multiplication, then the
 * result is clamped to [0.25, 2.0].
 *
 * With multiplier 1.0 (no sizing signals available), behaviour is identical
 * to the original all-in paper trader.
 *
 * Note on Kelly: this is NOT a Kelly criterion implementation. Kelly requires
 * a win-rate and win/loss ratio estimated from a statistically significant
 * trade history — Cantor does not yet have enough data for that. The multipliers
 * here are heuristic and should be treated as signals for a month of live
 * observation before being relied on.
 */

import type { FilterContext, Signal } from '@/types'

/** Minimum and maximum size multipliers */
export const MIN_MULTIPLIER = 0.25
export const MAX_MULTIPLIER = 2.0

/**
 * Funding rate sizing component.
 *
 * When funding favours the signal direction (shorts crowded for a BUY, or
 * longs crowded for a SELL), the position can be sized up slightly.
 * When funding is against the direction, size down defensively.
 *
 * Only applies when `context.fundingRate` is available.
 */
function fundingMultiplier(signal: Extract<Signal, 'BUY' | 'SELL'>, context: FilterContext): number {
  const { fundingRate } = context
  if (fundingRate === undefined) return 1.0

  if (signal === 'BUY') {
    // Negative funding = shorts crowded = contrarian setup favourable for longs
    if (fundingRate < -0.0001) return 1.2
    // Positive funding = longs crowded = against long position
    if (fundingRate > 0.0005) return 0.5
  } else {
    // Positive funding = longs crowded = contrarian setup favourable for shorts
    if (fundingRate > 0.0005) return 1.2
    // Negative funding = shorts crowded = against short position
    if (fundingRate < -0.0001) return 0.5
  }

  return 1.0
}

/**
 * Fear & Greed sizing component.
 *
 * When Fear & Greed is far from neutral and the signal is contrarian
 * (BUY when fearful, SELL when greedy), size up slightly. The further
 * from neutral, the stronger the contrarian reading.
 *
 * Only applies when `context.fearGreedIndex` is available.
 */
function fearGreedMultiplier(signal: Extract<Signal, 'BUY' | 'SELL'>, context: FilterContext): number {
  const { fearGreedIndex } = context
  if (fearGreedIndex === undefined) return 1.0

  const distanceFromNeutral = Math.abs(fearGreedIndex - 50)

  if (signal === 'BUY' && fearGreedIndex < 50 && distanceFromNeutral > 20) {
    // Buying into fear — contrarian signal, size up
    return 1.1
  }

  if (signal === 'SELL' && fearGreedIndex > 50 && distanceFromNeutral > 20) {
    // Selling into greed — contrarian signal, size up
    return 1.1
  }

  return 1.0
}

/**
 * Compute the position size multiplier for a signal given the current filter context.
 *
 * Individual component multipliers are composed by multiplication. The result
 * is clamped to [0.25, 2.0] regardless of the number of components.
 *
 * Returns 1.0 when no sizing context is available (behaviour unchanged from
 * the baseline all-in paper trader).
 *
 * @param signal  - BUY or SELL (HOLD is not sized — the caller should guard)
 * @param context - Pre-fetched signal context (funding rate, fear & greed, etc.)
 */
export function sizeForSignal(
  signal: Extract<Signal, 'BUY' | 'SELL'>,
  context: FilterContext
): number {
  const components = [
    fundingMultiplier(signal, context),
    fearGreedMultiplier(signal, context),
  ]

  const composed = components.reduce((acc, m) => acc * m, 1.0)
  return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, composed))
}
