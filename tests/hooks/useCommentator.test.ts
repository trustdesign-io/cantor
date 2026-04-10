import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommentator } from '@/hooks/useCommentator'
import type { DashboardSnapshot } from '@/types/commentary'

// ── Mock ollama ───────────────────────────────────────────────────────────────

vi.mock('@/lib/ollama', () => ({
  OLLAMA_MODEL: 'llama3.2:3b',
  streamChat: vi.fn(),
}))

import { streamChat } from '@/lib/ollama'
const mockedStreamChat = vi.mocked(streamChat)

// ── Snapshot helpers ──────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<DashboardSnapshot> = {}): DashboardSnapshot {
  return {
    signal: 'HOLD',
    baseSignal: 'HOLD',
    vetoedBy: undefined,
    vetoReason: undefined,
    emaFast: 50_000,
    emaSlow: 49_000,
    rsi: 50,
    candleClose: 50_000,
    position: null,
    fundingRate: 0.0005,
    fearGreedIndex: 50,
    ...overrides,
  }
}

describe('useCommentator', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockedStreamChat.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('starts with an empty buffer', () => {
    const { result } = renderHook(() =>
      useCommentator(makeSnapshot())
    )
    expect(result.current.entries).toEqual([])
  })

  it('does not call streamChat on the first render (no prev snapshot)', async () => {
    renderHook(() => useCommentator(makeSnapshot()))
    await act(async () => { vi.runAllTimers() })
    expect(mockedStreamChat).not.toHaveBeenCalled()
  })

  it('calls streamChat when a narratable event is detected', async () => {
    const initial = makeSnapshot({ signal: 'HOLD' })
    const { rerender } = renderHook(
      ({ snap }: { snap: DashboardSnapshot }) => useCommentator(snap),
      { initialProps: { snap: initial } }
    )

    const next = makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' })
    rerender({ snap: next })

    // Advance past the debounce timer
    await act(async () => { vi.advanceTimersByTime(600) })

    expect(mockedStreamChat).toHaveBeenCalledOnce()
  })

  it('does not call streamChat when nothing narratable changed', async () => {
    const snap = makeSnapshot()
    const { rerender } = renderHook(
      ({ s }: { s: DashboardSnapshot }) => useCommentator(s),
      { initialProps: { s: snap } }
    )
    rerender({ s: { ...snap } })

    await act(async () => { vi.advanceTimersByTime(600) })

    expect(mockedStreamChat).not.toHaveBeenCalled()
  })

  it('debounces rapid events — only calls streamChat once for events <500ms apart', async () => {
    const initial = makeSnapshot({ signal: 'HOLD' })
    const { rerender } = renderHook(
      ({ s }: { s: DashboardSnapshot }) => useCommentator(s),
      { initialProps: { s: initial } }
    )

    // Fire two events within 300ms (both < DEBOUNCE_MS = 500ms)
    rerender({ s: makeSnapshot({ signal: 'BUY', baseSignal: 'BUY', candleClose: 50_001 }) })
    await act(async () => { vi.advanceTimersByTime(100) })

    rerender({ s: makeSnapshot({ signal: 'SELL', baseSignal: 'SELL', candleClose: 50_002 }) })
    await act(async () => { vi.advanceTimersByTime(600) })

    // Only one call should have been made (the last event wins)
    expect(mockedStreamChat).toHaveBeenCalledOnce()
  })

  it('adds a streaming entry to the buffer while generation is in progress', async () => {
    // streamChat that resolves immediately (placeholder while streaming)
    mockedStreamChat.mockResolvedValueOnce(undefined)

    const initial = makeSnapshot()
    const { result, rerender } = renderHook(
      ({ s }: { s: DashboardSnapshot }) => useCommentator(s),
      { initialProps: { s: initial } }
    )

    rerender({ s: makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' }) })

    // The entry is added synchronously before streamChat resolves
    await act(async () => {
      vi.advanceTimersByTime(600)
      // Flush pending microtasks
      await Promise.resolve()
    })

    expect(result.current.entries.length).toBeGreaterThan(0)
  })

  it('marks entry as not streaming after onDone fires', async () => {
    mockedStreamChat.mockImplementationOnce(async ({ onToken, onDone }) => {
      onToken('full text')
      onDone('full text')
    })

    const initial = makeSnapshot()
    const { result, rerender } = renderHook(
      ({ s }: { s: DashboardSnapshot }) => useCommentator(s),
      { initialProps: { s: initial } }
    )

    rerender({ s: makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' }) })

    await act(async () => {
      vi.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })

    const doneEntry = result.current.entries.find(e => !e.streaming)
    expect(doneEntry?.text).toBe('full text')
  })

  it('clearEntries empties the buffer', async () => {
    mockedStreamChat.mockImplementationOnce(async ({ onToken, onDone }) => {
      onToken('hi')
      onDone('hi')
    })

    const initial = makeSnapshot()
    const { result, rerender } = renderHook(
      ({ s }: { s: DashboardSnapshot }) => useCommentator(s),
      { initialProps: { s: initial } }
    )

    rerender({ s: makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' }) })
    await act(async () => {
      vi.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(result.current.entries.length).toBeGreaterThan(0)

    act(() => result.current.clearEntries())
    expect(result.current.entries).toEqual([])
  })

  it('shows placeholder entry when Ollama fetch fails', async () => {
    mockedStreamChat.mockRejectedValueOnce(new Error('Network error'))

    const initial = makeSnapshot()
    const { result, rerender } = renderHook(
      ({ s }: { s: DashboardSnapshot }) => useCommentator(s),
      { initialProps: { s: initial } }
    )

    rerender({ s: makeSnapshot({ signal: 'BUY', baseSignal: 'BUY' }) })

    await act(async () => {
      vi.advanceTimersByTime(600)
      await Promise.resolve()
      await Promise.resolve()
    })

    const placeholderEntry = result.current.entries.find(e =>
      e.text.includes('Commentary unavailable')
    )
    expect(placeholderEntry).toBeDefined()
  })
})
