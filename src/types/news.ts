/** Category of a news event, used for colour/shape coding and filtering. */
export type NewsCategory = 'crypto' | 'macro' | 'geopolitical' | 'regulatory'

/** A single news/calendar event for the news lane. */
export interface NewsEvent {
  /** Unique identifier (source + id or hash). */
  id: string
  /** Unix timestamp (seconds) of the event. */
  time: number
  /** Short headline text. */
  title: string
  /** Source name (e.g. 'CryptoPanic', 'Finnhub', 'GDELT'). */
  source: string
  /** Category determines marker colour. */
  category: NewsCategory
  /**
   * Impact score for filtering:
   * - CryptoPanic: vote count (0–∞)
   * - GDELT: Goldstein scale magnitude (0–10)
   * - Finnhub: 0–3 (low/medium/high/critical)
   */
  impact: number
  /** Optional URL to the original article. */
  url?: string
}

/** Persisted filter state for the news lane. */
export interface NewsFilters {
  /** Which categories are currently visible. */
  categories: Record<NewsCategory, boolean>
  /** Minimum impact score — events below this are hidden. */
  minImpact: number
}

export const DEFAULT_NEWS_FILTERS: NewsFilters = {
  categories: { crypto: true, macro: true, geopolitical: true, regulatory: true },
  minImpact: 0,
}
