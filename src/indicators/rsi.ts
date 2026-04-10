/**
 * Relative Strength Index (RSI) — Wilder's original algorithm
 *
 * Formula:
 *   RS  = Average Gain / Average Loss  over the look-back period
 *   RSI = 100 − 100 / (1 + RS)
 *
 * The seed (first RSI value) uses a simple average of the first `period`
 * up-moves and down-moves. Subsequent values use Wilder's smoothing:
 *
 *   avgGain = (prevAvgGain × (period − 1) + gain) / period
 *   avgLoss = (prevAvgLoss × (period − 1) + loss) / period
 *
 * Wilder's smoothing is equivalent to an EMA with multiplier 1/period
 * (rather than 2/(period+1) used by standard EMA). This makes the
 * indicator somewhat slower to react than a standard EMA-based version.
 *
 * Period choice:
 *   RSI 14 is the industry default. Lower periods (7, 9) are more sensitive
 *   and produce more signals; higher periods (21, 28) reduce noise.
 *
 * Output:
 *   Array of the same length as `prices`.
 *   The first `period` values are NaN — we need period+1 prices to compute
 *   the first `period` changes before the seed average can be formed.
 *   Values range [0, 100]. RSI > 70 is conventionally overbought;
 *   RSI < 30 is oversold.
 *
 * Special cases:
 *   avgLoss = 0 (only gains in period) → RSI = 100
 *   avgGain = 0 (only losses in period) → RS = 0 → RSI = 0
 */
export function rsi(prices: readonly number[], period: number): number[] {
  const result: number[] = new Array(prices.length).fill(NaN)
  if (prices.length <= period) return result

  // Seed: simple average of the first `period` gains and losses
  let avgGain = 0
  let avgLoss = 0

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) avgGain += change
    else avgLoss += -change
  }
  avgGain /= period
  avgLoss /= period

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  // Wilder smoothing for all subsequent bars
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return result
}
