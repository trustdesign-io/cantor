import { useRef, useEffect, useCallback } from 'react'
import { StreamingText } from '@/components/StreamingText'
import { useCommentator } from '@/hooks/useCommentator'
import type { DashboardSnapshot } from '@/types/commentary'

/** Scrolls to the bottom sentinel unless the user has scrolled up more than this */
const STICK_THRESHOLD_PX = 40

interface CommentatorPanelProps {
  snapshot: DashboardSnapshot
}

function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function CommentatorPanel({ snapshot }: CommentatorPanelProps) {
  const { entries, clearEntries, model } = useCommentator(snapshot)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const stickToBottomRef = useRef(true)

  // Track whether the user has scrolled up away from the bottom
  const onScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom <= STICK_THRESHOLD_PX
  }, [])

  // Auto-scroll when new entries arrive, respecting the user's scroll position
  useEffect(() => {
    if (stickToBottomRef.current && sentinelRef.current) {
      sentinelRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [entries])

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 180,
        maxHeight: 320,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}
      >
        <span
          className="text-xs font-medium uppercase tracking-widest"
          style={{ color: 'var(--text-secondary)' }}
        >
          Live Commentary
        </span>
        <div className="flex items-center gap-2">
          {/* Model badge */}
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--text-secondary)',
              background: 'var(--bg-elevated)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
            }}
          >
            {model}
          </span>
          {/* Clear button */}
          <button
            onClick={clearEntries}
            aria-label="Clear commentary"
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              lineHeight: 1.4,
            }}
          >
            clear
          </button>
        </div>
      </div>

      {/* Scrollable entry list */}
      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        style={{ flex: '1 1 0', overflowY: 'auto', minHeight: 0 }}
        role="log"
        aria-label="Live commentary feed"
        aria-live="polite"
      >
        {entries.length === 0 ? (
          <div
            className="px-3 py-3 text-xs"
            style={{ color: 'var(--text-secondary)' }}
          >
            Events will appear here as the market moves. Make sure Ollama is running
            with <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>llama3.2:3b</code>.
          </div>
        ) : (
          <div className="flex flex-col">
            {entries.map(entry => {
              const isError = entry.text.startsWith('Commentary unavailable')
              return (
                <div
                  key={entry.id}
                  className="px-3 py-2"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span
                      className="text-xs tabular-nums"
                      style={{
                        color: 'var(--text-secondary)',
                        fontFamily: 'JetBrains Mono, monospace',
                        flexShrink: 0,
                      }}
                    >
                      {formatTime(entry.timestamp)}
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: isError ? 'var(--loss)' : 'var(--text-primary)' }}
                    >
                      {isError && (
                        <span aria-hidden="true" style={{ marginRight: '0.3em' }}>⚠</span>
                      )}
                      {entry.label}
                    </span>
                  </div>
                  <StreamingText
                    text={entry.text}
                    streaming={entry.streaming}
                    className="text-xs"
                    style={{ color: isError ? 'var(--loss)' : 'var(--text-secondary)' }}
                  />
                </div>
              )
            })}
          </div>
        )}
        {/* Bottom sentinel for auto-scroll */}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>
    </div>
  )
}
