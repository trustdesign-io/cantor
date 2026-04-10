/**
 * Perpetual futures funding rate data module.
 *
 * Fetches the current funding rate from Binance and Bybit public endpoints.
 * Both APIs are public (no auth required) and include CORS headers.
 * If one exchange errors, the module falls back to the other silently.
 * If both fail, the module returns null so the filter can pass rather than veto.
 */

export interface FundingRateData {
  exchange: 'binance' | 'bybit'
  pair: string
  /** Funding rate as a decimal (e.g. 0.0001 = 0.01%) per 8-hour period */
  fundingRate: number
  nextFundingTime: number  // Unix timestamp (ms)
  fetchedAt: number        // Unix timestamp (ms)
}

/** Cache TTL — refresh every 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
  data: FundingRateData | null
  fetchedAt: number
}

/**
 * Module-level singleton cache shared across all callers.
 * This is intentional for a local-only app: there is exactly one instance of the
 * data-fetching hook and it serves the entire app. The singleton avoids duplicate
 * network requests when multiple components read the same exchange pair.
 *
 * For testing: call `clearFundingRateCache()` in beforeEach to reset state.
 */
const cache = new Map<string, CacheEntry>()

/** Reset the cache — call in test beforeEach to avoid cross-test contamination. */
export function clearFundingRateCache(): void {
  cache.clear()
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS
}

async function fetchBinanceFunding(symbol: string): Promise<FundingRateData> {
  const url = `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Binance funding fetch failed: ${res.status}`)
  const json = await res.json() as {
    lastFundingRate: string
    nextFundingTime: number
  }
  return {
    exchange: 'binance',
    pair: symbol,
    fundingRate: parseFloat(json.lastFundingRate),
    nextFundingTime: json.nextFundingTime,
    fetchedAt: Date.now(),
  }
}

async function fetchBybitFunding(symbol: string): Promise<FundingRateData> {
  const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Bybit funding fetch failed: ${res.status}`)
  const json = await res.json() as {
    result: {
      list: Array<{ fundingRate: string; nextFundingTime: string }>
    }
  }
  const ticker = json.result.list[0]
  if (!ticker) throw new Error('Bybit funding: empty ticker list')
  return {
    exchange: 'bybit',
    pair: symbol,
    fundingRate: parseFloat(ticker.fundingRate),
    nextFundingTime: parseInt(ticker.nextFundingTime, 10),
    fetchedAt: Date.now(),
  }
}

/**
 * Fetch the current perpetual funding rate for a symbol from Binance or Bybit.
 * Returns null if the exchange fails (so filters can pass rather than veto on missing data).
 */
export async function fetchFundingRate(
  exchange: 'binance' | 'bybit',
  pair: string
): Promise<FundingRateData | null> {
  const key = `${exchange}:${pair}`
  const cached = cache.get(key)
  if (cached && isFresh(cached)) return cached.data

  try {
    const data = exchange === 'binance'
      ? await fetchBinanceFunding(pair)
      : await fetchBybitFunding(pair)
    cache.set(key, { data, fetchedAt: Date.now() })
    return data
  } catch {
    // Silently fall back — a failed exchange should not block signal evaluation.
    // The filter passes (ok: true) when fundingRate is absent.
    cache.set(key, { data: null, fetchedAt: Date.now() })
    return null
  }
}

/**
 * Fetch funding rates from both exchanges and return the average.
 * Falls back to whichever exchange succeeds if one fails.
 * Returns null if both fail.
 */
export async function fetchAverageFundingRate(btcSymbol = 'BTCUSDT'): Promise<number | null> {
  const [binance, bybit] = await Promise.allSettled([
    fetchFundingRate('binance', btcSymbol),
    fetchFundingRate('bybit', btcSymbol),
  ])

  const rates: number[] = []
  if (binance.status === 'fulfilled' && binance.value !== null) {
    rates.push(binance.value.fundingRate)
  }
  if (bybit.status === 'fulfilled' && bybit.value !== null) {
    rates.push(bybit.value.fundingRate)
  }

  if (rates.length === 0) return null
  return rates.reduce((sum, r) => sum + r, 0) / rates.length
}
