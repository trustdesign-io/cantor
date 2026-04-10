import { useState, useEffect } from 'react'
import { fetchStablecoinSupply } from '@/data/stablecoinSupply'
import type { StablecoinSupplyData } from '@/data/stablecoinSupply'

/** Refresh once per hour */
const REFRESH_INTERVAL_MS = 60 * 60 * 1_000

export interface StablecoinSupplyState {
  data: StablecoinSupplyData | null
}

/**
 * Fetches and caches 7-day USDT + USDC circulating supply data from CoinGecko.
 * Refreshes hourly. Returns null while loading or when the data source is unavailable.
 */
export function useStablecoinSupply(): StablecoinSupplyState {
  const [data, setData] = useState<StablecoinSupplyData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const result = await fetchStablecoinSupply()
      if (!cancelled) setData(result)
    }

    void refresh()
    const interval = setInterval(() => { void refresh() }, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { data }
}
