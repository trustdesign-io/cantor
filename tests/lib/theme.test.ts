import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement } from 'react'
import { ThemeProvider, useThemeContext } from '@/lib/theme'

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(ThemeProvider, null, children)
}

describe('ThemeProvider / useThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  afterEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('defaults to dark theme when nothing is stored', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    expect(result.current.theme).toBe('dark')
  })

  it('reads stored light theme from localStorage', () => {
    localStorage.setItem('cantor.theme', 'light')
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    expect(result.current.theme).toBe('light')
  })

  it('toggleTheme flips dark → light', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    expect(result.current.theme).toBe('dark')
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
  })

  it('toggleTheme flips light → dark', () => {
    localStorage.setItem('cantor.theme', 'light')
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('setTheme explicitly sets the theme', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    act(() => result.current.setTheme('light'))
    expect(result.current.theme).toBe('light')
  })

  it('persists theme choice to localStorage', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    act(() => result.current.toggleTheme())
    expect(localStorage.getItem('cantor.theme')).toBe('light')
  })

  it('sets data-theme="light" on documentElement when switching to light', () => {
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    act(() => result.current.setTheme('light'))
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('removes data-theme attribute when switching to dark', () => {
    localStorage.setItem('cantor.theme', 'light')
    document.documentElement.dataset.theme = 'light'
    const { result } = renderHook(() => useThemeContext(), { wrapper })
    act(() => result.current.setTheme('dark'))
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('throws when used outside ThemeProvider', () => {
    expect(() => {
      renderHook(() => useThemeContext())
    }).toThrow('useThemeContext must be used inside ThemeProvider')
  })
})
