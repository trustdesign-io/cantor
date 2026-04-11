import type { NewsEvent, NewsFilters } from '@/types/news'

/** Apply category and impact filters to a list of news events. */
export function applyNewsFilters(events: NewsEvent[], filters: NewsFilters): NewsEvent[] {
  return events.filter(
    e => filters.categories[e.category] && e.impact >= filters.minImpact
  )
}

/** Merge two arrays of events, deduplicating by id, sorted ascending by time. */
export function mergeAndSortEvents(a: NewsEvent[], b: NewsEvent[]): NewsEvent[] {
  const map = new Map<string, NewsEvent>()
  for (const e of a) map.set(e.id, e)
  for (const e of b) map.set(e.id, e)
  return Array.from(map.values()).sort((x, y) => x.time - y.time)
}

/**
 * Given a set of candles and a target unix timestamp, find the candle index
 * closest to that timestamp (for chart scrubbing).
 */
export function findNearestCandleIndex(
  candleTimes: readonly number[],
  targetTime: number
): number {
  if (candleTimes.length === 0) return 0
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < candleTimes.length; i++) {
    const diff = Math.abs((candleTimes[i] ?? 0) - targetTime)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }
  return best
}

/** Compute the percentage price change from a candle at index `start` to `end`. */
export function pctChange(
  closes: readonly number[],
  start: number,
  end: number
): number | null {
  const from = closes[start]
  const to = closes[end]
  if (from == null || to == null || from === 0) return null
  return ((to - from) / from) * 100
}
