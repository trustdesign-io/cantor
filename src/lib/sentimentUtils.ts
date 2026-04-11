import type { Candle } from '@/types'

/** A time-stamped scalar value, compatible with lightweight-charts LineSeries data. */
export interface TimeValue {
  time: number
  value: number
}

/**
 * Step-interpolate daily Fear & Greed values across intraday candle bars.
 *
 * Each candle gets the F&G value whose timestamp is the most recent daily
 * reading that falls on or before the candle's time (step-forward fill).
 * Candles earlier than the first reading are excluded.
 *
 * @param dailyReadings - Array of {time, value} sorted ascending by time
 * @param candles       - Array of candles sorted ascending by time
 * @returns             - TimeValue[] aligned to candle timestamps
 */
export function stepInterpolate(
  dailyReadings: TimeValue[],
  candles: readonly Candle[]
): TimeValue[] {
  if (dailyReadings.length === 0 || candles.length === 0) return []

  const result: TimeValue[] = []
  let readingIdx = 0

  for (const candle of candles) {
    // Advance the reading pointer to the latest daily value that does not
    // exceed the candle's timestamp.
    while (
      readingIdx < dailyReadings.length - 1 &&
      (dailyReadings[readingIdx + 1]?.time ?? Infinity) <= candle.time
    ) {
      readingIdx++
    }
    const reading = dailyReadings[readingIdx]
    // Skip candles before the first available reading
    if (reading == null || reading.time > candle.time) continue
    result.push({ time: candle.time, value: reading.value })
  }

  return result
}

/**
 * Compute a rolling z-score for a series of values using the previous N
 * periods as the lookback window. Returns NaN for the first N−1 values.
 *
 * @param values   - Input time-value series
 * @param window   - Lookback window length (default 20)
 */
export function rollingZScore(values: TimeValue[], window = 20): TimeValue[] {
  return values.map((tv, i) => {
    if (i < window - 1) return { ...tv, value: NaN }
    const slice = values.slice(i - window + 1, i + 1).map(x => x.value)
    const mean = slice.reduce((a, b) => a + b, 0) / window
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / window
    const std = Math.sqrt(variance)
    return { ...tv, value: std === 0 ? 0 : (tv.value - mean) / std }
  })
}

/** A detected divergence between price and sentiment. */
export interface DivergenceEvent {
  /** Candle index where the divergence ends (the third diverging bar). */
  endIndex: number
  /** Unix timestamp of the last diverging bar. */
  time: number
  /** 'bullish' = price falling, sentiment rising (hidden bull div). */
  direction: 'bullish' | 'bearish'
  /** Percentage price move over the window. */
  pricePct: number
  /** Sentiment change over the window (in sentiment units). */
  sentimentDelta: number
  /** Number of consecutive diverging bars. */
  barCount: number
}

/**
 * Detect divergences: consecutive bars where price and aggregate sentiment
 * move in opposite directions for at least `minBars` bars.
 *
 * Default thresholds per the ticket spec:
 *   - price move ≥ 2% over the window
 *   - sentiment change ≥ 10 points over the window
 *
 * @param prices     - Price close time-value series
 * @param sentiment  - Aggregate sentiment time-value series (same timestamps)
 * @param minBars    - Minimum consecutive diverging bars before a marker fires (default 3)
 * @param priceThreshold    - Minimum absolute price % move (default 2)
 * @param sentimentThreshold - Minimum absolute sentiment change (default 10)
 */
export function detectDivergences(
  prices: TimeValue[],
  sentiment: TimeValue[],
  minBars = 3,
  priceThreshold = 2,
  sentimentThreshold = 10,
): DivergenceEvent[] {
  if (prices.length < minBars || sentiment.length < minBars) return []

  // Build a timestamp-keyed map for fast sentiment lookup
  const sentMap = new Map<number, number>()
  for (const sv of sentiment) sentMap.set(sv.time, sv.value)

  const results: DivergenceEvent[] = []
  // Sliding window scan
  for (let end = minBars - 1; end < prices.length; end++) {
    const start = end - minBars + 1
    const startPrice = prices[start]
    const endPrice = prices[end]
    if (startPrice == null || endPrice == null) continue

    const startSent = sentMap.get(startPrice.time)
    const endSent = sentMap.get(endPrice.time)
    if (startSent == null || endSent == null) continue

    const pricePct = ((endPrice.value - startPrice.value) / startPrice.value) * 100
    const sentimentDelta = endSent - startSent

    const priceUp = pricePct >= priceThreshold
    const priceDown = pricePct <= -priceThreshold
    const sentUp = sentimentDelta >= sentimentThreshold
    const sentDown = sentimentDelta <= -sentimentThreshold

    if ((priceUp && sentDown) || (priceDown && sentUp)) {
      results.push({
        endIndex: end,
        time: endPrice.time,
        direction: priceDown && sentUp ? 'bullish' : 'bearish',
        pricePct,
        sentimentDelta,
        barCount: minBars,
      })
    }
  }

  return results
}
