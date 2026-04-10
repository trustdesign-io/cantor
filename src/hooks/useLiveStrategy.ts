import { useState, useEffect, useMemo, useReducer } from 'react'
import { ema } from '@/indicators/ema'
import { rsi } from '@/indicators/rsi'
import { detectSignal, EMA_FAST_PERIOD, EMA_SLOW_PERIOD, RSI_PERIOD } from '@/strategy/signals'
import { onSignal, INITIAL_STATE } from '@/strategy/paperTrader'
import type { Candle, FilterContext, Pair, Signal, SignalResult } from '@/types'
import type { PaperTraderState } from '@/strategy/paperTrader'

export interface LiveStrategyState {
  signal: Signal
  signalResult: SignalResult
  position: PaperTraderState['position']
  balance: number
  trades: PaperTraderState['trades']
}

type TraderAction =
  | { type: 'signal'; signal: Exclude<Signal, 'HOLD'>; price: number; time: number; pair: Pair }
  | { type: 'reset' }

function traderReducer(state: PaperTraderState, action: TraderAction): PaperTraderState {
  if (action.type === 'reset') return INITIAL_STATE
  return onSignal(state, action.signal, action.price, action.time, action.pair)
}

/**
 * Wires OHLC candles through indicators → signal → filter pipeline → paper trader.
 *
 * signalResult is derived state computed via useMemo (no effect needed).
 * Trader state is accumulated via useReducer, updated via effect dispatch.
 *
 * Pair changes reset all state to the initial values.
 */
export function useLiveStrategy(
  pair: Pair,
  candles: readonly Candle[],
  context: FilterContext = {}
): LiveStrategyState {
  const [currentPair, setCurrentPair] = useState(pair)
  const [traderState, dispatch] = useReducer(traderReducer, INITIAL_STATE)

  // Render-time pair reset — React batches these with the render
  if (pair !== currentPair) {
    setCurrentPair(pair)
    dispatch({ type: 'reset' })
  }

  // SignalResult is pure derived state — no effect or setState needed
  const signalResult = useMemo<SignalResult>(() => {
    if (candles.length < EMA_SLOW_PERIOD + 1) {
      return { signal: 'HOLD', baseSignal: 'HOLD' }
    }
    const closes = candles.map(c => c.close)
    return detectSignal(
      ema(closes, EMA_FAST_PERIOD),
      ema(closes, EMA_SLOW_PERIOD),
      rsi(closes, RSI_PERIOD),
      candles,
      context,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles])

  const signal = signalResult.signal

  // Advance the paper trader when an actionable signal arrives.
  // dispatch is stable and does not trigger the set-state-in-effect rule.
  useEffect(() => {
    if (signal === 'HOLD') return
    const last = candles[candles.length - 1]
    if (!last) return
    dispatch({ type: 'signal', signal, price: last.close, time: last.time * 1000, pair })
  }, [signal, pair, candles])

  return {
    signal,
    signalResult,
    position: traderState.position,
    balance: traderState.balance,
    trades: traderState.trades,
  }
}
