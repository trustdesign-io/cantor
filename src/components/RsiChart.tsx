import { useEffect, useRef } from 'react'
import {
  createChart,
  LineSeries,
  LineStyle,
} from 'lightweight-charts'
import type { ISeriesApi, Time } from 'lightweight-charts'
import { rsi } from '@/indicators/rsi'
import { RSI_PERIOD, RSI_OVERBOUGHT, RSI_OVERSOLD } from '@/strategy/signals'
import type { Candle } from '@/types'

interface RsiChartProps {
  candles: readonly Candle[]
}

// CSS token values
const RSI_LINE_COLOR  = '#a78bfa' // --rsi-line
const BG_SURFACE      = '#131720' // --bg-surface
const BORDER_COLOR    = '#2a3040' // --border
const TEXT_SECONDARY  = '#8892a4' // --text-secondary
const OVERBOUGHT_COLOR = 'rgba(239, 68, 68, 0.35)'  // --loss, semi-transparent
const OVERSOLD_COLOR   = 'rgba(34, 197, 94, 0.35)'  // --win, semi-transparent

export function RsiChart({ candles }: RsiChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rsiSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null)

  // Create the chart and series once on mount
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
        vertLine: { color: RSI_LINE_COLOR, labelBackgroundColor: RSI_LINE_COLOR },
        horzLine: { color: RSI_LINE_COLOR, labelBackgroundColor: RSI_LINE_COLOR },
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

    rsiSeriesRef.current = chart.addSeries(LineSeries, {
      color: RSI_LINE_COLOR,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    // Horizontal reference lines at the overbought and oversold thresholds
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
      rsiSeriesRef.current = null
    }
  }, [])

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
