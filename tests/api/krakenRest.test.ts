import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchOHLC } from '@/api/krakenRest'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns a minimal valid Kraken REST OHLC row for testing.
 * Shape: [time, open, high, low, close, vwap, volume, count] — 8 elements (no etime).
 */
function krakenRow(time: number, close: string, open = '40000', high = '41000', low = '39000', volume = '1.5', vwap = '40500') {
  return [time, open, high, low, close, vwap, volume, 10]
}

function makeSuccessBody(rows: unknown[]) {
  return JSON.stringify({
    error: [],
    result: {
      XXBTZUSD: rows,
      last: 1700000060,
    },
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('fetchOHLC', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the correct Kraken REST endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(makeSuccessBody([krakenRow(1_700_000_000, '42000')]), { status: 200 })
    )
    vi.stubGlobal('fetch', mockFetch)

    await fetchOHLC('XBT/USDT', 1, 1_700_000_000)

    expect(mockFetch).toHaveBeenCalledOnce()
    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('api.kraken.com/0/public/OHLC')
    expect(url).toContain('pair=')
    expect(url).toContain('interval=1')
    expect(url).toContain('since=1700000000')
  })

  it('maps Kraken rows to Candle type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSuccessBody([
        krakenRow(1_700_000_000, '42000', '40000', '43000', '39000', '2.5'),
      ]), { status: 200 })
    ))

    const candles = await fetchOHLC('XBT/USDT', 1)
    expect(candles).toHaveLength(1)
    expect(candles[0]).toMatchObject({
      time: 1_700_000_000,
      open: 40_000,
      high: 43_000,
      low: 39_000,
      close: 42_000,
      volume: 2.5,
    })
  })

  it('returns multiple candles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSuccessBody([
        krakenRow(1_700_000_000, '41000'),
        krakenRow(1_700_000_060, '42000'),
        krakenRow(1_700_000_120, '43000'),
      ]), { status: 200 })
    ))

    const candles = await fetchOHLC('XBT/USDT', 1)
    expect(candles).toHaveLength(3)
  })

  it('throws when Kraken returns error(s) in envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: ['EGeneral:Invalid arguments'], result: {} }),
        { status: 200 }
      )
    ))

    await expect(fetchOHLC('XBT/USDT', 1)).rejects.toThrow('EGeneral:Invalid arguments')
  })

  it('throws on HTTP error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('Not Found', { status: 404 })
    ))

    await expect(fetchOHLC('XBT/USDT', 1)).rejects.toThrow('HTTP 404')
  })

  it('throws on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(fetchOHLC('XBT/USDT', 1)).rejects.toThrow('Failed to fetch')
  })

  it('parses zero-volume rows without collapsing close to zero', async () => {
    // Kraken returns vwap = "0.0" on zero-volume minutes. The off-by-one bug
    // (9-element type with etime slot) caused closeStr to read vwap, making close = 0.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSuccessBody([
        krakenRow(1_700_000_000, '72970.0', '72968.3', '72970.1', '72968.3', '0.00000', '0.0'),
      ]), { status: 200 })
    ))

    const candles = await fetchOHLC('XBT/USDT', 1)
    expect(candles).toHaveLength(1)
    expect(candles[0].close).toBe(72_970.0)
    expect(candles[0].close).not.toBe(0)
  })

  it('skips rows with non-finite numeric values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeSuccessBody([
        krakenRow(1_700_000_000, 'NaN'),  // malformed close
        krakenRow(1_700_000_060, '42000'),
      ]), { status: 200 })
    ))

    const candles = await fetchOHLC('XBT/USDT', 1)
    expect(candles).toHaveLength(1)
    expect(candles[0].close).toBe(42_000)
  })
})
