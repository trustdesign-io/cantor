import type { Trade } from '@/types'

export interface PerformanceMetrics {
  /**
   * Total return as a percentage of the starting balance.
   * ((currentBalance - startingBalance) / startingBalance) * 100
   * Good: > 0% per session; exceptional: > 10% with controlled drawdown.
   */
  totalReturnPct: number

  /**
   * Fraction of trades that closed with positive P&L (0–1).
   * Break-even trades (pnlAbsolute === 0) are counted as losses.
   * 0.5 means half of all trades were winners.
   * Good: > 0.5 for trend-following strategies; > 0.4 combined with high avgWin / avgLoss ratio.
   */
  winRate: number

  /**
   * Average absolute P&L of winning trades (always positive or zero).
   * Higher is better, but must be read alongside avgLoss and winRate.
   * Good: avgWin / avgLoss > 1.5 (positive expectancy).
   */
  avgWin: number

  /**
   * Average absolute P&L of losing trades (always positive or zero — magnitude, not sign).
   * Closer to 0 is better. Combined with winRate determines expectancy.
   * Good: avgLoss / avgWin < 0.67.
   */
  avgLoss: number

  /**
   * Maximum peak-to-trough decline in running balance, expressed as a %.
   * The worst observed loss from a high-water mark to the subsequent low.
   * Computed in trade chronological order.
   * Good: < 10% for a low-risk strategy; < 20% is acceptable for momentum plays.
   */
  maxDrawdownPct: number

  /**
   * Simplified Sharpe ratio: mean(returnPct per trade) / stddev(returnPct per trade).
   * Risk-free rate is assumed to be zero (simplification — suitable for short intraday sessions).
   * Measures return earned per unit of volatility. Uses sample standard deviation (N-1).
   * Good: > 1.0; exceptional: > 2.0.
   * Simplification: does not annualise, does not subtract a risk-free rate, computed
   * per-trade rather than per time-period. Useful for relative comparison between
   * strategy configurations, not for comparing against external benchmarks.
   * Returns 0 when stddev is 0 (all trades identical) or fewer than 2 trades.
   */
  sharpeRatio: number

  /** Total number of completed (closed) trades in the period. */
  totalTrades: number

  /**
   * Current account balance: startingBalance + sum of all realised P&L.
   * Reflects the paper trader's account value after all closed trades.
   */
  currentBalance: number
}

/**
 * Computes performance metrics from a list of completed trades.
 * Pure function — no side effects, no mutations.
 *
 * @param trades - Completed trades from the paper trader (must be in chronological order
 *   for maxDrawdownPct to be meaningful).
 * @param startingBalance - Initial account balance (e.g. 10,000 USDT). Must be > 0.
 * @returns A PerformanceMetrics object. All values are 0 if trades is empty.
 *   If startingBalance is 0 or negative, totalReturnPct is returned as 0.
 */
export function computeMetrics(
  trades: readonly Trade[],
  startingBalance: number,
): PerformanceMetrics {
  const totalTrades = trades.length

  if (totalTrades === 0 || startingBalance <= 0) {
    return {
      totalReturnPct: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      maxDrawdownPct: 0,
      sharpeRatio: 0,
      totalTrades,
      currentBalance: startingBalance,
    }
  }

  // Break-even trades (pnlAbsolute === 0) are counted as losses — documented convention
  const wins   = trades.filter(t => t.pnlAbsolute > 0)
  const losses = trades.filter(t => t.pnlAbsolute <= 0)

  const winRate = wins.length / totalTrades
  const avgWin  = wins.length   > 0 ? wins.reduce((sum, t) => sum + t.pnlAbsolute, 0)         / wins.length   : 0
  // avgLoss is returned as a positive magnitude (absolute value of average loss)
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, t) => sum + t.pnlAbsolute, 0) / losses.length) : 0

  const totalPnl       = trades.reduce((sum, t) => sum + t.pnlAbsolute, 0)
  const currentBalance = startingBalance + totalPnl
  const totalReturnPct = (totalPnl / startingBalance) * 100

  // Max drawdown: peak-to-trough decline in running equity (trades assumed chronological)
  let peak = startingBalance
  let maxDrawdownPct = 0
  let running = startingBalance
  for (const trade of trades) {
    running += trade.pnlAbsolute
    if (running > peak) {
      peak = running
    } else {
      const drawdown = ((peak - running) / peak) * 100
      if (drawdown > maxDrawdownPct) maxDrawdownPct = drawdown
    }
  }

  // Sharpe ratio (simplified, per-trade, risk-free rate = 0, sample stddev N-1)
  const returns = trades.map(t => t.pnlPercent).filter(r => Number.isFinite(r))
  let sharpeRatio = 0
  if (returns.length >= 2) {
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const sampleVariance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / (returns.length - 1)
    const stdDev = Math.sqrt(sampleVariance)
    sharpeRatio = stdDev === 0 ? 0 : meanReturn / stdDev
  }

  return {
    totalReturnPct,
    winRate,
    avgWin,
    avgLoss,
    maxDrawdownPct,
    sharpeRatio,
    totalTrades,
    currentBalance,
  }
}
