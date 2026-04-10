import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { LiveTab } from '@/tabs/Live'

// ── Mocks ─────────────────────────────────────────────────────────────────────
// Chart components use lightweight-charts (canvas). Stub so the tab can render
// in jsdom without infrastructure.

vi.mock('@/components/PriceChart', () => ({
  PriceChart: () => <div role="img" aria-label="price chart stub" />,
}))

vi.mock('@/components/RsiChart', () => ({
  RsiChart: () => <div role="img" aria-label="rsi chart stub" />,
}))

// ── Default props ──────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  pair: 'XBT/USDT' as const,
  candles: [],
  signal: 'HOLD' as const,
  signalResult: { signal: 'HOLD' as const, baseSignal: 'HOLD' as const },
  position: null,
  balance: 10_000,
  macroBlackout: null,
  etfFlows: null,
  stablecoinData: null,
  fundingRate: null,
  fearGreedIndex: null,
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LiveTab', () => {
  it('renders the price chart', () => {
    render(<LiveTab {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText('price chart stub')).toBeInTheDocument()
  })

  it('renders the RSI panel', () => {
    render(<LiveTab {...DEFAULT_PROPS} />)
    expect(screen.getByLabelText('rsi chart stub')).toBeInTheDocument()
  })

  it('renders the signal log with initial state (no signals, full balance)', () => {
    render(<LiveTab {...DEFAULT_PROPS} />)
    // Multiple log roles exist (SignalLog + CommentatorPanel) — check by label
    expect(screen.getByRole('log', { name: 'Live signal events' })).toBeInTheDocument()
    expect(screen.getByText('No signals yet')).toBeInTheDocument()
    expect(screen.getByText('No open position')).toBeInTheDocument()
    expect(screen.getByText('10,000.00 USDT')).toBeInTheDocument()
  })

  it('does not show the blackout banner when macroBlackout is null', () => {
    render(<LiveTab {...DEFAULT_PROPS} macroBlackout={null} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the blackout banner with event name when macroBlackout is set', () => {
    render(<LiveTab {...DEFAULT_PROPS} macroBlackout="CPI" />)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveTextContent('CPI')
    expect(alert).toHaveTextContent('Macro blackout active')
  })
})
