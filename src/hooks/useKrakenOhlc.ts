import { useState, useEffect } from 'react'
import { z } from 'zod'
import { krakenWsManager } from '@/lib/krakenWsManager'
import type { Candle, Pair } from '@/types'

// Kraken v1 OHLC array: [time, etime, open, high, low, close, vwap, volume, count]
const KrakenOhlcPayload = z.tuple([
  z.number(), // 0: open time (unix seconds)
  z.string(), // 1: end time
  z.string(), // 2: open
  z.string(), // 3: high
  z.string(), // 4: low
  z.string(), // 5: close
  z.string(), // 6: vwap
  z.string(), // 7: volume
  z.number(), // 8: trade count
])

/** Maximum number of candles retained in the rolling buffer */
const MAX_CANDLES = 500

export interface OhlcState {
  /** Rolling buffer of completed + current candle (bounded at MAX_CANDLES) */
  candles: Candle[]
  /** Whether the WebSocket is currently connected */
  connected: boolean
}

const DISCONNECTED: OhlcState = { candles: [], connected: false }

/**
 * Subscribes to the Kraken ohlc channel (1-minute interval) for `pair` via
 * the shared WebSocket manager. Returns a rolling bounded buffer of Candle[].
 *
 * - Current (incomplete) candle is updated in place on each tick.
 * - Completed candles are appended; buffer is capped at MAX_CANDLES.
 * - Resets cleanly when `pair` changes.
 */
export function useKrakenOhlc(pair: Pair): OhlcState {
  // Render-time reset when pair changes (same pattern as useKrakenWebSocket)
  const [trackedPair, setTrackedPair] = useState<Pair>(pair)
  const [ohlcState, setOhlcState] = useState<OhlcState>(DISCONNECTED)

  if (pair !== trackedPair) {
    setTrackedPair(pair)
    setOhlcState(DISCONNECTED)
  }

  useEffect(() => {
    const unsubscribe = krakenWsManager.subscribe({
      channel: 'ohlc',
      pair,
      onConnected: (connected) => {
        setOhlcState((s) => ({ ...s, connected }))
      },
      onMessage: (payload) => {
        const parsed = KrakenOhlcPayload.safeParse(payload)
        if (!parsed.success) return

        const [time, , openStr, highStr, lowStr, closeStr, , volumeStr] = parsed.data
        const candle: Candle = {
          time,
          open: parseFloat(openStr),
          high: parseFloat(highStr),
          low: parseFloat(lowStr),
          close: parseFloat(closeStr),
          volume: parseFloat(volumeStr),
        }

        // Guard against non-finite values from malformed strings
        if (!isFinite(candle.open) || !isFinite(candle.close)) return

        setOhlcState((s) => {
          const { candles } = s
          const last = candles[candles.length - 1]

          if (last && last.time === time) {
            // Same interval — update current candle in place
            return { ...s, candles: [...candles.slice(0, -1), candle] }
          }

          // New interval — append, bounded at MAX_CANDLES
          const next =
            candles.length >= MAX_CANDLES
              ? [...candles.slice(1), candle]
              : [...candles, candle]
          return { ...s, candles: next }
        })
      },
    })
    return unsubscribe
  }, [pair])

  return ohlcState
}
