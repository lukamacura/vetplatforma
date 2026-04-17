/**
 * Postgres `date` and `<input type="date">` values are `YYYY-MM-DD`.
 * `new Date("YYYY-MM-DD")` is UTC midnight and can show as the wrong local calendar day.
 * Anchor at local noon for stable display and day-diff math.
 */
export function parseCalendarDate(input: string | null | undefined): Date | null {
  if (!input) return null
  const s = input.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00`)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Strict `YYYY-MM-DD` only (no time part). */
const YMD_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * DD.MM.GGGG — only digits and dots; day always before month (Serbian convention).
 * - Plain `date` / `<input type="date">` values: formatted from the string (no timezone shift).
 * - `timestamptz` / ISO instants: calendar date in Europe/Belgrade (clinic wall clock, matches vet UI).
 */
export function formatDateNumeric(input: string | null | undefined): string {
  if (!input) return "—"
  const s = input.trim()
  const m = s.match(YMD_ONLY)
  if (m) {
    const [, y, mo, d] = m
    return `${d}.${mo}.${y}`
  }
  const instant = new Date(s)
  if (Number.isNaN(instant.getTime())) return "—"
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(instant)
    .replace(/\//g, ".")
}

/** Date + time as shown in Serbia (same instant as DB `timestamptz`). */
export function formatDateTimeNumericBelgrade(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return "—"
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(d)
    .replace(/\//g, ".")
  return `${date} ${formatTimeBelgrade(iso)}`
}

/** HH:MM in Europe/Belgrade (matches clinic wall clock, independent of browser TZ). */
export function formatTimeBelgrade(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

/** `YYYY-MM-DD` calendar day of an instant in Europe/Belgrade. */
export function belgradeDayKey(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso.trim())
  if (Number.isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ""
  const y = get("year"), m = get("month"), day = get("day")
  if (!y || !m || !day) return null
  return `${y}-${m}-${day}`
}

/** Today's calendar day in Europe/Belgrade as `YYYY-MM-DD`. */
export function todayBelgradeKey(): string {
  return belgradeDayKey(new Date().toISOString())!
}

/** Add N days to a `YYYY-MM-DD` string (pure string math, no TZ issues). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

/**
 * Whole calendar days from *today in Belgrade* to the calendar day of `target`.
 * - If `target` is a Date built from a `YYYY-MM-DD` date-only value
 *   (vaccine/control), its local calendar day is used directly.
 * - If `target` is a `timestamptz` instant, pass the Date and it will be
 *   resolved via Belgrade calendar day.
 */
export function calendarDaysFromToday(target: Date): number {
  const targetKey = belgradeDayKey(target.toISOString()) ?? ""
  if (!targetKey) return 0
  const todayKey = todayBelgradeKey()
  return Math.round((keyToUtcMs(targetKey) - keyToUtcMs(todayKey)) / 86_400_000)
}
