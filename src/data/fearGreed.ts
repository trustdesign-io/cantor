/**
 * Crypto Fear & Greed Index data module.
 *
 * Fetches from alternative.me — free, public, no auth required.
 * The index only updates daily, so cache for 1 hour to avoid unnecessary requests.
 * On fetch failure, returns null so the filter can pass rather than veto.
 */

export interface FearGreedData {
  /** Index value 0–100 (0 = extreme fear, 100 = extreme greed) */
  value: number
  /** Human-readable classification (e.g. "Extreme Fear", "Greed") */
  classification: string
  /** Unix timestamp (seconds) when this reading was published */
  timestamp: number
  /** When this data was fetched (ms) */
  fetchedAt: number
}

/** Cache TTL — 1 hour. The index only updates daily; hourly is safe. */
const CACHE_TTL_MS = 60 * 60 * 1000

interface CacheEntry {
  data: FearGreedData | null
  fetchedAt: number
}

/**
 * Module-level singleton cache.
 * Call clearFearGreedCache() in test beforeEach to reset state.
 */
let cached: CacheEntry | null = null

/** Reset the cache — call in test beforeEach to avoid cross-test contamination. */
export function clearFearGreedCache(): void {
  cached = null
}

function isFresh(): boolean {
  return cached !== null && Date.now() - cached.fetchedAt < CACHE_TTL_MS
}

/**
 * Fetch the current Crypto Fear & Greed Index from alternative.me.
 * Returns null on failure (filter will pass, not veto).
 */
export async function fetchFearGreedIndex(): Promise<FearGreedData | null> {
  if (isFresh()) return cached!.data

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) throw new Error(`Fear & Greed fetch failed: ${res.status}`)
    const json = await res.json() as {
      data: Array<{
        value: string
        value_classification: string
        timestamp: string
      }>
    }
    const entry = json.data[0]
    if (!entry) throw new Error('Fear & Greed: empty data array')

    const data: FearGreedData = {
      value: parseInt(entry.value, 10),
      classification: entry.value_classification,
      timestamp: parseInt(entry.timestamp, 10),
      fetchedAt: Date.now(),
    }
    cached = { data, fetchedAt: Date.now() }
    return data
  } catch {
    // Silently fall back — a failed fetch should not suppress valid price signals.
    cached = { data: null, fetchedAt: Date.now() }
    return null
  }
}
