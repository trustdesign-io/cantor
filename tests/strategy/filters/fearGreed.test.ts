import { describe, it, expect } from 'vitest'
import {
  isFearGreedExtreme,
  FEAR_GREED_LONG_VETO,
  FEAR_GREED_SHORT_VETO,
} from '@/strategy/filters/fearGreed'
import type { FilterContext } from '@/types'

function ctx(fearGreedIndex?: number): FilterContext {
  return fearGreedIndex !== undefined ? { fearGreedIndex } : {}
}

describe('isFearGreedExtreme', () => {
  // ── Pass-through cases ─────────────────────────────────────────────────────

  it('passes when fearGreedIndex is undefined (data not yet loaded)', () => {
    expect(isFearGreedExtreme([], ctx())).toEqual({ ok: true })
  })

  it('passes in the neutral range (50)', () => {
    expect(isFearGreedExtreme([], ctx(50))).toEqual({ ok: true })
  })

  it('passes just below the long-veto threshold', () => {
    expect(isFearGreedExtreme([], ctx(FEAR_GREED_LONG_VETO))).toEqual({ ok: true })
    expect(isFearGreedExtreme([], ctx(FEAR_GREED_LONG_VETO - 1))).toEqual({ ok: true })
  })

  it('passes just above the short-veto threshold', () => {
    expect(isFearGreedExtreme([], ctx(FEAR_GREED_SHORT_VETO))).toEqual({ ok: true })
    expect(isFearGreedExtreme([], ctx(FEAR_GREED_SHORT_VETO + 1))).toEqual({ ok: true })
  })

  // ── Long veto (extreme greed) ──────────────────────────────────────────────

  it('vetoes longs when index is above the long-veto threshold', () => {
    const result = isFearGreedExtreme([], ctx(90))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/Extreme greed/)
      expect(result.reason).toMatch(/90/)
      expect(result.reason).toMatch(/longs at risk/)
    }
  })

  it('vetoes at exactly one tick above the long threshold', () => {
    const result = isFearGreedExtreme([], ctx(FEAR_GREED_LONG_VETO + 1))
    expect(result.ok).toBe(false)
  })

  it('vetoes at the extreme greed boundary (100)', () => {
    expect(isFearGreedExtreme([], ctx(100)).ok).toBe(false)
  })

  // ── Short veto (extreme fear) ──────────────────────────────────────────────

  it('vetoes shorts when index is below the short-veto threshold', () => {
    const result = isFearGreedExtreme([], ctx(10))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/Extreme fear/)
      expect(result.reason).toMatch(/10/)
      expect(result.reason).toMatch(/shorts at risk/)
    }
  })

  it('vetoes at exactly one tick below the short threshold', () => {
    const result = isFearGreedExtreme([], ctx(FEAR_GREED_SHORT_VETO - 1))
    expect(result.ok).toBe(false)
  })

  it('vetoes at the extreme fear boundary (0)', () => {
    expect(isFearGreedExtreme([], ctx(0)).ok).toBe(false)
  })
})
