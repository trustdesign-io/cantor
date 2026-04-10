import { useRef } from 'react'
import { TeachMeModal } from '@/components/TeachMeModal'
import { useTeachMe } from '@/hooks/useTeachMe'
import { TEACH_TOPICS } from '@/lib/teachTopics'
import type { TeachTopicId } from '@/lib/teachTopics'

interface TeachMeButtonProps {
  topicId: TeachTopicId
  /** The current value of the element, included in the prompt for context. */
  currentValue: string
}

/**
 * A small `(?)` button that opens an Ollama-powered explanation modal.
 * Renders inline — place next to any dashboard element that benefits from teaching.
 */
export function TeachMeButton({ topicId, currentValue }: TeachMeButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { isOpen, topic, entry, model, open, close } = useTeachMe()

  const topicEntry = Object.values(TEACH_TOPICS).find(t => t.id === topicId)

  function handleOpen() {
    if (!topicEntry) return
    open(topicEntry, topicId, currentValue)
  }

  function handleClose() {
    close()
    // Return focus to the trigger that opened the modal
    triggerRef.current?.focus()
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        aria-label={`Learn about ${topicEntry?.label ?? topicId}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '9px',
          lineHeight: 1,
          flexShrink: 0,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="teach-me-btn"
      >
        ?
      </button>
      <TeachMeModal
        isOpen={isOpen}
        onClose={handleClose}
        topic={topic}
        entry={entry}
        model={model}
      />
    </>
  )
}
