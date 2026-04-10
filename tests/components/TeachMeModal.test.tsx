import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TeachMeModal } from '@/components/TeachMeModal'
import { TEACH_TOPICS } from '@/lib/teachTopics'
import type { TeachEntry } from '@/hooks/useTeachMe'

// ── Radix Dialog uses ResizeObserver and pointer events — jsdom stubs needed ──
// ResizeObserver is already stubbed globally in tests/setup.ts

const DEFAULT_TOPIC = TEACH_TOPICS.fundingRate
const DEFAULT_ENTRY: TeachEntry = { text: 'Funding rate explained.', streaming: false }

function renderModal(overrides: {
  isOpen?: boolean
  topic?: typeof DEFAULT_TOPIC | null
  entry?: TeachEntry | null
  onClose?: () => void
} = {}) {
  const onClose = overrides.onClose ?? vi.fn()
  render(
    <TeachMeModal
      isOpen={overrides.isOpen ?? true}
      onClose={onClose}
      topic={'topic' in overrides ? overrides.topic ?? null : DEFAULT_TOPIC}
      entry={'entry' in overrides ? overrides.entry ?? null : DEFAULT_ENTRY}
      model="llama3.2:3b"
    />
  )
  return { onClose }
}

describe('TeachMeModal', () => {
  it('does not render dialog content when isOpen=false', () => {
    renderModal({ isOpen: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders dialog with topic label as title when open', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Funding Rate')).toBeInTheDocument()
  })

  it('renders the explanation text', () => {
    renderModal()
    expect(screen.getByText('Funding rate explained.')).toBeInTheDocument()
  })

  it('renders a streaming entry with blinking cursor', () => {
    renderModal({ entry: { text: 'Streaming text', streaming: true } })
    expect(screen.getByText('Streaming text')).toBeInTheDocument()
  })

  it('shows loading state when entry is null', () => {
    renderModal({ entry: null })
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/loading/i)
  })

  it('calls onClose when the close button is clicked', () => {
    const { onClose } = renderModal()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows the model badge', () => {
    renderModal()
    expect(screen.getByText('llama3.2:3b')).toBeInTheDocument()
  })

  it('has role="dialog" for accessibility', () => {
    renderModal()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
