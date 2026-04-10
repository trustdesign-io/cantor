import type { FilterFn, FilterResult } from '@/types'
import { getActiveWindow } from '@/data/macroCalendar'

/**
 * Pure inner logic — accepts an explicit timestamp so tests can inject any time
 * without touching the system clock or global state.
 */
export function isMacroBlackoutAt(nowMs: number): FilterResult {
  const window = getActiveWindow(nowMs)
  if (!window) return { ok: true }

  const minutesUntil = Math.round((window.announcementMs - nowMs) / 60_000)
  const minutesSince = Math.round((nowMs - window.announcementMs) / 60_000)

  let timing: string
  if (minutesUntil > 0) {
    timing = `in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}`
  } else if (minutesSince === 0) {
    timing = 'now'
  } else {
    timing = `${minutesSince} minute${minutesSince === 1 ? '' : 's'} ago`
  }

  return {
    ok: false,
    reason: `Macro blackout: ${window.event} release ${timing}`,
  }
}

/**
 * Veto all new positions during the 2-hour window around major US macro releases.
 *
 * Covered events: FOMC, CPI, NFP.
 * Window: 1 hour before → 1 hour after announcement time (UTC).
 *
 * Why: crypto is high-beta to US macro. The single largest intra-hour drawdowns
 * in 2024–2025 were on FOMC and CPI release hours. Avoiding entry in these
 * windows reduces blowup frequency.
 *
 * Named function declaration so `filter.name === 'isMacroBlackout'` is
 * reliable for the Phase 9 filter contribution report.
 *
 * Candles and context are not needed — this filter is time-based only.
 */
export const isMacroBlackout: FilterFn = function isMacroBlackout() {
  return isMacroBlackoutAt(Date.now())
}
