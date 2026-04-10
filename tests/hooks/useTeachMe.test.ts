import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTeachMe } from '@/hooks/useTeachMe'
import { TEACH_TOPICS } from '@/lib/teachTopics'

// ── Mock streamChat ───────────────────────────────────────────────────────────

vi.mock('@/lib/ollama', () => ({
  streamChat: vi.fn(),
  OLLAMA_MODEL: 'llama3.2:3b',
}))

import { streamChat } from '@/lib/ollama'
const mockedStreamChat = vi.mocked(streamChat)

// Clear the module-level cache between tests by re-importing the module
// (vitest isolates modules per file, so the cache is fresh for each test file run)

describe('useTeachMe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock: immediately calls onDone
    mockedStreamChat.mockImplementation(async ({ onToken, onDone }) => {
      onToken('Hello')
      onDone('Hello world')
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('starts closed with no topic', () => {
    const { result } = renderHook(() => useTeachMe())
    expect(result.current.isOpen).toBe(false)
    expect(result.current.topic).toBeNull()
    expect(result.current.entry).toBeNull()
  })

  it('opens with the correct topic when open() is called', async () => {
    const { result } = renderHook(() => useTeachMe())

    await act(async () => {
      result.current.open(TEACH_TOPICS.fundingRate, 'funding-rate', '+0.0100%')
    })

    expect(result.current.isOpen).toBe(true)
    expect(result.current.topic?.id).toBe('funding-rate')
  })

  it('sets entry.streaming=false after onDone fires', async () => {
    const { result } = renderHook(() => useTeachMe())

    await act(async () => {
      result.current.open(TEACH_TOPICS.fundingRate, 'funding-rate', '+0.0100%')
    })

    expect(result.current.entry?.streaming).toBe(false)
    expect(result.current.entry?.text).toBe('Hello world')
  })

  it('accumulates tokens during streaming', async () => {
    mockedStreamChat.mockImplementation(async ({ onToken, onDone }) => {
      onToken('Part1')
      onToken(' Part2')
      onDone('Part1 Part2')
    })

    const { result } = renderHook(() => useTeachMe())

    await act(async () => {
      result.current.open(TEACH_TOPICS.rsi, 'rsi', '55.0')
    })

    expect(result.current.entry?.text).toBe('Part1 Part2')
  })

  it('closes and sets isOpen=false when close() is called', async () => {
    const { result } = renderHook(() => useTeachMe())

    await act(async () => {
      result.current.open(TEACH_TOPICS.fundingRate, 'funding-rate', '+0.0100%')
    })

    act(() => {
      result.current.close()
    })

    expect(result.current.isOpen).toBe(false)
  })

  it('shows error text when streamChat rejects', async () => {
    mockedStreamChat.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useTeachMe())

    await act(async () => {
      result.current.open(TEACH_TOPICS.fearGreed, 'fear-greed', '75')
    })

    expect(result.current.entry?.text).toContain('unavailable')
    expect(result.current.entry?.streaming).toBe(false)
  })

  it('exposes the model name', () => {
    const { result } = renderHook(() => useTeachMe())
    expect(result.current.model).toBe('llama3.2:3b')
  })
})
