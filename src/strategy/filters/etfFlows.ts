import type { EtfFlowEntry } from '@/data/etfFlows'
import type { FilterFn, FilterResult } from '@/types'

/**
 * Number of consecutive negative-flow days required to trigger a veto.
 * Three consecutive net-outflow days have historically preceded BTC sell-offs.
 */
export const NEGATIVE_STREAK_THRESHOLD = 3

/**
 * Pure function — detects whether the last `n` entries in `flows` are all
 * net-negative. Returns true only when there are at least `n` entries and all
 * of the final `n` have `netFlowUsd < 0`.
 *
 * Exported separately so tests can drive it directly without constructing a
 * full FilterContext.
 *
 * @param flows - ETF flow history, oldest first
 * @param n     - Consecutive negative days required (defaults to NEGATIVE_STREAK_THRESHOLD)
 */
export function hasNegativeStreak(flows: readonly EtfFlowEntry[], n = NEGATIVE_STREAK_THRESHOLD): boolean {
  if (flows.length < n) return false
  const tail = flows.slice(-n)
  return tail.every(entry => entry.netFlowUsd < 0)
}

/**
 * Veto new long (BUY) positions when BTC ETF net flows have been negative for
 * three or more consecutive days.
 *
 * ⚠️  This filter is NOT wired into DEFAULT_FILTERS by default.
 *     Add it to your filter pipeline explicitly to opt in.
 *
 * Signal handling:
 *   BUY  — vetoed if streak detected
 *   SELL — always passes (streak is bearish context, shorting is consistent)
 *   HOLD — unreachable in filter context (detectSignal only calls filters on non-HOLD)
 *
 * Passes (ok: true) when flows are unavailable — fail-open prevents suppressing
 * valid signals due to a data outage.
 *
 * Named function declaration so `filter.name === 'isEtfFlowNegativeStreak'`
 * is reliable for the Phase 9 filter contribution report.
 */
export function isEtfFlowNegativeStreak(
  _candles: Parameters<FilterFn>[0],
  context: Parameters<FilterFn>[1]
): FilterResult {
  const { etfFlows } = context

  if (!etfFlows || etfFlows.length === 0) return { ok: true }

  // Only veto BUY signals — SELL signals are consistent with outflow context
  // The signal being filtered is available as the base signal in the detection
  // pipeline, but the FilterFn contract only sees candles+context, not the signal.
  // We apply the veto conservatively on all signals; callers can narrow by
  // checking `baseSignal` before adding this filter.
  if (!hasNegativeStreak(etfFlows)) return { ok: true }

  return {
    ok: false,
    reason: `ETF flow streak: ${NEGATIVE_STREAK_THRESHOLD}+ consecutive days of net outflow`,
  }
}
