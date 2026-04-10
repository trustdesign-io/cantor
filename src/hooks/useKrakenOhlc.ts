import { useState, useEffect } from 'react'
import { z } from 'zod'
import { krakenWsManager } from '@/lib/krakenWsManager'
import { fetchOHLC } from '@/api/krakenRest'
import type { Candle, OhlcInterval, Pair } from '@/types'

// Kraken WS v1 sends time as a microsecond-precise string (e.g. "1775846735.297534").
// Declaring position 0 as z.number() causes safeParse to reject every real message.
// Use z.string() and parseFloat() when building the Candle.
//
// IMPORTANT — which field to use as the Candle.time:
//   Index 0 ("time") is Kraken's name for the *last update time* of the in-progress
//   candle: it floats continuously (e.g. 1775857441.697132) as ticks arrive within
//   a bucket. It is NOT a bucket boundary despite the field name.
//   Index 1 ("etime") is the *end time of the interval* — a clean second boundary
//   (e.g. 1775857500) that matches what Kraken REST OHLC returns.
//
// We must use etime (index 1) so that REST backfill candles and WS live candles
// live on the same time grid. Using `time` (index 0) causes lightweight-charts to
// crash with "data must be asc ordered by time" when a WS update (microsecond
// stamp inside the current minute) is appended after a REST candle (bucket end).
const KrakenOhlcPayload = z.tuple([
  z.string(), // 0: last-update time, seconds since epoch (microsecond-precise string) — DO NOT USE
  z.string(), // 1: end time of interval (bucket boundary) — USE THIS as Candle.time
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
 * Subscribes to the Kraken ohlc channel for `pair` at the given `interval`
 * via the shared WebSocket manager. Returns a rolling bounded buffer of Candle[].
 *
 * - Current (incomplete) candle is updated in place on each tick.
 * - Completed candles are appended; buffer is capped at MAX_CANDLES.
 * - Resets cleanly when `pair` or `interval` changes.
 */
export function useKrakenOhlc(pair: Pair, interval: OhlcInterval): OhlcState {
  // Render-time reset when pair or interval changes (same pattern as useKrakenWebSocket)
  const [trackedPair, setTrackedPair] = useState<Pair>(pair)
  const [trackedInterval, setTrackedInterval] = useState<OhlcInterval>(interval)
  const [ohlcState, setOhlcState] = useState<OhlcState>(DISCONNECTED)

  if (pair !== trackedPair || interval !== trackedInterval) {
    setTrackedPair(pair)
    setTrackedInterval(interval)
    setOhlcState(DISCONNECTED)
  }

  // REST backfill: populate history on mount / pair / interval change so the chart has
  // something to render before the WebSocket starts pushing live updates.
  // The WS ohlc channel only emits the *current* candle — without this, the
  // chart would stay empty for however long it takes for full candles to
  // accumulate from live ticks.
  useEffect(() => {
    let cancelled = false

    fetchOHLC(pair, interval)
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
  }, [pair, interval])

  useEffect(() => {
    const unsubscribe = krakenWsManager.subscribe({
      channel: 'ohlc',
      pair,
      interval,
      onConnected: (connected) => {
        setOhlcState((s) => ({ ...s, connected }))
      },
      onMessage: (payload) => {
        const parsed = KrakenOhlcPayload.safeParse(payload)
        if (!parsed.success) return

        // Use etime (index 1) — the bucket end boundary — not time (index 0),
        // which is a live-updating microsecond stamp and does not match REST.
        const [, etimeStr, openStr, highStr, lowStr, closeStr, , volumeStr] = parsed.data
        const time = parseFloat(etimeStr)
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
          !isFinite(candle.time) ||
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

          // Fast path: same bucket as last — update in place.
          if (last && last.time === time) {
            return { ...s, candles: [...candles.slice(0, -1), candle] }
          }

          // Fast path: strictly newer than last — append, bounded at MAX_CANDLES.
          // This is by far the common case; the branches below only run when
          // Kraken emits an out-of-order final update for a prior bucket.
          if (!last || time > last.time) {
            const next =
              candles.length >= MAX_CANDLES
                ? [...candles.slice(1), candle]
                : [...candles, candle]
            return { ...s, candles: next }
          }

          // Out-of-order: the incoming candle is for a bucket that is not
          // the current last. This happens because Kraken's ohlc channel can
          // deliver a "final update" for the just-closed bucket *after* it
          // has already started emitting ticks for the next one. Blindly
          // appending would violate lightweight-charts' ascending-order
          // invariant and crash the chart.
          //
          // Resolution: binary search for an existing candle at the same
          // bucket time and update it in place; otherwise insert at the
          // correct sorted position. The bounded buffer is enforced after
          // the insert so we don't exceed MAX_CANDLES.
          let lo = 0
          let hi = candles.length - 1
          while (lo <= hi) {
            const mid = (lo + hi) >> 1
            const midTime = candles[mid]!.time
            if (midTime === time) {
              // Found an existing candle for this bucket — replace it.
              const next = candles.slice()
              next[mid] = candle
              return { ...s, candles: next }
            }
            if (midTime < time) lo = mid + 1
            else hi = mid - 1
          }
          // No existing candle for this bucket — insert at `lo` (the first
          // index whose time is greater than ours), preserving sort order.
          const inserted = [
            ...candles.slice(0, lo),
            candle,
            ...candles.slice(lo),
          ]
          const next =
            inserted.length > MAX_CANDLES ? inserted.slice(inserted.length - MAX_CANDLES) : inserted
          return { ...s, candles: next }
        })
      },
    })
    return unsubscribe
  }, [pair, interval])

  return ohlcState
}
