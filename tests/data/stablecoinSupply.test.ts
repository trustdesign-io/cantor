import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchStablecoinSupply,
  clearStablecoinSupplyCache,
  detectLargeMint,
  LARGE_MINT_THRESHOLD_BILLIONS,
} from '@/data/stablecoinSupply'
import type { StablecoinSupplyData } from '@/data/stablecoinSupply'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal CoinGecko market_chart response with one data point per day */
function cgResponse(dailyBillions: number[]): { market_caps: [number, number][] } {
  const BASE_TS = new Date('2026-04-01T00:00:00Z').getTime()
  return {
    market_caps: dailyBillions.map((b, i) => [BASE_TS + i * 86_400_000, b * 1e9]),
  }
}

function mockFetchPair(usdtBillions: number[], usdcBillions: number[]) {
  const fetchSpy = vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(cgResponse(usdtBillions)),
    })
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(cgResponse(usdcBillions)),
    })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

function mockFetchError() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
}

function mockFetchStatus(status: number) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  }))
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearStablecoinSupplyCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── fetchStablecoinSupply ─────────────────────────────────────────────────────

describe('fetchStablecoinSupply', () => {
  it('parses USDT and USDC supply and combines into snapshots', async () => {
    mockFetchPair([120, 121, 122], [35, 36, 37])

    const result = await fetchStablecoinSupply()
    expect(result).not.toBeNull()
    expect(result!.snapshots).toHaveLength(3)

    const first = result!.snapshots[0]
    expect(first.usdtBillions).toBeCloseTo(120)
    expect(first.usdcBillions).toBeCloseTo(35)
    expect(first.totalBillions).toBeCloseTo(155)
  })

  it('returns snapshots sorted oldest first', async () => {
    mockFetchPair([100, 101, 102], [30, 31, 32])

    const result = await fetchStablecoinSupply()
    expect(result).not.toBeNull()
    const dates = result!.snapshots.map(s => s.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('returns null when USDT fetch fails with non-200 status', async () => {
    mockFetchStatus(429)
    const result = await fetchStablecoinSupply()
    expect(result).toBeNull()
  })

  it('returns null when fetch throws a network error', async () => {
    mockFetchError()
    const result = await fetchStablecoinSupply()
    expect(result).toBeNull()
  })

  it('returns cached result on second call without re-fetching', async () => {
    const fetchSpy = mockFetchPair([120, 121], [35, 36])

    const first = await fetchStablecoinSupply()
    const second = await fetchStablecoinSupply()

    expect(first).not.toBeNull()
    expect(second).toEqual(first)
    // Two fetches for the first call (USDT + USDC), none for the second
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('re-fetches after cache is cleared', async () => {
    mockFetchPair([100, 101], [30, 31])
    await fetchStablecoinSupply()

    clearStablecoinSupplyCache()

    const fetchSpy2 = mockFetchPair([200, 201], [50, 51])
    const result = await fetchStablecoinSupply()
    expect(result!.snapshots[0].usdtBillions).toBeCloseTo(200)
    expect(fetchSpy2).toHaveBeenCalledTimes(2)
  })

  it('records fetchedAt timestamp', async () => {
    mockFetchPair([100], [30])
    const before = Date.now()
    const result = await fetchStablecoinSupply()
    const after = Date.now()

    expect(result!.fetchedAt).toBeGreaterThanOrEqual(before)
    expect(result!.fetchedAt).toBeLessThanOrEqual(after)
  })

  it('handles missing dates gracefully — uses union of dates from both coins', async () => {
    // USDT has 3 days; USDC only has 2 of them (first two)
    const BASE_TS = new Date('2026-04-01T00:00:00Z').getTime()
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          market_caps: [
            [BASE_TS, 100e9],
            [BASE_TS + 86_400_000, 101e9],
            [BASE_TS + 2 * 86_400_000, 102e9],
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          market_caps: [
            [BASE_TS, 30e9],
            [BASE_TS + 86_400_000, 31e9],
          ],
        }),
      })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await fetchStablecoinSupply()
    expect(result).not.toBeNull()
    // All 3 dates present; day 3 USDC defaults to 0
    expect(result!.snapshots).toHaveLength(3)
    const day3 = result!.snapshots[2]
    expect(day3.usdcBillions).toBe(0)
    expect(day3.totalBillions).toBeCloseTo(102)
  })
})

// ── detectLargeMint ───────────────────────────────────────────────────────────

describe('detectLargeMint', () => {
  function makeData(totals: number[]): StablecoinSupplyData {
    const BASE = new Date('2026-04-01T00:00:00Z').getTime()
    return {
      snapshots: totals.map((t, i) => ({
        date: new Date(BASE + i * 86_400_000).toISOString().slice(0, 10),
        usdtBillions: t * 0.75,
        usdcBillions: t * 0.25,
        totalBillions: t,
      })),
      fetchedAt: Date.now(),
    }
  }

  it('returns null when no single-day increase exceeds the threshold', () => {
    const data = makeData([100, 100.1, 100.2])
    expect(detectLargeMint(data)).toBeNull()
  })

  it('returns null when snapshots has fewer than 2 entries', () => {
    const data = makeData([100])
    expect(detectLargeMint(data)).toBeNull()
  })

  it('returns the snapshot with the largest qualifying mint', () => {
    // Day 2→3: +0.6B (above 0.5B threshold), Day 3→4: +1.0B (larger)
    const data = makeData([100, 100, 100.6, 101.6])
    const result = detectLargeMint(data)
    expect(result).not.toBeNull()
    expect(result!.totalBillions).toBeCloseTo(101.6)
  })

  it('returns null when the only delta equals exactly the threshold (not strictly above)', () => {
    const data = makeData([100, 100 + LARGE_MINT_THRESHOLD_BILLIONS])
    // Delta equals threshold exactly — not strictly greater
    expect(detectLargeMint(data)).toBeNull()
  })

  it('returns the first qualifying snapshot when two are equal', () => {
    // Both day 1→2 and day 2→3 have delta = 1.0B; first wins because second is not strictly greater
    const data = makeData([100, 101, 102])
    const result = detectLargeMint(data)
    // Day index 1 (second snapshot) has delta 1.0 from [0]→[1]
    expect(result).not.toBeNull()
    expect(result!.totalBillions).toBeCloseTo(101)
  })
})
