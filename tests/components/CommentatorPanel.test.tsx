import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommentatorPanel } from '@/components/CommentatorPanel'
import type { DashboardSnapshot } from '@/types/commentary'

// ── Mock useCommentator so the panel is testable in isolation ─────────────────

vi.mock('@/hooks/useCommentator', () => ({
  useCommentator: vi.fn(),
}))

// ── Mock useOllamaModels so no real network calls are made ────────────────────

vi.mock('@/hooks/useOllamaModels', () => ({
  useOllamaModels: vi.fn(),
}))

import { useCommentator } from '@/hooks/useCommentator'
import { useOllamaModels } from '@/hooks/useOllamaModels'
import type { CommentaryEntry } from '@/types/commentary'

const mockedUseCommentator = vi.mocked(useCommentator)
const mockedUseOllamaModels = vi.mocked(useOllamaModels)

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    fundingRate: null,
    fearGreedIndex: null,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<CommentaryEntry> = {}): CommentaryEntry {
  return {
    id: 'test-1',
    timestamp: new Date('2024-01-01T12:00:00').getTime(),
    event: { kind: 'ema-cross' as const, timestamp: Date.now(), candleClose: 50_000, crossType: 'golden' as const, emaFast: 50_000, emaSlow: 49_000, rsi: 50 },
    label: 'Golden cross',
    text: 'A golden cross just occurred.',
    streaming: false,
    ...overrides,
  }
}

describe('CommentatorPanel', () => {
  beforeEach(() => {
    localStorage.clear()

    mockedUseCommentator.mockReturnValue({
      entries: [],
      clearEntries: vi.fn(),
      model: 'llama3.2:3b',
    })

    mockedUseOllamaModels.mockReturnValue({
      models: ['llama3.2:3b', 'qwen2.5:7b'],
      loading: false,
      error: false,
      refetch: vi.fn(),
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders empty state when there are no entries', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText(/Events will appear here as the market moves/)).toBeInTheDocument()
  })

  it('renders the "LIVE COMMENTARY" header', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText(/Live Commentary/i)).toBeInTheDocument()
  })

  it('renders a model dropdown in the header', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    const select = screen.getByRole('combobox', { name: /ollama model/i })
    expect(select).toBeInTheDocument()
  })

  it('shows available models in the dropdown', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByRole('option', { name: 'llama3.2:3b' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'qwen2.5:7b' })).toBeInTheDocument()
  })

  it('selecting a new model persists to localStorage', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    const select = screen.getByRole('combobox', { name: /ollama model/i })
    fireEvent.change(select, { target: { value: 'qwen2.5:7b' } })
    expect(localStorage.getItem('cantor.ollamaModel')).toBe('qwen2.5:7b')
  })

  it('dropdown is disabled when Ollama is unreachable', () => {
    mockedUseOllamaModels.mockReturnValue({
      models: [],
      loading: false,
      error: true,
      refetch: vi.fn(),
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    const select = screen.getByRole('combobox', { name: /ollama model/i })
    expect(select).toBeDisabled()
  })

  it('renders a completed entry with label and text', () => {
    mockedUseCommentator.mockReturnValueOnce({
      entries: [makeEntry()],
      clearEntries: vi.fn(),
      model: 'llama3.2:3b',
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText('Golden cross')).toBeInTheDocument()
    expect(screen.getByText('A golden cross just occurred.')).toBeInTheDocument()
  })

  it('renders a streaming entry with visible text (cursor is aria-hidden)', () => {
    mockedUseCommentator.mockReturnValueOnce({
      entries: [makeEntry({ text: 'Streaming...', streaming: true })],
      clearEntries: vi.fn(),
      model: 'llama3.2:3b',
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText('Streaming...')).toBeInTheDocument()
  })

  it('shows the error placeholder with a warning icon', () => {
    mockedUseCommentator.mockReturnValueOnce({
      entries: [makeEntry({ text: 'Commentary unavailable — is Ollama running on localhost:11434?', label: 'Error', streaming: false })],
      clearEntries: vi.fn(),
      model: 'llama3.2:3b',
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText('Commentary unavailable — is Ollama running on localhost:11434?')).toBeInTheDocument()
    expect(screen.getByText('⚠', { exact: false })).toBeInTheDocument()
  })

  it('calls clearEntries when the clear button is clicked', () => {
    const clearMock = vi.fn()
    mockedUseCommentator.mockReturnValueOnce({
      entries: [makeEntry()],
      clearEntries: clearMock,
      model: 'llama3.2:3b',
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    fireEvent.click(screen.getByRole('button', { name: /clear/i }))
    expect(clearMock).toHaveBeenCalledOnce()
  })

  it('has a log role for accessibility', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByRole('log')).toBeInTheDocument()
  })
})
