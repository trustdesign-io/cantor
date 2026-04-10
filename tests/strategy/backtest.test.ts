import { describe, it, expect } from 'vitest'
import { runBacktest } from '@/strategy/backtest'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { Candle } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeCandlesFromCloses(closes: number[], startTime = 1_700_000_000): Candle[] {
  return closes.map((close, i) => ({
    time: startTime + i * 60,
    open: close * 0.999,
    high: close * 1.001,
    low:  close * 0.998,
    close,
    volume: 1,
  }))
}

/**
 * 22-bar series that produces a golden cross at bar 21.
 * EMA9 crosses above EMA21 and RSI is between 30-70.
 * Matches the BUY_CLOSES sequence from useLiveStrategy tests.
 */
const BUY_CLOSES = [
  100, 102, 99, 103, 98, 105, 97, 108, 96, 110,
  94,  112, 92, 115, 90, 118, 88, 120, 86, 122,
  84,  125,
]

/**
 * 30-bar sharply declining series appended after BUY_CLOSES.
 * A continuous steep drop from 120→0 ensures fast EMA (9) crosses
 * below slow EMA (21) in the combined window, producing a SELL signal.
 */
const DECLINING_CLOSES = Array.from({ length: 30 }, (_, i) => 120 - i * 4)

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('runBacktest', () => {
  it('returns empty trades and initial balance for fewer than 22 candles', () => {
    const result = runBacktest(makeCandlesFromCloses([100, 101, 102]), 'XBT/USDT')
    expect(result.trades).toHaveLength(0)
    expect(result.finalBalance).toBe(INITIAL_BALANCE)
  })

  it('returns empty trades when no crossover signal occurs', () => {
    // All-identical prices: both EMAs are always equal, so no crossover is possible
    const flat = Array.from({ length: 22 }, () => 100)
    const result = runBacktest(makeCandlesFromCloses(flat), 'XBT/USDT')
    expect(result.trades).toHaveLength(0)
    expect(result.finalBalance).toBe(INITIAL_BALANCE)
  })

  it('opens a position on BUY signal', () => {
    const result = runBacktest(makeCandlesFromCloses(BUY_CLOSES), 'XBT/USDT')
    expect(result.trades).toHaveLength(0)  // position opened but not closed yet
    expect(result.finalBalance).toBe(0)    // balance deployed into position
  })

  it('records a completed trade when BUY is followed by SELL', () => {
    // BUY_CLOSES triggers a golden cross; DECLINING_CLOSES forces a death cross
    const combinedCloses = [...BUY_CLOSES, ...DECLINING_CLOSES]
    const result = runBacktest(makeCandlesFromCloses(combinedCloses), 'XBT/USDT')
    expect(result.trades.length).toBeGreaterThanOrEqual(1)
  })

  it('returns trade with correct pair', () => {
    const combinedCloses = [...BUY_CLOSES, ...DECLINING_CLOSES]
    const result = runBacktest(makeCandlesFromCloses(combinedCloses), 'XBT/USDT')
    expect(result.trades.length).toBeGreaterThan(0)
    expect(result.trades[0].pair).toBe('XBT/USDT')
  })

  it('handles 720 candles without throwing', () => {
    const manyCloses = Array.from({ length: 720 }, (_, i) =>
      100 + Math.sin(i / 10) * 20 + (i % 7) * 0.5
    )
    expect(() => runBacktest(makeCandlesFromCloses(manyCloses), 'XBT/USDT')).not.toThrow()
  })

  it('final balance equals initial balance when no trades open or close', () => {
    // Too few candles for any signal
    const result = runBacktest(makeCandlesFromCloses([100, 101]), 'XBT/USDT')
    expect(result.finalBalance).toBe(INITIAL_BALANCE)
  })

  it('is a pure function — does not mutate input array', () => {
    const candles = makeCandlesFromCloses(BUY_CLOSES)
    const original = [...candles]
    runBacktest(candles, 'XBT/USDT')
    expect(candles).toEqual(original)
  })
})
