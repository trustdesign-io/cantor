import { useState, useEffect } from 'react'
import type { TimeValue } from '@/lib/sentimentUtils'

/**
 * Binance futures Global Long/Short Account Ratio.
 * Endpoint: GET /futures/data/globalLongShortAccountRatio
 * Docs: https://developers.binance.com/docs/derivatives/usds-margined-futures/market-data/rest-api/Long-Short-Ratio
 *
 * Returns the ratio at 5m resolution for the last 500 bars.
 */
const BASE = 'https://fapi.binance.com'
const ENDPOINT = '/futures/data/globalLongShortAccountRatio'

/** Refresh every 5 minutes — matching the 5m resolution. */
const REFRESH_MS = 5 * 60 * 1000

interface BinanceLsEntry {
  symbol: string
  longShortRatio: string  // as string in the API
  longAccount: string
  shortAccount: string
  timestamp: number
}

/** Map a Cantor pair like 'XBT/USDT' to a Binance futures symbol like 'BTCUSDT'. */
function pairToSymbol(pair: string): string {
  return pair.replace('XBT', 'BTC').replace('/', '')
}

/**
 * Fetch and cache the global long/short account ratio for the given pair.
 * Returns an empty array while loading or on error.
 */
export function useLongShortRatio(pair: string): { series: TimeValue[]; loading: boolean } {
  const [series, setSeries] = useState<TimeValue[] | null>(null)
  const symbol = pairToSymbol(pair)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const params = new URLSearchParams({
          symbol,
          period: '5m',
          limit: '500',
        })
        const res = await fetch(`${BASE}${ENDPOINT}?${params.toString()}`)
        if (!res.ok) throw new Error(`Long/short ratio fetch failed: ${res.status}`)
        const data = await res.json() as BinanceLsEntry[]
        if (cancelled) return
        const parsed: TimeValue[] = data.map(e => ({
          time: Math.floor(e.timestamp / 1000), // ms → s
          value: parseFloat(e.longShortRatio),
        })).filter(e => isFinite(e.value))
        setSeries(parsed)
      } catch {
        if (!cancelled) setSeries([])
      }
    }

    void refresh()
    const id = setInterval(() => { void refresh() }, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [symbol])

  return { series: series ?? [], loading: series === null }
}
