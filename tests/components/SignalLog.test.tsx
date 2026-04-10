import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SignalLog } from '@/components/SignalLog'
import type { Position, SignalEvent } from '@/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BUY_EVENT: SignalEvent = {
  timestamp: 1_700_000_060_000,
  pair: 'XBT/USDT',
  signal: 'BUY',
  price: 42_000,
}

const SELL_EVENT: SignalEvent = {
  timestamp: 1_700_000_120_000,
  pair: 'XBT/USDT',
  signal: 'SELL',
  price: 43_000,
}

const HOLD_EVENT: SignalEvent = {
  timestamp: 1_700_000_180_000,
  pair: 'XBT/USDT',
  signal: 'HOLD',
  price: 41_000,
}

const OPEN_POSITION: Position = {
  pair: 'XBT/USDT',
  entryPrice: 42_000,
  entryTime: 1_700_000_060_000,
  size: 0.238095,
  unrealisedPnl: 238.10,
  sizeMultiplier: 1.0,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SignalLog', () => {
  it('renders "No signals yet" when events array is empty', () => {
    render(<SignalLog events={[]} position={null} balance={10_000} />)
    expect(screen.getByText('No signals yet')).toBeInTheDocument()
  })

  it('renders a row for each event', () => {
    render(<SignalLog events={[BUY_EVENT, SELL_EVENT]} position={null} balance={0} />)
    expect(screen.getByText('BUY')).toBeInTheDocument()
    expect(screen.getByText('SELL')).toBeInTheDocument()
  })

  it('shows events in reverse chronological order (most recent first)', () => {
    render(<SignalLog events={[BUY_EVENT, SELL_EVENT, HOLD_EVENT]} position={null} balance={0} />)
    const rows = screen.getAllByRole('row').slice(1) // skip header row
    // HOLD is latest (timestamp 180s), BUY is oldest (60s)
    expect(within(rows[0]).getByText('HOLD')).toBeInTheDocument()
    expect(within(rows[2]).getByText('BUY')).toBeInTheDocument()
  })

  it('displays the pair column for each event', () => {
    const ethEvent: SignalEvent = { ...BUY_EVENT, pair: 'ETH/USDT' }
    render(<SignalLog events={[BUY_EVENT, ethEvent]} position={null} balance={0} />)
    // Both pairs must appear (there are two rows)
    const pairCells = screen.getAllByText('XBT/USDT')
    expect(pairCells.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('displays the formatted price for each event', () => {
    render(<SignalLog events={[BUY_EVENT]} position={null} balance={0} />)
    // 42000 → "42,000.00"
    expect(screen.getByText('42,000.00')).toBeInTheDocument()
  })

  it('shows "No open position" when position is null', () => {
    render(<SignalLog events={[]} position={null} balance={10_000} />)
    expect(screen.getByText('No open position')).toBeInTheDocument()
  })

  it('shows position details when a position is open', () => {
    render(<SignalLog events={[]} position={OPEN_POSITION} balance={0} />)
    expect(screen.getByText('Open position')).toBeInTheDocument()
    // Entry price appears in position footer
    expect(screen.getByText('@ 42,000.00')).toBeInTheDocument()
  })

  it('renders balance in the footer', () => {
    render(<SignalLog events={[]} position={null} balance={10_000} />)
    expect(screen.getByText('10,000.00 USDT')).toBeInTheDocument()
  })

  it('uses role=log with aria-live=polite on the event list', () => {
    render(<SignalLog events={[BUY_EVENT]} position={null} balance={0} />)
    const log = screen.getByRole('log')
    expect(log).toBeInTheDocument()
    expect(log.getAttribute('aria-live')).toBe('polite')
  })

  it('shows positive unrealised P&L with leading plus sign', () => {
    render(<SignalLog events={[]} position={OPEN_POSITION} balance={0} />)
    // unrealisedPnl = 238.10 → "+238.10"
    expect(screen.getByText('+238.10')).toBeInTheDocument()
  })

  it('shows negative unrealised P&L with minus sign', () => {
    const lossPosition: Position = { ...OPEN_POSITION, unrealisedPnl: -500 }
    render(<SignalLog events={[]} position={lossPosition} balance={0} />)
    expect(screen.getByText('-500.00')).toBeInTheDocument()
  })
})
