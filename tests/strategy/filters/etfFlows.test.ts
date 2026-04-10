import { describe, it, expect } from 'vitest'
import { hasNegativeStreak, isEtfFlowNegativeStreak, NEGATIVE_STREAK_THRESHOLD } from '@/strategy/filters/etfFlows'
import type { EtfFlowEntry } from '@/data/etfFlows'

function makeFlow(date: string, netFlowUsd: number): EtfFlowEntry {
  return { date, netFlowUsd, byFund: {} }
}

// ── hasNegativeStreak ─────────────────────────────────────────────────────────

describe('hasNegativeStreak', () => {
  it('returns false when flows array is empty', () => {
    expect(hasNegativeStreak([])).toBe(false)
  })

  it('returns false when fewer entries than threshold', () => {
    const flows = [makeFlow('2026-01-01', -100), makeFlow('2026-01-02', -200)]
    expect(hasNegativeStreak(flows, 3)).toBe(false)
  })

  it('returns true when the last N entries are all negative', () => {
    const flows = [
      makeFlow('2026-01-01', 500),  // positive — outside the tail
      makeFlow('2026-01-02', -100),
      makeFlow('2026-01-03', -200),
      makeFlow('2026-01-04', -50),
    ]
    expect(hasNegativeStreak(flows, 3)).toBe(true)
  })

  it('returns false when one of the last N is positive', () => {
    const flows = [
      makeFlow('2026-01-01', -100),
      makeFlow('2026-01-02', 50),   // positive — breaks streak
      makeFlow('2026-01-03', -200),
    ]
    expect(hasNegativeStreak(flows, 3)).toBe(false)
  })

  it('returns false when one of the last N is exactly zero', () => {
    const flows = [
      makeFlow('2026-01-01', -100),
      makeFlow('2026-01-02', 0),    // zero — not negative
      makeFlow('2026-01-03', -200),
    ]
    expect(hasNegativeStreak(flows, 3)).toBe(false)
  })

  it('returns true for exactly N negative entries (boundary)', () => {
    const flows = Array.from({ length: NEGATIVE_STREAK_THRESHOLD }, (_, i) =>
      makeFlow(`2026-01-0${i + 1}`, -(i + 1) * 100)
    )
    expect(hasNegativeStreak(flows)).toBe(true)
  })

  it('evaluates only the tail regardless of history length', () => {
    // Long history with positives early, negatives at the tail
    const flows = [
      ...Array.from({ length: 10 }, (_, i) => makeFlow(`2025-12-${(i + 1).toString().padStart(2, '0')}`, 300)),
      makeFlow('2026-01-01', -100),
      makeFlow('2026-01-02', -200),
      makeFlow('2026-01-03', -50),
    ]
    expect(hasNegativeStreak(flows, 3)).toBe(true)
  })
})

// ── isEtfFlowNegativeStreak FilterFn ─────────────────────────────────────────

describe('isEtfFlowNegativeStreak', () => {
  const CANDLES = [] as const

  it('passes when etfFlows is absent from context', () => {
    expect(isEtfFlowNegativeStreak(CANDLES, {})).toEqual({ ok: true })
  })

  it('passes when etfFlows is an empty array', () => {
    expect(isEtfFlowNegativeStreak(CANDLES, { etfFlows: [] })).toEqual({ ok: true })
  })

  it('vetoes when a negative streak is detected', () => {
    const etfFlows = [
      makeFlow('2026-01-01', -100),
      makeFlow('2026-01-02', -200),
      makeFlow('2026-01-03', -50),
    ]
    const result = isEtfFlowNegativeStreak(CANDLES, { etfFlows })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('ETF flow streak')
    }
  })

  it('passes when no streak is present', () => {
    const etfFlows = [
      makeFlow('2026-01-01', 100),
      makeFlow('2026-01-02', -200),
      makeFlow('2026-01-03', -50),
    ]
    expect(isEtfFlowNegativeStreak(CANDLES, { etfFlows })).toEqual({ ok: true })
  })
})
