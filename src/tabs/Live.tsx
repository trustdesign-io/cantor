import { useState, useEffect, useRef } from 'react'
import { PriceChart } from '@/components/PriceChart'
import { RsiChart } from '@/components/RsiChart'
import { SignalLog } from '@/components/SignalLog'
import type { Candle, Pair, Position, Signal, SignalEvent, SignalResult } from '@/types'

interface LiveTabProps {
  pair: Pair
  candles: readonly Candle[]
  signal: Signal
  signalResult: SignalResult
  position: Position | null
  balance: number
  /** Active macro blackout event name (e.g. 'CPI', 'FOMC'), or null when clear */
  macroBlackout: string | null
}

export function LiveTab({ pair, candles, signal, signalResult, position, balance, macroBlackout }: LiveTabProps) {
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

        {/* Signal log — right 1/3 */}
        <div style={{ flex: '1 1 0', minWidth: 240, overflow: 'hidden' }}>
          <SignalLog events={events} position={position} balance={balance} />
        </div>
      </div>
    </div>
  )
}
