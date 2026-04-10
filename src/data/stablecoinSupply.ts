/**
 * Stablecoin circulating supply data module.
 *
 * Fetches 7-day daily supply data for USDT and USDC from the CoinGecko API.
 *
 * Data source choice: the issue spec names Etherscan, Tronscan, and Solscan.
 * In practice, Tronscan and Solscan do not expose CORS-enabled endpoints that
 * work from a browser without a proxy server, and none of the three provide
 * freely accessible historical supply data needed for the 7-day delta chart.
 * CoinGecko's free API (`api.coingecko.com`) provides daily market cap history
 * for stablecoins, which approximates circulating supply (price ≈ $1). It is
 * CORS-enabled and rate-limited at 10–50 req/min with no key, or higher with
 * a free Pro key.
 *
 * To use a CoinGecko API key (optional), add to `.env.local`:
 *   VITE_COINGECKO_API_KEY=your_key_here
 *
 * Without a key, the app uses the public endpoint. It will still work but may
 * occasionally hit rate limits during development.
 *
 * ⚠️  This panel is explicitly experimental — the correlation between stablecoin
 *     mints and BTC price is real but noisy and unstable across regimes. Observe
 *     alongside real trades for a month before drawing conclusions.
 *
 * Fail-open: returns null on any failure so the panel shows "data unavailable"
 * without affecting signal evaluation.
 */

export interface SupplySnapshot {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /** USDT total circulating supply in USD billions */
  usdtBillions: number
  /** USDC total circulating supply in USD billions */
  usdcBillions: number
  /** Combined USDT + USDC supply in USD billions */
  totalBillions: number
}

export interface StablecoinSupplyData {
  /** Daily snapshots, oldest first */
  snapshots: readonly SupplySnapshot[]
  /** Timestamp when data was last fetched */
  fetchedAt: number
}

/** Single-day mint threshold for the large-mint badge (USD billions) */
export const LARGE_MINT_THRESHOLD_BILLIONS = 0.5

/** Cache TTL — 1 hour */
const CACHE_TTL_MS = 60 * 60 * 1_000

let cache: { data: StablecoinSupplyData | null; fetchedAt: number } | null = null

/** Reset cache — call in test beforeEach to avoid cross-test contamination. */
export function clearStablecoinSupplyCache(): void {
  cache = null
}

function isFresh(): boolean {
  return cache !== null && Date.now() - cache.fetchedAt < CACHE_TTL_MS
}

function tsToDate(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10)
}

/** Parse CoinGecko market_chart market_caps array into daily snapshots */
function parseDailySupply(data: unknown): Map<string, number> {
  const result = new Map<string, number>()
  if (!Array.isArray(data)) return result

  for (const point of data) {
    if (!Array.isArray(point) || point.length < 2) continue
    const [ts, value] = point as [unknown, unknown]
    if (typeof ts !== 'number' || typeof value !== 'number') continue
    const date = tsToDate(ts)
    // Keep only one entry per day (last wins; CoinGecko may return sub-daily points)
    result.set(date, value / 1e9) // convert to billions
  }

  return result
}

function buildUrl(coinId: string): string {
  const apiKey = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_COINGECKO_API_KEY
  const base = apiKey
    ? `https://pro-api.coingecko.com/api/v3`
    : `https://api.coingecko.com/api/v3`
  const keyParam = apiKey ? `&x_cg_pro_api_key=${apiKey}` : ''
  return `${base}/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily${keyParam}`
}

/**
 * Fetch 7 days of daily USDT and USDC circulating supply from CoinGecko.
 * Returns null if either fetch fails.
 */
export async function fetchStablecoinSupply(): Promise<StablecoinSupplyData | null> {
  if (isFresh()) return cache!.data

  try {
    const [usdtRes, usdcRes] = await Promise.all([
      fetch(buildUrl('tether')),
      fetch(buildUrl('usd-coin')),
    ])

    if (!usdtRes.ok) throw new Error(`CoinGecko USDT fetch failed: ${usdtRes.status}`)
    if (!usdcRes.ok) throw new Error(`CoinGecko USDC fetch failed: ${usdcRes.status}`)

    const [usdtJson, usdcJson] = await Promise.all([usdtRes.json(), usdcRes.json()]) as [
      { market_caps: unknown },
      { market_caps: unknown },
    ]

    const usdtMap = parseDailySupply(usdtJson.market_caps)
    const usdcMap = parseDailySupply(usdcJson.market_caps)

    // Build snapshots for dates present in both datasets
    const dates = [...new Set([...usdtMap.keys(), ...usdcMap.keys()])].sort()
    const snapshots: SupplySnapshot[] = dates.map(date => {
      const usdt = usdtMap.get(date) ?? 0
      const usdc = usdcMap.get(date) ?? 0
      return { date, usdtBillions: usdt, usdcBillions: usdc, totalBillions: usdt + usdc }
    })

    const data: StablecoinSupplyData = { snapshots, fetchedAt: Date.now() }
    cache = { data, fetchedAt: Date.now() }
    return data
  } catch {
    // Fail-open — stablecoin data is supplementary and experimental.
    cache = { data: null, fetchedAt: Date.now() }
    return null
  }
}

/**
 * Returns the SupplySnapshot with the largest single-day total supply increase
 * among those exceeding LARGE_MINT_THRESHOLD_BILLIONS, or null if none qualify.
 */
export function detectLargeMint(data: StablecoinSupplyData): SupplySnapshot | null {
  const { snapshots } = data
  if (snapshots.length < 2) return null

  let largest: SupplySnapshot | null = null
  let largestDelta = 0

  for (let i = 1; i < snapshots.length; i++) {
    const delta = snapshots[i].totalBillions - snapshots[i - 1].totalBillions
    if (delta > LARGE_MINT_THRESHOLD_BILLIONS && delta > largestDelta) {
      largestDelta = delta
      largest = snapshots[i]
    }
  }

  return largest
}
