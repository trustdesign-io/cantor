/**
 * Macro event calendar — hard-coded FOMC, CPI, and NFP release windows.
 *
 * ⚠️  This calendar is hard-coded and covers approximately one quarter.
 *     It must be updated manually every quarter with upcoming event dates.
 *     A future ticket will automate this from a free economic calendar API.
 *
 * Time zones are handled by converting each event to an explicit UTC timestamp
 * using `Intl.DateTimeFormat` offset calculation. All downstream logic works
 * in UTC milliseconds to avoid DST footguns.
 */

import rawEvents from './macroCalendar.json'

export interface MacroEvent {
  event: string
  /** ISO date string (YYYY-MM-DD) in the event's local timezone */
  date: string
  /** Local time of announcement (HH:MM, 24-hour) */
  time: string
  /** IANA timezone identifier (e.g. 'America/New_York') */
  timezone: string
}

/**
 * A resolved macro event with a UTC window.
 * The blackout runs from 1 hour before to 1 hour after the announcement.
 */
export interface MacroWindow {
  event: string
  /** UTC timestamp (ms) of the announcement */
  announcementMs: number
  /** UTC timestamp (ms) — blackout start (1 hour before) */
  windowStartMs: number
  /** UTC timestamp (ms) — blackout end (1 hour after) */
  windowEndMs: number
}

const ONE_HOUR_MS = 60 * 60 * 1_000

/**
 * Convert an event from the JSON calendar into a UTC MacroWindow.
 *
 * Algorithm (machine-timezone-independent):
 *   1. Parse the date+time string with a `Z` suffix so JS treats it as UTC.
 *      This gives us a "naive UTC seed" — the correct instant only if the event
 *      timezone happened to be UTC.
 *   2. Use Intl.DateTimeFormat to ask: what is the wall-clock time in the *event*
 *      timezone at that UTC seed instant?
 *   3. The difference between the wall-clock fields the formatter returns and the
 *      original HH:MM we asked for is the UTC offset at that date (accounting for DST).
 *   4. Add the offset to the seed to get the correct UTC announcement time.
 *
 * Using `Z` in step 1 and `Date.UTC` throughout means the result is identical
 * regardless of the machine's local timezone.
 */
function toMacroWindow(entry: MacroEvent): MacroWindow {
  const [hour, minute] = entry.time.split(':').map(Number)

  // Step 1 — seed parsed as UTC (Z suffix), independent of machine timezone
  const naiveSeedMs = new Date(`${entry.date}T${entry.time}:00Z`).getTime()

  // Step 2 — format the seed instant in the event's timezone
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: entry.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = fmt.formatToParts(new Date(naiveSeedMs))
  const p: Record<string, number> = {}
  for (const { type, value } of parts) {
    if (type !== 'literal') p[type] = parseInt(value, 10)
  }

  // Step 3 — the offset is: (what we asked for as UTC) − (what the formatter showed back as UTC).
  // Anchored to a fixed date so only the hours/minutes matter.
  // The `% 24` guard handles the rare case where hour12:false returns 24 for midnight.
  const naiveRequestedMs = Date.UTC(2000, 0, 1, hour, minute, 0)
  const naiveDisplayedMs = Date.UTC(2000, 0, 1, p['hour'] % 24, p['minute'], p['second'])
  const offsetMs = naiveRequestedMs - naiveDisplayedMs

  // Step 4 — correct UTC announcement time
  const announcementMs = naiveSeedMs + offsetMs

  return {
    event: entry.event,
    announcementMs,
    windowStartMs: announcementMs - ONE_HOUR_MS,
    windowEndMs: announcementMs + ONE_HOUR_MS,
  }
}

/** All calendar events resolved to UTC windows, in chronological order */
export const MACRO_WINDOWS: readonly MacroWindow[] = (rawEvents as MacroEvent[])
  .map(toMacroWindow)
  .sort((a, b) => a.announcementMs - b.announcementMs)

/**
 * Returns the name of the active macro event if `nowMs` falls within any
 * blackout window, otherwise null.
 *
 * @param nowMs - Current time in ms since epoch. Defaults to `Date.now()`.
 */
export function getActiveBlackout(nowMs = Date.now()): string | null {
  for (const w of MACRO_WINDOWS) {
    if (nowMs >= w.windowStartMs && nowMs <= w.windowEndMs) {
      return w.event
    }
  }
  return null
}

/**
 * Returns the MacroWindow whose blackout is active at `nowMs`, or null.
 *
 * @param nowMs - Current time in ms since epoch. Defaults to `Date.now()`.
 */
export function getActiveWindow(nowMs = Date.now()): MacroWindow | null {
  for (const w of MACRO_WINDOWS) {
    if (nowMs >= w.windowStartMs && nowMs <= w.windowEndMs) {
      return w
    }
  }
  return null
}
