/**
 * Exponential Moving Average (EMA)
 *
 * Formula:
 *   multiplier = 2 / (period + 1)
 *   EMA[0]     = SMA of first `period` prices  (seed)
 *   EMA[i]     = (price[i] − EMA[i−1]) × multiplier + EMA[i−1]
 *
 * The multiplier gives more weight to recent prices than a simple moving
 * average does. A smaller period (e.g. 9) reacts faster to price changes;
 * a larger period (e.g. 21) is smoother and lags more.
 *
 * Output:
 *   Array of the same length as `prices`.
 *   The first `period − 1` values are NaN (insufficient data for the seed SMA).
 *   All subsequent values are finite EMA readings that align index-for-index
 *   with the input prices array — making it easy to overlay on a chart.
 */
export function ema(prices: readonly number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(NaN)
  if (prices.length < period) return result

  // Seed: simple arithmetic mean of the first `period` prices
  let prev = 0
  for (let i = 0; i < period; i++) prev += prices[i]
  prev /= period
  result[period - 1] = prev

  // Smoothing constant
  const k = 2 / (period + 1)

  for (let i = period; i < prices.length; i++) {
    prev = (prices[i] - prev) * k + prev
    result[i] = prev
  }

  return result
}
