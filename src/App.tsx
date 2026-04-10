import { useState, useEffect, useMemo } from 'react'
import { Header } from '@/components/Header'
import { TabBar } from '@/components/TabBar'
import { LiveTab } from '@/tabs/Live'
import { BacktestTab } from '@/tabs/Backtest'
import { JournalTab } from '@/tabs/Journal'
import { PerformanceTab } from '@/tabs/Performance'
import { useKrakenWebSocket } from '@/hooks/useKrakenWebSocket'
import { useKrakenOhlc } from '@/hooks/useKrakenOhlc'
import { useLiveStrategy } from '@/hooks/useLiveStrategy'
import { useFundingRate } from '@/hooks/useFundingRate'
import { useFearGreed } from '@/hooks/useFearGreed'
import { useEtfFlows } from '@/hooks/useEtfFlows'
import { useStablecoinSupply } from '@/hooks/useStablecoinSupply'
import { getActiveBlackout } from '@/data/macroCalendar'
import type { FilterContext, Pair, Tab } from '@/types'

/** Below this width, the layout cannot display correctly — show a resize prompt. */
const MIN_VIEWPORT_WIDTH = 1280

function ResizeGuard({ children }: { children: React.ReactNode }) {
  const [tooNarrow, setTooNarrow] = useState(window.innerWidth < MIN_VIEWPORT_WIDTH)

  useEffect(() => {
    const handler = () => setTooNarrow(window.innerWidth < MIN_VIEWPORT_WIDTH)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (tooNarrow) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-secondary)' }}
      >
        <span className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Cantor</span>
        <span className="text-sm">Please resize your window to at least {MIN_VIEWPORT_WIDTH}px wide.</span>
      </div>
    )
  }

  return <>{children}</>
}

function AppContent({ pair, onPairChange }: { pair: Pair; onPairChange: (p: Pair) => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('live')
  const [macroBlackout, setMacroBlackout] = useState<string | null>(() => getActiveBlackout())

  // Recheck macro blackout window every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setMacroBlackout(getActiveBlackout()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { price, change24h } = useKrakenWebSocket(pair)
  const { fundingRate } = useFundingRate()
  const { fearGreed } = useFearGreed()
  const { flows: etfFlows } = useEtfFlows()
  const { data: stablecoinData } = useStablecoinSupply()

  // Stable FilterContext — only rebuilds when the underlying values change.
  // Passing an inline object literal would recreate it every render, causing
  // the signalResult memo in useLiveStrategy to re-run unnecessarily.
  const filterContext = useMemo<FilterContext>(
    () => ({
      fundingRate: fundingRate === null ? undefined : fundingRate,
      fearGreedIndex: fearGreed === null ? undefined : fearGreed.value,
      etfFlows: etfFlows === null ? undefined : etfFlows,
    }),
    [fundingRate, fearGreed, etfFlows]
  )

  // Hoisted so trades persist when switching away from the Live tab
  const { candles } = useKrakenOhlc(pair)
  const { signal, signalResult, position, balance, trades } = useLiveStrategy(pair, candles, filterContext)

  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}
    >
      <Header
        pair={pair}
        onPairChange={onPairChange}
        price={price}
        change24h={change24h}
        fundingRate={fundingRate}
        fearGreed={fearGreed}
      />
      <TabBar active={activeTab} onChange={setActiveTab} />

      <main className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
        {activeTab === 'live' && (
          <LiveTab pair={pair} candles={candles} signal={signal} signalResult={signalResult} position={position} balance={balance} macroBlackout={macroBlackout} etfFlows={etfFlows} stablecoinData={stablecoinData} fundingRate={fundingRate} fearGreedIndex={fearGreed === null ? null : fearGreed.value} />
        )}
        {activeTab === 'backtest' && <BacktestTab pair={pair} />}
        {activeTab === 'journal' && <JournalTab trades={trades} />}
        {activeTab === 'performance' && <PerformanceTab pair={pair} trades={trades} />}
      </main>
    </div>
  )
}

export default function App() {
  const [pair, setPair] = useState<Pair>('XBT/USDT')

  return (
    <ResizeGuard>
      <AppContent pair={pair} onPairChange={setPair} />
    </ResizeGuard>
  )
}
