import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BacktestTab } from '@/tabs/Backtest'
import type { Trade } from '@/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/api/krakenRest', () => ({
  fetchOHLC: vi.fn(),
}))

vi.mock('@/strategy/backtest', () => ({
  runBacktest: vi.fn(),
}))

// lightweight-charts is not available in jsdom
vi.mock('@/components/PriceChart', () => ({ PriceChart: () => <canvas /> }))
vi.mock('@/components/RsiChart',   () => ({ RsiChart:   () => <canvas /> }))

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

async function getModuleMocks() {
  const { fetchOHLC }  = await import('@/api/krakenRest')
  const { runBacktest } = await import('@/strategy/backtest')
  return { fetchOHLC: vi.mocked(fetchOHLC), runBacktest: vi.mocked(runBacktest) }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('BacktestTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders start and end date inputs', () => {
    render(<BacktestTab pair="XBT/USDT" />)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
  })

  it('start date defaults to 30 days ago', () => {
    render(<BacktestTab pair="XBT/USDT" />)
    const expected = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    expect((screen.getByLabelText(/start date/i) as HTMLInputElement).value).toBe(expected)
  })

  it('end date defaults to today', () => {
    render(<BacktestTab pair="XBT/USDT" />)
    const expected = new Date().toISOString().slice(0, 10)
    expect((screen.getByLabelText(/end date/i) as HTMLInputElement).value).toBe(expected)
  })

  it('renders Run Backtest button', () => {
    render(<BacktestTab pair="XBT/USDT" />)
    expect(screen.getByRole('button', { name: /run backtest/i })).toBeInTheDocument()
  })

  it('shows loading spinner while running', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockImplementation(() => new Promise(() => {})) // never resolves

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeInTheDocument()
    })
  })

  it('disables Run Backtest button while loading', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockImplementation(() => new Promise(() => {}))

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run backtest/i })).toBeDisabled()
    })
  })

  it('renders Journal results after a successful run', async () => {
    const { fetchOHLC, runBacktest } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    // Journal renders the pair in the table
    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument()
    })
    expect(screen.getByText('XBT/USDT')).toBeInTheDocument()
  })

  it('renders Performance results after a successful run', async () => {
    const { fetchOHLC, runBacktest } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => {
      expect(screen.getByText('Total Return')).toBeInTheDocument()
    })
  })

  it('shows error message when fetch fails', async () => {
    const { fetchOHLC } = await getModuleMocks()
    fetchOHLC.mockRejectedValue(new Error('HTTP 429'))

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    expect(screen.getByText(/http 429/i)).toBeInTheDocument()
  })

  it('shows error message when no candles are returned', async () => {
    const { fetchOHLC, runBacktest } = await getModuleMocks()
    fetchOHLC.mockResolvedValue([])
    runBacktest.mockReturnValue({ trades: [], finalBalance: 10_000 })

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('clears results and error when Run Backtest is clicked again', async () => {
    const { fetchOHLC, runBacktest } = await getModuleMocks()

    // First run — success with a trade
    fetchOHLC.mockResolvedValueOnce(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValueOnce({ trades: [COMPLETED_TRADE], finalBalance: 11_000 })

    // Second run — stall so we can observe the cleared state
    fetchOHLC.mockImplementation(() => new Promise(() => {}))

    render(<BacktestTab pair="XBT/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    // Table should be gone while loading
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument())
  })

  it('passes the pair prop to runBacktest', async () => {
    const { fetchOHLC, runBacktest } = await getModuleMocks()
    fetchOHLC.mockResolvedValue(Array.from({ length: 30 }, (_, i) => makeCandle(i)))
    runBacktest.mockReturnValue({ trades: [], finalBalance: 10_000 })

    render(<BacktestTab pair="ETH/USDT" />)
    fireEvent.click(screen.getByRole('button', { name: /run backtest/i }))

    await waitFor(() => expect(runBacktest).toHaveBeenCalledWith(expect.any(Array), 'ETH/USDT'))
  })
})
