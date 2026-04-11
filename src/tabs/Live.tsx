import { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { Group, Panel, Separator, type Layout } from 'react-resizable-panels'
import { PriceChart } from '@/components/PriceChart'
import { RsiChart } from '@/components/RsiChart'
import { SignalLog } from '@/components/SignalLog'
import { StrategyHeartbeat } from '@/components/StrategyHeartbeat'
import { EtfFlowsPanel } from '@/components/EtfFlowsPanel'
import { StablecoinPanel } from '@/components/StablecoinPanel'
import { CommentatorPanel } from '@/components/CommentatorPanel'
import { TeachMeButton } from '@/components/TeachMeButton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { NewsLane } from '@/components/NewsLane'
import { useCryptoPanic } from '@/hooks/useCryptoPanic'
import { useGdeltNews } from '@/hooks/useGdeltNews'
import { mergeAndSortEvents } from '@/lib/newsFilters'
import { ema } from '@/indicators/ema'
import { rsi } from '@/indicators/rsi'
import { EMA_FAST_PERIOD, EMA_SLOW_PERIOD, RSI_PERIOD } from '@/strategy/signals'
import type { EtfFlowEntry } from '@/data/etfFlows'
import type { StablecoinSupplyData } from '@/data/stablecoinSupply'
import type { Candle, OhlcInterval, Pair, Position, Signal, SignalEvent, SignalResult } from '@/types'
import type { DashboardSnapshot } from '@/types/commentary'

interface LiveTabProps {
  pair: Pair
  /** Active OHLC interval — used to clear the signal log on interval change */
  interval: OhlcInterval
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

/**
 * LocalStorage keys for persisted panel layouts. react-resizable-panels v4 has
 * no `autoSaveId` prop — we manage persistence ourselves via the `defaultLayout`
 * prop on mount and the `onLayoutChanged` callback on commit.
 */
const LS_KEY_OUTER = 'cantor.live.layout.outer'
const LS_KEY_CHART_COL = 'cantor.live.layout.chartCol'
const LS_KEY_ACTIVE_TAB = 'cantor.activeTab'

/** Safe read + JSON parse for a layout from localStorage. */
function loadLayout(key: string): Layout | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object') return undefined
    // Shallow validation: all values must be finite numbers
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (typeof v !== 'number' || !isFinite(v)) return undefined
    }
    return parsed as Layout
  } catch {
    return undefined
  }
}

/** Safe save for a layout to localStorage. */
function saveLayout(key: string, layout: Layout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // localStorage may throw in private mode — ignore
  }
}

export function LiveTab({ pair, interval, candles, signal, signalResult, position, balance, macroBlackout, etfFlows, stablecoinData, fundingRate, fearGreedIndex }: LiveTabProps) {
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

  // Reset accumulated events and signal gate when pair or interval changes —
  // signal history from a different pair or timeframe is meaningless.
  useEffect(() => {
    setEvents([])
    lastSignalRef.current = 'HOLD'
    lastVetoRef.current = undefined
  }, [pair, interval])

  // Build a stable DashboardSnapshot for the commentator on each candle update.
  // Indicator values are computed from the candle closes using the same functions
  // and periods as useLiveStrategy. This is intentional duplication — useLiveStrategy
  // does not expose its intermediate indicator arrays publicly, and adding a new
  // return value would change its API surface. If the indicator logic or period
  // constants change in useLiveStrategy, this snapshot must be updated to match.
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

  // Strategy heartbeat: track the wall-clock time of the most recent snapshot
  // update so the heartbeat strip can show "tick Xs ago". We key the effect
  // on a cheap identity proxy (candles length + last-candle timestamp) rather
  // than the snapshot object itself, which would fire far more than needed.
  const [lastTickAt, setLastTickAt] = useState<number | null>(null)
  const lastCandleTime = candles.length > 0 ? (candles[candles.length - 1]?.time ?? 0) : 0
  useEffect(() => {
    if (candles.length === 0) return
    setLastTickAt(Date.now())
  }, [candles.length, lastCandleTime])
  // Reset on pair/interval change — an old tick timestamp from another
  // market would make the new one look instantly stale.
  useEffect(() => {
    setLastTickAt(null)
  }, [pair, interval])

  // 1 Hz clock so the "tick Xs ago" label keeps counting between WS ticks.
  // Using a separate state (rather than Date.now() in render) avoids a render
  // storm during high-frequency WS updates — the heartbeat reads whichever
  // value is fresher.
  const [now, setNow] = useState<number>(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Interval in ms for the heartbeat's staleness threshold.
  const intervalMs = interval * 60_000

  // News data hooks — aggregate events from CryptoPanic and GDELT.
  const {
    events: cryptoEvents,
    loading: cryptoLoading,
    hasKey: hasCryptoPanicKey,
    setKey: setCryptoPanicKey,
  } = useCryptoPanic(pair)
  const { events: gdeltEvents, loading: gdeltLoading } = useGdeltNews()
  const newsLoading = cryptoLoading || gdeltLoading
  const allNewsEvents = useMemo(
    () => mergeAndSortEvents(cryptoEvents, gdeltEvents),
    [cryptoEvents, gdeltEvents]
  )

  // Load persisted layouts once on mount. Using useMemo keeps the initial
  // layout stable across re-renders without triggering a state update.
  const initialOuter = useMemo(() => loadLayout(LS_KEY_OUTER), [])
  const initialChartCol = useMemo(() => loadLayout(LS_KEY_CHART_COL), [])

  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem(LS_KEY_ACTIVE_TAB) ?? 'signals'
    } catch {
      return 'signals'
    }
  })

  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value)
    try {
      localStorage.setItem(LS_KEY_ACTIVE_TAB, value)
    } catch {
      // ignore
    }
  }, [])

  const onOuterLayoutChanged = useCallback((layout: Layout) => {
    saveLayout(LS_KEY_OUTER, layout)
  }, [])
  const onChartColLayoutChanged = useCallback((layout: Layout) => {
    saveLayout(LS_KEY_CHART_COL, layout)
  }, [])

  // Clear saved panel layouts and reload so defaults take effect.
  // LS_KEY_ACTIVE_TAB is intentionally not reset here — tab preference is
  // not a "layout" concern and the user would be surprised if their chosen
  // tab reset every time they hit the layout-reset button.
  const handleResetLayout = useCallback(() => {
    try {
      localStorage.removeItem(LS_KEY_OUTER)
      localStorage.removeItem(LS_KEY_CHART_COL)
    } catch {
      // localStorage may throw in private mode — ignore, the reload will
      // still work with the in-memory defaults
    }
    window.location.reload()
  }, [])

  // Shared Separator styles. react-resizable-panels forbids overriding
  // flex-grow/flex-shrink on Separators, but size/background/cursor are fine.
  const hSeparatorStyle = {
    width: 4,
    background: 'var(--border)',
    cursor: 'col-resize',
  } as const
  const vSeparatorStyle = {
    height: 4,
    background: 'var(--border)',
    cursor: 'row-resize',
  } as const

  // Shared Panel style — Panel applies style to its inner wrapper div.
  const panelFillStyle = { width: '100%', height: '100%' } as const

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
      <div className="flex-1 overflow-hidden">
        <Group
          orientation="horizontal"
          id="cantor.live.outer"
          defaultLayout={initialOuter}
          onLayoutChanged={onOuterLayoutChanged}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Charts column — left 72%, stacked vertically */}
          <Panel id="charts" defaultSize={72} minSize={40} style={panelFillStyle}>
            {/* Heartbeat strip — full-width, above the resizable chart panes */}
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <StrategyHeartbeat
              baseSignal={snapshot.baseSignal}
              emaFast={snapshot.emaFast}
              emaSlow={snapshot.emaSlow}
              rsi={snapshot.rsi}
              lastTickAt={lastTickAt}
              now={now}
              intervalMs={intervalMs}
            />
            <div style={{ flex: 1, minHeight: 0 }}>
            <Group
              orientation="vertical"
              id="cantor.live.chartCol"
              defaultLayout={initialChartCol}
              onLayoutChanged={onChartColLayoutChanged}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Price + EMA chart */}
              <Panel id="price" defaultSize={75} minSize={30} style={panelFillStyle}>
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <PriceChart candles={candles} />
                  {/* EMA legend overlay with teach-me buttons */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      display: 'flex',
                      gap: 12,
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: '#22d3ee', pointerEvents: 'auto' }}
                    >
                      EMA {EMA_FAST_PERIOD}
                      <TeachMeButton
                        topicId="ema-fast"
                        currentValue={isNaN(snapshot.emaFast) ? 'not yet calculated' : snapshot.emaFast.toFixed(2)}
                      />
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: '#f59e0b', pointerEvents: 'auto' }}
                    >
                      EMA {EMA_SLOW_PERIOD}
                      <TeachMeButton
                        topicId="ema-slow"
                        currentValue={isNaN(snapshot.emaSlow) ? 'not yet calculated' : snapshot.emaSlow.toFixed(2)}
                      />
                    </span>
                  </div>
                  {/* Reset layout button — top right of the price chart */}
                  <button
                    type="button"
                    onClick={handleResetLayout}
                    aria-label="Reset layout to defaults"
                    title="Reset layout"
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 2,
                      width: 22,
                      height: 22,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: 13,
                      lineHeight: 1,
                    }}
                  >
                    ⟲
                  </button>
                </div>
              </Panel>
              <Separator
                aria-label="Resize price chart and RSI panel"
                style={vSeparatorStyle}
              />
              {/* RSI panel */}
              <Panel id="rsi" defaultSize={25} minSize={15} style={panelFillStyle}>
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <RsiChart candles={candles} />
                  {/* RSI label overlay with teach-me button */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      left: 8,
                      zIndex: 2,
                    }}
                  >
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: '#a78bfa' }}
                    >
                      RSI {RSI_PERIOD}
                      <TeachMeButton
                        topicId="rsi"
                        currentValue={isNaN(snapshot.rsi) ? 'not yet calculated' : snapshot.rsi.toFixed(1)}
                      />
                    </span>
                  </div>
                </div>
              </Panel>
              <Separator
                aria-label="Resize RSI and news lane"
                style={vSeparatorStyle}
              />
              {/* News lane */}
              <Panel id="news" defaultSize={15} minSize={10} style={panelFillStyle}>
                <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                  {!hasCryptoPanicKey && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 8,
                        zIndex: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <CryptoPanicKeyPrompt onSave={setCryptoPanicKey} />
                    </div>
                  )}
                  <NewsLane
                    events={allNewsEvents}
                    candles={candles}
                    intervalMins={interval}
                    loading={newsLoading}
                  />
                </div>
              </Panel>
            </Group>
            </div>
            </div>
          </Panel>
          <Separator
            aria-label="Resize chart and sidebar panes"
            style={hSeparatorStyle}
          />
          {/* Sidebar — right 28%, tab-based */}
          <Panel id="sidebar" defaultSize={28} minSize={20} style={panelFillStyle}>
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <TabsList>
                <TabsTrigger value="signals">Signals</TabsTrigger>
                <TabsTrigger value="commentary">Commentary</TabsTrigger>
                <TabsTrigger value="flows">ETF Flows</TabsTrigger>
                <TabsTrigger value="stablecoin">Stablecoin</TabsTrigger>
              </TabsList>
              <TabsContent value="signals" className="overflow-y-auto">
                <SignalLog events={events} position={position} balance={balance} />
              </TabsContent>
              <TabsContent value="commentary">
                <CommentatorPanel snapshot={snapshot} />
              </TabsContent>
              <TabsContent value="flows" className="overflow-y-auto">
                <EtfFlowsPanel flows={etfFlows} pair={pair} />
              </TabsContent>
              <TabsContent value="stablecoin" className="overflow-y-auto">
                <StablecoinPanel data={stablecoinData} />
              </TabsContent>
            </Tabs>
          </Panel>
        </Group>
      </div>
    </div>
  )
}

// ── CryptoPanic API key prompt ─────────────────────────────────────────────────

function CryptoPanicKeyPrompt({ onSave }: { onSave: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2 py-0.5 text-xs rounded"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
        title="Add CryptoPanic API key to see crypto news"
      >
        + CryptoPanic key
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="password"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="CryptoPanic API key"
        autoFocus
        className="text-xs px-2 py-0.5 rounded"
        style={{
          width: 160,
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' && value.trim()) {
            onSave(value.trim())
            setOpen(false)
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      <button
        type="button"
        onClick={() => { if (value.trim()) { onSave(value.trim()); setOpen(false) } }}
        disabled={!value.trim()}
        className="px-2 py-0.5 text-xs rounded"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--bg-base)',
          border: 'none',
          cursor: value.trim() ? 'pointer' : 'not-allowed',
          opacity: value.trim() ? 1 : 0.5,
        }}
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="px-2 py-0.5 text-xs rounded"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        ✕
      </button>
    </div>
  )
}
