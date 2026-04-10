import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useKrakenWebSocket } from '@/hooks/useKrakenWebSocket'
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

  /** Tracks the last created instance so tests can control it */
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

  /** Test helper: simulate a successful connection */
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  /** Test helper: simulate a message arriving */
  simulateMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }

  /** Test helper: simulate an unexpected disconnect (not via .close()) */
  simulateUnexpectedClose() {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({} as CloseEvent)
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('WebSocket', MockWebSocket)
  MockWebSocket.lastInstance = null
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useKrakenWebSocket', () => {
  it('connects to the Kraken WebSocket URL on mount', () => {
    renderHook(() => useKrakenWebSocket('XBT/USDT'))
    expect(MockWebSocket.lastInstance?.url).toBe('wss://ws.kraken.com/')
  })

  it('starts with disconnected null state', () => {
    const { result } = renderHook(() => useKrakenWebSocket('XBT/USDT'))
    expect(result.current).toEqual({ price: null, change24h: null, connected: false })
  })

  it('sets connected: true and sends subscription after onopen fires', () => {
    const { result } = renderHook(() => useKrakenWebSocket('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
    })

    expect(result.current.connected).toBe(true)

    const sent = JSON.parse(MockWebSocket.lastInstance!.sentMessages[0]) as unknown
    expect(sent).toEqual({
      event: 'subscribe',
      pair: ['XBT/USDT'],
      subscription: { name: 'ticker' },
    })
  })

  it('subscribes to the correct pair when ETH/USDT is used', () => {
    renderHook(() => useKrakenWebSocket('ETH/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
    })

    const sent = JSON.parse(MockWebSocket.lastInstance!.sentMessages[0]) as { pair: string[] }
    expect(sent.pair).toEqual(['ETH/USDT'])
  })

  it('parses price and change24h from a ticker message', () => {
    const { result } = renderHook(() => useKrakenWebSocket('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      // Kraken v1 ticker format: [channelID, tickerData, "ticker", "XBT/USDT"]
      MockWebSocket.lastInstance!.simulateMessage([
        42,
        { c: ['45000.00', '0.01'], o: '44000.00' },
        'ticker',
        'XBT/USDT',
      ])
    })

    expect(result.current.price).toBe(45000)
    // Expected change: (45000 - 44000) / 44000 * 100 ≈ 2.2727...
    expect(result.current.change24h).toBeCloseTo(2.2727, 3)
  })

  it('ignores non-ticker messages (heartbeat, subscriptionStatus)', () => {
    const { result } = renderHook(() => useKrakenWebSocket('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage({ event: 'heartbeat' })
      MockWebSocket.lastInstance!.simulateMessage({ event: 'subscriptionStatus', status: 'subscribed' })
    })

    expect(result.current.price).toBeNull()
    expect(result.current.change24h).toBeNull()
  })

  it('sets connected: false after unexpected close', () => {
    const { result } = renderHook(() => useKrakenWebSocket('XBT/USDT'))

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
    })
    expect(result.current.connected).toBe(true)

    act(() => {
      MockWebSocket.lastInstance!.simulateUnexpectedClose()
    })
    expect(result.current.connected).toBe(false)
  })

  it('reconnects after a disconnect with a 3-second delay', () => {
    renderHook(() => useKrakenWebSocket('XBT/USDT'))
    const firstInstance = MockWebSocket.lastInstance!

    act(() => {
      firstInstance.simulateOpen()
      firstInstance.simulateUnexpectedClose()
    })

    // Not reconnected yet
    expect(MockWebSocket.lastInstance).toBe(firstInstance)

    act(() => {
      vi.advanceTimersByTime(3_000)
    })

    // A new WebSocket should have been created
    expect(MockWebSocket.lastInstance).not.toBe(firstInstance)
    expect(MockWebSocket.lastInstance?.url).toBe('wss://ws.kraken.com/')
  })

  it('resets price/change and reconnects when pair changes', () => {
    const { result, rerender } = renderHook(
      ({ pair }: { pair: Pair }) => useKrakenWebSocket(pair),
      { initialProps: { pair: 'XBT/USDT' as Pair } }
    )

    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
      MockWebSocket.lastInstance!.simulateMessage([
        42,
        { c: ['45000.00', '0.01'], o: '44000.00' },
        'ticker',
        'XBT/USDT',
      ])
    })
    expect(result.current.price).toBe(45000)

    // Switch to ETH/USDT
    rerender({ pair: 'ETH/USDT' })

    // State should reset immediately — no stale BTC price shown under ETH
    expect(result.current.price).toBeNull()
    expect(result.current.change24h).toBeNull()
    expect(result.current.connected).toBe(false)

    // New subscription should use ETH/USDT
    act(() => {
      MockWebSocket.lastInstance!.simulateOpen()
    })
    const sent = JSON.parse(MockWebSocket.lastInstance!.sentMessages[0]) as { pair: string[] }
    expect(sent.pair).toEqual(['ETH/USDT'])
  })

  it('does not reconnect after unmount', () => {
    const { unmount } = renderHook(() => useKrakenWebSocket('XBT/USDT'))
    const instance = MockWebSocket.lastInstance!

    act(() => {
      instance.simulateOpen()
    })

    unmount()

    // Advance past reconnect delay — should not create a new socket
    const instanceAfterUnmount = MockWebSocket.lastInstance
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(MockWebSocket.lastInstance).toBe(instanceAfterUnmount)
  })
})
