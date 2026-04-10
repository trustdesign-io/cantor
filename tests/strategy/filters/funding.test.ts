import { describe, it, expect } from 'vitest'
import {
  isFundingExtreme,
  FUNDING_LONG_VETO_THRESHOLD,
  FUNDING_SHORT_VETO_THRESHOLD,
} from '@/strategy/filters/funding'
import type { FilterContext } from '@/types'

function ctx(fundingRate?: number): FilterContext {
  return fundingRate !== undefined ? { fundingRate } : {}
}

describe('isFundingExtreme', () => {
  // ── Pass-through cases ─────────────────────────────────────────────────────

  it('passes when fundingRate is undefined (data not yet loaded)', () => {
    expect(isFundingExtreme([], ctx())).toEqual({ ok: true })
  })

  it('passes when funding is near-zero (neutral market)', () => {
    expect(isFundingExtreme([], ctx(0))).toEqual({ ok: true })
    expect(isFundingExtreme([], ctx(0.00005))).toEqual({ ok: true })
  })

  it('passes when funding is just below the long-veto threshold', () => {
    // Exactly at threshold is NOT over — should pass
    expect(isFundingExtreme([], ctx(FUNDING_LONG_VETO_THRESHOLD))).toEqual({ ok: true })
    expect(isFundingExtreme([], ctx(FUNDING_LONG_VETO_THRESHOLD - 0.00001))).toEqual({ ok: true })
  })

  it('passes when funding is just above the short-veto threshold', () => {
    expect(isFundingExtreme([], ctx(FUNDING_SHORT_VETO_THRESHOLD))).toEqual({ ok: true })
    expect(isFundingExtreme([], ctx(FUNDING_SHORT_VETO_THRESHOLD + 0.00001))).toEqual({ ok: true })
  })

  // ── Long veto ──────────────────────────────────────────────────────────────

  it('vetoes longs when funding exceeds the long threshold', () => {
    const result = isFundingExtreme([], ctx(0.0018))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/Funding extreme/)
      expect(result.reason).toMatch(/longs crowded/)
      expect(result.reason).toMatch(/\+/)
    }
  })

  it('vetoes at exactly one tick above the long threshold', () => {
    const result = isFundingExtreme([], ctx(FUNDING_LONG_VETO_THRESHOLD + 0.0000001))
    expect(result.ok).toBe(false)
  })

  // ── Short veto ─────────────────────────────────────────────────────────────

  it('vetoes shorts when funding is below the short threshold', () => {
    const result = isFundingExtreme([], ctx(-0.002))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toMatch(/Funding extreme/)
      expect(result.reason).toMatch(/shorts crowded/)
    }
  })

  it('vetoes at exactly one tick below the short threshold', () => {
    const result = isFundingExtreme([], ctx(FUNDING_SHORT_VETO_THRESHOLD - 0.0000001))
    expect(result.ok).toBe(false)
  })
})
