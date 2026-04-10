import { useState, useEffect, useRef, useMemo } from 'react'
import { PriceChart } from '@/components/PriceChart'
import { RsiChart } from '@/components/RsiChart'
import { SignalLog } from '@/components/SignalLog'
import { EtfFlowsPanel } from '@/components/EtfFlowsPanel'
import { StablecoinPanel } from '@/components/StablecoinPanel'
import { CommentatorPanel } from '@/components/CommentatorPanel'
import { ema } from '@/indicators/ema'
import { rsi } from '@/indicators/rsi'
import { EMA_FAST_PERIOD, EMA_SLOW_PERIOD, RSI_PERIOD } from '@/strategy/signals'
import type { EtfFlowEntry } from '@/data/etfFlows'
import type { StablecoinSupplyData } from '@/data/stablecoinSupply'
import type { Candle, Pair, Position, Signal, SignalEvent, SignalResult } from '@/types'
import type { DashboardSnapshot } from '@/types/commentary'

interface LiveTabProps {
  pair: Pair
  candles: readonly Candle[]
  signal: Signal
  signalResult: SignalResult
  position: Position | null
  balance: number
  /** Active macro blackout event name (e.g. 'CPI', 'FOMC'), or null when clear */
  macroBlackout: string | null
  /** Last 14 days of BTC ETF net flows, or null when unavailable */
  etfFlows: readonly EtfFlowEntry[] | null
  /** Last 7 days of stablecoin supply data, or null when unavailable */
  stablecoinData: StablecoinSupplyData | null
  /** Current perpetual funding rate, or null while loading */
  fundingRate: number | null
  /** Crypto Fear & Greed Index 0–100, or null while loading */
  fearGreedIndex: number | null
}

export function LiveTab({ pair, candles, signal, signalResult, position, balance, macroBlackout, etfFlows, stablecoinData, fundingRate, fearGreedIndex }: LiveTabProps) {
  // Accumulate signal events from the strategy.
  // Append when signal changes away from HOLD; reset the gate when it returns to HOLD
  // so the next non-HOLD is captured as a fresh entry.
  const [events, setEvents] = useState<SignalEvent[]>([])
  const lastSignalRef = useRef<Signal>('HOLD')
  const lastVetoRef = useRef<string | undefined>(undefined)

  // `candles` is intentionally omitted from deps: we only need to fire when
  // `signal` or `signalResult` changes (which itself only changes in response to new candles).
  useEffect(() => {
    const last = candles[candles.length - 1]
    if (!last) return

    if (signal !== 'HOLD' && signal !== lastSignalRef.current) {
      setEvents(prev => [
        ...prev,
        { timestamp: Date.now(), pair, signal, price: last.close },
      ])
      lastVetoRef.current = undefined
    } else if (
      signal === 'HOLD' &&
      signalResult.baseSignal !== 'HOLD' &&
      signalResult.reason !== undefined &&
      signalResult.reason !== lastVetoRef.current
    ) {
      // A filter vetoed a non-HOLD base signal — log it as a suppressed entry
      setEvents(prev => [
        ...prev,
        {
          timestamp: Date.now(),
          pair,
          signal: 'HOLD',
          price: last.close,
          vetoReason: signalResult.reason,
        },
      ])
      lastVetoRef.current = signalResult.reason
    }

    lastSignalRef.current = signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, signalResult, pair])

  // Reset accumulated events and signal gate when pair changes
  useEffect(() => {
    setEvents([])
    lastSignalRef.current = 'HOLD'
    lastVetoRef.current = undefined
  }, [pair])

  // Build a stable DashboardSnapshot for the commentator on each candle update.
  // Indicator values are computed from the candle closes — same computation as
  // useLiveStrategy, kept here to avoid exposing internals from that hook.
  const snapshot = useMemo<DashboardSnapshot>(() => {
    const closes = candles.map(c => c.close)
    const emaFastArr = ema(closes, EMA_FAST_PERIOD)
    const emaSlowArr = ema(closes, EMA_SLOW_PERIOD)
    const rsiArr = rsi(closes, RSI_PERIOD)
    const n = closes.length
    return {
      signal,
      baseSignal: signalResult.baseSignal,
      vetoedBy: signalResult.vetoedBy,
      vetoReason: signalResult.reason,
      emaFast: n > 0 ? (emaFastArr[n - 1] ?? NaN) : NaN,
      emaSlow: n > 0 ? (emaSlowArr[n - 1] ?? NaN) : NaN,
      rsi: n > 0 ? (rsiArr[n - 1] ?? NaN) : NaN,
      candleClose: n > 0 ? (closes[n - 1] ?? NaN) : NaN,
      position,
      fundingRate,
      fearGreedIndex,
    }
  }, [candles, signal, signalResult, position, fundingRate, fearGreedIndex])

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 88px)' }}>
      {macroBlackout !== null && (
        <div
          role="alert"
          className="flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: 'color-mix(in srgb, #f59e0b 18%, var(--bg-surface))',
            borderBottom: '1px solid color-mix(in srgb, #f59e0b 40%, transparent)',
            color: '#92400e',
          }}
        >
          <span aria-hidden="true">⚠</span>
          Macro blackout active — {macroBlackout} release window. New positions suppressed.
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {/* Charts — left 2/3, stacked vertically */}
        <div className="flex flex-col" style={{ flex: '2 1 0', minWidth: 0 }}>
          {/* Price + EMA chart — 75% of chart column height */}
          <div style={{ flex: '3 1 0', minHeight: 0, borderBottom: '1px solid var(--border)' }}>
            <PriceChart candles={candles} />
          </div>
          {/* RSI panel — 25% of chart column height */}
          <div style={{ flex: '1 1 0', minHeight: 0 }}>
            <RsiChart candles={candles} />
          </div>
        </div>

        {/* Signal log + ETF flows panel — right 1/3 */}
        <div
          className="flex flex-col"
          style={{ flex: '1 1 0', minWidth: 240, overflow: 'hidden' }}
        >
          <div className="flex-1 overflow-hidden">
            <SignalLog events={events} position={position} balance={balance} />
          </div>
          <CommentatorPanel snapshot={snapshot} />
          <EtfFlowsPanel flows={etfFlows} />
          <StablecoinPanel data={stablecoinData} />
        </div>
      </div>
    </div>
  )
}
