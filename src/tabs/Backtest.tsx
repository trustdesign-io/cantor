import { useState } from 'react'
import { fetchOHLC } from '@/api/krakenRest'
import { runBacktest } from '@/strategy/backtest'
import { computeMetrics } from '@/metrics/performance'
import { Journal } from '@/components/Journal'
import { Performance } from '@/components/Performance'
import { INITIAL_BALANCE } from '@/strategy/paperTrader'
import type { PerformanceMetrics } from '@/metrics/performance'
import type { Pair, Trade } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function defaultStartDate(): string {
  return toDateString(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
}

function defaultEndDate(): string {
  return toDateString(new Date())
}

// ── Component ─────────────────────────────────────────────────────────────────

type Status = 'idle' | 'loading' | 'done' | 'error'

interface BacktestTabProps {
  pair: Pair
}

interface Results {
  trades: readonly Trade[]
  metrics: PerformanceMetrics
}

export function BacktestTab({ pair }: BacktestTabProps) {
  const today = toDateString(new Date())

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate]     = useState(defaultEndDate)
  const [status, setStatus]       = useState<Status>('idle')
  const [results, setResults]     = useState<Results | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function handleRun() {
    setStatus('loading')
    setResults(null)
    setError(null)

    try {
      const since = Math.floor(new Date(startDate).getTime() / 1000)
      // endDate is inclusive — include all candles up to 23:59:59 of the end day
      const until = Math.floor(new Date(endDate).getTime() / 1000) + 24 * 60 * 60 - 1

      const allCandles = await fetchOHLC(pair, 60, since)
      // Client-side filter to respect the end date (Kraken doesn't take an `until` param)
      const candles = allCandles.filter(c => c.time <= until)

      if (candles.length === 0) {
        throw new Error('No candle data returned for the selected date range.')
      }

      const result  = runBacktest(candles, pair)
      const metrics = computeMetrics(result.trades, INITIAL_BALANCE)
      setResults({ trades: result.trades, metrics })
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setStatus('error')
    }
  }

  const isLoading = status === 'loading'

  return (
    <div
      className="flex flex-col gap-6 p-6 overflow-y-auto"
      style={{ height: 'calc(100vh - 88px)', backgroundColor: 'var(--bg-base)' }}
    >
      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="flex items-end gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="backtest-start"
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            Start date
          </label>
          <input
            id="backtest-start"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            max={endDate}
            className="rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="backtest-end"
            className="text-xs font-medium"
            style={{ color: 'var(--text-secondary)' }}
          >
            End date
          </label>
          <input
            id="backtest-end"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
            max={today}
            className="rounded px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={isLoading}
          className="rounded px-4 py-2 text-sm font-semibold"
          style={{
            backgroundColor: isLoading ? 'var(--bg-surface)' : 'var(--accent)',
            color: isLoading ? 'var(--text-secondary)' : 'var(--accent-foreground, #fff)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            border: 'none',
          }}
        >
          Run Backtest
        </button>

        {isLoading && (
          <span
            role="status"
            aria-label="Running backtest…"
            className="inline-block w-5 h-5 rounded-full border-2 animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {status === 'error' && error && (
        <div
          role="alert"
          className="rounded px-4 py-3 text-sm"
          style={{
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--signal-sell, #ef4444)',
            border: '1px solid var(--signal-sell, #ef4444)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {status === 'done' && results && (
        <div className="flex flex-col gap-6">
          <section aria-label="Backtest performance">
            <Performance metrics={results.metrics} />
          </section>
          <section aria-label="Backtest trade journal">
            <Journal trades={results.trades} />
          </section>
        </div>
      )}

      {/* ── Idle prompt ──────────────────────────────────────────────────── */}
      {status === 'idle' && (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Select a date range and click <em>Run Backtest</em> to replay the strategy over historical data.
        </p>
      )}
    </div>
  )
}
