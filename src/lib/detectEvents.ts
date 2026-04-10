import type { DashboardSnapshot, CommentaryEvent } from '@/types/commentary'
import { FUNDING_LONG_VETO_THRESHOLD, FUNDING_SHORT_VETO_THRESHOLD } from '@/strategy/filters/funding'
import { RSI_OVERBOUGHT, RSI_OVERSOLD } from '@/strategy/signals'

/**
 * Compare two consecutive dashboard snapshots and return all CommentaryEvents
 * that occurred during the transition from `prev` to `next`.
 *
 * Pure function — no side effects, no network calls.
 *
 * The caller is responsible for not passing identical snapshots. When nothing
 * narratable changed, the function returns an empty array.
 */
export function detectEvents(
  prev: DashboardSnapshot,
  next: DashboardSnapshot
): CommentaryEvent[] {
  const now = Date.now()
  const events: CommentaryEvent[] = []
  const close = next.candleClose

  // Guard: skip detection if indicator values are not yet seeded
  const indicatorsReady =
    isFinite(next.emaFast) &&
    isFinite(next.emaSlow) &&
    isFinite(next.rsi) &&
    isFinite(prev.emaFast) &&
    isFinite(prev.emaSlow) &&
    isFinite(prev.rsi)

  // ── signal-change ────────────────────────────────────────────────────────
  // Fire when an actionable (non-HOLD) signal appears fresh
  if (
    prev.signal === 'HOLD' &&
    next.signal !== 'HOLD'
  ) {
    events.push({
      kind: 'signal-change',
      timestamp: now,
      candleClose: close,
      signal: next.signal,
      emaFast: next.emaFast,
      emaSlow: next.emaSlow,
      rsi: next.rsi,
    })
  }

  // ── filter-veto ──────────────────────────────────────────────────────────
  // Fire when a new filter veto occurs (vetoedBy changed or reason changed)
  const { vetoedBy, vetoReason } = next
  if (
    vetoedBy !== undefined &&
    vetoReason !== undefined &&
    next.baseSignal !== 'HOLD' &&
    (vetoedBy !== prev.vetoedBy || vetoReason !== prev.vetoReason)
  ) {
    // baseSignal is narrowed to 'BUY' | 'SELL' by the !== 'HOLD' check above
    const baseSignal = next.baseSignal
    events.push({
      kind: 'filter-veto',
      timestamp: now,
      candleClose: close,
      baseSignal,
      vetoedBy,
      reason: vetoReason,
      fundingRate: next.fundingRate,
      fearGreedIndex: next.fearGreedIndex,
    })
  }

  // ── ema-cross ────────────────────────────────────────────────────────────
  if (indicatorsReady) {
    const prevFastAbove = prev.emaFast > prev.emaSlow
    const nextFastAbove = next.emaFast > next.emaSlow

    if (!prevFastAbove && nextFastAbove) {
      events.push({
        kind: 'ema-cross',
        timestamp: now,
        candleClose: close,
        crossType: 'golden',
        emaFast: next.emaFast,
        emaSlow: next.emaSlow,
        rsi: next.rsi,
      })
    } else if (prevFastAbove && !nextFastAbove) {
      events.push({
        kind: 'ema-cross',
        timestamp: now,
        candleClose: close,
        crossType: 'death',
        emaFast: next.emaFast,
        emaSlow: next.emaSlow,
        rsi: next.rsi,
      })
    }

    // ── rsi-zone-enter ───────────────────────────────────────────────────
    if (prev.rsi < RSI_OVERBOUGHT && next.rsi >= RSI_OVERBOUGHT) {
      events.push({
        kind: 'rsi-zone-enter',
        timestamp: now,
        candleClose: close,
        zone: 'overbought',
        rsi: next.rsi,
        emaFast: next.emaFast,
        emaSlow: next.emaSlow,
      })
    } else if (prev.rsi > RSI_OVERSOLD && next.rsi <= RSI_OVERSOLD) {
      events.push({
        kind: 'rsi-zone-enter',
        timestamp: now,
        candleClose: close,
        zone: 'oversold',
        rsi: next.rsi,
        emaFast: next.emaFast,
        emaSlow: next.emaSlow,
      })
    }

    // ── rsi-zone-exit ────────────────────────────────────────────────────
    if (prev.rsi >= RSI_OVERBOUGHT && next.rsi < RSI_OVERBOUGHT) {
      events.push({
        kind: 'rsi-zone-exit',
        timestamp: now,
        candleClose: close,
        zone: 'overbought',
        rsi: next.rsi,
      })
    } else if (prev.rsi <= RSI_OVERSOLD && next.rsi > RSI_OVERSOLD) {
      events.push({
        kind: 'rsi-zone-exit',
        timestamp: now,
        candleClose: close,
        zone: 'oversold',
        rsi: next.rsi,
      })
    }
  }

  // ── position-open ────────────────────────────────────────────────────────
  if (prev.position === null && next.position !== null) {
    events.push({
      kind: 'position-open',
      timestamp: now,
      candleClose: close,
      position: next.position,
      emaFast: next.emaFast,
      emaSlow: next.emaSlow,
      rsi: next.rsi,
    })
  }

  // ── position-close ───────────────────────────────────────────────────────
  if (prev.position !== null && next.position === null) {
    const rawPnlPct = ((close - prev.position.entryPrice) / prev.position.entryPrice) * 100
    // Short positions (size < 0) profit when price falls — invert the sign
    const isShort = prev.position.size < 0
    const pnlPercent = isShort ? -rawPnlPct : rawPnlPct
    events.push({
      kind: 'position-close',
      timestamp: now,
      candleClose: close,
      entryPrice: prev.position.entryPrice,
      exitPrice: close,
      pnlPercent,
    })
  }

  // ── funding-threshold-cross ──────────────────────────────────────────────
  if (prev.fundingRate !== null && next.fundingRate !== null) {
    const wasExtremeHigh = prev.fundingRate > FUNDING_LONG_VETO_THRESHOLD
    const isExtremeHigh = next.fundingRate > FUNDING_LONG_VETO_THRESHOLD
    const wasExtremeLow = prev.fundingRate < FUNDING_SHORT_VETO_THRESHOLD
    const isExtremeLow = next.fundingRate < FUNDING_SHORT_VETO_THRESHOLD

    if (!wasExtremeHigh && isExtremeHigh) {
      events.push({
        kind: 'funding-threshold-cross',
        timestamp: now,
        candleClose: close,
        fundingRate: next.fundingRate,
        direction: 'into-extreme',
        crowded: 'longs',
      })
    } else if (wasExtremeHigh && !isExtremeHigh) {
      events.push({
        kind: 'funding-threshold-cross',
        timestamp: now,
        candleClose: close,
        fundingRate: next.fundingRate,
        direction: 'out-of-extreme',
        crowded: 'longs',
      })
    }

    if (!wasExtremeLow && isExtremeLow) {
      events.push({
        kind: 'funding-threshold-cross',
        timestamp: now,
        candleClose: close,
        fundingRate: next.fundingRate,
        direction: 'into-extreme',
        crowded: 'shorts',
      })
    } else if (wasExtremeLow && !isExtremeLow) {
      events.push({
        kind: 'funding-threshold-cross',
        timestamp: now,
        candleClose: close,
        fundingRate: next.fundingRate,
        direction: 'out-of-extreme',
        crowded: 'shorts',
      })
    }
  }

  return events
}
