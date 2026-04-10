import { useState, useEffect } from 'react'
import { z } from 'zod'
import { krakenWsManager } from '@/lib/krakenWsManager'
import type { Pair } from '@/types'

const KrakenTickerPayload = z.object({
  c: z.tuple([z.string(), z.string()]),
  o: z.string(),
})

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

const DISCONNECTED: TickerState = { price: null, change24h: null, connected: false }

/**
 * Subscribes to the Kraken ticker channel for `pair` via the shared
 * WebSocket manager, and returns live price + 24h change %.
 *
 * The underlying connection is shared with other hooks (e.g. useKrakenOhlc).
 * Resets cleanly when `pair` changes — no stale data from the previous pair.
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

  useEffect(() => {
    const unsubscribe = krakenWsManager.subscribe({
      channel: 'ticker',
      pair,
      onConnected: (connected) => {
        setTickerState((s) => ({ ...s, connected }))
      },
      onMessage: (payload) => {
        const parsed = KrakenTickerPayload.safeParse(payload)
        if (!parsed.success) return
        const price = parseFloat(parsed.data.c[0])
        const openPrice = parseFloat(parsed.data.o)
        const change24h = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0
        setTickerState((s) => ({ ...s, price, change24h }))
      },
    })
    return unsubscribe
  }, [pair])

  return tickerState
}
