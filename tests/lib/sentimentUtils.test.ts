import { describe, it, expect } from 'vitest'
import { stepInterpolate, rollingZScore, detectDivergences } from '@/lib/sentimentUtils'
import type { Candle } from '@/types'

function makeCandle(time: number, close: number): Candle {
  return { time, open: close, high: close, low: close, close, volume: 1 }
}

// ── stepInterpolate ──────────────────────────────────────────────────────────

describe('stepInterpolate', () => {
  it('returns empty array when readings are empty', () => {
    const candles = [makeCandle(100, 50)]
    expect(stepInterpolate([], candles)).toHaveLength(0)
  })

  it('returns empty array when candles are empty', () => {
    expect(stepInterpolate([{ time: 100, value: 50 }], [])).toHaveLength(0)
  })

  it('assigns the most recent daily reading to each candle', () => {
    // Two daily readings at t=0 and t=86400
    const readings = [{ time: 0, value: 40 }, { time: 86400, value: 60 }]
    const candles = [
      makeCandle(0, 100),        // exactly at first reading
      makeCandle(43200, 100),    // midway between readings → still first reading
      makeCandle(86400, 100),    // exactly at second reading
      makeCandle(100000, 100),   // after second reading → second reading
    ]
    const result = stepInterpolate(readings, candles)
    expect(result).toHaveLength(4)
    expect(result[0]?.value).toBe(40)
    expect(result[1]?.value).toBe(40) // step, not interpolated
    expect(result[2]?.value).toBe(60)
    expect(result[3]?.value).toBe(60)
  })

  it('excludes candles before the first reading', () => {
    const readings = [{ time: 1000, value: 50 }]
    const candles = [makeCandle(500, 100), makeCandle(1000, 100), makeCandle(1500, 100)]
    const result = stepInterpolate(readings, candles)
    expect(result).toHaveLength(2)
    expect(result[0]?.time).toBe(1000)
  })

  it('preserves candle timestamps in output', () => {
    const readings = [{ time: 0, value: 55 }]
    const candles = [makeCandle(100, 200), makeCandle(200, 210)]
    const result = stepInterpolate(readings, candles)
    expect(result.map(r => r.time)).toEqual([100, 200])
  })
})

// ── rollingZScore ────────────────────────────────────────────────────────────

describe('rollingZScore', () => {
  it('returns NaN for first window-1 values', () => {
    const values = Array.from({ length: 5 }, (_, i) => ({ time: i, value: i + 1 }))
    const result = rollingZScore(values, 3)
    expect(isNaN(result[0]?.value ?? 0)).toBe(true)
    expect(isNaN(result[1]?.value ?? 0)).toBe(true)
    expect(isNaN(result[2]?.value ?? 0)).toBe(false)
  })

  it('returns 0 z-score when all values in window are identical', () => {
    const values = Array.from({ length: 5 }, (_, i) => ({ time: i, value: 50 }))
    const result = rollingZScore(values, 3)
    expect(result[4]?.value).toBe(0)
  })

  it('returns positive z-score for value above mean', () => {
    // Window [1, 2, 3]: mean=2, std≈0.816, z of 3 = (3-2)/0.816 ≈ 1.22
    const values = [{ time: 0, value: 1 }, { time: 1, value: 2 }, { time: 2, value: 3 }]
    const result = rollingZScore(values, 3)
    expect(result[2]!.value).toBeGreaterThan(0)
  })
})

// ── detectDivergences ────────────────────────────────────────────────────────

describe('detectDivergences', () => {
  it('returns empty when series are too short', () => {
    const prices = [{ time: 0, value: 100 }, { time: 1, value: 102 }]
    const sentiment = [{ time: 0, value: 50 }, { time: 1, value: 40 }]
    expect(detectDivergences(prices, sentiment, 3)).toHaveLength(0)
  })

  it('detects bearish divergence: price rises, sentiment falls', () => {
    // Price: +3% over 3 bars. Sentiment: −12 points. Bearish divergence.
    const prices = [
      { time: 0, value: 100 },
      { time: 1, value: 101 },
      { time: 2, value: 103 },
    ]
    const sentiment = [
      { time: 0, value: 60 },
      { time: 1, value: 55 },
      { time: 2, value: 48 },
    ]
    const divs = detectDivergences(prices, sentiment, 3, 2, 10)
    expect(divs).toHaveLength(1)
    expect(divs[0]?.direction).toBe('bearish')
    expect(divs[0]?.endIndex).toBe(2)
  })

  it('detects bullish divergence: price falls, sentiment rises', () => {
    const prices = [
      { time: 0, value: 100 },
      { time: 1, value: 97 },
      { time: 2, value: 95 },
    ]
    const sentiment = [
      { time: 0, value: 30 },
      { time: 1, value: 38 },
      { time: 2, value: 42 },
    ]
    const divs = detectDivergences(prices, sentiment, 3, 2, 10)
    expect(divs).toHaveLength(1)
    expect(divs[0]?.direction).toBe('bullish')
  })

  it('does not fire when price move is below threshold', () => {
    // Price only moves 1% — below priceThreshold of 2
    const prices = [
      { time: 0, value: 100 },
      { time: 1, value: 100.5 },
      { time: 2, value: 101 },
    ]
    const sentiment = [
      { time: 0, value: 60 },
      { time: 1, value: 50 },
      { time: 2, value: 48 },
    ]
    expect(detectDivergences(prices, sentiment, 3, 2, 10)).toHaveLength(0)
  })

  it('does not fire when sentiment change is below threshold', () => {
    // Price moves 3% but sentiment only drops 5 points — below sentimentThreshold of 10
    const prices = [
      { time: 0, value: 100 },
      { time: 1, value: 102 },
      { time: 2, value: 103 },
    ]
    const sentiment = [
      { time: 0, value: 60 },
      { time: 1, value: 57 },
      { time: 2, value: 55 },
    ]
    expect(detectDivergences(prices, sentiment, 3, 2, 10)).toHaveLength(0)
  })

  it('does not fire when price and sentiment move in the same direction', () => {
    const prices = [
      { time: 0, value: 100 },
      { time: 1, value: 102 },
      { time: 2, value: 105 },
    ]
    const sentiment = [
      { time: 0, value: 40 },
      { time: 1, value: 48 },
      { time: 2, value: 55 },
    ]
    expect(detectDivergences(prices, sentiment, 3, 2, 10)).toHaveLength(0)
  })
})
