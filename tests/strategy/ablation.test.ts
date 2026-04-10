import { describe, it, expect } from 'vitest'
import { runFilterAblation } from '@/strategy/ablation'
import type { FilterFn, Candle } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal candle array long enough for the EMA/RSI indicators to seed.
 * Generates an alternating rise/fall pattern to produce at least a few crossover signals.
 */
function makeCandles(count: number): Candle[] {
  const candles: Candle[] = []
  let close = 50_000
  for (let i = 0; i < count; i++) {
    const dir = i % 40 < 20 ? 1 : -1
    close = close + dir * 500
    candles.push({ time: 1_700_000_000 + i * 3600, open: close - 100, high: close + 200, low: close - 200, close, volume: 10 })
  }
  return candles
}

const PASS_FILTER: FilterFn = function passFilter() { return { ok: true } }
const VETO_FILTER: FilterFn = function vetoFilter() { return { ok: false, reason: 'test veto' } }

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runFilterAblation', () => {
  it('returns one entry per filter', () => {
    const candles = makeCandles(100)
    const { entries } = runFilterAblation(candles, 'XBT/USDT', 10_000, [PASS_FILTER, VETO_FILTER])
    expect(entries).toHaveLength(2)
  })

  it('uses the filter function name for filterName', () => {
    const candles = makeCandles(100)
    const { entries } = runFilterAblation(candles, 'XBT/USDT', 10_000, [PASS_FILTER, VETO_FILTER])
    expect(entries[0].filterName).toBe('passFilter')
    expect(entries[1].filterName).toBe('vetoFilter')
  })

  it('returns empty entries array when no filters are provided', () => {
    const candles = makeCandles(100)
    const { entries } = runFilterAblation(candles, 'XBT/USDT', 10_000, [])
    expect(entries).toHaveLength(0)
  })

  it('exposes baselineTradeCount from the baseline run', () => {
    const candles = makeCandles(150)
    // With VETO_FILTER, baseline suppresses all trades → count should be 0
    const { baselineTradeCount } = runFilterAblation(candles, 'XBT/USDT', 10_000, [VETO_FILTER])
    expect(baselineTradeCount).toBe(0)
  })

  it('reports allTradesRemoved=true when baseline has zero trades', () => {
    const candles = makeCandles(100)
    const { entries } = runFilterAblation(candles, 'XBT/USDT', 10_000, [VETO_FILTER, VETO_FILTER])
    for (const entry of entries) {
      expect(entry.allTradesRemoved).toBe(true)
    }
  })

  it('deltaTrades reflects additional trades that occur when filter is removed', () => {
    const candles = makeCandles(150)
    const { entries } = runFilterAblation(candles, 'XBT/USDT', 10_000, [PASS_FILTER, VETO_FILTER])

    // Removing vetoFilter reveals additional trades (deltaTrades >= 0)
    const vetoEntry = entries.find(e => e.filterName === 'vetoFilter')!
    expect(vetoEntry.deltaTrades).toBeGreaterThanOrEqual(0)

    // Removing passFilter (which never vetoes) leaves trade count unchanged
    const passEntry = entries.find(e => e.filterName === 'passFilter')!
    expect(passEntry.deltaTrades).toBe(0)
  })

  it('is deterministic — same candles produce the same result on two calls', () => {
    const candles = makeCandles(150)
    const filters: readonly FilterFn[] = [PASS_FILTER, VETO_FILTER]
    const r1 = runFilterAblation(candles, 'XBT/USDT', 10_000, filters)
    const r2 = runFilterAblation(candles, 'XBT/USDT', 10_000, filters)
    expect(r1).toEqual(r2)
  })

  it('does not mutate the candles array', () => {
    const candles = makeCandles(50)
    const copy = candles.map(c => ({ ...c }))
    runFilterAblation(candles, 'XBT/USDT', 10_000, [PASS_FILTER])
    expect(candles).toEqual(copy)
  })
})
