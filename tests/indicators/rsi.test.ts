import { describe, it, expect } from 'vitest'
import { rsi } from '@/indicators/rsi'

describe('rsi', () => {
  it('returns all-NaN array when prices.length <= period', () => {
    const result = rsi([1, 2, 3], 14)
    expect(result).toHaveLength(3)
    expect(result.every((v) => isNaN(v))).toBe(true)
  })

  it('output has the same length as input', () => {
    const prices = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(rsi(prices, 14)).toHaveLength(20)
  })

  it('first period values are NaN, index period is the first RSI value', () => {
    // 15 prices → first 14 NaN, result[14] is defined
    const prices = Array.from({ length: 15 }, (_, i) => i + 1)
    const result = rsi(prices, 14)
    result.slice(0, 14).forEach((v) => expect(isNaN(v)).toBe(true))
    expect(isNaN(result[14])).toBe(false)
  })

  it('RSI period 14 — all gains → RSI = 100', () => {
    // 15 strictly ascending prices: all 14 changes are gains, avgLoss = 0
    const prices = Array.from({ length: 15 }, (_, i) => i + 1)
    const result = rsi(prices, 14)
    expect(result[14]).toBeCloseTo(100, 5)
  })

  it('RSI period 14 — all losses → RSI = 0', () => {
    // 15 strictly descending prices: all 14 changes are losses, avgGain = 0
    const prices = Array.from({ length: 15 }, (_, i) => 15 - i)
    const result = rsi(prices, 14)
    expect(result[14]).toBeCloseTo(0, 5)
  })

  it('RSI period 14 — equal gains and losses → RSI ≈ 50', () => {
    // 7 gains of 1 and 7 losses of 1 (alternating) → avgGain = avgLoss = 0.5
    // RS = 1 → RSI = 50
    const prices: number[] = [100]
    for (let i = 0; i < 14; i++) {
      prices.push(prices[prices.length - 1] + (i % 2 === 0 ? 1 : -1))
    }
    const result = rsi(prices, 14)
    expect(result[14]).toBeCloseTo(50, 5)
  })

  it('RSI period 3 — small example with manual verification (seed)', () => {
    // prices = [10, 11, 12, 9, 8]
    // Changes:         +1, +1, −3, −1
    // First 3 changes: gains = 2, losses = 3
    // avgGain = 2/3, avgLoss = 3/3 = 1
    // RS = (2/3)/1 = 0.6667 → RSI[3] = 100 − 100/1.6667 ≈ 40.0
    const prices = [10, 11, 12, 9, 8]
    const result = rsi(prices, 3)
    expect(isNaN(result[0])).toBe(true)
    expect(isNaN(result[1])).toBe(true)
    expect(isNaN(result[2])).toBe(true)
    expect(result[3]).toBeCloseTo(40.0, 1)
  })

  it('RSI period 3 — Wilder smoothing applied correctly on 5th bar', () => {
    // Continuing from above: 5th bar change = −1 (loss)
    // avgGain = (0.6667×2 + 0) / 3 = 0.4444
    // avgLoss = (1×2 + 1) / 3 = 1
    // RS = 0.4444 → RSI[4] = 100 − 100/1.4444 ≈ 30.77
    const prices = [10, 11, 12, 9, 8]
    const result = rsi(prices, 3)
    expect(result[4]).toBeCloseTo(30.77, 1)
  })
})
