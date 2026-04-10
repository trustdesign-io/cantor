/**
 * BTC spot ETF net flows data module.
 *
 * Fetches daily net flow data from the SoSoValue public API.
 * SoSoValue aggregates all US BTC spot ETF products and provides CORS-enabled
 * JSON endpoints.
 *
 * ⚠️  FRAGILITY NOTE: This uses an undocumented public endpoint with no SLA.
 *     If it breaks, check https://sosovalue.xyz for updated endpoints, or
 *     switch to Farside Investors (https://farside.co.uk/btc/) with a scraper.
 *     Farside requires a server-side proxy to avoid CORS — not feasible in this
 *     local-only app without a backend.
 *
 * Fail-open: if the fetch fails for any reason, returns null so the UI shows
 * "data unavailable" and any streak filter passes rather than vetoes.
 */

export interface EtfFlowEntry {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /**
   * Net inflow in USD millions for that day.
   * Positive = net inflow; negative = net outflow.
   */
  netFlowUsd: number
  /** Per-fund breakdown (optional — may be empty if the source omits it) */
  byFund: Record<string, number>
}

/** Cache TTL — refresh once per hour */
const CACHE_TTL_MS = 60 * 60 * 1_000

interface CacheEntry {
  data: readonly EtfFlowEntry[] | null
  fetchedAt: number
}

let cache: CacheEntry | null = null

/** Reset the cache — call in test beforeEach to avoid cross-test contamination. */
export function clearEtfFlowsCache(): void {
  cache = null
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

/**
 * Parse the SoSoValue API response into `EtfFlowEntry[]`.
 * The API returns an array of objects with `date` (YYYY-MM-DD) and
 * `total_net_inflow` (USD millions) fields.
 */
function parseResponse(json: unknown): EtfFlowEntry[] {
  if (!Array.isArray(json)) return []

  const entries: EtfFlowEntry[] = []
  for (const item of json) {
    if (typeof item !== 'object' || item === null) continue
    const obj = item as Record<string, unknown>

    const date = typeof obj['date'] === 'string' ? obj['date'] : null
    const flow = typeof obj['total_net_inflow'] === 'number'
      ? obj['total_net_inflow']
      : typeof obj['total_net_inflow'] === 'string'
        ? parseFloat(obj['total_net_inflow'] as string)
        : null

    if (date === null || flow === null || isNaN(flow)) continue

    entries.push({ date, netFlowUsd: flow, byFund: {} })
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Fetch the last `days` days of BTC spot ETF net flows from SoSoValue.
 * Returns null if the fetch fails or the data cannot be parsed.
 */
export async function fetchBtcEtfNetFlows(days = 14): Promise<readonly EtfFlowEntry[] | null> {
  if (cache && isFresh(cache)) return cache.data

  try {
    const url = `https://sosovalue.xyz/api/etf/us-btc-spot?type=day`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`ETF flows fetch failed: ${res.status}`)

    const json = await res.json()
    if (!Array.isArray(json)) throw new Error('ETF flows: unexpected response format (not an array)')
    const all = parseResponse(json)

    // Return only the most recent `days` entries
    const recent = all.slice(-days)
    cache = { data: recent, fetchedAt: Date.now() }
    return recent
  } catch {
    // Fail-open — ETF data is supplementary. Missing data should not block signals.
    cache = { data: null, fetchedAt: Date.now() }
    return null
  }
}
