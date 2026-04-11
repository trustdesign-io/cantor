import { useState, useEffect } from 'react'
import type { NewsEvent } from '@/types/news'

/**
 * GDELT 2.0 Document API — free, no key required.
 * Docs: https://blog.gdeltproject.org/gdelt-2-0-our-global-watch/
 *
 * We filter to ECON_* and GOV_* themes with extreme tone (< −5 or > 5) to
 * avoid firehose noise. The free API returns max 250 results.
 */
const GDELT_API = 'https://api.gdeltproject.org/api/v2/doc/doc'

const GDELT_THEMES = 'ECON_BANKING OR ECON_BITCOIN OR ECON_INFLATION OR GOV_CENTRAL_BANK OR GOV_REGULATION OR ECON_COMMODITY'

/** Fetch days — GDELT free tier is current/near-term news. */
const FETCH_DAYS = 3

interface GdeltArticle {
  url: string
  url_mobile?: string
  title: string
  seendate: string    // YYYYMMDDTHHMMSSZ
  socialimage?: string
  domain: string
  language: string
  sourcecountry: string
  tone?: string       // Tone score as string
  /** Goldstein scale (unused currently, retained for future use) */
  goldstein?: string
}

interface GdeltResponse {
  articles?: GdeltArticle[]
}

function gdeltDateToUnix(seendate: string): number {
  // Format: 20240115T120000Z
  const y = seendate.slice(0, 4)
  const mo = seendate.slice(4, 6)
  const d = seendate.slice(6, 8)
  const h = seendate.slice(9, 11)
  const mi = seendate.slice(11, 13)
  const s = seendate.slice(13, 15)
  return Math.floor(new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`).getTime() / 1000)
}

function buildGdeltUrl(): string {
  const now = new Date()
  const start = new Date(now.getTime() - FETCH_DAYS * 86400 * 1000)

  function pad2(n: number): string { return n.toString().padStart(2, '0') }
  function fmt(d: Date): string {
    return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}`
  }

  const params = new URLSearchParams({
    query: `${GDELT_THEMES} tone>5 OR tone<-5`,
    mode: 'ArtList',
    format: 'json',
    maxrecords: '250',
    startdatetime: fmt(start),
    enddatetime: fmt(now),
    sort: 'DateDesc',
  })
  return `${GDELT_API}?${params.toString()}`
}

/**
 * Fetch geopolitical/macro news from GDELT 2.0.
 * Returns an empty array on any fetch/parse failure.
 */
export function useGdeltNews(): { events: NewsEvent[]; loading: boolean } {
  /** null = initial/loading, array = settled */
  const [events, setEvents] = useState<NewsEvent[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(buildGdeltUrl(), { signal: controller.signal })
      .then(r => r.json() as Promise<GdeltResponse>)
      .then(data => {
        if (controller.signal.aborted) return
        const articles = data.articles ?? []
        const parsed: NewsEvent[] = articles.map((a, i) => {
          const tone = parseFloat(a.tone ?? '0') || 0
          // Use absolute tone as impact proxy (0–10+ range); Goldstein scale
          // is also available in a.goldstein but tone is more consistent here.
          const impact = Math.abs(tone)
          return {
            id: `gdelt-${i}-${a.seendate}`,
            time: gdeltDateToUnix(a.seendate),
            title: a.title,
            source: 'GDELT / ' + a.domain,
            category: 'geopolitical' as const,
            impact: Math.round(impact * 10) / 10,
            url: a.url,
          }
        })
        setEvents(parsed)
      })
      .catch(() => {
        // Network failure or CORS — degrade gracefully
        if (!controller.signal.aborted) setEvents([])
      })

    return () => controller.abort()
  }, []) // Fetch once on mount — GDELT data doesn't update in real time

  return { events: events ?? [], loading: events === null }
}
