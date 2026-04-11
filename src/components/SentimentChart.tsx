import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  AreaSeries,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, ISeriesMarkersPluginApi, Time, SeriesMarker } from 'lightweight-charts'
import { useTheme } from '@/hooks/useTheme'
import type { TimeValue, DivergenceEvent } from '@/lib/sentimentUtils'

// ── Constants ─────────────────────────────────────────────────────────────────

const GREED_COLOR = '#22c55e'   // extreme greed

const LS_KEY_SERIES = 'cantor.sentimentSeries'

interface SeriesVisibility {
  fearGreed: boolean
  longShort: boolean
}

function loadVisibility(): SeriesVisibility {
  try {
    const raw = localStorage.getItem(LS_KEY_SERIES)
    if (raw) return JSON.parse(raw) as SeriesVisibility
  } catch { /* ignore */ }
  return { fearGreed: true, longShort: true }
}

function saveVisibility(v: SeriesVisibility): void {
  try { localStorage.setItem(LS_KEY_SERIES, JSON.stringify(v)) } catch { /* ignore */ }
}

function getChartColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    bg:   style.getPropertyValue('--chart-bg').trim()   || '#131720',
    grid: style.getPropertyValue('--chart-grid').trim() || '#2a3040',
    text: style.getPropertyValue('--chart-text').trim() || '#8892a4',
  }
}

/** Map an F&G value 0–100 to a CSS color string blending fear ↔ greed. */
function fgColor(value: number): string {
  // value 0 → red, 50 → neutral (#8892a4), 100 → green
  if (value <= 50) {
    const t = value / 50
    const r = Math.round(239 + (136 - 239) * t)
    const g = Math.round(68  + (146 - 68)  * t)
    const b = Math.round(68  + (164 - 68)  * t)
    return `rgb(${r},${g},${b})`
  } else {
    const t = (value - 50) / 50
    const r = Math.round(136 + (34  - 136) * t)
    const g = Math.round(146 + (197 - 146) * t)
    const b = Math.round(164 + (94  - 164) * t)
    return `rgb(${r},${g},${b})`
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface SentimentChartProps {
  /** Fear & Greed step-interpolated series aligned to candle timestamps. */
  fearGreedSeries: TimeValue[]
  /** Binance long/short ratio series. */
  longShortSeries: TimeValue[]
  /** Detected divergence events from detectDivergences(). */
  divergences: DivergenceEvent[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SentimentChart({ fearGreedSeries, longShortSeries, divergences }: SentimentChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const fgSeriesRef = useRef<ISeriesApi<'Area', Time> | null>(null)
  const lsSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const markersApiRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

  const { theme } = useTheme()
  const [visibility, setVisibility] = useState<SeriesVisibility>(loadVisibility)

  // Create chart once on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const { bg, grid, text } = getChartColors()

    const chart = createChart(container, {
      layout: {
        background: { color: bg },
        textColor: text,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: {
        borderColor: grid,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: grid,
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    })

    chartRef.current = chart

    // Fear & Greed — AreaSeries for gradient fill
    fgSeriesRef.current = chart.addSeries(AreaSeries, {
      lineColor:   GREED_COLOR,
      topColor:    'rgba(34, 197, 94, 0.35)',
      bottomColor: 'rgba(239, 68, 68, 0.1)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    // Long/short ratio — LineSeries on a separate scale
    lsSeriesRef.current = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
      priceScaleId: 'ls',
    })
    chart.priceScale('ls').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderColor: grid,
    })

    // Markers for divergences
    markersApiRef.current = createSeriesMarkers(fgSeriesRef.current, [])

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        chart.resize(entry.contentRect.width, entry.contentRect.height)
      }
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      fgSeriesRef.current = null
      lsSeriesRef.current = null
      markersApiRef.current = null
    }
  }, [])

  // Re-apply theme
  useEffect(() => {
    if (!chartRef.current) return
    const { bg, grid, text } = getChartColors()
    chartRef.current.applyOptions({
      layout: { background: { color: bg }, textColor: text },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid },
    })
    chartRef.current.priceScale('ls').applyOptions({ borderColor: grid })
  }, [theme])

  // Update Fear & Greed data
  useEffect(() => {
    if (!fgSeriesRef.current) return
    const data = fearGreedSeries.map(tv => ({
      time: tv.time as Time,
      value: tv.value,
    }))
    fgSeriesRef.current.setData(data)
    // Update line color based on latest F&G value
    const last = fearGreedSeries[fearGreedSeries.length - 1]
    if (last != null) {
      fgSeriesRef.current.applyOptions({ lineColor: fgColor(last.value) })
    }
  }, [fearGreedSeries])

  // Update Long/Short data
  useEffect(() => {
    if (!lsSeriesRef.current) return
    lsSeriesRef.current.setData(
      longShortSeries.map(tv => ({ time: tv.time as Time, value: tv.value }))
    )
  }, [longShortSeries])

  // Update divergence markers
  useEffect(() => {
    if (!markersApiRef.current) return
    const markers: SeriesMarker<Time>[] = divergences.map(d => ({
      time: d.time as Time,
      position: d.direction === 'bullish' ? 'belowBar' : 'aboveBar',
      color: d.direction === 'bullish' ? '#22c55e' : '#ef4444',
      shape: d.direction === 'bullish' ? 'arrowUp' : 'arrowDown',
      text: `${d.direction === 'bullish' ? '▲' : '▼'} ${Math.abs(d.pricePct).toFixed(1)}%`,
    }))
    markersApiRef.current.setMarkers(markers)
  }, [divergences])

  // Visibility toggles
  useEffect(() => {
    fgSeriesRef.current?.applyOptions({ visible: visibility.fearGreed })
    lsSeriesRef.current?.applyOptions({ visible: visibility.longShort })
  }, [visibility])

  const toggle = useCallback((key: keyof SeriesVisibility) => {
    setVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] }
      saveVisibility(next)
      return next
    })
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Legend / toggle bar */}
      <div
        className="flex items-center gap-2 px-3 py-1 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          type="button"
          aria-pressed={visibility.fearGreed}
          aria-label={`Fear/Greed series ${visibility.fearGreed ? 'visible' : 'hidden'}`}
          onClick={() => toggle('fearGreed')}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all"
          style={{
            border: `1px solid ${GREED_COLOR}`,
            backgroundColor: visibility.fearGreed ? 'rgba(34,197,94,0.15)' : 'transparent',
            color: visibility.fearGreed ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 2, backgroundColor: GREED_COLOR, display: 'inline-block', borderRadius: 1 }} />
          Fear/Greed
        </button>
        <button
          type="button"
          aria-pressed={visibility.longShort}
          aria-label={`Long/Short ratio series ${visibility.longShort ? 'visible' : 'hidden'}`}
          onClick={() => toggle('longShort')}
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all"
          style={{
            border: '1px solid #f59e0b',
            backgroundColor: visibility.longShort ? 'rgba(245,158,11,0.15)' : 'transparent',
            color: visibility.longShort ? 'var(--text-primary)' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <span style={{ width: 8, height: 2, backgroundColor: '#f59e0b', display: 'inline-block', borderRadius: 1 }} />
          L/S Ratio
        </button>
        {divergences.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-secondary)' }}>
            {divergences.length} divergence{divergences.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* Chart canvas */}
      <div
        ref={containerRef}
        className="flex-1"
        role="img"
        aria-label="Sentiment chart: Crypto Fear & Greed Index and Long/Short ratio"
      />
    </div>
  )
}
