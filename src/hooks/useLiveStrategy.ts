import { useState, useEffect } from 'react'
import { ema } from '@/indicators/ema'
import { rsi } from '@/indicators/rsi'
import { computeSignal, EMA_FAST_PERIOD, EMA_SLOW_PERIOD, RSI_PERIOD } from '@/strategy/signals'
import { onSignal, INITIAL_STATE } from '@/strategy/paperTrader'
import type { Candle, Pair, Signal } from '@/types'
import type { PaperTraderState } from '@/strategy/paperTrader'

export interface LiveStrategyState {
  signal: Signal
  position: PaperTraderState['position']
  balance: number
  trades: PaperTraderState['trades']
}

const INITIAL_LIVE_STATE: LiveStrategyState = {
  signal: 'HOLD',
  position: null,
  balance: INITIAL_STATE.balance,
  trades: [],
}

/**
 * Wires OHLC candles through indicators → signal → paper trader.
 *
 * On each new candle array (or pair change):
 *   1. Requires at least EMA_SLOW_PERIOD + 1 candles (22) to compute a crossover
 *   2. Computes EMA-9, EMA-21, RSI-14 over close prices
 *   3. Derives a signal from the latest two bars
 *   4. Feeds the signal into the paper trader state machine
 *
 * Pair changes reset all state to the initial values.
 */
export function useLiveStrategy(pair: Pair, candles: readonly Candle[]): LiveStrategyState {
  const [currentPair, setCurrentPair] = useState(pair)
  const [signal, setSignal] = useState<Signal>('HOLD')
  const [traderState, setTraderState] = useState<PaperTraderState>(INITIAL_STATE)

  // Render-time pair reset — React batches these with the render
  if (pair !== currentPair) {
    setCurrentPair(pair)
    setSignal('HOLD')
    setTraderState(INITIAL_STATE)
  }

  useEffect(() => {
    // Need at least slow period + 1 bars to detect a crossover (prev + curr).
    // Reset signal to HOLD when the candle buffer shrinks below the minimum
    // (e.g. on reconnect without a pair change) to prevent a stale BUY/SELL
    // from persisting when indicators can no longer be computed.
    if (candles.length < EMA_SLOW_PERIOD + 1) {
      setSignal('HOLD')
      return
    }

    const closes = candles.map(c => c.close)

    const emaFast = ema(closes, EMA_FAST_PERIOD)
    const emaSlow = ema(closes, EMA_SLOW_PERIOD)
    const rsiValues = rsi(closes, RSI_PERIOD)

    const newSignal = computeSignal(emaFast, emaSlow, rsiValues)
    setSignal(newSignal)

    if (newSignal !== 'HOLD') {
      const last = candles[candles.length - 1]
      setTraderState(prev => onSignal(prev, newSignal, last.close, last.time * 1000, pair))
    }
  }, [candles, pair])

  return {
    signal,
    position: traderState.position,
    balance: traderState.balance,
    trades: traderState.trades,
  }
}
