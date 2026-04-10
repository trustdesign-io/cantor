import { useState, useEffect } from 'react'
import { fetchAverageFundingRate } from '@/data/fundingRates'

/** Refresh interval — every 5 minutes */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000

export interface FundingRateState {
  /** Average funding rate as a decimal (e.g. 0.001 = 0.1% per 8h), or null while loading */
  fundingRate: number | null
}

/**
 * Fetches and caches the average BTC perpetual funding rate from Binance and Bybit.
 * Refreshes every 5 minutes. Returns null while the first fetch is in-flight
 * or if both exchanges fail (so filters pass rather than veto on missing data).
 */
export function useFundingRate(): FundingRateState {
  const [fundingRate, setFundingRate] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const rate = await fetchAverageFundingRate()
      if (!cancelled) setFundingRate(rate)
    }

    void refresh()
    const interval = setInterval(() => { void refresh() }, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { fundingRate }
}
