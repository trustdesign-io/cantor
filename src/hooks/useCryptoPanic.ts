import { useState, useEffect } from 'react'
import type { NewsEvent } from '@/types/news'

const LS_KEY_API_KEY = 'cantor.cryptoPanicKey'
const BASE_URL = 'https://cryptopanic.com/api/v1/posts'

/** Max age of news to fetch, in days. Free tier allows ~30 days. */
const FETCH_DAYS = 7

interface CryptoPanicPost {
  id: number
  title: string
  published_at: string
  url: string
  votes: { positive: number; negative: number; important: number; liked: number; disliked: number; lol: number; toxic: number; saved: number; comments: number }
  currencies?: Array<{ code: string; title: string }>
  kind: string
  domain: string
}

interface CryptoPanicResponse {
  results: CryptoPanicPost[]
}

/** Read or prompt for the CryptoPanic API key. Returns null if not set and user cancelled. */
export function getCryptoPanicKey(): string | null {
  try {
    const stored = localStorage.getItem(LS_KEY_API_KEY)
    if (stored) return stored
  } catch {
    // localStorage unavailable
  }
  return null
}

/** Persist the CryptoPanic API key to localStorage. */
export function setCryptoPanicKey(key: string): void {
  try {
    localStorage.setItem(LS_KEY_API_KEY, key)
  } catch {
    // ignore
  }
}

function toUnixSeconds(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000)
}

function buildUrl(apiKey: string, pair: string, filter: 'hot' | 'rising' | 'bullish' | 'bearish' | 'important'): string {
  // Map pair like 'XBT/USDT' to 'BTC'
  const baseCurrency = pair.split('/')[0]?.replace('XBT', 'BTC') ?? 'BTC'
  const params = new URLSearchParams({
    auth_token: apiKey,
    currencies: baseCurrency,
    filter,
    public: 'true',
  })
  return `${BASE_URL}/?${params.toString()}`
}

/**
 * Fetch crypto news from CryptoPanic for the given trading pair.
 * Returns an empty array if the API key is not set or the request fails.
 */
export function useCryptoPanic(pair: string): {
  events: NewsEvent[]
  loading: boolean
  hasKey: boolean
  setKey: (key: string) => void
} {
  /** null = initial/loading, array = settled */
  const [events, setEvents] = useState<NewsEvent[] | null>(null)
  const [apiKey, setApiKeyState] = useState<string | null>(() => getCryptoPanicKey())

  const setKey = (key: string) => {
    setCryptoPanicKey(key)
    setApiKeyState(key)
  }

  useEffect(() => {
    if (!apiKey) return

    const controller = new AbortController()
    // Reset to null (loading) whenever the key or pair changes.
    // setTimeout(0) avoids calling setState synchronously in the effect body.
    const resetTimer = setTimeout(() => setEvents(null), 0)

    const cutoff = Date.now() / 1000 - FETCH_DAYS * 86400

    Promise.all([
      fetch(buildUrl(apiKey, pair, 'hot'), { signal: controller.signal }).then(r => r.json() as Promise<CryptoPanicResponse>).catch(() => ({ results: [] as CryptoPanicPost[] })),
      fetch(buildUrl(apiKey, pair, 'important'), { signal: controller.signal }).then(r => r.json() as Promise<CryptoPanicResponse>).catch(() => ({ results: [] as CryptoPanicPost[] })),
    ])
      .then(([hot, important]) => {
        if (controller.signal.aborted) return
        const seen = new Set<number>()
        const combined: NewsEvent[] = []
        for (const post of [...hot.results, ...important.results]) {
          if (seen.has(post.id)) continue
          seen.add(post.id)
          const time = toUnixSeconds(post.published_at)
          if (time < cutoff) continue
          const votes = post.votes.positive + post.votes.important + post.votes.liked
          combined.push({
            id: `cp-${post.id}`,
            time,
            title: post.title,
            source: 'CryptoPanic',
            category: post.kind === 'news' ? 'crypto' : 'regulatory',
            impact: votes,
            url: post.url,
          })
        }
        setEvents(combined)
      })
      .catch(() => {
        if (!controller.signal.aborted) setEvents([])
      })

    return () => {
      clearTimeout(resetTimer)
      controller.abort()
    }
  }, [apiKey, pair])

  return { events: events ?? [], loading: events === null, hasKey: apiKey !== null, setKey }
}
