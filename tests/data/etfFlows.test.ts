import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchBtcEtfNetFlows, clearEtfFlowsCache } from '@/data/etfFlows'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }))
}

function mockFetchError() {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')))
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  clearEtfFlowsCache()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fetchBtcEtfNetFlows', () => {
  it('parses well-formed API response into sorted EtfFlowEntry[]', async () => {
    mockFetchOnce([
      { date: '2026-04-03', total_net_inflow: 200 },
      { date: '2026-04-01', total_net_inflow: -50 },
      { date: '2026-04-02', total_net_inflow: 100 },
    ])

    const result = await fetchBtcEtfNetFlows()
    expect(result).not.toBeNull()
    // Sorted oldest first
    expect(result![0].date).toBe('2026-04-01')
    expect(result![1].date).toBe('2026-04-02')
    expect(result![2].date).toBe('2026-04-03')
    // Values preserved
    expect(result![0].netFlowUsd).toBe(-50)
    expect(result![2].netFlowUsd).toBe(200)
  })

  it('returns only the last N entries when the API returns more', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
      total_net_inflow: i * 10,
    }))
    mockFetchOnce(many)

    const result = await fetchBtcEtfNetFlows(14)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(14)
    // Should be the 14 most recent entries
    expect(result![13].date).toBe('2026-01-30')
  })

  it('returns null when fetch throws a network error', async () => {
    mockFetchError()
    const result = await fetchBtcEtfNetFlows()
    expect(result).toBeNull()
  })

  it('returns null when the API returns a non-200 status', async () => {
    mockFetchOnce({}, 500)
    const result = await fetchBtcEtfNetFlows()
    expect(result).toBeNull()
  })

  it('returns null when the API returns non-array JSON', async () => {
    mockFetchOnce({ error: 'not an array' })
    const result = await fetchBtcEtfNetFlows()
    expect(result).toBeNull()
  })

  it('skips entries with missing or non-numeric flow values', async () => {
    mockFetchOnce([
      { date: '2026-04-01', total_net_inflow: 100 },
      { date: '2026-04-02', total_net_inflow: null },  // should be skipped
      { date: '2026-04-03', total_net_inflow: 'not-a-number' },  // skipped
      { date: '2026-04-04', total_net_inflow: -50 },
    ])

    const result = await fetchBtcEtfNetFlows()
    expect(result).not.toBeNull()
    expect(result!.length).toBe(2)
    expect(result![0].date).toBe('2026-04-01')
    expect(result![1].date).toBe('2026-04-04')
  })

  it('returns cached result on second call (no second fetch)', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ date: '2026-04-01', total_net_inflow: 100 }]),
      })
      .mockRejectedValue(new Error('Should not be called a second time'))
    vi.stubGlobal('fetch', fetchSpy)

    const first = await fetchBtcEtfNetFlows()
    const second = await fetchBtcEtfNetFlows()

    expect(first).not.toBeNull()
    expect(second).toEqual(first)
    // Exactly one fetch call — the second was served from cache
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('re-fetches after cache is cleared', async () => {
    mockFetchOnce([{ date: '2026-04-01', total_net_inflow: 100 }])
    await fetchBtcEtfNetFlows()

    clearEtfFlowsCache()

    mockFetchOnce([{ date: '2026-04-02', total_net_inflow: 200 }])
    const result = await fetchBtcEtfNetFlows()
    expect(result![0].date).toBe('2026-04-02')
  })
})
