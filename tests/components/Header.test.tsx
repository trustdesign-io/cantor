import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Header } from '@/components/Header'
import type { OhlcInterval } from '@/types'

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: vi.fn(), setTheme: vi.fn() }),
}))

function renderHeader(overrides: {
  interval?: OhlcInterval
  onIntervalChange?: (i: OhlcInterval) => void
} = {}) {
  const onIntervalChange = overrides.onIntervalChange ?? vi.fn()
  render(
    <Header
      pair="XBT/USDT"
      onPairChange={vi.fn()}
      interval={overrides.interval ?? 1}
      onIntervalChange={onIntervalChange}
      price={null}
      change24h={null}
    />
  )
  return { onIntervalChange }
}

describe('Header interval picker', () => {
  it('renders 5 interval options', () => {
    renderHeader()
    for (const label of ['1m interval', '5m interval', '15m interval', '1h interval', '4h interval']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('calls onIntervalChange with the correct numeric value when an option is clicked', () => {
    const { onIntervalChange } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: '5m interval' }))
    expect(onIntervalChange).toHaveBeenCalledWith(5)
  })

  it('calls onIntervalChange with 60 when 1h is clicked', () => {
    const { onIntervalChange } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: '1h interval' }))
    expect(onIntervalChange).toHaveBeenCalledWith(60)
  })

  it('calls onIntervalChange with 240 when 4h is clicked', () => {
    const { onIntervalChange } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: '4h interval' }))
    expect(onIntervalChange).toHaveBeenCalledWith(240)
  })

  it('highlights the currently active interval', () => {
    renderHeader({ interval: 15 })
    const btn = screen.getByRole('button', { name: '15m interval' })
    // Active chip has accent background (var(--accent)) and bg-base text
    expect(btn).toHaveStyle({ color: 'var(--bg-base)' })
  })
})
