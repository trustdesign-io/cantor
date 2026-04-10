import { useMemo } from 'react'
import { Performance } from '@/components/Performance'
import { computeMetrics } from '@/metrics/performance'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { Trade } from '@/types'

interface PerformanceTabProps {
  trades: readonly Trade[]
}

export function PerformanceTab({ trades }: PerformanceTabProps) {
  const metrics = useMemo(
    () => computeMetrics(trades, INITIAL_BALANCE),
    [trades],
  )

  return (
    <div style={{ height: 'calc(100vh - 88px)' }}>
      <Performance metrics={metrics} />
    </div>
  )
}
