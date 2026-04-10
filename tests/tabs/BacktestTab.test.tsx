import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BacktestTab } from '@/tabs/Backtest'
import type { Trade } from '@/types'
import type { PerformanceMetrics } from '@/metrics/performance'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/api/krakenRest', () => ({ fetchOHLC: vi.fn() }))
vi.mock('@/strategy/backtest', () => ({ runBacktest: vi.fn() }))
vi.mock('@/metrics/performance', () => ({ computeMetrics: vi.fn() }))
vi.mock('@/components/Journal', () => ({
  Journal: ({ trades }: { trades: readonly Trade[] }) => (
    <table data-testid="journal">
      <tbody>
        {trades.map(t => <tr key={t.id}><td>{t.pair}</td></tr>)}
      </tbody>
    </table>
  ),
}))
vi.mock('@/components/Performance', () => ({
  Performance: ({ metrics }: { metrics: PerformanceMetrics }) => (
    <div data-testid="performance">
      <span>Total Return</span>
      <span>{metrics.totalReturnPct}</span>
    </div>
  ),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandle(i: number) {
  return { time: 1_700_000_000 + i * 3_600, open: 100, high: 101, low: 99, close: 100, volume: 1 }
}

const COMPLETED_TRADE: Trade = {
  id: 'trade-1',
  pair: 'XBT/USDT',
  entryPrice: 100,
  exitPrice: 110,
  entryTime: 1_700_000_000_000,
  exitTime:  1_700_086_400_000,
  durationMs: 86_400_000,
  pnlAbsolute: 1_000,
  pnlPercent: 10,
  signalReason: 'EMA 9 crossed above EMA 21, RSI=45',
}

const STUB_METRICS: PerformanceMetrics = {
  totalReturnPct: 10,
  winRate: 1,
  avgWin: 1000,
  avgLoss: 0,
  maxDrawdownPct: 0,
  sharpeRatio: 2,
  totalTrades: 1,
  currentBalance: 11_000,
}

async function getModuleMocks() {
  const { fetchOHLC }      = await import('@/api/krakenRest')
  const { runBacktest }    = await import('@/strategy/backtest')
  const { computeMetrics } = await import('@/metrics/performance')
  return {
    fetchOHLC:      vi.mocked(fetchOHLC),
    runBacktest:    vi.mocked(runBacktest),
    computeMetrics: vi.mocked(computeMetrics),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BacktestTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Date defaults (uses fake timers to prevent midnight flakiness) ──────────

  describe('date defaults', () => {
    const FIXED_NOW = new Date('2025-01-15T12:00:00Z').getTime()

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(FIXED_NOW)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('start date defaults to 30 days ago', () => {
      render(<BacktestTab pair="XBT/USDT" />)
      expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe('2024-12-16')
    })

    it('end date defaults to today', () => {
      render(<BacktestTab pair="XBT/USDT" />)
      expect((screen.getByLabelText(/end date/i) as HTMLInputElement).value).toBe('2025-01-15')
    })

    it('end date input has max constrained to today', () => {
      render(<BacktestTab pair="XBT/USDT" />)
      expect((screen.getByLabelText(/end date/i) as HTMLInputElement).max).toBe('2025-01-15')
    })
  })

  // ── Structure ───────────────────────────────────────────────────────────────

  it('renders start and end date inputs', () => {
    render(<BacktestTab pair="XBT/USDT" />)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
  })

  it('renders Run Backtest button', () => {
    render(<BacktestTab pair="XBT/USDT" />)
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeInTheDocument()
  })

  // ── Loading state ───────────────────────────────────────────────────────────

  it('shows loading spinner while running', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockImplementation(() => new Promise(() => {}))

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
  })

  it('disables Run Backtest button while loading', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockImplementation(() => new Promise(() => {}))

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled())
  })

  // ── Success results ─────────────────────────────────────────────────────────

  it('renders Journal results after a successful run', async () => {
    const { fetchOHLC, runBacktest, computeMetrics } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })
    computeMetrics.mockReturnValue(STUB_METRICS)

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByTestId('journal')).toBeInTheDocument())
    expect(screen.getByText('XBT/USDT')).toBeInTheDocument()
  })

  it('renders Performance results after a successful run', async () => {
    const { fetchOHLC, runBacktest, computeMetrics } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })
    computeMetrics.mockReturnValue(STUB_METRICS)

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByTestId('performance')).toBeInTheDocument())
    expect(screen.getByText('Total Return')).toBeInTheDocument()
  })

  it('calls computeMetrics with the backtest trades', async () => {
    const { fetchOHLC, runBacktest, computeMetrics } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })
    computeMetrics.mockReturnValue(STUB_METRICS)

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(computeMetrics).toHaveBeenCalledWith([COMPLETED_TRADE], expect.any(Number)))
  })

  // ── Error states ────────────────────────────────────────────────────────────

  it('shows error message when fetch fails', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockRejectedValue(new Error('HTTP 429'))

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/http 429/i)).toBeInTheDocument()
  })

  it('shows error message when no candles are returned', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockResolvedValue([])

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/no candle data/i)).toBeInTheDocument()
  })

  it('shows error message when runBacktest throws (compute fails)', async () => {
    const { fetchOHLC, runBacktest } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockImplementation(() => { throw new Error('Compute error') })

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/compute error/i)).toBeInTheDocument()
  })

  // ── Clearing results ────────────────────────────────────────────────────────

  it('clears previous results when Run Backtest is clicked again', async () => {
    const { fetchOHLC, runBacktest, computeMetrics } = await getModuleMocks()

    fetchOHLC.mockResolvedValueOnce(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValueOnce({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })
    computeMetrics.mockReturnValueOnce(STUB_METRICS)
    fetchOHLC.mockImplementation(() => new Promise(() => {})) // stall second run

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))
    await waitFor(() => expect(screen.getByTestId('journal')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))
    await waitFor(() => expect(screen.queryByTestId('journal')).not.toBeInTheDocument())
  })

  // ── Props ───────────────────────────────────────────────────────────────────

  it('passes the pair prop to runBacktest', async () => {
    const { fetchOHLC, runBacktest, computeMetrics } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [], finalBalance: 10_000 })
    computeMetrics.mockReturnValue({ ...STUB_METRICS, totalTrades: 0 })

    render(<BacktestTab pair="ETH/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(runBacktest).toHaveBeenCalledWith(expect.any(Array), 'ETH/USDT'))
  })

  it('filters out candles after endDate before passing to runBacktest', async () => {
    const { fetchOHLC, runBacktest, computeMetrics } = await getModuleMocks()

    const validCandles   = Array.from({ length: 10 }, (_, i) => makeCandle(i))
    // Far-future candles (2099) — these should be filtered out
    const futureCandles  = Array.from({ length: 5 }, (_, i) => ({
      ...makeCandle(i),
      time: Math.floor(new Date('2099-01-01').getTime() / 1000) + i * 3_600,
    }))
    fetchOHLC.mockResolvedValue([...validCandles, ...futureCandles])
    runBacktest.mockReturnValue({ trades: [], finalBalance: 10_000 })
    computeMetrics.mockReturnValue({ ...STUB_METRICS, totalTrades: 0 })

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(runBacktest).toHaveBeenCalled())
    const candlesPassed = runBacktest.mock.calls[0][0] as unknown[]
    expect(candlesPassed.length).toBe(validCandles.length)
  })
})
