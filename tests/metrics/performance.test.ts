import { describe, it, expect } from 'vitest'
import { computeMetrics } from '@/metrics/performance'
import type { Trade } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeTrade(overrides: Partial<Trade>): Trade {
  return {
    id: 'test',
    pair: 'XBT/USDT',
    entryPrice: 40_000,
    exitPrice: 42_000,
    entryTime: 1_700_000_000_000,
    exitTime:  1_700_003_600_000,
    pnlAbsolute: 500,
    pnlPercent: 5,
    durationMs: 3_600_000,
    signalReason: 'test',
    ...overrides,
  }
}

const WIN  = makeTrade({ id: 'w1', pnlAbsolute: 500,  pnlPercent:  5 })
const WIN2 = makeTrade({ id: 'w2', pnlAbsolute: 300,  pnlPercent:  3 })
const LOSS = makeTrade({ id: 'l1', pnlAbsolute: -400, pnlPercent: -4, exitTime: 1_700_100_000_000 })

const STARTING_BALANCE = 10_000

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('computeMetrics', () => {
  describe('zero trades', () => {
    it('returns zeroed metrics for empty trade list', () => {
      const m = computeMetrics([], STARTING_BALANCE)
      expect(m.totalTrades).toBe(0)
      expect(m.winRate).toBe(0)
      expect(m.totalReturnPct).toBe(0)
      expect(m.avgWin).toBe(0)
      expect(m.avgLoss).toBe(0)
      expect(m.maxDrawdownPct).toBe(0)
      expect(m.sharpeRatio).toBe(0)
      expect(m.currentBalance).toBe(STARTING_BALANCE)
    })
  })

  describe('totalTrades', () => {
    it('counts all trades', () => {
      const m = computeMetrics([WIN, WIN2, LOSS], STARTING_BALANCE)
      expect(m.totalTrades).toBe(3)
    })
  })

  describe('winRate', () => {
    it('is 1 (100%) when all trades are wins', () => {
      const m = computeMetrics([WIN, WIN2], STARTING_BALANCE)
      expect(m.winRate).toBeCloseTo(1, 4)
    })

    it('is 0 when all trades are losses', () => {
      const m = computeMetrics([LOSS], STARTING_BALANCE)
      expect(m.winRate).toBe(0)
    })

    it('calculates fractional win rate correctly', () => {
      const m = computeMetrics([WIN, LOSS], STARTING_BALANCE)
      expect(m.winRate).toBeCloseTo(0.5, 4)
    })
  })

  describe('totalReturnPct', () => {
    it('is 0 for zero trades', () => {
      expect(computeMetrics([], STARTING_BALANCE).totalReturnPct).toBe(0)
    })

    it('accumulates P&L from all trades relative to starting balance', () => {
      // WIN: +500, LOSS: -400 → net +100 on 10_000 = 1%
      const m = computeMetrics([WIN, LOSS], STARTING_BALANCE)
      expect(m.totalReturnPct).toBeCloseTo(1, 4)
    })

    it('is positive when sum of wins exceeds losses', () => {
      const m = computeMetrics([WIN, WIN2], STARTING_BALANCE)
      expect(m.totalReturnPct).toBeGreaterThan(0)
    })
  })

  describe('currentBalance', () => {
    it('equals startingBalance plus sum of all pnlAbsolute values', () => {
      const m = computeMetrics([WIN, LOSS], STARTING_BALANCE)
      expect(m.currentBalance).toBeCloseTo(STARTING_BALANCE + 500 - 400, 4)
    })
  })

  describe('avgWin', () => {
    it('is 0 when no winning trades', () => {
      const m = computeMetrics([LOSS], STARTING_BALANCE)
      expect(m.avgWin).toBe(0)
    })

    it('averages all winning pnlAbsolute values', () => {
      const m = computeMetrics([WIN, WIN2, LOSS], STARTING_BALANCE)
      expect(m.avgWin).toBeCloseTo((500 + 300) / 2, 4)
    })
  })

  describe('avgLoss', () => {
    it('is 0 when no losing trades', () => {
      const m = computeMetrics([WIN], STARTING_BALANCE)
      expect(m.avgLoss).toBe(0)
    })

    it('returns the average loss as a positive magnitude', () => {
      const loss1 = makeTrade({ id: 'l1', pnlAbsolute: -400 })
      const loss2 = makeTrade({ id: 'l2', pnlAbsolute: -200 })
      const m = computeMetrics([loss1, loss2], STARTING_BALANCE)
      expect(m.avgLoss).toBeCloseTo(300, 4) // Math.abs((-400 + -200) / 2) = 300
    })
  })

  describe('maxDrawdownPct', () => {
    it('is 0 for zero trades', () => {
      expect(computeMetrics([], STARTING_BALANCE).maxDrawdownPct).toBe(0)
    })

    it('is 0 when all trades are winning', () => {
      const m = computeMetrics([WIN, WIN2], STARTING_BALANCE)
      expect(m.maxDrawdownPct).toBe(0)
    })

    it('computes peak-to-trough drawdown across trade sequence', () => {
      // Sequence: +500, +300, -400
      // Balance: 10000 → 10500 → 10800 (peak) → 10400
      // Max drawdown: (10800 - 10400) / 10800 * 100 ≈ 3.7%
      const trades = [WIN, WIN2, LOSS]
      const m = computeMetrics(trades, STARTING_BALANCE)
      const expectedDD = (400 / 10_800) * 100
      expect(m.maxDrawdownPct).toBeCloseTo(expectedDD, 2)
    })
  })

  describe('sharpeRatio', () => {
    it('is 0 for zero trades', () => {
      expect(computeMetrics([], STARTING_BALANCE).sharpeRatio).toBe(0)
    })

    it('is 0 for a single trade (fewer than 2 needed for sample stddev)', () => {
      expect(computeMetrics([WIN], STARTING_BALANCE).sharpeRatio).toBe(0)
    })

    it('is 0 when all returns are identical (zero standard deviation)', () => {
      const t1 = makeTrade({ id: 't1', pnlPercent: 5 })
      const t2 = makeTrade({ id: 't2', pnlPercent: 5 })
      const m = computeMetrics([t1, t2], STARTING_BALANCE)
      expect(m.sharpeRatio).toBe(0)
    })

    it('is positive when mean return exceeds zero with some variance', () => {
      const m = computeMetrics([WIN, WIN2, LOSS], STARTING_BALANCE)
      expect(m.sharpeRatio).toBeGreaterThan(0)
    })
  })

  describe('edge cases', () => {
    it('handles startingBalance = 0 without throwing (returns 0 for totalReturnPct)', () => {
      const m = computeMetrics([WIN], 0)
      expect(m.totalReturnPct).toBe(0)
      expect(Number.isFinite(m.totalReturnPct)).toBe(true)
    })
  })
})
