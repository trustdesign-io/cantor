import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Performance } from '@/components/Performance'
import type { PerformanceMetrics } from '@/metrics/performance'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ZERO_METRICS: PerformanceMetrics = {
  totalReturnPct: 0,
  winRate: 0,
  avgWin: 0,
  avgLoss: 0,
  maxDrawdownPct: 0,
  sharpeRatio: 0,
  totalTrades: 0,
  currentBalance: 10_000,
}

const POSITIVE_METRICS: PerformanceMetrics = {
  totalReturnPct: 7.5,
  winRate: 0.6,
  avgWin: 400,
  avgLoss: 200,
  maxDrawdownPct: 5.2,
  sharpeRatio: 1.8,
  totalTrades: 10,
  currentBalance: 10_750,
}

const NEGATIVE_METRICS: PerformanceMetrics = {
  ...POSITIVE_METRICS,
  totalReturnPct: -3.5,
  currentBalance: 9_650,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Performance', () => {
  it('renders all 8 metric labels', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('Total Return')).toBeInTheDocument()
    expect(screen.getByText('Win Rate')).toBeInTheDocument()
    expect(screen.getByText('Avg Win')).toBeInTheDocument()
    expect(screen.getByText('Avg Loss')).toBeInTheDocument()
    expect(screen.getByText('Max Drawdown')).toBeInTheDocument()
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument()
    expect(screen.getByText('Total Trades')).toBeInTheDocument()
    expect(screen.getByText('Balance')).toBeInTheDocument()
  })

  it('shows "No trades yet" empty state when totalTrades is 0', () => {
    render(<Performance metrics={ZERO_METRICS} />)
    expect(screen.getByText('No trades yet')).toBeInTheDocument()
  })

  it('does not render metric labels in empty state', () => {
    render(<Performance metrics={ZERO_METRICS} />)
    expect(screen.queryByText('Total Return')).not.toBeInTheDocument()
  })

  it('does not show "No trades yet" when there are trades', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.queryByText('No trades yet')).not.toBeInTheDocument()
  })

  it('displays totalReturnPct with + sign for positive return', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('+7.50%')).toBeInTheDocument()
  })

  it('displays totalReturnPct with - sign for negative return', () => {
    render(<Performance metrics={NEGATIVE_METRICS} />)
    expect(screen.getByText('-3.50%')).toBeInTheDocument()
  })

  it('displays win rate as a percentage', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('60.0%')).toBeInTheDocument()
  })

  it('displays avgWin formatted to 2dp', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('400.00')).toBeInTheDocument()
  })

  it('displays avgLoss formatted to 2dp', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('200.00')).toBeInTheDocument()
  })

  it('displays maxDrawdownPct as a percentage', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('5.20%')).toBeInTheDocument()
  })

  it('displays Sharpe ratio to 2dp', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('1.80')).toBeInTheDocument()
  })

  it('displays total trades count', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('displays current balance formatted', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    expect(screen.getByText('10,750.00')).toBeInTheDocument()
  })

  it('positive totalReturnPct value has win colour (data-colour=win)', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    const returnValue = screen.getByText('+7.50%')
    expect(returnValue.closest('[data-colour]')).toHaveAttribute('data-colour', 'win')
  })

  it('negative totalReturnPct value has loss colour (data-colour=loss)', () => {
    render(<Performance metrics={NEGATIVE_METRICS} />)
    const returnValue = screen.getByText('-3.50%')
    expect(returnValue.closest('[data-colour]')).toHaveAttribute('data-colour', 'loss')
  })

  it('win rate value has win colour when >= 0.5', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    const winRateValue = screen.getByText('60.0%')
    expect(winRateValue.closest('[data-colour]')).toHaveAttribute('data-colour', 'win')
  })

  it('avgLoss value has loss colour when > 0', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    const avgLossValue = screen.getByText('200.00')
    expect(avgLossValue.closest('[data-colour]')).toHaveAttribute('data-colour', 'loss')
  })

  it('maxDrawdown value has loss colour when > 0', () => {
    render(<Performance metrics={POSITIVE_METRICS} />)
    const ddValue = screen.getByText('5.20%')
    expect(ddValue.closest('[data-colour]')).toHaveAttribute('data-colour', 'loss')
  })

  it('zero totalReturnPct renders without + sign', () => {
    render(<Performance metrics={{ ...POSITIVE_METRICS, totalReturnPct: 0 }} />)
    expect(screen.getByText('0.00%')).toBeInTheDocument()
    expect(screen.queryByText('+0.00%')).not.toBeInTheDocument()
  })
})
