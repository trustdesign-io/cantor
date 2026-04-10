import { describe, it, expect } from 'vitest'
import { ema } from '@/indicators/ema'

describe('ema', () => {
  it('returns all-NaN array when prices.length < period', () => {
    const result = ema([1, 2, 3], 5)
    expect(result).toHaveLength(3)
    expect(result.every((v) => isNaN(v))).toBe(true)
  })

  it('output has the same length as input', () => {
    const prices = Array.from({ length: 20 }, (_, i) => i + 1)
    expect(ema(prices, 9)).toHaveLength(20)
  })

  it('first period−1 values are NaN, index period−1 is the seed SMA', () => {
    // prices = [1..9], period = 9 → seed = mean = 5
    const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const result = ema(prices, 9)
    result.slice(0, 8).forEach((v) => expect(isNaN(v)).toBe(true))
    expect(result[8]).toBeCloseTo(5, 10)
  })

  it('EMA period 9 — arithmetic sequence converges correctly', () => {
    // For prices [1..11], multiplier = 2/(9+1) = 0.2
    // seed EMA[8] = (1+…+9)/9 = 5
    // EMA[9]  = (10−5)×0.2 + 5 = 6
    // EMA[10] = (11−6)×0.2 + 6 = 7
    const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    const result = ema(prices, 9)
    expect(result[8]).toBeCloseTo(5, 10)
    expect(result[9]).toBeCloseTo(6, 10)
    expect(result[10]).toBeCloseTo(7, 10)
  })

  it('EMA period 21 — arithmetic sequence converges correctly', () => {
    // For prices [1..22], multiplier = 2/(21+1) = 1/11
    // seed EMA[20] = (1+…+21)/21 = 231/21 = 11
    // EMA[21] = (22−11)/11 + 11 = 12
    const prices = Array.from({ length: 22 }, (_, i) => i + 1)
    const result = ema(prices, 21)
    result.slice(0, 20).forEach((v) => expect(isNaN(v)).toBe(true))
    expect(result[20]).toBeCloseTo(11, 10)
    expect(result[21]).toBeCloseTo(12, 10)
  })

  it('EMA period 3 — small example with manual verification', () => {
    // prices = [10, 11, 12, 13], period = 3, multiplier = 0.5
    // EMA[2] = (10+11+12)/3 = 11
    // EMA[3] = (13−11)×0.5 + 11 = 12
    const result = ema([10, 11, 12, 13], 3)
    expect(result[2]).toBeCloseTo(11, 10)
    expect(result[3]).toBeCloseTo(12, 10)
  })
})
