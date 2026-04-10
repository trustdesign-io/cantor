import { useState, useEffect } from 'react'
import { fetchFearGreedIndex } from '@/data/fearGreed'
import type { FearGreedData } from '@/data/fearGreed'

/** Refresh interval — hourly. The index only updates daily. */
const REFRESH_INTERVAL_MS = 60 * 60 * 1000

export interface FearGreedState {
  /** Full index data, or null while loading or if fetch failed */
  fearGreed: FearGreedData | null
}

/**
 * Fetches and caches the Crypto Fear & Greed Index from alternative.me.
 * Refreshes every hour. Returns null while the first fetch is in-flight
 * or if the fetch fails (so filters pass rather than veto on missing data).
 */
export function useFearGreed(): FearGreedState {
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const data = await fetchFearGreedIndex()
      if (!cancelled) setFearGreed(data)
    }

    void refresh()
    const interval = setInterval(() => { void refresh() }, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { fearGreed }
}
