import type { Candle, Pair } from '@/types'

/** Kraken REST base URL */
const KRAKEN_BASE = 'https://api.kraken.com/0/public'

/** Maps a Cantor pair name to the Kraken REST pair code. */
const PAIR_MAP: Record<Pair, string> = {
  'XBT/USDT': 'XBTUSDT',
  'ETH/USDT': 'ETHUSDT',
}

// Kraken REST /0/public/OHLC returns 8-element rows: [time, open, high, low, close, vwap, volume, count].
// This is different from the WS v1 ohlc payload, which has 9 elements including etime.
// Do not unify them — they are genuinely different shapes.
type KrakenOhlcRow = [number, string, string, string, string, string, string, number]

/** Shape of the Kraken OHLC response envelope. */
interface KrakenOhlcResponse {
  error: string[]
  result: Record<string, KrakenOhlcRow[] | number>
}

/**
 * Fetches OHLC candlestick data from the Kraken public REST API.
 *
 * @param pair     - Trading pair (e.g. 'XBT/USDT').
 * @param interval - Candle interval in minutes (e.g. 1, 5, 60).
 * @param since    - Optional Unix timestamp (seconds). Kraken returns candles since this time.
 * @returns        - Array of Candle objects mapped from Kraken's response. Rows with
 *                   non-finite values are silently skipped.
 * @throws         - If the network request fails, the HTTP status is not OK, or the
 *                   Kraken error envelope contains error messages.
 */
export async function fetchOHLC(pair: Pair, interval: number, since?: number): Promise<Candle[]> {
  const krakenPair = PAIR_MAP[pair]
  const url = new URL(`${KRAKEN_BASE}/OHLC`)
  url.searchParams.set('pair', krakenPair)
  url.searchParams.set('interval', String(interval))
  if (since !== undefined) {
    url.searchParams.set('since', String(since))
  }

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching OHLC for ${pair}`)
  }

  const body: KrakenOhlcResponse = await response.json()

  if (body.error.length > 0) {
    throw new Error(body.error.join('; '))
  }

  // Kraken returns { result: { XBTUSDT: [...rows], last: <timestamp> } }
  // Find the first array value in result — that is the OHLC data
  const rows = Object.values(body.result).find(Array.isArray) as KrakenOhlcRow[] | undefined
  if (!rows) return []

  const candles: Candle[] = []
  for (const [time, openStr, highStr, lowStr, closeStr, , volumeStr] of rows) {
    const open   = parseFloat(openStr)
    const high   = parseFloat(highStr)
    const low    = parseFloat(lowStr)
    const close  = parseFloat(closeStr)
    const volume = parseFloat(volumeStr)

    // Skip rows with malformed or non-finite numeric values
    if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close) || !isFinite(volume)) {
      continue
    }

    candles.push({ time, open, high, low, close, volume })
  }

  return candles
}
