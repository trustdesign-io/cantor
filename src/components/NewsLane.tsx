import { useState, useCallback, useRef, useEffect } from 'react'
import { applyNewsFilters } from '@/lib/newsFilters'
import { streamChat } from '@/lib/ollama'
import { getPreferredModel } from '@/lib/modelPreference'
import type { NewsEvent, NewsCategory, NewsFilters } from '@/types/news'
import type { Candle } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_COLOURS: Record<NewsCategory, string> = {
  crypto:       '#a855f7', // purple
  macro:        '#eab308', // yellow
  geopolitical: '#ef4444', // red
  regulatory:   '#3b82f6', // blue
}

const CATEGORY_LABELS: Record<NewsCategory, string> = {
  crypto:       'Crypto',
  macro:        'Macro',
  geopolitical: 'Geo',
  regulatory:   'Reg',
}

const ALL_CATEGORIES: NewsCategory[] = ['crypto', 'macro', 'geopolitical', 'regulatory']

const LS_KEY_FILTERS = 'cantor.newsFilters'
const TOOLTIP_DEBOUNCE_MS = 500

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadFilters(): NewsFilters {
  try {
    const raw = localStorage.getItem(LS_KEY_FILTERS)
    if (raw) return JSON.parse(raw) as NewsFilters
  } catch { /* ignore */ }
  return {
    categories: { crypto: true, macro: true, geopolitical: true, regulatory: true },
    minImpact: 0,
  }
}

function saveFilters(f: NewsFilters): void {
  try { localStorage.setItem(LS_KEY_FILTERS, JSON.stringify(f)) } catch { /* ignore */ }
}

// ── Post-event price impact ────────────────────────────────────────────────────

interface EventImpact {
  h1: number | null
  h4: number | null
  h24: number | null
}

function computeImpact(event: NewsEvent, candles: readonly Candle[], intervalMins: number): EventImpact {
  const candlesPerHour = Math.round(60 / intervalMins)
  const idx = candles.findIndex(c => c.time >= event.time)
  if (idx < 0) return { h1: null, h4: null, h24: null }
  const baseClose = candles[idx]?.close
  if (baseClose == null || baseClose === 0) return { h1: null, h4: null, h24: null }

  function pct(offsetCandles: number): number | null {
    const target = candles[idx + offsetCandles]
    if (target == null) return null
    return ((target.close - baseClose) / baseClose) * 100
  }

  return {
    h1:  pct(candlesPerHour),
    h4:  pct(candlesPerHour * 4),
    h24: pct(candlesPerHour * 24),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NewsLaneProps {
  events: NewsEvent[]
  candles: readonly Candle[]
  /** Active interval in minutes, used to compute post-event price impact. */
  intervalMins: number
  /** Callback to tell the parent to scrub the chart to a given unix timestamp. */
  onScrubTo?: (time: number) => void
  /** Whether any data source is still loading. */
  loading?: boolean
}

interface TooltipState {
  event: NewsEvent
  x: number
  y: number
  summary: string | null
}

export function NewsLane({ events, candles, intervalMins, onScrubTo, loading }: NewsLaneProps) {
  const [filters, setFilters] = useState<NewsFilters>(loadFilters)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<NewsEvent | null>(null)
  const [selectedImpact, setSelectedImpact] = useState<EventImpact | null>(null)

  const summaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const summaryAbortRef = useRef<AbortController | null>(null)

  const filtered = applyNewsFilters(events, filters)

  // ── Filter handlers ──────────────────────────────────────────────────────────

  const toggleCategory = useCallback((cat: NewsCategory) => {
    setFilters(prev => {
      const next: NewsFilters = {
        ...prev,
        categories: { ...prev.categories, [cat]: !prev.categories[cat] },
      }
      saveFilters(next)
      return next
    })
  }, [])

  const handleImpactChange = useCallback((value: number) => {
    setFilters(prev => {
      const next: NewsFilters = { ...prev, minImpact: value }
      saveFilters(next)
      return next
    })
  }, [])

  // ── Tooltip / Ollama summary ─────────────────────────────────────────────────

  const clearTooltip = useCallback(() => {
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current)
    summaryAbortRef.current?.abort()
    setTooltip(null)
  }, [])

  const handleMarkerMouseEnter = useCallback((e: React.MouseEvent, event: NewsEvent) => {
    if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current)
    summaryAbortRef.current?.abort()

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTooltip({ event, x: rect.left, y: rect.top, summary: null })

    // Fire-and-forget Ollama summary after debounce
    summaryTimerRef.current = setTimeout(() => {
      const ac = new AbortController()
      summaryAbortRef.current = ac
      let text = ''
      streamChat({
        model: getPreferredModel(),
        system: 'You are a concise news analyst. Summarise the headline in one sentence (max 20 words). Plain English only.',
        user: event.title,
        onToken: chunk => {
          if (ac.signal.aborted) return
          text += chunk
          setTooltip(prev => prev?.event.id === event.id ? { ...prev, summary: text } : prev)
        },
        onDone: () => { /* summary complete */ },
        signal: ac.signal,
      }).catch(() => { /* Ollama unavailable — tooltip still shows without summary */ })
    }, TOOLTIP_DEBOUNCE_MS)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (summaryTimerRef.current) clearTimeout(summaryTimerRef.current)
      summaryAbortRef.current?.abort()
    }
  }, [])

  // ── Marker click: scrub chart + compute impact ────────────────────────────────

  const handleMarkerClick = useCallback((event: NewsEvent) => {
    const impact = computeImpact(event, candles, intervalMins)
    setSelectedEvent(event)
    setSelectedImpact(impact)
    onScrubTo?.(event.time)
  }, [candles, intervalMins, onScrubTo])

  const dismissSelected = useCallback(() => {
    setSelectedEvent(null)
    setSelectedImpact(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  const maxImpact = filtered.length > 0 ? Math.max(...filtered.map(e => e.impact)) : 10

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-surface)',
        borderTop: '1px solid var(--border)',
      }}
    >
      {/* Filter bar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <span className="mono-sm" style={{ color: 'var(--text-secondary)', marginRight: 4 }}>News</span>
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            type="button"
            aria-pressed={filters.categories[cat]}
            onClick={() => toggleCategory(cat)}
            className="px-2 py-0.5 rounded text-xs font-medium transition-opacity"
            style={{
              backgroundColor: filters.categories[cat]
                ? CATEGORY_COLOURS[cat]
                : 'var(--bg-elevated)',
              color: filters.categories[cat] ? 'var(--bg-base)' : 'var(--text-secondary)',
              border: `1px solid ${CATEGORY_COLOURS[cat]}`,
              opacity: filters.categories[cat] ? 1 : 0.5,
            }}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
        {/* Impact slider */}
        <label className="flex items-center gap-1.5 ml-auto" style={{ color: 'var(--text-secondary)' }}>
          <span className="mono-sm">Impact ≥</span>
          <input
            type="range"
            min={0}
            max={Math.max(maxImpact, 10)}
            step={1}
            value={filters.minImpact}
            onChange={e => handleImpactChange(Number(e.target.value))}
            aria-label="Minimum impact threshold"
            style={{ width: 80, accentColor: 'var(--accent)' }}
          />
          <span className="mono-sm" style={{ minWidth: 24 }}>{filters.minImpact}</span>
        </label>
        {loading && (
          <span className="mono-sm ml-2" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
            Loading…
          </span>
        )}
      </div>

      {/* Event markers area */}
      <div
        className="flex-1 relative overflow-x-auto overflow-y-hidden"
        style={{ minHeight: 0 }}
        role="list"
        aria-label="News events"
        onMouseLeave={clearTooltip}
      >
        {filtered.length === 0 ? (
          <div
            className="flex items-center justify-center h-full mono-sm"
            style={{ color: 'var(--text-secondary)', opacity: 0.5 }}
          >
            {loading ? 'Fetching news…' : 'No events match current filters'}
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 h-full">
            {filtered.map(event => {
              const color = CATEGORY_COLOURS[event.category]
              const isSelected = selectedEvent?.id === event.id
              return (
                <button
                  key={event.id}
                  type="button"
                  role="listitem"
                  aria-label={`${CATEGORY_LABELS[event.category]}: ${event.title}`}
                  onMouseEnter={e => handleMarkerMouseEnter(e, event)}
                  onMouseLeave={clearTooltip}
                  onClick={() => handleMarkerClick(event)}
                  style={{
                    flexShrink: 0,
                    width: 10,
                    height: 10,
                    borderRadius: event.category === 'macro' ? '0' : '50%',
                    backgroundColor: color,
                    border: isSelected ? `2px solid var(--text-primary)` : `1px solid ${color}`,
                    cursor: 'pointer',
                    opacity: event.impact < filters.minImpact ? 0.2 : 1,
                    transition: 'transform 0.1s',
                    transform: isSelected ? 'scale(1.5)' : 'scale(1)',
                  }}
                />
              )
            })}
          </div>
        )}

        {/* Hover tooltip */}
        {tooltip && (
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y - 120,
              zIndex: 50,
              maxWidth: 280,
              padding: '8px 10px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: CATEGORY_COLOURS[tooltip.event.category], marginBottom: 2 }}>
              {CATEGORY_LABELS[tooltip.event.category]} · {tooltip.event.source}
            </div>
            <div className="mono-sm" style={{ color: 'var(--text-primary)', marginBottom: tooltip.summary ? 4 : 0 }}>
              {tooltip.event.title}
            </div>
            {tooltip.summary && (
              <div className="mono-sm" style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                {tooltip.summary}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post-event price impact overlay */}
      {selectedEvent && selectedImpact && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            zIndex: 10,
            padding: '8px 12px',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            minWidth: 200,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="mono-sm" style={{ color: 'var(--text-secondary)' }}>
              {selectedEvent.title.slice(0, 40)}{selectedEvent.title.length > 40 ? '…' : ''}
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={dismissSelected}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </div>
          {[
            { label: '+1h',  val: selectedImpact.h1 },
            { label: '+4h',  val: selectedImpact.h4 },
            { label: '+24h', val: selectedImpact.h24 },
          ].map(({ label, val }) => (
            <div key={label} className="flex justify-between items-center">
              <span className="mono-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span
                className="mono-sm"
                style={{
                  color: val == null ? 'var(--text-secondary)'
                    : val >= 0 ? 'var(--win)' : 'var(--loss)',
                }}
              >
                {val == null ? '—' : `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
