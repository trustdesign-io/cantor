/**
 * Crypto Fear & Greed Index historical data from alternative.me.
 * The API supports `?limit=N` to return N days of readings.
 */

import type { TimeValue } from '@/lib/sentimentUtils'

/** How many days of historical F&G to fetch for the chart strip. */
const HISTORY_DAYS = 30

/** Cache TTL — 1 hour. The index only updates daily. */
const CACHE_TTL_MS = 60 * 60 * 1000

interface HistoryCache {
  data: TimeValue[]
  fetchedAt: number
}

let historyCache: HistoryCache | null = null

/**
 * Fetch N days of Fear & Greed history from alternative.me.
 * Returns an empty array on failure.
 */
export async function fetchFearGreedHistory(limit = HISTORY_DAYS): Promise<TimeValue[]> {
  if (historyCache && Date.now() - historyCache.fetchedAt < CACHE_TTL_MS) {
    return historyCache.data
  }

  try {
    const res = await fetch(`https://api.alternative.me/fng/?limit=${limit}`)
    if (!res.ok) throw new Error(`F&G history fetch failed: ${res.status}`)
    const json = await res.json() as {
      data: Array<{ value: string; timestamp: string }>
    }
    const data: TimeValue[] = (json.data ?? [])
      .map(entry => ({
        time: parseInt(entry.timestamp, 10),
        value: parseInt(entry.value, 10),
      }))
      .filter(e => isFinite(e.time) && isFinite(e.value))
      .sort((a, b) => a.time - b.time)

    historyCache = { data, fetchedAt: Date.now() }
    return data
  } catch {
    // Don't cache error responses at full TTL — retry within 5 minutes
    historyCache = { data: [], fetchedAt: Date.now() - CACHE_TTL_MS + 5 * 60 * 1000 }
    return []
  }
}

/** Reset cache — call in test beforeEach. */
export function clearFearGreedHistoryCache(): void {
  historyCache = null
}
