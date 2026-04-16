/**
 * Scheduling Optimization Engine
 *
 * Three interlocking systems:
 * 1. 15-min base-unit grid — all slots snap to :00/:15/:30/:45
 * 2. Adaptive buffers — post-appointment cooldown per service
 * 3. Anchor booking — contiguous-block bias to eliminate dead air
 */

// ── Constants ────────────────────────────────────────────────

export const BASE_UNIT = 15

// ── Types ────────────────────────────────────────────────────

export type OccupiedInterval = { start: number; end: number }

export interface SlotRank {
  isContiguous: boolean
  gapMinutes:   number
}

export interface RankedSlot {
  iso:          string
  rank:         SlotRank
}

export interface SchedulingConfig {
  date:         string          // YYYY-MM-DD
  durationMin:  number          // service duration in minutes
  intervals:    OccupiedInterval[]
  openTime:     string          // HH:MM
  closeTime:    string          // HH:MM
}

interface ServiceDurationBuffer {
  duration_minutes:     number
  buffer_after_minutes: number
}

// ── Helpers ──────────────────────────────────────────────────

export function toLocalDateStr(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatSlot(iso: string): string {
  return new Date(iso).toLocaleTimeString("sr-Latn-RS", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function overlaps(
  slotStart: number,
  slotEnd: number,
  intervals: OccupiedInterval[],
): boolean {
  return intervals.some((iv) => slotStart < iv.end && slotEnd > iv.start)
}

// ── System 2: Adaptive Buffers ───────────────────────────────

export function suggestBuffer(durationMin: number): number {
  if (durationMin <= 15) return 0
  if (durationMin <= 30) return 5
  if (durationMin <= 60) return 10
  return 15
}

/**
 * Build occupied intervals from raw appointment data,
 * incorporating each service's buffer_after_minutes.
 */
export function buildOccupiedIntervals(
  appointments: { scheduled_at: string; service_id: string }[],
  serviceMap:   Record<string, ServiceDurationBuffer>,
): OccupiedInterval[] {
  return appointments.map((a) => {
    const start = new Date(a.scheduled_at).getTime()
    const svc   = serviceMap[a.service_id]
    const dur   = svc?.duration_minutes ?? 30
    const buf   = svc?.buffer_after_minutes ?? 0
    return { start, end: start + (dur + buf) * 60_000 }
  })
}

// ── System 1: Base-Unit Grid Slot Generation ─────────────────

/**
 * Generate all technically-valid slots on a 15-min grid.
 * Services >= 60 min are further constrained to 30-min boundaries.
 */
export function generateGridSlots(config: SchedulingConfig): string[] {
  const { date, durationMin, intervals, openTime, closeTime } = config
  const openMinutes  = parseTime(openTime)
  const closeMinutes = parseTime(closeTime)
  const alignment    = durationMin >= 60 ? 30 : BASE_UNIT

  const slots: string[] = []
  const baseDate = new Date(`${date}T00:00:00`)

  for (let min = openMinutes; min + durationMin <= closeMinutes; min += BASE_UNIT) {
    if (min % alignment !== 0) continue

    const slotStart = baseDate.getTime() + min * 60_000
    const slotEnd   = slotStart + durationMin * 60_000
    if (!overlaps(slotStart, slotEnd, intervals)) {
      slots.push(new Date(slotStart).toISOString())
    }
  }
  return slots
}

// ── System 3: Anchor Booking ─────────────────────────────────

/**
 * Compute the fill frontier: the latest contiguous time from an anchor.
 * Intervals must be sorted by start ascending.
 */
function computeFrontier(
  anchorMs: number,
  intervals: OccupiedInterval[],
): number {
  let frontier = anchorMs
  for (const iv of intervals) {
    if (iv.start <= frontier && iv.end > frontier) {
      frontier = iv.end
    }
  }
  return frontier
}

function rankSlot(
  slotStartMs: number,
  slotEndMs:   number,
  midpointMs:  number,
  amFrontier:  number,
  pmFrontier:  number,
): SlotRank {
  const block    = slotStartMs < midpointMs ? "am" : "pm"
  const frontier = block === "am" ? amFrontier : pmFrontier

  const isContiguous = slotStartMs <= frontier
  const gapMinutes   = Math.max(0, Math.round((slotStartMs - frontier) / 60_000))

  return { isContiguous, gapMinutes }
}

/**
 * Main entry point: generate ranked slots with anchor-booking bias.
 *
 * - `mode: "strict"` (owners): only contiguous slots returned.
 *   On an empty day, returns anchor-point slots only.
 * - `mode: "advisory"` (vets): all slots returned, sorted by rank.
 */
export function generateOptimizedSlots(
  config: SchedulingConfig,
  mode: "strict" | "advisory",
  serviceDurationMin?: number,
): RankedSlot[] {
  const gridSlots = generateGridSlots(config)
  if (gridSlots.length === 0) return []

  const openMs  = parseTime(config.openTime) * 60_000
    + new Date(`${config.date}T00:00:00`).getTime()
  const closeMs = parseTime(config.closeTime) * 60_000
    + new Date(`${config.date}T00:00:00`).getTime()
  const midpointMs = (openMs + closeMs) / 2

  const sorted = [...config.intervals].sort((a, b) => a.start - b.start)
  const amFrontier = computeFrontier(openMs, sorted)
  const pmFrontier = computeFrontier(
    Math.ceil(((parseTime(config.openTime) + parseTime(config.closeTime)) / 2) / BASE_UNIT) * BASE_UNIT * 60_000
      + new Date(`${config.date}T00:00:00`).getTime(),
    sorted,
  )

  const durMs = config.durationMin * 60_000
  const effectiveDuration = serviceDurationMin ?? config.durationMin

  const ranked: RankedSlot[] = gridSlots.map((iso) => {
    const slotMs = new Date(iso).getTime()
    const rank   = rankSlot(slotMs, slotMs + durMs, midpointMs, amFrontier, pmFrontier)
    return { iso, rank }
  })

  if (mode === "strict") {
    const contiguous = ranked.filter((s) => s.rank.isContiguous)
    if (contiguous.length > 0) return contiguous

    // Empty day: offer slots at the two anchor points only
    const anchorSlots = ranked.filter((s) => {
      const ms = new Date(s.iso).getTime()
      return ms === openMs || Math.abs(ms - midpointMs) < BASE_UNIT * 60_000
    })
    return anchorSlots.length > 0 ? anchorSlots : ranked.slice(0, 2)
  }

  // Advisory mode: sort contiguous-first, then by gap size.
  // Secondary bias: long services prefer AM, short prefer PM.
  ranked.sort((a, b) => {
    if (a.rank.isContiguous !== b.rank.isContiguous) {
      return a.rank.isContiguous ? -1 : 1
    }
    if (a.rank.gapMinutes !== b.rank.gapMinutes) {
      return a.rank.gapMinutes - b.rank.gapMinutes
    }

    // Density bias: long services → AM first, short → PM first
    const aMs = new Date(a.iso).getTime()
    const bMs = new Date(b.iso).getTime()
    if (effectiveDuration >= 60) return aMs - bMs  // AM first
    if (effectiveDuration <= 30) return bMs - aMs   // PM first
    return aMs - bMs
  })

  return ranked
}

// ── Available days helper ────────────────────────────────────

export function getAvailableDays(
  hoursMap: Map<number, { is_closed: boolean }>,
  lookAheadDays: number = 14,
): string[] {
  const days: string[] = []
  for (let i = 1; i <= lookAheadDays; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const weekday = d.getDay()
    const hours   = hoursMap.get(weekday)
    if (hours) {
      if (hours.is_closed) continue
    } else {
      if (weekday === 0 || weekday === 6) continue
    }
    days.push(toLocalDateStr(d))
  }
  return days
}
