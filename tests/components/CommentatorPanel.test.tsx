import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CommentatorPanel } from '@/components/CommentatorPanel'
import type { DashboardSnapshot } from '@/types/commentary'

// ── Mock useCommentator so the panel is testable in isolation ─────────────────

vi.mock('@/hooks/useCommentator', () => ({
  useCommentator: vi.fn(),
}))

import { useCommentator } from '@/hooks/useCommentator'
const mockedUseCommentator = vi.mocked(useCommentator)

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

function makeEntry(overrides: Partial<Parameters<typeof mockedUseCommentator>[0]> = {}) {
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
    const clearMock = vi.fn()
    mockedUseCommentator.mockReturnValue({
      entries: [],
      clearEntries: clearMock,
      model: 'llama3.2:3b',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when there are no entries', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText(/Events will appear here as the market moves/)).toBeInTheDocument()
  })

  it('renders the "LIVE COMMENTARY" header', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText(/Live Commentary/i)).toBeInTheDocument()
  })

  it('renders a model badge in the header', () => {
    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    // Badge is a <span> with the model name — use getAllByText and check at least one is the badge
    const matches = screen.getAllByText('llama3.2:3b')
    expect(matches.length).toBeGreaterThan(0)
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
      entries: [makeEntry({ text: 'Streaming...', streaming: true } as never)],
      clearEntries: vi.fn(),
      model: 'llama3.2:3b',
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    // The text content should appear even while streaming
    expect(screen.getByText('Streaming...')).toBeInTheDocument()
  })

  it('shows the error placeholder with a warning icon', () => {
    mockedUseCommentator.mockReturnValueOnce({
      entries: [makeEntry({ text: 'Commentary unavailable — is Ollama running on localhost:11434?', label: 'Error', streaming: false } as never)],
      clearEntries: vi.fn(),
      model: 'llama3.2:3b',
    })

    render(<CommentatorPanel snapshot={makeSnapshot()} />)
    expect(screen.getByText('Commentary unavailable — is Ollama running on localhost:11434?')).toBeInTheDocument()
    // Warning icon should be present in the label area
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
