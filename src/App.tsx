import { useState, useEffect } from 'react'
import { Header } from '@/components/Header'
import { TabBar } from '@/components/TabBar'
import { LiveTab } from '@/tabs/Live'
import { BacktestTab } from '@/tabs/Backtest'
import { JournalTab } from '@/tabs/Journal'
import { PerformanceTab } from '@/tabs/Performance'
import type { Pair, Tab } from '@/types'

/** Below this width, the layout cannot display correctly — show a resize prompt. */
const MIN_VIEWPORT_WIDTH = 1280

function ResizeGuard({ children }: { children: React.ReactNode }) {
  const [tooNarrow, setTooNarrow] = useState(window.innerWidth < MIN_VIEWPORT_WIDTH)

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setTooNarrow(window.innerWidth < MIN_VIEWPORT_WIDTH)
    })
    observer.observe(document.body)
    return () => observer.disconnect()
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

export default function App() {
  const [pair, setPair] = useState<Pair>('XBT/USDT')
  const [activeTab, setActiveTab] = useState<Tab>('live')

  return (
    <ResizeGuard>
      <div
        className="flex flex-col"
        style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}
      >
        <Header
          pair={pair}
          onPairChange={setPair}
          price={null}
          change24h={null}
        />
        <TabBar active={activeTab} onChange={setActiveTab} />

        <main className="flex-1 overflow-auto" style={{ backgroundColor: 'var(--bg-base)' }}>
          {activeTab === 'live' && <LiveTab />}
          {activeTab === 'backtest' && <BacktestTab />}
          {activeTab === 'journal' && <JournalTab />}
          {activeTab === 'performance' && <PerformanceTab />}
        </main>
      </div>
    </ResizeGuard>
  )
}
