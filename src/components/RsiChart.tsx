import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import { rsi } from '@/indicators/rsi'
import { RSI_PERIOD, RSI_OVERBOUGHT, RSI_OVERSOLD } from '@/strategy/signals'
import { useTheme } from '@/hooks/useTheme'
import type { Candle } from '@/types'

interface RsiChartProps {
  candles: readonly Candle[]
}

const RSI_LINE_COLOR   = '#a78bfa'                    // --rsi-line
const OVERBOUGHT_COLOR = 'rgba(239, 68, 68, 0.35)'   // --loss, semi-transparent
const OVERSOLD_COLOR   = 'rgba(34, 197, 94, 0.35)'   // --win, semi-transparent

function getChartColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    bg:   style.getPropertyValue('--chart-bg').trim()   || '#131720',
    grid: style.getPropertyValue('--chart-grid').trim() || '#2a3040',
    text: style.getPropertyValue('--chart-text').trim() || '#8892a4',
  }
}

export function RsiChart({ candles }: RsiChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)

  const { theme } = useTheme()

  // Create the chart and series once on mount
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
        vertLine: { color: RSI_LINE_COLOR, labelBackgroundColor: RSI_LINE_COLOR },
        horzLine: { color: RSI_LINE_COLOR, labelBackgroundColor: RSI_LINE_COLOR },
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

    rsiSeriesRef.current = chart.addSeries(LineSeries, {
      color: RSI_LINE_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    rsiSeriesRef.current.createPriceLine({
      price: RSI_OVERBOUGHT,
      color: OVERBOUGHT_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `${RSI_OVERBOUGHT}`,
    })

    rsiSeriesRef.current.createPriceLine({
      price: RSI_OVERSOLD,
      color: OVERSOLD_COLOR,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: `${RSI_OVERSOLD}`,
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
      rsiSeriesRef.current = null
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

  // Update RSI data whenever candles change
  useEffect(() => {
    if (!rsiSeriesRef.current) return

    const closes = candles.map(c => c.close)
    const rsiValues = rsi(closes, RSI_PERIOD)

    const data = candles
      .map((c, i) => ({ time: c.time as Time, value: rsiValues[i] }))
      .filter(d => isFinite(d.value))

    rsiSeriesRef.current.setData(data)
  }, [candles])

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      role="img"
      aria-label={`RSI ${RSI_PERIOD} panel with ${RSI_OVERBOUGHT} overbought and ${RSI_OVERSOLD} oversold reference lines`}
    />
  )
}
