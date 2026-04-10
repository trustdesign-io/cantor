import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

// jsdom defaults to innerWidth=0 which triggers the ResizeGuard.
// Cantor is a desktop-only app; set a valid desktop width for all smoke tests.
beforeAll(() => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1440 })
})

describe('App smoke test', () => {
  it('renders the Cantor brand name in the header', () => {
    render(<App />)
    expect(screen.getAllByText('Cantor').length).toBeGreaterThan(0)
  })

  it('renders all four tab labels', () => {
    render(<App />)
    expect(screen.getByText('Live')).toBeInTheDocument()
    expect(screen.getByText('Backtest')).toBeInTheDocument()
    expect(screen.getByText('Journal')).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()
  })
})
