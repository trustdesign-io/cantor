import { describe, it, expect } from 'vitest'
import { isMacroBlackoutAt } from '@/strategy/filters/macro'
import { MACRO_WINDOWS } from '@/data/macroCalendar'

// Pick the first event in the calendar as the test anchor
const FIRST = MACRO_WINDOWS[0]
const ANNOUNCEMENT = FIRST.announcementMs

// ── Absolute UTC correctness ───────────────────────────────────────────────────
// These tests verify the timezone conversion is machine-independent.
// CPI 2026-04-14 08:30 ET (EDT = UTC−4) → 12:30 UTC

describe('MACRO_WINDOWS — absolute UTC timestamps', () => {
  it('CPI 2026-04-14 08:30 ET resolves to 12:30:00 UTC', () => {
    const cpi = MACRO_WINDOWS.find(w => w.event === 'CPI')
    expect(cpi).toBeDefined()
    expect(cpi!.announcementMs).toBe(new Date('2026-04-14T12:30:00Z').getTime())
  })

  it('FOMC 2026-05-07 14:00 ET resolves to 18:00:00 UTC', () => {
    const fomc = MACRO_WINDOWS.find(w => w.event === 'FOMC')
    expect(fomc).toBeDefined()
    expect(fomc!.announcementMs).toBe(new Date('2026-05-07T18:00:00Z').getTime())
  })
})

describe('isMacroBlackoutAt — inside window', () => {
  it('vetoes at the exact announcement time', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('Macro blackout')
      expect(result.reason).toContain(FIRST.event)
    }
  })

  it('vetoes 1 minute before announcement', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT - 60_000)
    expect(result.ok).toBe(false)
  })

  it('vetoes 1 minute after announcement', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT + 60_000)
    expect(result.ok).toBe(false)
  })

  it('vetoes at the window start boundary (1 hour before)', () => {
    const result = isMacroBlackoutAt(FIRST.windowStartMs)
    expect(result.ok).toBe(false)
  })

  it('vetoes at the window end boundary (1 hour after)', () => {
    const result = isMacroBlackoutAt(FIRST.windowEndMs)
    expect(result.ok).toBe(false)
  })

  it('reason includes "in N minutes" when before announcement', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT - 30 * 60_000)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('in 30 minutes')
    }
  })

  it('reason includes "N minutes ago" when after announcement', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT + 45 * 60_000)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('45 minutes ago')
    }
  })

  it('reason says "now" at the exact announcement time', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('now')
    }
  })
})

describe('isMacroBlackoutAt — outside window', () => {
  it('passes 1 ms before the window start', () => {
    const result = isMacroBlackoutAt(FIRST.windowStartMs - 1)
    expect(result.ok).toBe(true)
  })

  it('passes 1 ms after the window end', () => {
    const result = isMacroBlackoutAt(FIRST.windowEndMs + 1)
    expect(result.ok).toBe(true)
  })

  it('passes for a time well outside any event (year 2000)', () => {
    const result = isMacroBlackoutAt(new Date('2000-01-01T00:00:00Z').getTime())
    expect(result.ok).toBe(true)
  })
})

describe('isMacroBlackoutAt — singular/plural minute phrasing', () => {
  it('uses singular "minute" when 1 minute before', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT - 60_000)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('in 1 minute')
      expect(result.reason).not.toContain('minutes')
    }
  })

  it('uses singular "minute" when 1 minute after', () => {
    const result = isMacroBlackoutAt(ANNOUNCEMENT + 60_000)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toContain('1 minute ago')
      expect(result.reason).not.toContain('minutes ago')
    }
  })
})
