import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKrakenOhlc } from '@/hooks/useKrakenOhlc'
import { krakenWsManager } from '@/lib/krakenWsManager'
import type { Pair } from '@/types'

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
