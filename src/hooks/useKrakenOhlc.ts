import { useState, useEffect } from 'react'
import { z } from 'zod'
import { krakenWsManager } from '@/lib/krakenWsManager'
import { fetchOHLC } from '@/api/krakenRest'
import type { Candle, Pair } from '@/types'

/** Interval (in minutes) used by both the REST backfill and the WS subscription */
const OHLC_INTERVAL_MINUTES = 1

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

  // REST backfill: populate history on mount / pair change so the chart has
  // something to render before the WebSocket starts pushing live updates.
  // The WS ohlc channel only emits the *current* candle — without this, the
  // chart would stay empty for however long it takes for full candles to
  // accumulate from live ticks.
  useEffect(() => {
    let cancelled = false

    fetchOHLC(pair, OHLC_INTERVAL_MINUTES)
      .then((history) => {
        if (cancelled) return
        // Keep only the most recent MAX_CANDLES to match the rolling buffer cap
        const trimmed =
          history.length > MAX_CANDLES ? history.slice(-MAX_CANDLES) : history
        setOhlcState((s) => {
          // If the WS has already started appending, merge rather than clobber:
          // drop any backfill candles whose time >= the earliest WS candle,
          // then prepend history.
          if (s.candles.length === 0) {
            return { ...s, candles: trimmed }
          }
          const firstLive = s.candles[0]!.time
          const historyBefore = trimmed.filter((c) => c.time < firstLive)
          return { ...s, candles: [...historyBefore, ...s.candles] }
        })
      })
      .catch((err) => {
        // Log and carry on — the WS will still populate candles over time,
        // and surfacing a hard error here would break the whole Live tab.
        console.error('[useKrakenOhlc] REST backfill failed:', err)
      })

    return () => {
      cancelled = true
    }
  }, [pair])

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
        if (
          !isFinite(candle.open) ||
          !isFinite(candle.high) ||
          !isFinite(candle.low) ||
          !isFinite(candle.close) ||
          !isFinite(candle.volume)
        )
          return

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
