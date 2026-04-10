import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectEvents } from '@/lib/detectEvents'
import type { DashboardSnapshot } from '@/types/commentary'
import { FUNDING_LONG_VETO_THRESHOLD, FUNDING_SHORT_VETO_THRESHOLD } from '@/strategy/filters/funding'
import { RSI_OVERBOUGHT, RSI_OVERSOLD } from '@/strategy/signals'

// ── Base snapshot helpers ─────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    signal: 'HOLD',
    baseSignal: 'HOLD',
    vetoedBy: undefined,
    vetoReason: undefined,
    emaFast: 50_000,
    emaSlow: 49_000,
    rsi: 50,
    candleClose: 50_000,
    position: null,
    fundingRate: 0.0005,
    fearGreedIndex: 50,
    ...overrides,
  }
}

describe('detectEvents', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── No-op ───────────────────────────────────────────────────────────────

  it('returns [] when nothing narratable changed', () => {
    const snap = makeSnapshot()
    expect(detectEvents(snap, snap)).toEqual([])
  })

  it('returns [] when only candleClose changes', () => {
    const prev = makeSnapshot({ candleClose: 50_000 })
    const next = makeSnapshot({ candleClose: 50_100 })
    expect(detectEvents(prev, next)).toEqual([])
  })

  // ── signal-change ────────────────────────────────────────────────────────

  it('fires signal-change when BUY signal appears', () => {
    const prev = makeSnapshot({ signal: 'HOLD' })
    const next = makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'signal-change')
    expect(match).toBeDefined()
    expect(match?.kind === 'signal-change' && match.signal).toBe('BUY')
  })

  it('fires signal-change when SELL signal appears', () => {
    const prev = makeSnapshot({ signal: 'HOLD' })
    const next = makeSnapshot({ signal: 'SELL', baseSignal: 'SELL' })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'signal-change')
    expect(match).toBeDefined()
  })

  it('does not fire signal-change when signal stays HOLD', () => {
    const prev = makeSnapshot({ signal: 'HOLD' })
    const next = makeSnapshot({ signal: 'HOLD' })
    expect(detectEvents(prev, next).some(e => e.kind === 'signal-change')).toBe(false)
  })

  it('does not fire signal-change when signal stays BUY', () => {
    const prev = makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' })
    const next = makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' })
    expect(detectEvents(prev, next).some(e => e.kind === 'signal-change')).toBe(false)
  })

  // ── filter-veto ──────────────────────────────────────────────────────────

  it('fires filter-veto when a new veto occurs', () => {
    const prev = makeSnapshot({ vetoedBy: undefined, vetoReason: undefined, baseSignal: 'HOLD' })
    const next = makeSnapshot({
      signal: 'HOLD',
      baseSignal: 'BUY',
      vetoedBy: 'isFundingExtreme',
      vetoReason: 'Funding extreme (+0.0150% / 8h, longs crowded)',
    })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'filter-veto')
    expect(match).toBeDefined()
    expect(match?.kind === 'filter-veto' && match.vetoedBy).toBe('isFundingExtreme')
  })

  it('does not fire filter-veto when veto reason is unchanged', () => {
    const shared = {
      signal: 'HOLD' as const,
      baseSignal: 'BUY' as const,
      vetoedBy: 'isFundingExtreme',
      vetoReason: 'same reason',
    }
    const prev = makeSnapshot(shared)
    const next = makeSnapshot(shared)
    expect(detectEvents(prev, next).some(e => e.kind === 'filter-veto')).toBe(false)
  })

  // ── ema-cross ────────────────────────────────────────────────────────────

  it('fires ema-cross golden when fast crosses above slow', () => {
    const prev = makeSnapshot({ emaFast: 48_000, emaSlow: 49_000 })
    const next = makeSnapshot({ emaFast: 50_000, emaSlow: 49_000 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'ema-cross')
    expect(match?.kind === 'ema-cross' && match.crossType).toBe('golden')
  })

  it('fires ema-cross death when fast crosses below slow', () => {
    const prev = makeSnapshot({ emaFast: 50_000, emaSlow: 49_000 })
    const next = makeSnapshot({ emaFast: 48_000, emaSlow: 49_000 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'ema-cross')
    expect(match?.kind === 'ema-cross' && match.crossType).toBe('death')
  })

  it('does not fire ema-cross when fast stays above slow', () => {
    const prev = makeSnapshot({ emaFast: 51_000, emaSlow: 49_000 })
    const next = makeSnapshot({ emaFast: 52_000, emaSlow: 49_000 })
    expect(detectEvents(prev, next).some(e => e.kind === 'ema-cross')).toBe(false)
  })

  it('does not fire ema-cross when indicators are NaN', () => {
    const prev = makeSnapshot({ emaFast: NaN, emaSlow: NaN, rsi: NaN })
    const next = makeSnapshot({ emaFast: NaN, emaSlow: NaN, rsi: NaN })
    expect(detectEvents(prev, next).some(e => e.kind === 'ema-cross')).toBe(false)
  })

  // ── rsi-zone-enter ───────────────────────────────────────────────────────

  it('fires rsi-zone-enter overbought when RSI crosses above 70', () => {
    const prev = makeSnapshot({ rsi: RSI_OVERBOUGHT - 1 })
    const next = makeSnapshot({ rsi: RSI_OVERBOUGHT })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'rsi-zone-enter')
    expect(match?.kind === 'rsi-zone-enter' && match.zone).toBe('overbought')
  })

  it('fires rsi-zone-enter oversold when RSI crosses below 30', () => {
    const prev = makeSnapshot({ rsi: RSI_OVERSOLD + 1 })
    const next = makeSnapshot({ rsi: RSI_OVERSOLD })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'rsi-zone-enter')
    expect(match?.kind === 'rsi-zone-enter' && match.zone).toBe('oversold')
  })

  // ── rsi-zone-exit ────────────────────────────────────────────────────────

  it('fires rsi-zone-exit overbought when RSI drops below 70', () => {
    const prev = makeSnapshot({ rsi: RSI_OVERBOUGHT })
    const next = makeSnapshot({ rsi: RSI_OVERBOUGHT - 1 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'rsi-zone-exit')
    expect(match?.kind === 'rsi-zone-exit' && match.zone).toBe('overbought')
  })

  it('fires rsi-zone-exit oversold when RSI rises above 30', () => {
    const prev = makeSnapshot({ rsi: RSI_OVERSOLD })
    const next = makeSnapshot({ rsi: RSI_OVERSOLD + 1 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'rsi-zone-exit')
    expect(match?.kind === 'rsi-zone-exit' && match.zone).toBe('oversold')
  })

  // ── position-open / position-close ───────────────────────────────────────

  it('fires position-open when position goes from null to active', () => {
    const prev = makeSnapshot({ position: null })
    const next = makeSnapshot({
      position: {
        pair: 'XBT/USDT',
        entryPrice: 50_000,
        entryTime: Date.now(),
        size: 0.01,
        unrealisedPnl: 0,
        sizeMultiplier: 1,
      },
    })
    const events = detectEvents(prev, next)
    expect(events.some(e => e.kind === 'position-open')).toBe(true)
  })

  it('fires position-close when position goes from active to null', () => {
    const prev = makeSnapshot({
      position: {
        pair: 'XBT/USDT',
        entryPrice: 48_000,
        entryTime: Date.now() - 3600_000,
        size: 0.01,
        unrealisedPnl: 20,
        sizeMultiplier: 1,
      },
    })
    const next = makeSnapshot({ position: null })
    const events = detectEvents(prev, next)
    expect(events.some(e => e.kind === 'position-close')).toBe(true)
  })

  it('does not fire position events when position stays null', () => {
    const prev = makeSnapshot({ position: null })
    const next = makeSnapshot({ position: null })
    const events = detectEvents(prev, next)
    expect(events.some(e => e.kind === 'position-open' || e.kind === 'position-close')).toBe(false)
  })

  it('reports negative pnlPercent for a short position that closed at a loss (price rose)', () => {
    const entryPrice = 50_000
    // Short entered at 50000, price rose to 51000 — a loss for the short
    const prev = makeSnapshot({
      position: {
        pair: 'XBT/USDT',
        entryPrice,
        entryTime: Date.now() - 3600_000,
        size: -0.01, // negative = short
        unrealisedPnl: -10,
        sizeMultiplier: 1,
      },
      candleClose: 51_000,
    })
    const next = makeSnapshot({ position: null, candleClose: 51_000 })
    const events = detectEvents(prev, next)
    const closeEvent = events.find(e => e.kind === 'position-close')
    expect(closeEvent?.kind === 'position-close' && closeEvent.pnlPercent).toBeLessThan(0)
  })

  it('can return multiple events from a single snapshot transition', () => {
    // Golden cross AND RSI entering overbought simultaneously
    const prev = makeSnapshot({
      emaFast: 48_000,
      emaSlow: 49_000,
      rsi: RSI_OVERBOUGHT - 1,
    })
    const next = makeSnapshot({
      emaFast: 50_000,
      emaSlow: 49_000,
      rsi: RSI_OVERBOUGHT,
    })
    const events = detectEvents(prev, next)
    expect(events.some(e => e.kind === 'ema-cross')).toBe(true)
    expect(events.some(e => e.kind === 'rsi-zone-enter')).toBe(true)
    expect(events.length).toBeGreaterThanOrEqual(2)
  })

  // ── funding-threshold-cross ───────────────────────────────────────────────

  it('fires funding-threshold-cross into-extreme when rate crosses long threshold', () => {
    const prev = makeSnapshot({ fundingRate: FUNDING_LONG_VETO_THRESHOLD - 0.0001 })
    const next = makeSnapshot({ fundingRate: FUNDING_LONG_VETO_THRESHOLD + 0.0001 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'funding-threshold-cross')
    expect(match?.kind === 'funding-threshold-cross' && match.direction).toBe('into-extreme')
    expect(match?.kind === 'funding-threshold-cross' && match.crowded).toBe('longs')
  })

  it('fires funding-threshold-cross out-of-extreme when rate falls below long threshold', () => {
    const prev = makeSnapshot({ fundingRate: FUNDING_LONG_VETO_THRESHOLD + 0.0001 })
    const next = makeSnapshot({ fundingRate: FUNDING_LONG_VETO_THRESHOLD - 0.0001 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'funding-threshold-cross')
    expect(match?.kind === 'funding-threshold-cross' && match.direction).toBe('out-of-extreme')
  })

  it('fires funding-threshold-cross into-extreme for shorts', () => {
    const prev = makeSnapshot({ fundingRate: FUNDING_SHORT_VETO_THRESHOLD + 0.0001 })
    const next = makeSnapshot({ fundingRate: FUNDING_SHORT_VETO_THRESHOLD - 0.0001 })
    const events = detectEvents(prev, next)
    const match = events.find(e => e.kind === 'funding-threshold-cross')
    expect(match?.kind === 'funding-threshold-cross' && match.crowded).toBe('shorts')
  })

  it('does not fire funding-threshold-cross when both rates are null', () => {
    const prev = makeSnapshot({ fundingRate: null })
    const next = makeSnapshot({ fundingRate: null })
    expect(detectEvents(prev, next).some(e => e.kind === 'funding-threshold-cross')).toBe(false)
  })
})
