import { renderHook } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useLiveStrategy } from '@/hooks/useLiveStrategy'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { Candle, Pair } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandlesFromCloses(closes: number[], baseTime = 1_700_000_000): Candle[] {
  return closes.map((c, i) => ({
    time: baseTime + i * 60,
    open: c,
    high: c,
    low: c,
    close: c,
    volume: 1,
  }))
}

/**
 * 22-bar zigzag sequence that produces a verified golden cross at bar 21.
 * Manual calculation:
 *   EMA9[20] ≈ 101.0 < EMA21[20] ≈ 101.9  (EMA9 was below)
 *   EMA9[21] ≈ 105.8 > EMA21[21] ≈ 104.0  (EMA9 crosses above)
 *   RSI[21]  ≈ 54    < 70                   (not overbought)
 *   → computeSignal returns 'BUY'
 */
const BUY_CLOSES = [
  100, 102, 99, 103, 98, 105, 97, 108, 96, 110,
  94,  112, 92, 115, 90, 118, 88, 120, 86, 122,
  84,  125,
]
const BUY_CANDLES = makeCandlesFromCloses(BUY_CLOSES)
const PAIR: Pair = 'XBT/USDT'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useLiveStrategy', () => {
  it('starts with HOLD signal, full balance, no position, empty trades', () => {
    const { result } = renderHook(() => useLiveStrategy(PAIR, []))
    expect(result.current.signal).toBe('HOLD')
    expect(result.current.balance).toBe(INITIAL_BALANCE)
    expect(result.current.position).toBeNull()
    expect(result.current.trades).toHaveLength(0)
  })

  it('stays HOLD when fewer than 22 candles are provided (insufficient indicator history)', () => {
    const shortCandles = makeCandlesFromCloses([100, 102, 99, 103, 98])
    const { result } = renderHook(() => useLiveStrategy(PAIR, shortCandles))
    expect(result.current.signal).toBe('HOLD')
    expect(result.current.balance).toBe(INITIAL_BALANCE)
  })

  it('emits BUY signal on golden cross and feeds paper trader (balance → 0, position opens)', () => {
    const { result } = renderHook(() => useLiveStrategy(PAIR, BUY_CANDLES))
    expect(result.current.signal).toBe('BUY')
    expect(result.current.balance).toBe(0)
    expect(result.current.position).not.toBeNull()
    // Entry price = last close = 125
    expect(result.current.position!.entryPrice).toBe(125)
    // size = INITIAL_BALANCE / 125 = 80
    expect(result.current.position!.size).toBeCloseTo(80, 10)
    expect(result.current.trades).toHaveLength(0) // no closed trades yet
  })

  it('resets all state cleanly when pair changes', () => {
    const { result, rerender } = renderHook(
      ({ pair, candles }: { pair: Pair; candles: Candle[] }) =>
        useLiveStrategy(pair, candles),
      { initialProps: { pair: PAIR, candles: BUY_CANDLES } }
    )
    expect(result.current.signal).toBe('BUY')
    expect(result.current.balance).toBe(0)

    // Switch to ETH/USDT with no candles yet → state must reset
    rerender({ pair: 'ETH/USDT', candles: [] })
    expect(result.current.signal).toBe('HOLD')
    expect(result.current.balance).toBe(INITIAL_BALANCE)
    expect(result.current.position).toBeNull()
    expect(result.current.trades).toHaveLength(0)
  })

  it('updates signal when candles are updated with enough history', () => {
    const { result, rerender } = renderHook(
      ({ candles }: { candles: Candle[] }) => useLiveStrategy(PAIR, candles),
      { initialProps: { candles: makeCandlesFromCloses([100, 102]) } }
    )
    expect(result.current.signal).toBe('HOLD') // insufficient data

    rerender({ candles: BUY_CANDLES })
    expect(result.current.signal).toBe('BUY') // now has crossover
    expect(result.current.balance).toBe(0)
  })
})
