import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StablecoinPanel } from '@/components/StablecoinPanel'
import type { StablecoinSupplyData } from '@/data/stablecoinSupply'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeData(totals: number[]): StablecoinSupplyData {
  const BASE = new Date('2026-04-01T00:00:00Z').getTime()
  return {
    snapshots: totals.map((t, i) => ({
      date: new Date(BASE + i * 86_400_000).toISOString().slice(0, 10),
      usdtBillions: t * 0.75,
      usdcBillions: t * 0.25,
      totalBillions: t,
    })),
    fetchedAt: Date.now(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StablecoinPanel', () => {
  it('shows "data unavailable" when data is null', () => {
    render(<StablecoinPanel data={null} />)
    expect(screen.getByText('Data unavailable')).toBeInTheDocument()
    expect(screen.getByRole('figure')).toHaveAccessibleName(/data unavailable/i)
  })

  it('shows "insufficient data" when fewer than 2 snapshots are present', () => {
    render(<StablecoinPanel data={makeData([100])} />)
    expect(screen.getByText('Insufficient data')).toBeInTheDocument()
  })

  it('renders the current total supply in the header', () => {
    render(<StablecoinPanel data={makeData([100, 101, 102, 103])} />)
    // Latest snapshot is 103B
    expect(screen.getByText('$103B')).toBeInTheDocument()
  })

  it('does not show mint badge when no single-day increase exceeds the threshold', () => {
    // All deltas are 0.1B — below the 0.5B threshold
    render(<StablecoinPanel data={makeData([100, 100.1, 100.2, 100.3])} />)
    expect(screen.queryByText('Mint')).not.toBeInTheDocument()
  })

  it('shows mint badge when a qualifying large mint is detected', () => {
    // Day 1→2: +2B — well above threshold
    render(<StablecoinPanel data={makeData([100, 102, 102.1, 102.2])} />)
    const badge = screen.getByText('Mint')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveAttribute('aria-label', expect.stringContaining('stablecoin mint'))
  })

  it('has accessible role and label on the figure container', () => {
    render(<StablecoinPanel data={makeData([100, 101, 102, 103])} />)
    const figure = screen.getByRole('figure')
    expect(figure).toHaveAccessibleName(/stablecoin supply/i)
  })
})
