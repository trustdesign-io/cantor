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
