import { useState, useEffect } from 'react'
import { fetchBtcEtfNetFlows } from '@/data/etfFlows'
import type { EtfFlowEntry } from '@/data/etfFlows'

/** Refresh once per hour */
const REFRESH_INTERVAL_MS = 60 * 60 * 1_000

export interface EtfFlowsState {
  /** Last 14 days of BTC ETF net flows, or null while loading / if unavailable */
  flows: readonly EtfFlowEntry[] | null
}

/**
 * Fetches and caches the last 14 days of BTC spot ETF net flows.
 * Refreshes hourly. Returns null when loading or when the data source is unavailable.
 */
export function useEtfFlows(): EtfFlowsState {
  const [flows, setFlows] = useState<readonly EtfFlowEntry[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      const data = await fetchBtcEtfNetFlows(14)
      if (!cancelled) setFlows(data)
    }

    void refresh()
    const interval = setInterval(() => { void refresh() }, REFRESH_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { flows }
}
