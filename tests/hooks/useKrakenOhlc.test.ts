import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKrakenOhlc } from '@/hooks/useKrakenOhlc'
import { useKrakenWebSocket } from '@/hooks/useKrakenWebSocket'
import { krakenWsManager } from '@/lib/krakenWsManager'
import type { Candle, Pair } from '@/types'

// ── Mock REST backfill ────────────────────────────────────────────────────────
// The hook now calls fetchOHLC() on mount to backfill history before the WS
// takes over. Default the mock to an empty array so existing WS-focused tests
// keep their invariants (candles start empty, grow from WS messages only).
// Tests that exercise the backfill path override this mock explicitly.
vi.mock('@/api/krakenRest', () => ({
  fetchOHLC: vi.fn(async () => [] as Candle[]),
}))
import { fetchOHLC } from '@/api/krakenRest'
const mockedFetchOHLC = vi.mocked(fetchOHLC)

// ── Mock WebSocket ────────────────────────────────────────────────────────────

type WsHandler = ((event: MessageEvent | Event | CloseEvent) => void) | null

class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readyState: number = MockWebSocket.CONNECTING
  onopen: WsHandler = null
  onmessage: WsHandler = null
  onclose: WsHandler = null
  onerror: WsHandler = null

  sentMessages: string[] = []

  static lastInstance: MockWebSocket | null = null

  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.lastInstance = this
  }

  send(data: string) {
    this.sentMessages.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  simulateUnexpectedClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a Kraken v1 OHLC message: [channelID, payload, "ohlc-1", pair] */
function ohlcMessage(
  pair: string,
  time: number,
  opts: { open?: string; high?: string; low?: string; close?: string; volume?: string } = {}
) {
  return [
    42,
    [
      time,
      String(time + 60),       // etime
      opts.open ?? '45000.00',
      opts.high ?? '45100.00',
      opts.low ?? '44900.00',
      opts.close ?? '45050.00',
      '45020.00',              // vwap
      opts.volume ?? '1.5',
      50,                      // count
    ],
    'ohlc-1',
    pair,
  ]
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', MockWebSocket)
  MockWebSocket.lastInstance = null
  krakenWsManager._reset()
  mockedFetchOHLC.mockReset()
  mockedFetchOHLC.mockResolvedValue([])
})

afterEach(() => {
  krakenWsManager._reset()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useKrakenOhlc', () => {
  it('connects to the Kraken WebSocket URL on mount', () => {
    renderHook(() => useKrakenOhlc('XBT/USDT'))
    expect(MockWebSocket.lastInstance?.url).toBe('wss://ws.kraken.com/')
  })

  it('starts with empty candles and disconnected state', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))
    expect(result.current).toEqual({ candles: [], connected: false })
  })

  it('sets connected: true and sends ohlc subscribe after onopen fires', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
    })

    expect(result.current.connected).toBe(true)

    const sent = JSON.parse(MockWebSocket.lastInstance!.sentMessages[0]) as unknown
    expect(sent).toEqual({
      event: 'subscribe',
      pair: ['XBT/USDT'],
      subscription: { name: 'ohlc', interval: 1 },
    })
  })

  it('subscribes to the correct pair when ETH/USDT is used', () => {
    renderHook(() => useKrakenOhlc('ETH/USDT'))
    act(() => { MockWebSocket.lastInstance!.simulateOpen() })
    const sent = JSON.parse(MockWebSocket.lastInstance!.sentMessages[0]) as { pair: string[] }
    expect(sent.pair).toEqual(['ETH/USDT'])
  })

  it('parses an OHLC message into a Candle and appends it', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage(
        ohlcMessage('XBT/USDT', 1_700_000_000, {
          open: '45000.00', high: '45100.00', low: '44900.00',
          close: '45050.00', volume: '1.5',
        })
      )
    })

    expect(result.current.candles).toHaveLength(1)
    const candle = result.current.candles[0]
    expect(candle.time).toBe(1_700_000_000)
    expect(candle.open).toBe(45000)
    expect(candle.high).toBe(45100)
    expect(candle.low).toBe(44900)
    expect(candle.close).toBe(45050)
    expect(candle.volume).toBe(1.5)
  })

  it('updates the current candle in place when the same timestamp arrives', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      // First tick of the candle
      MockWebSocket.lastInstance!.simulateMessage(
        ohlcMessage('XBT/USDT', 1_700_000_000, { close: '45000.00', high: '45000.00' })
      )
      // Updated tick — same timestamp, higher high
      MockWebSocket.lastInstance!.simulateMessage(
        ohlcMessage('XBT/USDT', 1_700_000_000, { close: '45080.00', high: '45100.00' })
      )
    })

    // Still one candle, updated in place
    expect(result.current.candles).toHaveLength(1)
    expect(result.current.candles[0].close).toBe(45080)
    expect(result.current.candles[0].high).toBe(45100)
  })

  it('appends a new candle when the timestamp changes', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage(ohlcMessage('XBT/USDT', 1_700_000_000))
      MockWebSocket.lastInstance!.simulateMessage(ohlcMessage('XBT/USDT', 1_700_000_060))
    })

    expect(result.current.candles).toHaveLength(2)
    expect(result.current.candles[0].time).toBe(1_700_000_000)
    expect(result.current.candles[1].time).toBe(1_700_000_060)
  })

  it('caps the buffer at MAX_CANDLES (500) by dropping the oldest candle', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      // Push 501 distinct candles
      for (let i = 0; i < 501; i++) {
        MockWebSocket.lastInstance!.simulateMessage(
          ohlcMessage('XBT/USDT', 1_700_000_000 + i * 60)
        )
      }
    })

    expect(result.current.candles).toHaveLength(500)
    // Oldest candle dropped — first retained is the second one
    expect(result.current.candles[0].time).toBe(1_700_000_000 + 60)
    expect(result.current.candles[499].time).toBe(1_700_000_000 + 500 * 60)
  })

  it('ignores non-ohlc messages (ticker, heartbeat)', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage({ event: 'heartbeat' })
      MockWebSocket.lastInstance!.simulateMessage([
        42,
        { c: ['45000.00', '0.01'], o: '44000.00' },
        'ticker',
        'XBT/USDT',
      ])
    })

    expect(result.current.candles).toHaveLength(0)
  })

  it('sets connected: false after unexpected close', () => {
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    act(() => { MockWebSocket.lastInstance!.simulateOpen() })
    expect(result.current.connected).toBe(true)

    act(() => { MockWebSocket.lastInstance!.simulateUnexpectedClose() })
    expect(result.current.connected).toBe(false)
  })

  it('reconnects after a disconnect with a 3-second delay', () => {
    renderHook(() => useKrakenOhlc('XBT/USDT'))
    const firstInstance = MockWebSocket.lastInstance!

    act(() => {
      firstInstance.simulateOpen()
      firstInstance.simulateUnexpectedClose()
    })

    expect(MockWebSocket.lastInstance).toBe(firstInstance)

    act(() => { vi.advanceTimersByTime(3_000) })

    expect(MockWebSocket.lastInstance).not.toBe(firstInstance)
    expect(MockWebSocket.lastInstance?.url).toBe('wss://ws.kraken.com/')
  })

  it('resets candles and reconnects when pair changes', () => {
    const { result, rerender } = renderHook(
      ({ pair }: { pair: Pair }) => useKrakenOhlc(pair),
      { initialProps: { pair: 'XBT/USDT' as Pair } }
    )

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage(ohlcMessage('XBT/USDT', 1_700_000_000))
    })
    expect(result.current.candles).toHaveLength(1)

    rerender({ pair: 'ETH/USDT' })

    // State resets immediately — no stale XBT candles shown under ETH
    expect(result.current.candles).toHaveLength(0)
    expect(result.current.connected).toBe(false)

    // New subscription should use ETH/USDT
    act(() => { MockWebSocket.lastInstance!.simulateOpen() })
    const sent = JSON.parse(MockWebSocket.lastInstance!.sentMessages[0]) as { pair: string[] }
    expect(sent.pair).toEqual(['ETH/USDT'])
  })

  it('does not reconnect after unmount', () => {
    const { unmount } = renderHook(() => useKrakenOhlc('XBT/USDT'))
    const instance = MockWebSocket.lastInstance!

    act(() => { instance.simulateOpen() })

    unmount()

    const instanceAfterUnmount = MockWebSocket.lastInstance
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(MockWebSocket.lastInstance).toBe(instanceAfterUnmount)
  })
})

// ── REST backfill ─────────────────────────────────────────────────────────────

describe('useKrakenOhlc REST backfill', () => {
  /** Build a minimal Candle at the given unix-seconds time. */
  function candle(time: number, close = 45000): Candle {
    return { time, open: close, high: close, low: close, close, volume: 1 }
  }

  it('calls fetchOHLC with the current pair and 1-minute interval on mount', () => {
    renderHook(() => useKrakenOhlc('XBT/USDT'))
    expect(mockedFetchOHLC).toHaveBeenCalledTimes(1)
    expect(mockedFetchOHLC).toHaveBeenCalledWith('XBT/USDT', 1)
  })

  it('refetches backfill when the pair changes', () => {
    const { rerender } = renderHook(
      ({ pair }: { pair: Pair }) => useKrakenOhlc(pair),
      { initialProps: { pair: 'XBT/USDT' as Pair } }
    )
    expect(mockedFetchOHLC).toHaveBeenLastCalledWith('XBT/USDT', 1)

    rerender({ pair: 'ETH/USDT' })
    expect(mockedFetchOHLC).toHaveBeenLastCalledWith('ETH/USDT', 1)
    expect(mockedFetchOHLC).toHaveBeenCalledTimes(2)
  })

  it('populates candles with backfill when the WS has not yet pushed any data', async () => {
    const history = [
      candle(1_700_000_000, 44000),
      candle(1_700_000_060, 44500),
      candle(1_700_000_120, 45000),
    ]
    mockedFetchOHLC.mockResolvedValueOnce(history)

    vi.useRealTimers() // waitFor needs real timers to flush the fetch promise
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    await waitFor(() => {
      expect(result.current.candles).toHaveLength(3)
    })
    expect(result.current.candles.map((c) => c.close)).toEqual([44000, 44500, 45000])
  })

  it('trims backfill to the most recent MAX_CANDLES (500)', async () => {
    const history = Array.from({ length: 600 }, (_, i) =>
      candle(1_700_000_000 + i * 60, 44000 + i)
    )
    mockedFetchOHLC.mockResolvedValueOnce(history)

    vi.useRealTimers()
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    await waitFor(() => {
      expect(result.current.candles).toHaveLength(500)
    })
    // Oldest retained should be candle #100 (600 - 500)
    expect(result.current.candles[0].time).toBe(1_700_000_000 + 100 * 60)
    expect(result.current.candles[499].time).toBe(1_700_000_000 + 599 * 60)
  })

  it('merges backfill under existing WS candles without clobbering live data', async () => {
    // Delay the REST resolution so the WS message lands first
    let resolveFetch: (c: Candle[]) => void = () => {}
    mockedFetchOHLC.mockImplementationOnce(
      () => new Promise<Candle[]>((res) => { resolveFetch = res })
    )

    vi.useRealTimers()
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    // WS pushes a live candle before the REST backfill resolves
    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage(
        ohlcMessage('XBT/USDT', 1_700_000_120, { close: '45000.00' })
      )
    })
    expect(result.current.candles).toHaveLength(1)
    expect(result.current.candles[0].time).toBe(1_700_000_120)

    // Now the REST backfill resolves — it overlaps with the live candle
    // (time 1_700_000_120) and includes two older candles. Only the older
    // ones should be prepended; the live candle must be preserved.
    const history = [
      candle(1_700_000_000, 44000),
      candle(1_700_000_060, 44500),
      candle(1_700_000_120, 99999), // would clobber if merge logic is wrong
    ]
    await act(async () => {
      resolveFetch(history)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.candles).toHaveLength(3)
    })
    expect(result.current.candles.map((c) => c.time)).toEqual([
      1_700_000_000,
      1_700_000_060,
      1_700_000_120,
    ])
    // Live candle preserved, NOT overwritten by the stale REST row
    expect(result.current.candles[2].close).toBe(45000)
  })

  it('swallows a fetchOHLC rejection and does not break the hook', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockedFetchOHLC.mockRejectedValueOnce(new Error('kraken down'))

    vi.useRealTimers()
    const { result } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
    // Candles stay empty; hook is still usable (WS can still populate)
    expect(result.current.candles).toEqual([])
    consoleErrorSpy.mockRestore()
  })
})

// ── Shared connection integration ─────────────────────────────────────────────

describe('useKrakenOhlc + useKrakenWebSocket shared connection', () => {
  it('joins an already-open socket without creating a new WebSocket', () => {
    // Ticker hook opens the connection
    const { result: tickerResult } = renderHook(() => useKrakenWebSocket('XBT/USDT'))
    act(() => { MockWebSocket.lastInstance!.simulateOpen() })
    expect(tickerResult.current.connected).toBe(true)

    const socketAfterTicker = MockWebSocket.lastInstance

    // OHLC hook mounts while socket is OPEN — should reuse the same socket
    const { result: ohlcResult } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    expect(MockWebSocket.lastInstance).toBe(socketAfterTicker)
    expect(ohlcResult.current.connected).toBe(true)

    // An ohlc subscribe message should have been sent immediately
    const messages = socketAfterTicker!.sentMessages.map(
      (m) => JSON.parse(m) as { subscription: { name: string } }
    )
    expect(messages.some((m) => m.subscription.name === 'ohlc')).toBe(true)
  })

  it('notifies both hooks when the shared socket opens mid-CONNECTING', () => {
    // Both hooks mount before the socket opens
    const { result: tickerResult } = renderHook(() => useKrakenWebSocket('XBT/USDT'))
    const socketWhileConnecting = MockWebSocket.lastInstance

    const { result: ohlcResult } = renderHook(() => useKrakenOhlc('XBT/USDT'))

    // No new socket should have been created (socket was CONNECTING)
    expect(MockWebSocket.lastInstance).toBe(socketWhileConnecting)
    expect(tickerResult.current.connected).toBe(false)
    expect(ohlcResult.current.connected).toBe(false)

    // Socket opens — both hooks receive connected: true
    act(() => { MockWebSocket.lastInstance!.simulateOpen() })

    expect(tickerResult.current.connected).toBe(true)
    expect(ohlcResult.current.connected).toBe(true)

    // Both subscriptions sent in onopen
    const messages = MockWebSocket.lastInstance!.sentMessages.map(
      (m) => JSON.parse(m) as { subscription: { name: string } }
    )
    expect(messages.some((m) => m.subscription.name === 'ticker')).toBe(true)
    expect(messages.some((m) => m.subscription.name === 'ohlc')).toBe(true)
  })
})
