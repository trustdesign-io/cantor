import { useState, useEffect, useRef } from 'react'
import type { Pair } from '@/types'

export interface TickerState {
  /** Last trade price, or null while connecting */
  price: number | null
  /** 24-hour price change as a percentage (today's open vs. current price).
   *  Uses today's Kraken opening price as the baseline — a close approximation
   *  to the true 24h window, accurate enough for a personal lab display. */
  change24h: number | null
  /** Whether the WebSocket is currently connected */
  connected: boolean
}

/** Kraken v1 WebSocket endpoint — public, no auth required */
const WS_URL = 'wss://ws.kraken.com/'

/** How long to wait before a reconnect attempt after an unexpected disconnect */
const RECONNECT_DELAY_MS = 3_000

const DISCONNECTED: TickerState = { price: null, change24h: null, connected: false }

/**
 * Connects to the Kraken public WebSocket, subscribes to the ticker channel
 * for `pair`, and returns live price + 24h change %.
 *
 * Reconnects automatically after disconnects. Switches subscription cleanly
 * when `pair` changes — no stale data from the previous pair leaks through.
 */
export function useKrakenWebSocket(pair: Pair): TickerState {
  // Track which pair state currently belongs to so we can reset during render
  // when the pair prop changes. This is the React-recommended pattern for
  // "reset state when a prop changes" without calling setState in an effect.
  const [trackedPair, setTrackedPair] = useState<Pair>(pair)
  const [tickerState, setTickerState] = useState<TickerState>(DISCONNECTED)

  // Synchronous render-time reset when pair changes.
  // React batches this with the current render, avoiding an extra commit.
  if (pair !== trackedPair) {
    setTrackedPair(pair)
    setTickerState(DISCONNECTED)
  }

  /** Reference to the active WebSocket so closures can compare identity */
  const wsRef = useRef<WebSocket | null>(null)
  /** Pending reconnect timer — cancelled on pair change or unmount */
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Set to false during cleanup so stale onclose handlers don't reconnect */
  const shouldReconnectRef = useRef(true)

  useEffect(() => {
    shouldReconnectRef.current = true

    // Function declaration is hoisted within this effect closure, so
    // the onclose handler can safely reference it without TDZ issues
    function connect() {
      // Tear down any existing connection before opening a new one
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        setTickerState((s) => ({ ...s, connected: true }))
        ws.send(
          JSON.stringify({
            event: 'subscribe',
            pair: [pair],
            subscription: { name: 'ticker' },
          })
        )
      }

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data: unknown = JSON.parse(event.data)
          // Kraken v1 ticker updates arrive as arrays: [channelID, {...}, "ticker", "XBT/USDT"]
          // System events (heartbeat, subscriptionStatus) are plain objects — skip them.
          if (!Array.isArray(data) || data[2] !== 'ticker') return

          const ticker = data[1] as { c: [string, string]; o: string }
          const price = parseFloat(ticker.c[0])
          const openPrice = parseFloat(ticker.o)
          const change24h = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0

          setTickerState((s) => ({ ...s, price, change24h }))
        } catch {
          // JSON parse errors are safe to ignore — should not occur in normal operation
        }
      }

      ws.onclose = () => {
        setTickerState((s) => ({ ...s, connected: false }))
        // Only schedule a reconnect if this socket is still the active one and
        // the hook hasn't been cleaned up (pair change or unmount)
        if (wsRef.current === ws && shouldReconnectRef.current) {
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS)
        }
      }

      ws.onerror = () => {
        // onerror always precedes onclose — reconnect logic lives in onclose
      }
    }

    connect()

    return () => {
      shouldReconnectRef.current = false
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [pair])

  return tickerState
}
