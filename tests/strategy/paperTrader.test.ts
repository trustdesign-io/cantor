import { describe, it, expect } from 'vitest'
import {
  onSignal,
  INITIAL_STATE,
  INITIAL_BALANCE,
} from '@/strategy/paperTrader'

const PAIR = 'XBT/USDT' as const
const T0 = 1_700_000_000_000  // entry timestamp (ms)
const T1 = 1_700_003_600_000  // exit timestamp (+1 hour)

// ── HOLD ──────────────────────────────────────────────────────────────────────

describe('HOLD', () => {
  it('returns the same state object reference (no work done)', () => {
    const next = onSignal(INITIAL_STATE, 'HOLD', 45_000, T0, PAIR)
    expect(next).toBe(INITIAL_STATE)
  })
})

// ── BUY ───────────────────────────────────────────────────────────────────────

describe('BUY', () => {
  it('opens a position consuming 100% of balance', () => {
    const state = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)

    expect(state.balance).toBe(0)
    expect(state.position).not.toBeNull()
    expect(state.position!.entryPrice).toBe(1_000)
    expect(state.position!.entryTime).toBe(T0)
    expect(state.position!.pair).toBe(PAIR)
    // size = INITIAL_BALANCE / price = 10 000 / 1 000 = 10
    expect(state.position!.size).toBeCloseTo(10, 10)
  })

  it('does not open a second position when already in one', () => {
    const withPosition = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const unchanged = onSignal(withPosition, 'BUY', 1_100, T1, PAIR)
    // State reference is the same — no mutation, no new position
    expect(unchanged).toBe(withPosition)
  })

  it('does not open a position when balance is zero', () => {
    const zeroBalance = { ...INITIAL_STATE, balance: 0 }
    const next = onSignal(zeroBalance, 'BUY', 1_000, T0, PAIR)
    expect(next).toBe(zeroBalance)
  })

  it('does not mutate the input state', () => {
    const before = { ...INITIAL_STATE }
    onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    expect(INITIAL_STATE.balance).toBe(before.balance)
    expect(INITIAL_STATE.position).toBeNull()
  })
})

// ── SELL ──────────────────────────────────────────────────────────────────────

describe('SELL', () => {
  it('does nothing when flat (no open position)', () => {
    const next = onSignal(INITIAL_STATE, 'SELL', 1_000, T0, PAIR)
    expect(next).toBe(INITIAL_STATE)
  })

  it('closes position and updates balance to exit value', () => {
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    // size = 10; sell at 1 100 → exit value = 11 000
    const closed = onSignal(opened, 'SELL', 1_100, T1, PAIR)

    expect(closed.position).toBeNull()
    expect(closed.balance).toBeCloseTo(11_000, 5)
  })

  it('records a completed trade in the trades array', () => {
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const closed = onSignal(opened, 'SELL', 1_100, T1, PAIR)

    expect(closed.trades).toHaveLength(1)
    const trade = closed.trades[0]
    expect(trade.pair).toBe(PAIR)
    expect(trade.entryPrice).toBe(1_000)
    expect(trade.exitPrice).toBe(1_100)
    expect(trade.entryTime).toBe(T0)
    expect(trade.exitTime).toBe(T1)
    expect(trade.durationMs).toBe(T1 - T0)
  })

  it('does not mutate the input state', () => {
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const snapshot = { ...opened }
    onSignal(opened, 'SELL', 1_100, T1, PAIR)
    expect(opened.position).toEqual(snapshot.position)
    expect(opened.balance).toBe(snapshot.balance)
    expect(opened.trades).toHaveLength(0)
  })
})

// ── P&L calculation ───────────────────────────────────────────────────────────

describe('P&L calculation', () => {
  it('profitable trade: pnlAbsolute and pnlPercent are positive', () => {
    // Buy 10 units @ 1 000, sell @ 1 100 → P&L = +1 000 (+10%)
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const closed = onSignal(opened, 'SELL', 1_100, T1, PAIR)
    const trade = closed.trades[0]

    expect(trade.pnlAbsolute).toBeCloseTo(1_000, 5)
    expect(trade.pnlPercent).toBeCloseTo(10, 5)
  })

  it('losing trade: pnlAbsolute and pnlPercent are negative', () => {
    // Buy 10 units @ 1 000, sell @ 900 → P&L = -1 000 (-10%)
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const closed = onSignal(opened, 'SELL', 900, T1, PAIR)
    const trade = closed.trades[0]

    expect(trade.pnlAbsolute).toBeCloseTo(-1_000, 5)
    expect(trade.pnlPercent).toBeCloseTo(-10, 5)
  })

  it('break-even trade: pnlAbsolute = 0', () => {
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const closed = onSignal(opened, 'SELL', 1_000, T1, PAIR)
    expect(closed.trades[0].pnlAbsolute).toBeCloseTo(0, 10)
  })
})

// ── Fractional sizing (sizeMultiplier) ────────────────────────────────────────

describe('fractional sizing', () => {
  it('deploys only the multiplied fraction of balance on BUY', () => {
    // 0.5× multiplier → deploys 5 000 of 10 000
    const state = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR, 0.5)

    expect(state.balance).toBeCloseTo(5_000, 5)
    // size = 5 000 / 1 000 = 5 units
    expect(state.position!.size).toBeCloseTo(5, 10)
    expect(state.position!.sizeMultiplier).toBe(0.5)
  })

  it('SELL after fractional BUY restores remaining cash plus exit value', () => {
    // BUY 0.5×: balance = 5 000, position = 5 units @ 1 000
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR, 0.5)
    // SELL @ 1 200: exit value = 5 * 1 200 = 6 000; total balance = 5 000 + 6 000 = 11 000
    const closed = onSignal(opened, 'SELL', 1_200, T1, PAIR)

    expect(closed.balance).toBeCloseTo(11_000, 5)
    expect(closed.position).toBeNull()
  })

  it('records the multiplier on the completed trade', () => {
    const opened = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR, 0.5)
    const closed = onSignal(opened, 'SELL', 1_100, T1, PAIR)

    expect(closed.trades[0].sizeMultiplier).toBe(0.5)
  })

  it('caps effective multiplier at 1.0 (no leverage in paper trading)', () => {
    // Passing multiplier > 1.0 should still only deploy 100% of balance
    const state = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR, 1.5)

    expect(state.balance).toBeCloseTo(0, 5)
    expect(state.position!.size).toBeCloseTo(10, 10)
  })

  it('compounds correctly across two fractional trades', () => {
    // Trade 1: 0.5× BUY @ 1 000 → deploys 5 000, 5 000 cash remains
    const s1 = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR, 0.5)
    // SELL @ 1 100 → exit = 5 * 1 100 = 5 500; balance = 5 000 + 5 500 = 10 500
    const s2 = onSignal(s1, 'SELL', 1_100, T1, PAIR)
    expect(s2.balance).toBeCloseTo(10_500, 5)

    // Trade 2: 0.5× BUY @ 1 100 → deploys 5 250, 5 250 cash remains
    const s3 = onSignal(s2, 'BUY', 1_100, T1 + 1, PAIR, 0.5)
    expect(s3.balance).toBeCloseTo(5_250, 5)
    // SELL @ 1_050 → size = 5250/1100 ≈ 4.772727; exit ≈ 5011.36; balance ≈ 5 250 + 5 011.36
    const s4 = onSignal(s3, 'SELL', 1_050, T1 + 2, PAIR)
    expect(s4.trades).toHaveLength(2)
    expect(s4.balance).toBeCloseTo(5_250 + (5_250 / 1_100) * 1_050, 5)
  })
})

// ── Multi-trade sequence ──────────────────────────────────────────────────────

describe('multi-trade sequence', () => {
  it('balance compounds across consecutive trades', () => {
    // Trade 1: buy @ 1 000, sell @ 1 100 → balance = 11 000
    const s1 = onSignal(INITIAL_STATE, 'BUY', 1_000, T0, PAIR)
    const s2 = onSignal(s1, 'SELL', 1_100, T1, PAIR)
    // Trade 2: buy @ 1 100 with new balance (11 000), sell @ 1 050
    const s3 = onSignal(s2, 'BUY', 1_100, T1 + 1, PAIR)
    const s4 = onSignal(s3, 'SELL', 1_050, T1 + 2, PAIR)

    expect(s4.trades).toHaveLength(2)
    // After trade 2: size = 11000/1100 = 10; exit = 10*1050 = 10500
    expect(s4.balance).toBeCloseTo(10_500, 5)
  })

  it('INITIAL_BALANCE constant matches the initial state balance', () => {
    expect(INITIAL_STATE.balance).toBe(INITIAL_BALANCE)
    expect(INITIAL_STATE.position).toBeNull()
    expect(INITIAL_STATE.trades).toHaveLength(0)
  })
})
