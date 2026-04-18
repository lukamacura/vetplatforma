/**
 * Timezone helpers — the whole app schedules in Europe/Belgrade.
 *
 * Why this file exists: `new Date("2026-04-18T09:00:00")` parses in the
 * browser's LOCAL timezone. That works on a Belgrade phone today, but
 * breaks on SSR (UTC), on travellers, on wrong-TZ devices, and on the
 * two DST Sundays a year. Use these helpers instead so slot math is
 * always anchored to real clinic wall-clock time.
 */

export const CLINIC_TZ = "Europe/Belgrade"

/**
 * Offset (in ms) between the given UTC instant and the same wall-clock
 * moment as read in `tz`. Positive when `tz` is ahead of UTC.
 */
function getTZOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12:   false,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
    hour:     "2-digit",
    minute:   "2-digit",
    second:   "2-digit",
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(date)
       .filter((p) => p.type !== "literal")
       .map((p) => [p.type, p.value])
  ) as Record<string, string>

  // Intl may emit "24" for midnight in some locales — normalize.
  const hour = parts.hour === "24" ? "00" : parts.hour

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  )
  return asUTC - date.getTime()
}

/**
 * Interpret "YYYY-MM-DD" + "HH:MM" as a Belgrade wall-clock moment and
 * return the real UTC Date for that instant.
 *
 * Example: belgradeToUTC("2026-04-18", "09:00") → Date representing
 * 07:00 UTC (summer DST) or 08:00 UTC (winter).
 */
export function belgradeToUTC(dayStr: string, hhmm: string = "00:00"): Date {
  // Naively treat the input as UTC, then subtract Belgrade's offset
  // at that approximate instant to land on the real UTC moment.
  const naive  = new Date(`${dayStr}T${hhmm}:00Z`)
  const offset = getTZOffsetMs(naive, CLINIC_TZ)
  return new Date(naive.getTime() - offset)
}

/**
 * Day bounds in UTC for a Belgrade calendar day.
 * Use for range queries like `.gte(start).lt(end)`.
 * End is exclusive (next-day 00:00 Belgrade).
 */
export function belgradeDayBoundsUTC(dayStr: string): [string, string] {
  const start = belgradeToUTC(dayStr, "00:00")
  const end   = new Date(start.getTime() + 24 * 60 * 60_000)
  return [start.toISOString(), end.toISOString()]
}

/**
 * Today's date in Belgrade as YYYY-MM-DD, regardless of device TZ.
 */
export function belgradeToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year:     "numeric",
    month:    "2-digit",
    day:      "2-digit",
  }).formatToParts(new Date())

  const y = parts.find((p) => p.type === "year")!.value
  const m = parts.find((p) => p.type === "month")!.value
  const d = parts.find((p) => p.type === "day")!.value
  return `${y}-${m}-${d}`
}

/**
 * Return the Belgrade weekday (0=Sun, 1=Mon, …, 6=Sat) for a YYYY-MM-DD.
 * Needed because Date#getDay() reads in the browser's local TZ.
 */
export function belgradeWeekday(dayStr: string): number {
  const noonUTC = belgradeToUTC(dayStr, "12:00")
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: CLINIC_TZ,
    weekday:  "short",
  }).format(noonUTC)
  // Sun=0 Mon=1 … Sat=6
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as const)[
    name as "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat"
  ]
}
