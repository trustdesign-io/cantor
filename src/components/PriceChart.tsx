import { useEffect, useRef } from 'react'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { ema } from '@/indicators/ema'
import { EMA_FAST_PERIOD, EMA_SLOW_PERIOD } from '@/strategy/signals'
import { useTheme } from '@/hooks/useTheme'
import type { Candle } from '@/types'

interface PriceChartProps {
  candles: readonly Candle[]
}

// Candle and EMA colors are invariant across themes — charts keep a dark canvas
const EMA_FAST_COLOR = '#22d3ee' // --ema-fast
const EMA_SLOW_COLOR = '#f59e0b' // --ema-slow

function getChartColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    bg:   style.getPropertyValue('--chart-bg').trim()   || '#131720',
    grid: style.getPropertyValue('--chart-grid').trim() || '#2a3040',
    text: style.getPropertyValue('--chart-text').trim() || '#8892a4',
  }
}

export function PriceChart({ candles }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null)
  const emaFastSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)
  const emaSlowSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)

  const { theme } = useTheme()

  // Create the chart once on mount
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
      crosshair: {
        vertLine: { color: EMA_FAST_COLOR, labelBackgroundColor: EMA_FAST_COLOR },
        horzLine: { color: EMA_FAST_COLOR, labelBackgroundColor: EMA_FAST_COLOR },
      },
      rightPriceScale: {
        borderColor: grid,
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

    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
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

  // Re-apply theme colors when theme changes
  useEffect(() => {
    if (!chartRef.current) return
    const { bg, grid, text } = getChartColors()
    chartRef.current.applyOptions({
      layout: {
        background: { color: bg },
        textColor: text,
      },
      grid: {
        vertLines: { color: grid },
        horzLines: { color: grid },
      },
      rightPriceScale: { borderColor: grid },
      timeScale: { borderColor: grid },
    })
  }, [theme])

  // Update data whenever candles change
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
      role="img"
      aria-label={`Price chart with EMA ${EMA_FAST_PERIOD} and EMA ${EMA_SLOW_PERIOD} overlays`}
    />
  )
}
