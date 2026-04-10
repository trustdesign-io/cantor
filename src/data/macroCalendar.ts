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
 * Strategy: build a Date string in the event timezone, then use
 * Intl.DateTimeFormat to compute the UTC offset at that instant, accounting
 * for DST automatically.
 */
function toMacroWindow(entry: MacroEvent): MacroWindow {
  const [hour, minute] = entry.time.split(':').map(Number)

  // Use Intl to find the UTC offset at this date in the target timezone
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

  // Find the UTC instant that maps to the announced local date/time by
  // binary search / iteration via an offset trick.
  //
  // Build a UTC Date where the wall-clock fields match the local fields, then
  // compute the difference between what we asked for and what the locale gives
  // back — that difference is the UTC offset.
  const localDate = new Date(`${entry.date}T${entry.time.padStart(5, '0')}:00`)
  const parts = fmt.formatToParts(localDate)
  const p: Record<string, number> = {}
  for (const { type, value } of parts) {
    if (type !== 'literal') p[type] = parseInt(value, 10)
  }

  // The difference between the "naive UTC" interpretation and the actual
  // local time tells us the UTC offset in milliseconds.
  const naiveUtcMs = Date.UTC(
    localDate.getFullYear(),
    localDate.getMonth(),
    localDate.getDate(),
    hour,
    minute,
    0,
  )

  // Build UTC timestamp for the local fields the formatter returned
  const displayedUtcMs = Date.UTC(p['year'], p['month'] - 1, p['day'], p['hour'] % 24, p['minute'], p['second'])
  const offsetMs = naiveUtcMs - displayedUtcMs

  const announcementMs = naiveUtcMs + offsetMs

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
