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

/**
 * 22-bar ascending zigzag that produces a verified death cross at bar 21.
 * Mirror of BUY_CLOSES: prices generally climb bars 0-20, then drop sharply
 * at bar 21 so EMA9 (faster) falls below EMA21 (slower).
 *   EMA9[20]  > EMA21[20]  (EMA9 was above during the uptrend)
 *   EMA9[21]  < EMA21[21]  (EMA9 reacts first to the sharp drop)
 *   RSI[21]   > 30         (not oversold — death cross is confirmed)
 *   → computeSignal returns 'SELL'
 */
const SELL_CLOSES = [
  125, 123, 126, 122, 127, 120, 128, 117, 129, 115,
  131, 113, 133, 110, 135, 107, 137, 105, 139, 103,
  141, 100,
]
const SELL_CANDLES = makeCandlesFromCloses(SELL_CLOSES)

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
    rerender({ pair: 'ETH/USDT' as unknown as typeof PAIR, candles: [] })
    expect(result.current.signal).toBe('HOLD')
    expect(result.current.balance).toBe(INITIAL_BALANCE)
    expect(result.current.position).toBeNull()
    expect(result.current.trades).toHaveLength(0)
  })

  it('emits SELL signal on death cross and closes the open position', () => {
    // First, open a position via BUY sequence
    const { result, rerender } = renderHook(
      ({ candles }: { candles: Candle[] }) => useLiveStrategy(PAIR, candles),
      { initialProps: { candles: BUY_CANDLES } }
    )
    expect(result.current.signal).toBe('BUY')
    expect(result.current.position).not.toBeNull()

    // Now switch to a death-cross sequence — should close the position via SELL
    rerender({ candles: SELL_CANDLES })
    expect(result.current.signal).toBe('SELL')
    // Position closed, balance restored to exit value
    expect(result.current.position).toBeNull()
    expect(result.current.trades).toHaveLength(1)
    expect(result.current.balance).toBeGreaterThan(0)
  })

  it('resets signal to HOLD when candle count drops below minimum (stale signal prevention)', () => {
    const { result, rerender } = renderHook(
      ({ candles }: { candles: Candle[] }) => useLiveStrategy(PAIR, candles),
      { initialProps: { candles: BUY_CANDLES } }
    )
    expect(result.current.signal).toBe('BUY')

    // Candles shrink (e.g. reconnect buffer reset) without a pair change
    rerender({ candles: makeCandlesFromCloses([100, 102]) })
    expect(result.current.signal).toBe('HOLD')
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
