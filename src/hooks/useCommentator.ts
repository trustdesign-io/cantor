import { useState, useEffect, useRef, useCallback } from 'react'
import { detectEvents } from '@/lib/detectEvents'
import { streamChat, OLLAMA_MODEL } from '@/lib/ollama'
import type { DashboardSnapshot, CommentaryEntry, CommentaryEvent } from '@/types/commentary'

/** System prompt used for all commentary generations */
const COMMENTARY_SYSTEM_PROMPT =
  'You are a trading coach explaining a paper trading dashboard to a beginner. ' +
  'Keep every response to 2 short sentences. Use plain English. ' +
  'Define any jargon inline. Never give buy/sell advice.'

/** Maximum number of entries kept in the rolling commentary buffer */
const MAX_BUFFER_SIZE = 50

/** Minimum ms between LLM generations — rapid events within this window are collapsed */
const DEBOUNCE_MS = 500

/** Placeholder shown when Ollama is unreachable */
const UNAVAILABLE_TEXT = 'Commentary unavailable — is Ollama running on localhost:11434?'

// ── Event labels ─────────────────────────────────────────────────────────────

function labelFor(event: CommentaryEvent): string {
  switch (event.kind) {
    case 'signal-change':
      return event.signal === 'BUY' ? 'Buy signal' : 'Sell signal'
    case 'filter-veto':
      return 'Signal vetoed'
    case 'ema-cross':
      return event.crossType === 'golden' ? 'Golden cross' : 'Death cross'
    case 'rsi-zone-enter':
      return event.zone === 'overbought' ? 'RSI overbought' : 'RSI oversold'
    case 'rsi-zone-exit':
      return event.zone === 'overbought' ? 'RSI exited overbought' : 'RSI exited oversold'
    case 'position-open':
      return 'Position opened'
    case 'position-close':
      return 'Position closed'
    case 'funding-threshold-cross':
      return event.direction === 'into-extreme'
        ? `Funding extreme (${event.crowded})`
        : `Funding normalised`
  }
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function promptFor(event: CommentaryEvent): string {
  const close = event.candleClose.toFixed(2)

  switch (event.kind) {
    case 'signal-change':
      return (
        `A ${event.signal} signal just fired. Price: $${close}. ` +
        `EMA 9 = ${event.emaFast.toFixed(2)}, EMA 21 = ${event.emaSlow.toFixed(2)}, RSI = ${event.rsi.toFixed(1)}. ` +
        `Briefly explain what this means for the paper trade.`
      )

    case 'filter-veto':
      return (
        `A ${event.baseSignal} signal was suppressed by the "${event.vetoedBy}" filter. ` +
        `Reason: "${event.reason}". Price: $${close}. ` +
        `Briefly explain why this filter blocked the trade.`
      )

    case 'ema-cross':
      return (
        `A ${event.crossType === 'golden' ? 'golden' : 'death'} cross just occurred. ` +
        `EMA 9 (${event.emaFast.toFixed(2)}) crossed ${event.crossType === 'golden' ? 'above' : 'below'} ` +
        `EMA 21 (${event.emaSlow.toFixed(2)}). RSI = ${event.rsi.toFixed(1)}, price = $${close}. ` +
        `Briefly explain what this crossover means.`
      )

    case 'rsi-zone-enter':
      return (
        `RSI just entered the ${event.zone} zone at ${event.rsi.toFixed(1)}. ` +
        `Price: $${close}. EMA 9 = ${event.emaFast.toFixed(2)}, EMA 21 = ${event.emaSlow.toFixed(2)}. ` +
        `Briefly explain what RSI ${event.zone} means for the current trend.`
      )

    case 'rsi-zone-exit':
      return (
        `RSI just exited the ${event.zone} zone, now at ${event.rsi.toFixed(1)}. ` +
        `Price: $${close}. Briefly explain what this means for momentum.`
      )

    case 'position-open': {
      const side = event.position.size > 0 ? 'long' : 'short'
      return (
        `A ${side} position was opened at $${event.position.entryPrice.toFixed(2)}. ` +
        `EMA 9 = ${event.emaFast.toFixed(2)}, EMA 21 = ${event.emaSlow.toFixed(2)}, ` +
        `RSI = ${event.rsi.toFixed(1)}. Briefly explain the entry conditions.`
      )
    }

    case 'position-close': {
      const direction = event.pnlPercent >= 0 ? 'profit' : 'loss'
      return (
        `The position was closed at $${event.exitPrice.toFixed(2)}, entered at $${event.entryPrice.toFixed(2)}. ` +
        `P&L: ${event.pnlPercent >= 0 ? '+' : ''}${event.pnlPercent.toFixed(2)}% (${direction}). ` +
        `Briefly explain what happened in this trade.`
      )
    }

    case 'funding-threshold-cross':
      return (
        `Perpetual funding rate ${event.direction === 'into-extreme' ? 'crossed into' : 'returned from'} extreme territory ` +
        `at ${(event.fundingRate * 100).toFixed(4)}% per 8h (${event.crowded} crowded). ` +
        `Price: $${close}. Briefly explain what extreme funding means.`
      )
  }
}

// ── ID generator ─────────────────────────────────────────────────────────────

let idCounter = 0
function nextId(): string {
  return `commentary-${Date.now()}-${++idCounter}`
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseCommentatorResult {
  entries: CommentaryEntry[]
  clearEntries: () => void
  model: string
}

/**
 * Subscribes to dashboard state changes, detects narratable events, and
 * streams LLM explanations for each event into a rolling buffer.
 *
 * - Debounces rapid successive events: events arriving within DEBOUNCE_MS of
 *   each other are collapsed into a single LLM call for the last event.
 * - Aborts in-flight generations when a newer event fires.
 * - Caps the buffer at MAX_BUFFER_SIZE entries (rolling, oldest removed first).
 * - Logs Ollama errors once per session and returns a placeholder entry.
 *
 * @param snapshot - Current dashboard state. Pass a stable reference to avoid
 *   unnecessary re-renders (useMemo the snapshot in the caller).
 */
export function useCommentator(snapshot: DashboardSnapshot): UseCommentatorResult {
  const [entries, setEntries] = useState<CommentaryEntry[]>([])

  const prevSnapshotRef = useRef<DashboardSnapshot | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorLoggedRef = useRef(false)

  const processEvent = useCallback(async (event: CommentaryEvent) => {
    // Abort any in-flight generation for a stale event
    abortControllerRef.current?.abort()
    const controller = new AbortController()
    abortControllerRef.current = controller

    const id = nextId()
    const label = labelFor(event)

    // Add placeholder entry immediately so the UI can show it streaming
    const newEntry: CommentaryEntry = {
      id,
      timestamp: event.timestamp,
      event,
      label,
      text: '',
      streaming: true,
    }

    setEntries(prev => {
      const updated = [...prev, newEntry]
      return updated.length > MAX_BUFFER_SIZE
        ? updated.slice(updated.length - MAX_BUFFER_SIZE)
        : updated
    })

    const prompt = promptFor(event)

    try {
      await streamChat({
        system: COMMENTARY_SYSTEM_PROMPT,
        user: prompt,
        signal: controller.signal,
        onToken: (delta) => {
          setEntries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, text: e.text + delta } : e
            )
          )
        },
        onDone: (fullText) => {
          setEntries(prev =>
            prev.map(e =>
              e.id === id ? { ...e, text: fullText, streaming: false } : e
            )
          )
        },
      })
    } catch (err) {
      // Ignore abort errors — these are intentional cancellations
      if (err instanceof Error && err.name === 'AbortError') return

      // Log Ollama errors once per session to avoid console spam
      if (!errorLoggedRef.current) {
        errorLoggedRef.current = true
        console.error('[useCommentator] Ollama error:', err)
      }

      setEntries(prev =>
        prev.map(e =>
          e.id === id
            ? { ...e, text: UNAVAILABLE_TEXT, streaming: false }
            : e
        )
      )
    }
  }, [])

  useEffect(() => {
    const prev = prevSnapshotRef.current
    prevSnapshotRef.current = snapshot

    // First render — no previous snapshot to diff against
    if (prev === null) return

    const detectedEvents = detectEvents(prev, snapshot)
    if (detectedEvents.length === 0) return

    // Use the last event if multiple fire simultaneously
    const event = detectedEvents[detectedEvents.length - 1]

    // Debounce: cancel any pending call and schedule a fresh one
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null
      void processEvent(event)
    }, DEBOUNCE_MS)
  }, [snapshot, processEvent])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const clearEntries = useCallback(() => setEntries([]), [])

  return { entries, clearEntries, model: OLLAMA_MODEL }
}
