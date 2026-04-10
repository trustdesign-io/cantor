import { describe, it, expect, vi } from 'vitest'
import { computeSignal, detectSignal, RSI_OVERBOUGHT, RSI_OVERSOLD } from '@/strategy/signals'
import type { FilterFn } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build minimal aligned arrays [prev, curr] for clean crossover tests */
function arrays(
  fastPrev: number,
  fastCurr: number,
  slowPrev: number,
  slowCurr: number,
  rsi: number
) {
  return {
    emaFast: [fastPrev, fastCurr],
    emaSlow: [slowPrev, slowCurr],
    rsiValues: [rsi, rsi], // RSI same on both bars — only latest matters
  }
}

// ── BUY conditions ────────────────────────────────────────────────────────────

describe('computeSignal — BUY', () => {
  it('returns BUY on golden cross with RSI below overbought', () => {
    // EMA 9 crosses from below (99) to above (101) EMA 21 (100); RSI = 50
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, 50)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('BUY')
  })

  it('returns BUY when EMA 9 touches EMA 21 on prev bar then crosses above', () => {
    // fastPrev === slowPrev counts as "not yet above" → qualifies for cross
    const { emaFast, emaSlow, rsiValues } = arrays(100, 101, 100, 100, 50)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('BUY')
  })

  it('returns BUY when RSI is exactly one below overbought threshold', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, RSI_OVERBOUGHT - 1)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('BUY')
  })
})

// ── SELL conditions ───────────────────────────────────────────────────────────

describe('computeSignal — SELL', () => {
  it('returns SELL on death cross with RSI above oversold', () => {
    // EMA 9 crosses from above (101) to below (99) EMA 21 (100); RSI = 50
    const { emaFast, emaSlow, rsiValues } = arrays(101, 99, 100, 100, 50)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('SELL')
  })

  it('returns SELL when EMA 9 touches EMA 21 on prev bar then crosses below', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(100, 99, 100, 100, 50)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('SELL')
  })

  it('returns SELL when RSI is exactly one above oversold threshold', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(101, 99, 100, 100, RSI_OVERSOLD + 1)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('SELL')
  })
})

// ── HOLD conditions ───────────────────────────────────────────────────────────

describe('computeSignal — HOLD', () => {
  it('returns HOLD when EMA 9 is already above EMA 21 (no crossover)', () => {
    // EMA 9 consistently above EMA 21 — trend established, no fresh signal
    const { emaFast, emaSlow, rsiValues } = arrays(105, 106, 100, 100, 50)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('HOLD')
  })

  it('returns HOLD when EMA 9 is consistently below EMA 21 (no crossover)', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(95, 96, 100, 100, 50)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('HOLD')
  })

  it('returns HOLD on golden cross BUT RSI at overbought threshold (not strictly below)', () => {
    // RSI = 70 does not satisfy RSI < 70 → suppress buy signal
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, RSI_OVERBOUGHT)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('HOLD')
  })

  it('returns HOLD on golden cross with RSI above overbought', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, 75)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('HOLD')
  })

  it('returns HOLD on death cross BUT RSI at oversold threshold (not strictly above)', () => {
    // RSI = 30 does not satisfy RSI > 30 → suppress sell signal
    const { emaFast, emaSlow, rsiValues } = arrays(101, 99, 100, 100, RSI_OVERSOLD)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('HOLD')
  })

  it('returns HOLD on death cross with RSI below oversold', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(101, 99, 100, 100, 25)
    expect(computeSignal(emaFast, emaSlow, rsiValues)).toBe('HOLD')
  })

  it('returns HOLD when any indicator value is NaN (insufficient candle history)', () => {
    expect(computeSignal([NaN, 101], [NaN, 100], [NaN, 50])).toBe('HOLD')
    expect(computeSignal([99, 101], [100, NaN], [50, 50])).toBe('HOLD')
    expect(computeSignal([99, 101], [100, 100], [50, NaN])).toBe('HOLD')
  })

  it('returns HOLD when fewer than 2 bars are available', () => {
    expect(computeSignal([101], [100], [50])).toBe('HOLD')
    expect(computeSignal([], [], [])).toBe('HOLD')
  })
})

// ── detectSignal — filter pipeline ────────────────────────────────────────────

describe('detectSignal — empty filter list', () => {
  it('passes base BUY signal through with no filters', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, 50)
    const result = detectSignal(emaFast, emaSlow, rsiValues, [], {}, [])
    expect(result.signal).toBe('BUY')
    expect(result.baseSignal).toBe('BUY')
    expect(result.vetoedBy).toBeUndefined()
    expect(result.reason).toBeUndefined()
  })

  it('passes base SELL signal through with no filters', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(101, 99, 100, 100, 50)
    const result = detectSignal(emaFast, emaSlow, rsiValues, [], {}, [])
    expect(result.signal).toBe('SELL')
    expect(result.baseSignal).toBe('SELL')
  })

  it('passes HOLD through without calling filters', () => {
    const filter = vi.fn((): ReturnType<FilterFn> => ({ ok: false, reason: 'should not run' }))
    // EMA already above (no crossover) → HOLD base signal
    const { emaFast, emaSlow, rsiValues } = arrays(105, 106, 100, 100, 50)
    const result = detectSignal(emaFast, emaSlow, rsiValues, [], {}, [filter])
    expect(result.signal).toBe('HOLD')
    expect(result.baseSignal).toBe('HOLD')
    expect(filter).not.toHaveBeenCalled()
  })
})

describe('detectSignal — first filter vetoes', () => {
  it('downgrades BUY to HOLD with reason when first filter returns ok: false', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, 50)
    function isFundingExtreme(): ReturnType<FilterFn> {
      return { ok: false, reason: 'Funding extreme (+0.15% / 8h)' }
    }
    const result = detectSignal(emaFast, emaSlow, rsiValues, [], {}, [isFundingExtreme])
    expect(result.signal).toBe('HOLD')
    expect(result.baseSignal).toBe('BUY')
    expect(result.vetoedBy).toBe('isFundingExtreme')
    expect(result.reason).toBe('Funding extreme (+0.15% / 8h)')
  })
})

describe('detectSignal — second filter vetoes when first passes', () => {
  it('runs all filters in order and stops on the first veto', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, 50)
    function passFilter(): ReturnType<FilterFn> { return { ok: true } }
    function isFearGreedExtreme(): ReturnType<FilterFn> {
      return { ok: false, reason: 'Extreme fear (index=15)' }
    }
    const third = vi.fn((): ReturnType<FilterFn> => ({ ok: false, reason: 'should not run' }))
    const result = detectSignal(emaFast, emaSlow, rsiValues, [], {}, [passFilter, isFearGreedExtreme, third])
    expect(result.signal).toBe('HOLD')
    expect(result.baseSignal).toBe('BUY')
    expect(result.vetoedBy).toBe('isFearGreedExtreme')
    expect(result.reason).toBe('Extreme fear (index=15)')
    expect(third).not.toHaveBeenCalled()
  })

  it('passes signal through when all filters return ok: true', () => {
    const { emaFast, emaSlow, rsiValues } = arrays(99, 101, 100, 100, 50)
    const pass1: FilterFn = () => ({ ok: true })
    const pass2: FilterFn = () => ({ ok: true })
    const result = detectSignal(emaFast, emaSlow, rsiValues, [], {}, [pass1, pass2])
    expect(result.signal).toBe('BUY')
    expect(result.baseSignal).toBe('BUY')
    expect(result.vetoedBy).toBeUndefined()
  })
})
