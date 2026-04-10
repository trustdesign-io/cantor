import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts'
import type { ISeriesApi, Time } from 'lightweight-charts'
import { ema } from '@/indicators/ema'
import { EMA_FAST_PERIOD, EMA_SLOW_PERIOD } from '@/strategy/signals'
import type { Candle } from '@/types'

interface PriceChartProps {
  candles: readonly Candle[]
}

// CSS token values — static constants, resolved at module load
const EMA_FAST_COLOR = '#22d3ee' // --ema-fast
const EMA_SLOW_COLOR = '#f59e0b' // --ema-slow
const BG_SURFACE     = '#131720' // --bg-surface
const BORDER_COLOR   = '#2a3040' // --border
const TEXT_SECONDARY = '#8892a4' // --text-secondary

export function PriceChart({ candles }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Keep mutable refs to the series so we can update data without recreating the chart
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null)
  const emaFastSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const emaSlowSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

  // Create the chart once on mount
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      layout: {
        background: { color: BG_SURFACE },
        textColor: TEXT_SECONDARY,
      },
      grid: {
        vertLines: { color: BORDER_COLOR },
        horzLines: { color: BORDER_COLOR },
      },
      crosshair: {
        vertLine: { color: EMA_FAST_COLOR, labelBackgroundColor: EMA_FAST_COLOR },
        horzLine: { color: EMA_FAST_COLOR, labelBackgroundColor: EMA_FAST_COLOR },
      },
      rightPriceScale: {
        borderColor: BORDER_COLOR,
      },
      timeScale: {
        borderColor: BORDER_COLOR,
        timeVisible: true,
        secondsVisible: false,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    })

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',      // --win
      downColor: '#ef4444',    // --loss
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    })

    emaFastSeriesRef.current = chart.addSeries(LineSeries, {
      color: EMA_FAST_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    emaSlowSeriesRef.current = chart.addSeries(LineSeries, {
      color: EMA_SLOW_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    chartRef.current = chart

    // Resize observer keeps the chart filling its container on layout changes
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
      candleSeriesRef.current = null
      emaFastSeriesRef.current = null
      emaSlowSeriesRef.current = null
    }
  }, [])

  // Update data whenever candles change — no chart recreation, only setData calls
  useEffect(() => {
    if (
      !candleSeriesRef.current ||
      !emaFastSeriesRef.current ||
      !emaSlowSeriesRef.current
    ) return

    const candleData = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))

    candleSeriesRef.current.setData(candleData)

    const closes = candles.map(c => c.close)
    const emaFastValues = ema(closes, EMA_FAST_PERIOD)
    const emaSlowValues = ema(closes, EMA_SLOW_PERIOD)

    const emaFastData = candles
      .map((c, i) => ({ time: c.time as Time, value: emaFastValues[i] }))
      .filter(d => isFinite(d.value))

    const emaSlowData = candles
      .map((c, i) => ({ time: c.time as Time, value: emaSlowValues[i] }))
      .filter(d => isFinite(d.value))

    emaFastSeriesRef.current.setData(emaFastData)
    emaSlowSeriesRef.current.setData(emaSlowData)
  }, [candles])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      aria-label="Price chart with EMA 9 and EMA 21 overlays"
    />
  )
}
