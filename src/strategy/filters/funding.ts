import type { FilterFn } from '@/types'

/**
 * Funding rate threshold for long veto (percent per 8-hour period).
 * Above this level, longs are crowded — leveraged long positions are paying to hold.
 * Mean-reversion shorts have historical edge; new longs should be avoided.
 */
export const FUNDING_LONG_VETO_THRESHOLD = 0.001   // +0.1% per 8h

/**
 * Funding rate threshold for short veto (percent per 8-hour period).
 * Below this level, shorts are crowded — leveraged short positions are paying to hold.
 * New shorts should be avoided.
 */
export const FUNDING_SHORT_VETO_THRESHOLD = -0.0005  // -0.05% per 8h

/**
 * Veto new long positions when perpetual funding is extreme (too many longs).
 * Veto new short positions when funding is deeply negative (too many shorts).
 *
 * The filter reads `context.fundingRate` — the average across exchanges as a
 * decimal (e.g. 0.001 = 0.1%). If the value is absent (data not yet fetched or
 * both exchanges failed), the filter passes to avoid suppressing valid signals.
 *
 * Named function declaration so `filter.name === 'isFundingExtreme'` is
 * reliable for the Phase 9 filter contribution report.
 */
export function isFundingExtreme(
  _candles: Parameters<FilterFn>[0],
  context: Parameters<FilterFn>[1]
): ReturnType<FilterFn> {
  const { fundingRate } = context

  // Missing data — pass rather than veto
  if (fundingRate === undefined || fundingRate === null) {
    return { ok: true }
  }

  const pct = (fundingRate * 100).toFixed(4)

  if (fundingRate > FUNDING_LONG_VETO_THRESHOLD) {
    return {
      ok: false,
      reason: `Funding extreme (+${pct}% / 8h, longs crowded)`,
    }
  }

  if (fundingRate < FUNDING_SHORT_VETO_THRESHOLD) {
    return {
      ok: false,
      reason: `Funding extreme (${pct}% / 8h, shorts crowded)`,
    }
  }

  return { ok: true }
}
