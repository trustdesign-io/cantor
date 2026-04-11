import { useState, useEffect, useMemo } from 'react'
import { fetchFearGreedHistory } from '@/data/fearGreedHistory'
import { useLongShortRatio } from '@/hooks/useLongShortRatio'
import { stepInterpolate, detectDivergences } from '@/lib/sentimentUtils'
import type { TimeValue, DivergenceEvent } from '@/lib/sentimentUtils'
import type { Candle } from '@/types'

/** Refresh interval for F&G history — hourly (index only updates daily). */
const REFRESH_MS = 60 * 60 * 1000

interface SentimentData {
  /** F&G values step-interpolated to candle timestamps. */
  fearGreedSeries: TimeValue[]
  /** Binance long/short ratio series. */
  longShortSeries: TimeValue[]
  /** Detected divergence events. */
  divergences: DivergenceEvent[]
}

/**
 * Aggregates all sentiment series for the SentimentChart pane.
 *
 * @param pair    - Active trading pair (for pair-aware long/short ratio)
 * @param candles - Current candle data (for interpolation alignment and divergence)
 */
export function useSentimentData(pair: string, candles: readonly Candle[]): SentimentData {
  const [fgHistory, setFgHistory] = useState<TimeValue[]>([])

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const data = await fetchFearGreedHistory()
      if (!cancelled) setFgHistory(data)
    }

    void refresh()
    const id = setInterval(() => { void refresh() }, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const { series: longShortSeries } = useLongShortRatio(pair)

  const fearGreedSeries = useMemo(
    () => stepInterpolate(fgHistory, candles),
    [fgHistory, candles]
  )

  const divergences = useMemo<DivergenceEvent[]>(() => {
    if (fearGreedSeries.length === 0) return []
    const priceValues: TimeValue[] = candles.map(c => ({ time: c.time, value: c.close }))
    return detectDivergences(priceValues, fearGreedSeries)
  }, [candles, fearGreedSeries])

  return { fearGreedSeries, longShortSeries, divergences }
}
