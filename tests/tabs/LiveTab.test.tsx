import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LiveTab } from '@/tabs/Live'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Chart components use lightweight-charts (canvas) and WebSocket hooks.
// Stub both so the tab can render in jsdom without infrastructure.

vi.mock('@/hooks/useKrakenOhlc', () => ({
  useKrakenOhlc: () => ({ candles: [], connected: false }),
}))

vi.mock('@/hooks/useLiveStrategy', () => ({
  useLiveStrategy: () => ({
    signal: 'HOLD',
    position: null,
    balance: 10_000,
    trades: [],
  }),
}))

vi.mock('@/components/PriceChart', () => ({
  PriceChart: () => <div role="img" aria-label="price chart stub" />,
}))

vi.mock('@/components/RsiChart', () => ({
  RsiChart: () => <div role="img" aria-label="rsi chart stub" />,
}))

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LiveTab', () => {
  it('renders the price chart', () => {
    render(<LiveTab pair="XBT/USDT" />)
    expect(screen.getByLabelText('price chart stub')).toBeInTheDocument()
  })

  it('renders the RSI panel', () => {
    render(<LiveTab pair="XBT/USDT" />)
    expect(screen.getByLabelText('rsi chart stub')).toBeInTheDocument()
  })

  it('renders the signal log with initial state (no signals, full balance)', () => {
    render(<LiveTab pair="XBT/USDT" />)
    expect(screen.getByRole('log')).toBeInTheDocument()
    expect(screen.getByText('No signals yet')).toBeInTheDocument()
    expect(screen.getByText('No open position')).toBeInTheDocument()
    expect(screen.getByText('10,000.00 USDT')).toBeInTheDocument()
  })
})
