/**
 * Reservation slot engine — see `docs/reservation_system.md`.
 *
 * What it does, in plain words:
 *   - The day is sliced into 15-minute cells (09:00 · 09:15 · 09:30 …).
 *   - A slot is "free" when:
 *       1. start + duration fits entirely inside the working day, AND
 *       2. [start, start + duration + clinic.buffer_minutes] does not
 *          overlap any existing confirmed appointment's stored window.
 *   - Returns a plain chronological list. No packing recommendations,
 *     no gap warnings, no 30-min snap for long services — those are V2.
 *
 * All wall-clock math is anchored to Europe/Belgrade via `./time`.
 */

import { belgradeToUTC, belgradeWeekday } from "./time"

// ── Constants ────────────────────────────────────────────────

export const BASE_UNIT = 15

// ── Types ────────────────────────────────────────────────────

export type OccupiedInterval = { start: number; end: number }

export interface SchedulingConfig {
  date:             string          // YYYY-MM-DD (Belgrade calendar day)
  durationMin:      number          // service duration in minutes
  bufferMin:        number          // clinic.buffer_minutes
  intervals:        OccupiedInterval[]
  openTime:         string          // HH:MM (Belgrade wall-clock)
  closeTime:        string          // HH:MM (Belgrade wall-clock)
  /**
   * Earliest allowed slot start. Slots before this instant are dropped.
   * Use to enforce "no booking in the past" + owner 15-min lead time.
   * Omit for vets to allow same-minute walk-in booking.
   */
  notBefore?:       Date
}

// ── Helpers ──────────────────────────────────────────────────

export function toLocalDateStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleTimeString("sr-Latn-RS", {
    hour:     "2-digit",
    minute:   "2-digit",
    timeZone: "Europe/Belgrade",
  })
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function overlaps(
  slotStart: number,
  slotEnd:   number,
  intervals: OccupiedInterval[],
): boolean {
  return intervals.some((iv) => slotStart < iv.end && slotEnd > iv.start)
}

// ── Slot generation ─────────────────────────────────────────

/**
 * Generate every free slot on the 15-minute grid for the given day,
 * in chronological order.
 *
 * A slot is free when:
 *   - start + duration <= close     (the work fits in the working day), AND
 *   - [start, start + duration + buffer] does not overlap any occupied
 *     interval. Occupied intervals already include their own buffer —
 *     see `intervalsFromAppointments`.
 */
export function generateFreeSlots(config: SchedulingConfig): string[] {
  const {
    date, durationMin, bufferMin, intervals,
    openTime, closeTime, notBefore,
  } = config

  const openMinutes  = parseTime(openTime)
  const closeMinutes = parseTime(closeTime)

  const slots: string[] = []
  const dayMidnightMs = belgradeToUTC(date, "00:00").getTime()
  const notBeforeMs   = notBefore?.getTime() ?? 0

  const windowMs = (durationMin + bufferMin) * 60_000

  for (let min = openMinutes; min + durationMin <= closeMinutes; min += BASE_UNIT) {
    const slotStart = dayMidnightMs + min * 60_000
    const slotEnd   = slotStart + windowMs
    if (slotStart < notBeforeMs) continue
    if (!overlaps(slotStart, slotEnd, intervals)) {
      slots.push(new Date(slotStart).toISOString())
    }
  }
  return slots
}

/**
 * Build occupied intervals from raw appointment rows. The DB trigger
 * already stores `ends_at = scheduled_at + duration + clinic.buffer`,
 * so we can trust it directly — no need to re-lookup services.
 */
export function intervalsFromAppointments(
  appointments: { scheduled_at: string; ends_at: string }[],
): OccupiedInterval[] {
  return appointments.map((a) => ({
    start: new Date(a.scheduled_at).getTime(),
    end:   new Date(a.ends_at).getTime(),
  }))
}

// ── Available days helper ────────────────────────────────────

export function getAvailableDays(
  hoursMap: Map<number, { is_closed: boolean }>,
  lookAheadDays: number = 14,
): string[] {
  // Anchor to Belgrade "today" regardless of device TZ, then walk days forward
  // by 24h increments. Weekday is resolved in Belgrade to stay consistent with
  // clinic_hours rows.
  const days: string[] = []
  const todayBgMidnight = belgradeToUTC(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Belgrade",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date()),
    "00:00",
  ).getTime()

  for (let i = 1; i <= lookAheadDays; i++) {
    const dayMs   = todayBgMidnight + i * 24 * 60 * 60_000
    const dayStr  = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Belgrade",
      year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(dayMs))
    const weekday = belgradeWeekday(dayStr)
    const hours   = hoursMap.get(weekday)
    if (hours) {
      if (hours.is_closed) continue
    } else {
      if (weekday === 0 || weekday === 6) continue
    }
    days.push(dayStr)
  }
  return days
}
