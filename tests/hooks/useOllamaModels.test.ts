import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('@/lib/ollama', () => ({
  listModels: vi.fn(),
  OLLAMA_MODEL: 'llama3.2:3b',
  streamChat: vi.fn(),
}))

import { useOllamaModels } from '@/hooks/useOllamaModels'
import { listModels } from '@/lib/ollama'
const mockedListModels = vi.mocked(listModels)

describe('useOllamaModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls listModels on mount and returns model names', async () => {
    mockedListModels.mockResolvedValue(['llama3.2:3b', 'qwen2.5:7b'])

    const { result } = renderHook(() => useOllamaModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.models).toEqual(['llama3.2:3b', 'qwen2.5:7b'])
    expect(result.current.error).toBe(false)
  })

  it('starts with loading=true before the fetch resolves', () => {
    mockedListModels.mockImplementation(() => new Promise(() => { /* never resolves */ }))

    const { result } = renderHook(() => useOllamaModels())

    expect(result.current.loading).toBe(true)
  })

  it('sets error=true when listModels returns an empty array', async () => {
    mockedListModels.mockResolvedValue([])

    const { result } = renderHook(() => useOllamaModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.error).toBe(true)
    expect(result.current.models).toEqual([])
  })

  it('refetch re-calls listModels and updates the model list', async () => {
    mockedListModels.mockResolvedValue(['llama3.2:3b'])

    const { result } = renderHook(() => useOllamaModels())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    mockedListModels.mockResolvedValue(['llama3.2:3b', 'qwen2.5:7b'])

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => {
      expect(result.current.models).toEqual(['llama3.2:3b', 'qwen2.5:7b'])
    })
  })
})
