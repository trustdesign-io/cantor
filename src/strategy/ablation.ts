import { runBacktest } from '@/strategy/backtest'
import { computeMetrics } from '@/metrics/performance'
import { DEFAULT_FILTERS } from '@/strategy/signals'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { Candle, FilterFn, Pair } from '@/types'

export interface AblationEntry {
  /** Human-readable filter name (from the filter function's `.name` property) */
  filterName: string
  /**
   * Total return % delta: baseline − without-filter.
   * Positive = the filter contributed positively (removing it hurts return).
   * Negative = the filter contributed negatively (removing it helps return).
   */
  deltaReturn: number
  /**
   * Sharpe ratio delta: baseline − without-filter.
   * Positive = the filter improved risk-adjusted return.
   */
  deltaSharpe: number
  /**
   * Trade count delta: trades-without-filter − baseline-trades.
   * Shows how many additional trades would have occurred without the filter
   * (i.e., how many the filter suppressed).
   */
  deltaTrades: number
  /** True when the baseline run produced zero trades — no meaningful delta is possible. */
  allTradesRemoved: boolean
}

/**
 * Runs N+1 backtests: one baseline (all filters on), then one with each filter
 * individually removed. Returns per-filter deltas for return %, Sharpe ratio,
 * and trade count.
 *
 * Results are fully deterministic given the same candle set — the backtester
 * does not use `Date.now()` or any other source of non-determinism for trade
 * decisions.
 *
 * @param candles        - Historical candle series (oldest first). Not mutated.
 * @param pair           - Trading pair label used in trade records.
 * @param startingBalance - Starting account balance for metric computation.
 * @param filters        - Filter pipeline. Defaults to DEFAULT_FILTERS.
 */
export function runFilterAblation(
  candles: readonly Candle[],
  pair: Pair,
  startingBalance: number = INITIAL_BALANCE,
  filters: readonly FilterFn[] = DEFAULT_FILTERS,
): AblationEntry[] {
  const baseline = runBacktest(candles, pair, {}, filters)
  const baselineMetrics = computeMetrics(baseline.trades, startingBalance)

  return filters.map(filter => {
    const filtersWithout = filters.filter(f => f !== filter)
    const result = runBacktest(candles, pair, {}, filtersWithout)
    const metrics = computeMetrics(result.trades, startingBalance)

    return {
      filterName: filter.name || 'unknown',
      deltaReturn: baselineMetrics.totalReturnPct - metrics.totalReturnPct,
      deltaSharpe: baselineMetrics.sharpeRatio - metrics.sharpeRatio,
      deltaTrades: result.trades.length - baseline.trades.length,
      allTradesRemoved: baseline.trades.length === 0,
    }
  })
}
