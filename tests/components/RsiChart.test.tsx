import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RsiChart } from '@/components/RsiChart'
import type { Candle } from '@/types'

// ── Mock lightweight-charts ────────────────────────────────────────────────────
// jsdom has no canvas/WebGL — createChart must be stubbed.

const mockSetData = vi.fn()
const mockCreatePriceLine = vi.fn()
const mockAddSeries = vi.fn(() => ({
  setData: mockSetData,
  createPriceLine: mockCreatePriceLine,
}))
const mockRemove = vi.fn()
const mockResize = vi.fn()

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: mockAddSeries,
    remove: mockRemove,
    resize: mockResize,
  })),
  LineSeries: {},
  LineStyle: { Dashed: 2 },
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCandles(closes: number[], baseTime = 1_700_000_000): Candle[] {
  return closes.map((c, i) => ({
    time: baseTime + i * 60,
    open: c, high: c, low: c, close: c, volume: 1,
  }))
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RsiChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a container with role=img and a descriptive aria-label', () => {
    render(<RsiChart candles={[]} />)
    const el = screen.getByRole('img')
    expect(el).toBeDefined()
    const label = el.getAttribute('aria-label') ?? ''
    // Label must reference RSI period and the two threshold values
    expect(label).toContain('14')  // RSI_PERIOD
    expect(label).toContain('70')  // RSI_OVERBOUGHT
    expect(label).toContain('30')  // RSI_OVERSOLD
  })

  it('creates two price lines for overbought and oversold thresholds on mount', () => {
    render(<RsiChart candles={[]} />)
    expect(mockCreatePriceLine).toHaveBeenCalledTimes(2)
    const prices = mockCreatePriceLine.mock.calls.map(([opts]: [{ price: number }]) => opts.price)
    expect(prices).toContain(70)  // RSI_OVERBOUGHT
    expect(prices).toContain(30)  // RSI_OVERSOLD
  })

  it('calls setData with empty array when no candles are provided', () => {
    render(<RsiChart candles={[]} />)
    expect(mockSetData).toHaveBeenCalledWith([])
  })

  it('strips NaN RSI values before setData (first RSI_PERIOD values are NaN)', () => {
    // RSI(14) requires 15 bars to emit first value; fewer = all NaN, setData([])
    const shortCandles = makeCandles([100, 102, 99, 103, 98])
    render(<RsiChart candles={shortCandles} />)
    expect(mockSetData).toHaveBeenCalledWith([])
  })

  it('passes finite RSI values to setData when enough candles are provided', () => {
    // 20 bars is enough for RSI(14) to produce 6 finite values (bars 14..19)
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    render(<RsiChart candles={makeCandles(closes)} />)
    const [data] = mockSetData.mock.calls.at(-1) as [Array<{ time: number; value: number }>]
    // Should have 6 finite points (indices 14–19 out of 20)
    expect(data.length).toBe(6)
    data.forEach(d => {
      expect(isFinite(d.value)).toBe(true)
      expect(d.value).toBeGreaterThanOrEqual(0)
      expect(d.value).toBeLessThanOrEqual(100)
    })
  })

  it('calls setData again when candles prop is updated', () => {
    const { rerender } = render(<RsiChart candles={[]} />)
    const callsBefore = mockSetData.mock.calls.length

    const closes = Array.from({ length: 20 }, (_, i) => 100 + i)
    rerender(<RsiChart candles={makeCandles(closes)} />)

    expect(mockSetData.mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('removes the chart on unmount', () => {
    const { unmount } = render(<RsiChart candles={[]} />)
    unmount()
    expect(mockRemove).toHaveBeenCalledOnce()
  })
})
