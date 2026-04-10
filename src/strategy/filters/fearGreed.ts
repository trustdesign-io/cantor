import type { FilterFn } from '@/types'

/**
 * Fear & Greed threshold for long veto.
 * Above this level the market is in "extreme greed" — sentiment is stretched,
 * historically a contrarian indicator against new longs.
 */
export const FEAR_GREED_LONG_VETO = 80

/**
 * Fear & Greed threshold for short veto.
 * Below this level the market is in "extreme fear" — sentiment is stretched to
 * the downside, historically a contrarian indicator against new shorts.
 */
export const FEAR_GREED_SHORT_VETO = 20

/**
 * Veto new longs when the Crypto Fear & Greed Index is above 80 (extreme greed).
 * Veto new shorts when the index is below 20 (extreme fear).
 *
 * The filter reads `context.fearGreedIndex`. If the value is absent (data not
 * yet fetched or fetch failed), the filter passes to avoid suppressing valid signals.
 *
 * Named function declaration so `filter.name === 'isFearGreedExtreme'` is
 * reliable for the Phase 9 filter contribution report.
 */
export function isFearGreedExtreme(
  _candles: Parameters<FilterFn>[0],
  context: Parameters<FilterFn>[1]
): ReturnType<FilterFn> {
  const { fearGreedIndex } = context

  if (fearGreedIndex === undefined || fearGreedIndex === null) {
    return { ok: true }
  }

  if (fearGreedIndex > FEAR_GREED_LONG_VETO) {
    return {
      ok: false,
      reason: `Extreme greed (Fear & Greed = ${fearGreedIndex}, longs at risk)`,
    }
  }

  if (fearGreedIndex < FEAR_GREED_SHORT_VETO) {
    return {
      ok: false,
      reason: `Extreme fear (Fear & Greed = ${fearGreedIndex}, shorts at risk)`,
    }
  }

  return { ok: true }
}
