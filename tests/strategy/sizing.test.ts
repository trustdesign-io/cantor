import { describe, it, expect } from 'vitest'
import { sizeForSignal, MIN_MULTIPLIER, MAX_MULTIPLIER } from '@/strategy/sizing'

describe('sizeForSignal', () => {
  describe('no context — neutral result', () => {
    it('returns 1.0 when no context is provided', () => {
      expect(sizeForSignal('BUY', {})).toBe(1.0)
      expect(sizeForSignal('SELL', {})).toBe(1.0)
    })
  })

  describe('funding rate component — BUY', () => {
    it('sizes up (1.2×) when funding is negative (shorts crowded) on BUY', () => {
      expect(sizeForSignal('BUY', { fundingRate: -0.0002 })).toBe(1.2)
    })

    it('sizes down (0.5×) when funding is strongly positive (longs crowded) on BUY', () => {
      expect(sizeForSignal('BUY', { fundingRate: 0.001 })).toBe(0.5)
    })

    it('returns 1.0 when funding is within neutral band on BUY', () => {
      expect(sizeForSignal('BUY', { fundingRate: 0.0002 })).toBe(1.0)
    })
  })

  describe('funding rate component — SELL', () => {
    it('sizes up (1.2×) when funding is strongly positive (longs crowded) on SELL', () => {
      expect(sizeForSignal('SELL', { fundingRate: 0.001 })).toBe(1.2)
    })

    it('sizes down (0.5×) when funding is negative (shorts crowded) on SELL', () => {
      expect(sizeForSignal('SELL', { fundingRate: -0.0002 })).toBe(0.5)
    })

    it('returns 1.0 when funding is within neutral band on SELL', () => {
      expect(sizeForSignal('SELL', { fundingRate: 0.0002 })).toBe(1.0)
    })
  })

  describe('fear & greed component — BUY', () => {
    it('sizes up (1.1×) when F&G shows extreme fear on BUY (contrarian)', () => {
      // fearGreedIndex < 50 and distance from neutral > 20 → e.g. index = 25
      expect(sizeForSignal('BUY', { fearGreedIndex: 25 })).toBe(1.1)
    })

    it('returns 1.0 when F&G is near neutral on BUY', () => {
      expect(sizeForSignal('BUY', { fearGreedIndex: 50 })).toBe(1.0)
    })

    it('returns 1.0 when F&G shows greed on BUY (not contrarian)', () => {
      expect(sizeForSignal('BUY', { fearGreedIndex: 75 })).toBe(1.0)
    })
  })

  describe('fear & greed component — SELL', () => {
    it('sizes up (1.1×) when F&G shows extreme greed on SELL (contrarian)', () => {
      // fearGreedIndex > 50 and distance from neutral > 20 → e.g. index = 75
      expect(sizeForSignal('SELL', { fearGreedIndex: 75 })).toBe(1.1)
    })

    it('returns 1.0 when F&G is near neutral on SELL', () => {
      expect(sizeForSignal('SELL', { fearGreedIndex: 50 })).toBe(1.0)
    })

    it('returns 1.0 when F&G shows fear on SELL (not contrarian)', () => {
      expect(sizeForSignal('SELL', { fearGreedIndex: 25 })).toBe(1.0)
    })
  })

  describe('composition — multiple signals', () => {
    it('multiplies components together (1.2 × 1.1 = 1.32)', () => {
      // BUY + negative funding (1.2×) + extreme fear (1.1×) = 1.32
      const result = sizeForSignal('BUY', { fundingRate: -0.0002, fearGreedIndex: 25 })
      expect(result).toBeCloseTo(1.32, 10)
    })

    it('composes adverse signals below neutral (0.5 × 1.0 = 0.5)', () => {
      // BUY + strongly positive funding (0.5×) + neutral F&G (1.0×) = 0.5
      expect(sizeForSignal('BUY', { fundingRate: 0.001, fearGreedIndex: 50 })).toBe(0.5)
    })
  })

  describe('clamping', () => {
    it('clamps result at MIN_MULTIPLIER (0.25)', () => {
      // Even adversarial context can't push below 0.25
      // Worst combo: 0.5 × 0.5 = 0.25 (stays at min)
      const result = sizeForSignal('BUY', { fundingRate: 0.001, fearGreedIndex: 75 })
      expect(result).toBeGreaterThanOrEqual(MIN_MULTIPLIER)
    })

    it('clamps result at MAX_MULTIPLIER (2.0)', () => {
      // Best combo: 1.2 × 1.1 = 1.32 — within range
      const result = sizeForSignal('BUY', { fundingRate: -0.0002, fearGreedIndex: 25 })
      expect(result).toBeLessThanOrEqual(MAX_MULTIPLIER)
    })
  })
})
