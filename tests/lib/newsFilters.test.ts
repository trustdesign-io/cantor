import { describe, it, expect } from 'vitest'
import { applyNewsFilters, mergeAndSortEvents, findNearestCandleIndex, pctChange } from '@/lib/newsFilters'
import type { NewsEvent, NewsFilters } from '@/types/news'

function makeEvent(id: string, category: NewsEvent['category'], impact: number, time = 1_700_000_000): NewsEvent {
  return { id, time, title: `${id} headline`, source: 'test', category, impact }
}

const ALL_ON: NewsFilters = {
  categories: { crypto: true, macro: true, geopolitical: true, regulatory: true },
  minImpact: 0,
}

describe('applyNewsFilters', () => {
  it('returns all events when all categories enabled and minImpact=0', () => {
    const events = [makeEvent('a', 'crypto', 5), makeEvent('b', 'macro', 1), makeEvent('c', 'geopolitical', 8)]
    expect(applyNewsFilters(events, ALL_ON)).toHaveLength(3)
  })

  it('hides events whose category is disabled', () => {
    const events = [makeEvent('a', 'crypto', 5), makeEvent('b', 'macro', 1)]
    const filters: NewsFilters = { ...ALL_ON, categories: { ...ALL_ON.categories, macro: false } }
    const result = applyNewsFilters(events, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('hides events below minImpact', () => {
    const events = [makeEvent('a', 'crypto', 3), makeEvent('b', 'crypto', 10)]
    const filters: NewsFilters = { ...ALL_ON, minImpact: 5 }
    const result = applyNewsFilters(events, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('hides events that fail both category and impact filters', () => {
    const events = [makeEvent('a', 'macro', 1)]
    const filters: NewsFilters = {
      categories: { ...ALL_ON.categories, macro: false },
      minImpact: 5,
    }
    expect(applyNewsFilters(events, filters)).toHaveLength(0)
  })

  it('returns empty array when no events match', () => {
    expect(applyNewsFilters([], ALL_ON)).toHaveLength(0)
  })
})

describe('mergeAndSortEvents', () => {
  it('combines two arrays and deduplicates by id', () => {
    const a = [makeEvent('x', 'crypto', 1, 100), makeEvent('y', 'macro', 2, 200)]
    const b = [makeEvent('y', 'macro', 3, 200), makeEvent('z', 'geopolitical', 4, 50)]
    const merged = mergeAndSortEvents(a, b)
    // 3 unique ids, sorted by time
    expect(merged).toHaveLength(3)
    expect(merged[0].id).toBe('z') // time=50
    expect(merged[1].id).toBe('x') // time=100
    expect(merged[2].id).toBe('y') // time=200, b wins on dup
    // b's version of 'y' has impact=3
    expect(merged[2].impact).toBe(3)
  })

  it('returns sorted result with an empty second array', () => {
    const a = [makeEvent('b', 'crypto', 1, 300), makeEvent('a', 'crypto', 1, 100)]
    const merged = mergeAndSortEvents(a, [])
    expect(merged[0].time).toBe(100)
    expect(merged[1].time).toBe(300)
  })
})

describe('findNearestCandleIndex', () => {
  it('returns 0 for empty array', () => {
    expect(findNearestCandleIndex([], 1000)).toBe(0)
  })

  it('finds exact match', () => {
    expect(findNearestCandleIndex([100, 200, 300], 200)).toBe(1)
  })

  it('finds nearest when no exact match', () => {
    expect(findNearestCandleIndex([100, 200, 300], 230)).toBe(1) // 30 away from 200, 70 away from 300
    expect(findNearestCandleIndex([100, 200, 300], 270)).toBe(2) // 30 away from 300, 70 away from 200
  })
})

describe('pctChange', () => {
  it('returns null when start index is out of range', () => {
    expect(pctChange([100, 110], 5, 6)).toBeNull()
  })

  it('returns null when from price is 0', () => {
    expect(pctChange([0, 100], 0, 1)).toBeNull()
  })

  it('computes positive change', () => {
    const result = pctChange([100, 110], 0, 1)
    expect(result).toBeCloseTo(10)
  })

  it('computes negative change', () => {
    const result = pctChange([100, 90], 0, 1)
    expect(result).toBeCloseTo(-10)
  })
})
