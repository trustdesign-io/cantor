import { useState, useEffect, useRef } from 'react'
import { PriceChart } from '@/components/PriceChart'
import { RsiChart } from '@/components/RsiChart'
import { SignalLog } from '@/components/SignalLog'
import type { Candle, Pair, Position, Signal, SignalEvent } from '@/types'

interface LiveTabProps {
  pair: Pair
  candles: readonly Candle[]
  signal: Signal
  position: Position | null
  balance: number
}

export function LiveTab({ pair, candles, signal, position, balance }: LiveTabProps) {
  // Accumulate signal events from the strategy.
  // Append when signal changes away from HOLD; reset the gate when it returns to HOLD
  // so the next non-HOLD is captured as a fresh entry.
  const [events, setEvents] = useState<SignalEvent[]>([])
  const lastSignalRef = useRef<Signal>('HOLD')
  // `candles` is intentionally omitted from deps: we only need to fire when
  // `signal` changes (which itself only changes in response to new candles).
  // Including `candles` would add a spurious run on every tick.
  useEffect(() => {
    if (signal !== 'HOLD' && signal !== lastSignalRef.current) {
      const last = candles[candles.length - 1]
      if (!last) return
      setEvents(prev => [
        ...prev,
        {
          timestamp: Date.now(),
          pair,
          signal,
          price: last.close,
        },
      ])
    }
    lastSignalRef.current = signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signal, pair])

  // Reset accumulated events and signal gate when pair changes
  useEffect(() => {
    setEvents([])
    lastSignalRef.current = 'HOLD'
  }, [pair])

  return (
    <div className="flex" style={{ height: 'calc(100vh - 88px)' }}>
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
  )
}
