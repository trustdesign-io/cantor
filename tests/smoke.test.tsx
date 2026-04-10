import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from '../src/App'

describe('App smoke test', () => {
  it('renders the nav brand label', () => {
    render(<App />)
    expect(screen.getAllByText('starter-local').length).toBeGreaterThan(0)
  })

  it('renders the Home route content', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'starter-local' })).toBeInTheDocument()
  })
})
