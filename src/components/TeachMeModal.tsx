import * as Dialog from '@radix-ui/react-dialog'
import { StreamingText } from '@/components/StreamingText'
import type { TeachEntry } from '@/hooks/useTeachMe'
import type { TeachTopic } from '@/lib/teachTopics'

interface TeachMeModalProps {
  isOpen: boolean
  onClose: () => void
  topic: TeachTopic | null
  entry: TeachEntry | null
  model: string
}

export function TeachMeModal({ isOpen, onClose, topic, entry, model }: TeachMeModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 40,
          }}
        />
        <Dialog.Content
          aria-describedby="teach-me-body"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '480px',
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: '70vh',
            borderRadius: '8px',
            padding: '24px',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <Dialog.Title
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {topic?.label ?? 'Learn'}
              </Dialog.Title>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                }}
              >
                {model}
              </span>
            </div>
            <Dialog.Close
              aria-label="Close explanation"
              style={{
                flexShrink: 0,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '2px 8px',
                fontSize: '12px',
                lineHeight: '20px',
              }}
            >
              ✕
            </Dialog.Close>
          </div>

          {/* Body */}
          <div
            id="teach-me-body"
            style={{
              flex: 1,
              overflowY: 'auto',
              fontSize: '13px',
              lineHeight: '1.6',
              color: 'var(--text-primary)',
            }}
          >
            {!entry ? (
              <span style={{ color: 'var(--text-secondary)' }}>Loading…</span>
            ) : (
              <StreamingText
                text={entry.text}
                streaming={entry.streaming}
                style={{ color: entry.text.includes('unavailable') ? 'var(--text-secondary)' : 'var(--text-primary)' }}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
