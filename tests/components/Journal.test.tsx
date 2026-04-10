import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Journal } from '@/components/Journal'
import type { Trade } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const WIN_TRADE: Trade = {
  id: 'trade-1',
  pair: 'XBT/USDT',
  entryPrice: 40_000,
  exitPrice: 42_000,
  entryTime: 1_700_000_000_000,
  exitTime:  1_700_003_600_000, // +1 hour
  pnlAbsolute: 500,
  pnlPercent: 5,
  durationMs: 3_600_000,
  signalReason: 'EMA 9/21 crossover, exit price 42000.00',
}

const LOSS_TRADE: Trade = {
  id: 'trade-2',
  pair: 'ETH/USDT',
  entryPrice: 2_000,
  exitPrice: 1_800,
  entryTime: 1_700_100_000_000,
  exitTime:  1_700_107_200_000, // +2 hours
  pnlAbsolute: -400,
  pnlPercent: -10,
  durationMs: 7_200_000,
  signalReason: 'EMA 9/21 crossover, exit price 1800.00',
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('Journal', () => {
  it('renders "No completed trades yet" when trades array is empty', () => {
    render(<Journal trades={[]} />)
    expect(screen.getByText('No completed trades yet')).toBeInTheDocument()
  })

  it('renders all 8 column headers', () => {
    render(<Journal trades={[WIN_TRADE]} />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Pair')).toBeInTheDocument()
    expect(screen.getByText('Entry')).toBeInTheDocument()
    expect(screen.getByText('Exit')).toBeInTheDocument()
    expect(screen.getByText('P&L (£)')).toBeInTheDocument()
    expect(screen.getByText('P&L (%)')).toBeInTheDocument()
    expect(screen.getByText('Duration')).toBeInTheDocument()
    expect(screen.getByText('Signal')).toBeInTheDocument()
  })

  it('renders a row for each trade', () => {
    render(<Journal trades={[WIN_TRADE, LOSS_TRADE]} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows).toHaveLength(2)
  })

  it('shows pair for each trade', () => {
    render(<Journal trades={[WIN_TRADE, LOSS_TRADE]} />)
    expect(screen.getByText('XBT/USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('shows formatted entry and exit prices', () => {
    render(<Journal trades={[WIN_TRADE]} />)
    expect(screen.getByText('40,000.00')).toBeInTheDocument()
    expect(screen.getByText('42,000.00')).toBeInTheDocument()
  })

  it('shows P&L with plus sign for winning trade', () => {
    render(<Journal trades={[WIN_TRADE]} />)
    expect(screen.getByText('+500.00')).toBeInTheDocument()
    expect(screen.getByText('+5.00%')).toBeInTheDocument()
  })

  it('shows P&L with minus sign for losing trade', () => {
    render(<Journal trades={[LOSS_TRADE]} />)
    expect(screen.getByText('-400.00')).toBeInTheDocument()
    expect(screen.getByText('-10.00%')).toBeInTheDocument()
  })

  it('shows duration formatted as hours and minutes', () => {
    render(<Journal trades={[WIN_TRADE]} />)
    expect(screen.getByText('1h 0m')).toBeInTheDocument()
  })

  it('shows signal reason', () => {
    render(<Journal trades={[WIN_TRADE]} />)
    expect(screen.getByText(WIN_TRADE.signalReason)).toBeInTheDocument()
  })

  it('defaults to descending date order (most recent first)', () => {
    render(<Journal trades={[WIN_TRADE, LOSS_TRADE]} />)
    const rows = screen.getAllByRole('row').slice(1)
    // LOSS_TRADE has later exitTime → should appear first
    expect(within(rows[0]).getByText('ETH/USDT')).toBeInTheDocument()
    expect(within(rows[1]).getByText('XBT/USDT')).toBeInTheDocument()
  })

  it('returns to descending date order when Date header is clicked twice', async () => {
    render(<Journal trades={[WIN_TRADE, LOSS_TRADE]} />)
    const dateHeader = screen.getByRole('columnheader', { name: /date/i })
    await userEvent.click(dateHeader) // asc
    await userEvent.click(dateHeader) // desc (back to default)
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('sorts by P&L ascending when P&L (£) header clicked', async () => {
    render(<Journal trades={[WIN_TRADE, LOSS_TRADE]} />)
    const pnlHeader = screen.getByRole('columnheader', { name: /P&L \(£\)/i })
    await userEvent.click(pnlHeader) // asc → loss first
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('applies win background to profitable rows', () => {
    render(<Journal trades={[WIN_TRADE]} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveAttribute('data-outcome', 'win')
  })

  it('applies loss background to unprofitable rows', () => {
    render(<Journal trades={[LOSS_TRADE]} />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveAttribute('data-outcome', 'loss')
  })
})
