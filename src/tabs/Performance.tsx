import { useMemo } from 'react'
import { Performance } from '@/components/Performance'
import { FilterContributionReport } from '@/components/FilterContributionReport'
import { computeMetrics } from '@/metrics/performance'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { Pair, Trade } from '@/types'

interface PerformanceTabProps {
  pair: Pair
  trades: readonly Trade[]
}

export function PerformanceTab({ pair, trades }: PerformanceTabProps) {
  const metrics = useMemo(
    () => computeMetrics(trades, INITIAL_BALANCE),
    [trades],
  )

  return (
    <div className="overflow-auto" style={{ height: 'calc(100vh - 88px)', backgroundColor: 'var(--bg-base)' }}>
      <div className="p-6">
        <Performance metrics={metrics} />
        <FilterContributionReport pair={pair} />
      </div>
    </div>
  )
}
