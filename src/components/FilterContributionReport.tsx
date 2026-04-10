import { useState, useCallback } from 'react'
import { fetchOHLC } from '@/api/krakenRest'
import { runFilterAblation } from '@/strategy/ablation'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { AblationEntry } from '@/strategy/ablation'
import type { Pair } from '@/types'

interface FilterContributionReportProps {
  pair: Pair
}

type SortKey = 'filterName' | 'deltaReturn' | 'deltaSharpe' | 'deltaTrades'
type SortDir = 'asc' | 'desc'

const DELTA_FMT = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'always' })
const COUNT_FMT = new Intl.NumberFormat('en-GB', { signDisplay: 'always' })

const RETURN_THRESHOLD = 1.0  // ±1% total return = meaningful contribution
const SHARPE_THRESHOLD = 0.1  // ±0.1 Sharpe units

function verdict(entry: AblationEntry): { label: string; colour: string } {
  if (entry.allTradesRemoved) return { label: 'no trades', colour: 'var(--text-secondary)' }
  if (entry.deltaReturn > RETURN_THRESHOLD || entry.deltaSharpe > SHARPE_THRESHOLD) {
    return { label: 'helping', colour: 'var(--win)' }
  }
  if (entry.deltaReturn < -RETURN_THRESHOLD || entry.deltaSharpe < -SHARPE_THRESHOLD) {
    return { label: 'hurting', colour: 'var(--loss)' }
  }
  return { label: 'neutral', colour: 'var(--text-secondary)' }
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span aria-hidden="true" style={{ opacity: 0.3 }}>↕</span>
  return <span aria-hidden="true">{dir === 'asc' ? '↑' : '↓'}</span>
}

export function FilterContributionReport({ pair }: FilterContributionReportProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [results, setResults] = useState<AblationEntry[] | null>(null)
  const [tradeCount, setTradeCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('deltaReturn')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const run = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      // 30 days × 24 hours = 720 candles at 60-min intervals
      const since = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60
      const candles = await fetchOHLC(pair, 60, since)
      const entries = runFilterAblation(candles, pair, INITIAL_BALANCE)
      // Baseline trade count: run with all filters, same candles
      const { runBacktest } = await import('@/strategy/backtest')
      const { DEFAULT_FILTERS } = await import('@/strategy/signals')
      const baseline = runBacktest(candles, pair, {}, DEFAULT_FILTERS)
      setTradeCount(baseline.trades.length)
      setResults(entries)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ablation failed')
      setStatus('error')
    }
  }, [pair])

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = results
    ? [...results].sort((a, b) => {
        const av = a[sortKey]
        const bv = b[sortKey]
        const cmp = typeof av === 'string'
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : null

  const buttonLabel = status === 'loading'
    ? 'Running…'
    : results !== null
      ? 'Re-run ablation'
      : 'Run ablation'

  const headerCellStyle = {
    padding: '6px 12px',
    textAlign: 'left' as const,
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
    borderBottom: '1px solid var(--border)',
  }

  const cellStyle = {
    padding: '7px 12px',
    fontSize: 12,
    borderBottom: '1px solid var(--border)',
    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
  }

  return (
    <section aria-labelledby="ablation-heading" style={{ marginTop: 24 }}>
      <div className="flex items-center justify-between gap-4" style={{ marginBottom: 12 }}>
        <h2
          id="ablation-heading"
          className="text-sm font-semibold"
          style={{ color: 'var(--text-primary)', margin: 0 }}
        >
          Filter Contribution (30-day ablation)
        </h2>
        <button
          onClick={() => { void run() }}
          disabled={status === 'loading'}
          aria-busy={status === 'loading'}
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            opacity: status === 'loading' ? 0.6 : 1,
          }}
        >
          {buttonLabel}
        </button>
      </div>

      {status === 'error' && error && (
        <p role="alert" className="text-xs" style={{ color: 'var(--loss)', marginBottom: 8 }}>
          {error}
        </p>
      )}

      {status === 'loading' && (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }} aria-live="polite">
          Fetching 30 days of 60-min candles and running {'{N+1}'} backtests…
        </p>
      )}

      {status === 'done' && sorted && (
        <>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>
            Sample size: {tradeCount} trade{tradeCount !== 1 ? 's' : ''}.
            {tradeCount < 100 && ' Not statistically significant below ~100 trades — treat as directional only.'}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}
              aria-label="Filter contribution report"
            >
              <thead>
                <tr>
                  {(
                    [
                      { key: 'filterName' as SortKey, label: 'Filter' },
                      { key: 'deltaReturn' as SortKey, label: 'Return Δ %' },
                      { key: 'deltaSharpe' as SortKey, label: 'Sharpe Δ' },
                      { key: 'deltaTrades' as SortKey, label: 'Trades Δ' },
                    ] as const
                  ).map(col => (
                    <th
                      key={col.key}
                      scope="col"
                      onClick={() => handleSort(col.key)}
                      aria-sort={
                        sortKey === col.key
                          ? sortDir === 'asc' ? 'ascending' : 'descending'
                          : 'none'
                      }
                      style={headerCellStyle}
                    >
                      {col.label}{' '}
                      <SortIcon active={sortKey === col.key} dir={sortDir} />
                    </th>
                  ))}
                  <th scope="col" style={{ ...headerCellStyle, cursor: 'default' }}>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map(entry => {
                  const v = verdict(entry)
                  return (
                    <tr key={entry.filterName}>
                      <td style={{ ...cellStyle, fontFamily: 'inherit' }}>{entry.filterName}</td>
                      <td style={{ ...cellStyle, color: entry.deltaReturn > 0 ? 'var(--win)' : entry.deltaReturn < 0 ? 'var(--loss)' : 'inherit' }}>
                        {DELTA_FMT.format(entry.deltaReturn)}
                      </td>
                      <td style={{ ...cellStyle, color: entry.deltaSharpe > 0 ? 'var(--win)' : entry.deltaSharpe < 0 ? 'var(--loss)' : 'inherit' }}>
                        {DELTA_FMT.format(entry.deltaSharpe)}
                      </td>
                      <td style={cellStyle}>
                        {COUNT_FMT.format(entry.deltaTrades)}
                      </td>
                      <td style={{ ...cellStyle, color: v.colour, fontFamily: 'inherit' }}>
                        {v.label}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            Δ = baseline (all filters on) minus with-filter removed.
            Positive return Δ means the filter added to total return.
          </p>
        </>
      )}
    </section>
  )
}
