import type { Pair } from '@/types'

type MessageHandler = (payload: unknown) => void
type ConnectedHandler = (connected: boolean) => void

export type KrakenChannel = 'ticker' | 'ohlc'

export interface KrakenSubscriber {
  channel: KrakenChannel
  pair: Pair
  /** Interval in minutes — only meaningful for the 'ohlc' channel. Defaults to 1 when absent. */
  interval?: number
  onMessage: MessageHandler
  onConnected: ConnectedHandler
}

const WS_URL = 'wss://ws.kraken.com/'
const RECONNECT_DELAY_MS = 3_000

/**
 * Module-level singleton that manages a single Kraken public WebSocket
 * connection shared across all hooks. Multiple subscribers (ticker, ohlc, …)
 * register callbacks; the manager dispatches incoming messages to the right
 * handlers and handles connect/reconnect transparently.
 */
class KrakenWsManager {
  private ws: WebSocket | null = null
  private subscribers: Set<KrakenSubscriber> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private shouldReconnect = false

  /**
   * Register a subscriber. Returns an unsubscribe function; call it in
   * useEffect cleanup to stop receiving messages and close the socket when
   * there are no remaining subscribers.
   */
  subscribe(sub: KrakenSubscriber): () => void {
    this.subscribers.add(sub)

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Already open — notify immediately and send subscribe
      sub.onConnected(true)
      this.sendSubscribe(sub)
    } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      // No active connection — open one; onopen will subscribe everyone
      this.connect()
    }
    // else CONNECTING: onopen will handle it

    return () => {
      this.subscribers.delete(sub)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscribe(sub)
      }
      if (this.subscribers.size === 0) {
        this.disconnectCleanly()
      }
    }
  }

  private connect() {
    this.shouldReconnect = true
    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.onopen = () => {
      for (const sub of this.subscribers) {
        sub.onConnected(true)
      }
      // Subscribe unique channel/pair/interval combos in one pass
      const subscribed = new Set<string>()
      for (const sub of this.subscribers) {
        const key = `${sub.channel}:${sub.pair}:${sub.interval ?? 1}`
        if (!subscribed.has(key)) {
          this.sendSubscribe(sub)
          subscribed.add(key)
        }
      }
    }

    ws.onmessage = (event: MessageEvent<string>) => {
      let data: unknown
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }
      if (!Array.isArray(data)) return

      const channelName = data[2] as string
      const pairName = data[3] as string

      for (const sub of this.subscribers) {
        // Kraken sends "ticker" for ticker and "ohlc-1" for 1-min OHLC,
        // so we match by prefix: 'ohlc' matches 'ohlc-1', 'ticker' matches 'ticker'.
        if (channelName.startsWith(sub.channel) && pairName === sub.pair) {
          sub.onMessage(data[1])
        }
      }
    }

    ws.onclose = () => {
      for (const sub of this.subscribers) {
        sub.onConnected(false)
      }
      // Only reconnect if this socket is still the active one and we have subscribers
      if (this.ws === ws && this.shouldReconnect && this.subscribers.size > 0) {
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS)
      }
    }

    ws.onerror = () => {
      // onerror always precedes onclose — reconnect logic lives there
    }
  }

  private disconnectCleanly() {
    this.shouldReconnect = false
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private sendSubscribe(sub: KrakenSubscriber) {
    this.ws!.send(
      JSON.stringify({
        event: 'subscribe',
        pair: [sub.pair],
        subscription: {
          name: sub.channel,
          ...(sub.channel === 'ohlc' ? { interval: sub.interval ?? 1 } : {}),
        },
      })
    )
  }

  private sendUnsubscribe(sub: KrakenSubscriber) {
    this.ws!.send(
      JSON.stringify({
        event: 'unsubscribe',
        pair: [sub.pair],
        subscription: {
          name: sub.channel,
          ...(sub.channel === 'ohlc' ? { interval: sub.interval ?? 1 } : {}),
        },
      })
    )
  }

  /**
   * Reset all state — for test isolation only. Not safe to call in production
   * while subscribers are active.
   */
  _reset() {
    this.subscribers.clear()
    this.disconnectCleanly()
  }
}

export const krakenWsManager = new KrakenWsManager()
