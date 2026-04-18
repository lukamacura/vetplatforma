"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  CalendarDays, ChevronLeft, ChevronRight,
  Lock, Check, Loader2, Syringe, Stethoscope, NotebookPen, Sparkles,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import type { Appointment, Pet, Species } from "@/lib/types"
import {
  belgradeDayKey,
  todayBelgradeKey,
  addDaysToKey,
  formatTimeBelgrade,
  formatDateNumeric,
} from "@/lib/dates"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dayKeyFromLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  // Monday-first: 0=Mon … 6=Sun
  const startPad = (first.getDay() + 6) % 7
  const endPad   = (7 - ((startPad + last.getDate()) % 7)) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  for (let i = 0; i < endPad; i++) cells.push(null)
  return cells
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type CalendarAppt = Pick<
  Appointment,
  "id" | "clinic_id" | "pet_id" | "service_id" | "owner_id" | "scheduled_at" | "status" | "booked_by"
> & {
  service_name: string
  pet_name: string
  pet_species: Species
  pet_photo_url: string | null
}

type ReminderItem = {
  pet: Pet
  type: "vaccine" | "control"
  date: string   // YYYY-MM-DD
}

type SaveStatus = "idle" | "saving" | "saved"

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerCalendarPage() {
  const [userId,      setUserId]      = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>(() => todayBelgradeKey())
  const [viewYear,    setViewYear]    = useState(() => new Date().getFullYear())
  const [viewMonth,   setViewMonth]   = useState(() => new Date().getMonth())

  const [pets,         setPets]         = useState<Pet[]>([])
  const [appointments, setAppointments] = useState<CalendarAppt[]>([])
  const [notesMap,     setNotesMap]     = useState<Record<string, string>>({})

  const [loading,    setLoading]    = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef  = useRef<HTMLTextAreaElement | null>(null)
  const savedHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const todayKey = todayBelgradeKey()

  // ─── Initial load: user + pets ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, owner_id, name, species, breed, birth_date, weight_kg, next_vaccine_date, next_control_date, chip_id, passport_number, gender, color, photo_url, owner_notes, vaccine_note, vet_notes, created_at")
        .eq("owner_id", user.id)
        .order("name")
      setPets((petsData as Pet[]) ?? [])
    }
    init()
  }, [])

  // ─── Load appointments + notes for the viewed month ────────────────────────
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const supabase = createClient()

      const monthStart = new Date(viewYear, viewMonth, 1)
      const monthEnd   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999)
      const dayStartKey = dayKeyFromLocal(monthStart)
      const dayEndKey   = dayKeyFromLocal(new Date(viewYear, viewMonth + 1, 0))

      // Explicitly exclude vet_notes — owner must never see per-appointment vet notes.
      const { data: apptData } = await supabase
        .from("appointments")
        .select("id, clinic_id, pet_id, service_id, owner_id, scheduled_at, status, booked_by")
        .eq("owner_id", userId)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .order("scheduled_at")

      if (cancelled) return

      let enriched: CalendarAppt[] = []
      if (apptData?.length) {
        const serviceIds = [...new Set(apptData.map((a) => a.service_id))]
        const petIds     = [...new Set(apptData.map((a) => a.pet_id))]
        const [{ data: services }, { data: petRows }] = await Promise.all([
          supabase.from("services").select("id, name").in("id", serviceIds),
          supabase.from("pets").select("id, name, species, photo_url").in("id", petIds),
        ])
        const sMap = Object.fromEntries((services ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
        const pMap = Object.fromEntries(
          (petRows ?? []).map((p: { id: string; name: string; species: Species; photo_url: string | null }) => [p.id, p]),
        )
        enriched = apptData.map((a) => ({
          ...a,
          service_name:    sMap[a.service_id] ?? "—",
          pet_name:        pMap[a.pet_id]?.name ?? "—",
          pet_species:     pMap[a.pet_id]?.species ?? "other",
          pet_photo_url:   pMap[a.pet_id]?.photo_url ?? null,
        }))
      }

      const { data: noteData } = await supabase
        .from("owner_day_notes")
        .select("day, note")
        .eq("owner_id", userId)
        .gte("day", dayStartKey)
        .lte("day", dayEndKey)

      if (cancelled) return

      const nMap: Record<string, string> = {}
      for (const row of noteData ?? []) {
        nMap[row.day as string] = (row.note as string) ?? ""
      }

      setAppointments(enriched)
      setNotesMap((prev) => ({ ...prev, ...nMap }))
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId, viewYear, viewMonth])

  // ─── Group data by day key ─────────────────────────────────────────────────
  const apptsByDay = useMemo(() => {
    const m: Record<string, CalendarAppt[]> = {}
    for (const a of appointments) {
      const k = belgradeDayKey(a.scheduled_at)
      if (!k) continue
      ;(m[k] ??= []).push(a)
    }
    return m
  }, [appointments])

  const remindersByDay = useMemo(() => {
    const m: Record<string, ReminderItem[]> = {}
    for (const pet of pets) {
      if (pet.next_vaccine_date) {
        ;(m[pet.next_vaccine_date] ??= []).push({ pet, type: "vaccine", date: pet.next_vaccine_date })
      }
      if (pet.next_control_date) {
        ;(m[pet.next_control_date] ??= []).push({ pet, type: "control", date: pet.next_control_date })
      }
    }
    return m
  }, [pets])

  // ─── Selected day slices ───────────────────────────────────────────────────
  const selectedAppts     = apptsByDay[selectedKey] ?? []
  const selectedReminders = remindersByDay[selectedKey] ?? []
  const selectedNote      = notesMap[selectedKey] ?? ""

  // ─── Note saving (debounced upsert) ────────────────────────────────────────
  const saveNote = useCallback(async (day: string, note: string) => {
    if (!userId) return
    setSaveStatus("saving")
    const supabase = createClient()
    const { error } = await supabase
      .from("owner_day_notes")
      .upsert(
        { owner_id: userId, day, note, updated_at: new Date().toISOString() },
        { onConflict: "owner_id,day" },
      )
    if (!error) {
      setSaveStatus("saved")
      if (savedHideRef.current) clearTimeout(savedHideRef.current)
      savedHideRef.current = setTimeout(() => setSaveStatus("idle"), 1800)
    } else {
      setSaveStatus("idle")
    }
  }, [userId])

  function onNoteChange(value: string) {
    const day = selectedKey
    setNotesMap((prev) => ({ ...prev, [day]: value }))
    setSaveStatus("saving")
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      saveNote(day, value)
    }, 600)
  }

  // Flush pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedHideRef.current) clearTimeout(savedHideRef.current)
    }
  }, [])

  // Auto-grow textarea to fit content
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`
  }, [selectedNote, selectedKey])

  // Reset save indicator when switching days
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSaveStatus("idle")
  }, [selectedKey])

  // ─── Calendar navigation ───────────────────────────────────────────────────
  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1) }
    else setViewMonth((m) => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1) }
    else setViewMonth((m) => m + 1)
  }
  function goToToday() {
    const now = new Date()
    setViewYear(now.getFullYear())
    setViewMonth(now.getMonth())
    setSelectedKey(todayBelgradeKey())
  }

  const monthGrid = getMonthGrid(viewYear, viewMonth)
  const isViewingThisMonth =
    viewYear === new Date().getFullYear() && viewMonth === new Date().getMonth()

  // Date header chip ("Danas"/"Sutra"/"Juče")
  const dayChip = selectedKey === todayKey
    ? { label: "Danas", cls: "badge-brand" }
    : selectedKey === addDaysToKey(todayKey, 1)
    ? { label: "Sutra", cls: "badge-amber" }
    : selectedKey === addDaysToKey(todayKey, -1)
    ? { label: "Juče", cls: "badge-muted" }
    : null

  const selectedDateFull = dateFromKey(selectedKey).toLocaleDateString("sr-Latn-RS", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  })

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5 pb-4"
    >

      {/* ── Header ── */}
      <motion.div variants={stagger.item}>
        <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>
          Kalendar
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Termini i lične beleške za svaki dan
        </p>
      </motion.div>

      {/* ── Month calendar card ── */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-4">

        {/* Month header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            aria-label="Prethodni mesec"
            className="flex items-center justify-center rounded-full transition-all"
            style={{ width: 40, height: 40, color: "var(--text-muted)", background: "var(--surface-raised)" }}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>

          <button
            onClick={goToToday}
            className="flex items-center gap-1.5"
            style={{ cursor: "pointer" }}
          >
            <span className="text-sm" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {new Date(viewYear, viewMonth).toLocaleDateString("sr-Latn-RS", { month: "long", year: "numeric" })}
            </span>
            {!isViewingThisMonth && (
              <span
                className="text-xs rounded-md px-2 py-0.5"
                style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 }}
              >
                Danas
              </span>
            )}
          </button>

          <button
            onClick={nextMonth}
            aria-label="Sledeći mesec"
            className="flex items-center justify-center rounded-full transition-all"
            style={{ width: 40, height: 40, color: "var(--text-muted)", background: "var(--surface-raised)" }}
          >
            <ChevronRight size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 mb-1">
          {["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"].map((d) => (
            <div key={d} className="text-center py-1">
              <span
                style={{
                  fontSize: 10, fontWeight: 600,
                  color: "var(--text-muted)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}
              >
                {d}
              </span>
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthGrid.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} style={{ minHeight: 40 }} />
            const key       = dayKeyFromLocal(day)
            const isSelected= key === selectedKey
            const isToday   = key === todayKey
            const isWeekend = day.getDay() === 0 || day.getDay() === 6
            const hasAppt     = (apptsByDay[key] ?? []).some((a) => a.status !== "cancelled")
            const hasReminder = (remindersByDay[key] ?? []).length > 0
            const hasNote     = (notesMap[key] ?? "").trim().length > 0

            return (
              <button
                key={key}
                onClick={() => setSelectedKey(key)}
                className="cal-day flex flex-col items-center justify-center py-1"
                data-selected={isSelected}
                data-today={isToday}
                style={{ minHeight: 44 }}
              >
                <motion.div
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="cal-day-inner flex items-center justify-center rounded-full"
                  style={{ width: 34, height: 34 }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: isSelected || isToday ? 700 : 500,
                      color: isSelected
                        ? "#fff"
                        : isToday
                        ? "var(--brand)"
                        : isWeekend
                        ? "var(--text-muted)"
                        : "var(--text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {day.getDate()}
                  </span>
                </motion.div>

                {/* Dots row */}
                <div className="flex gap-0.5 mt-1 items-center" style={{ height: 5 }}>
                  {hasAppt && (
                    <span
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.95)" : "var(--blue)",
                      }}
                    />
                  )}
                  {hasReminder && (
                    <span
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.95)" : "var(--amber)",
                      }}
                    />
                  )}
                  {hasNote && (
                    <span
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.95)" : "var(--yellow)",
                      }}
                    />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Dot legend */}
        <div className="flex items-center justify-center gap-3 flex-wrap mt-3 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--blue)" }} />
            Termin
          </span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)" }} />
            Podsetnik
          </span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--yellow)" }} />
            Beleška
          </span>
        </div>
      </motion.div>

      {/* ── Day detail panel ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="space-y-4"
        >

          {/* Date header */}
          <div className="flex items-center justify-between">
            <div>
              <p
                className="text-xs uppercase tracking-widest mb-0.5"
                style={{ color: "var(--brand)", fontWeight: 700 }}
              >
                {dayChip?.label ?? "Izabrani dan"}
              </p>
              <h2 className="text-lg" style={{ fontWeight: 700, textTransform: "capitalize" }}>
                {selectedDateFull}
              </h2>
            </div>
            {dayChip && (
              <span className={`badge ${dayChip.cls}`}>
                <CalendarDays size={11} strokeWidth={2} />
                {dayChip.label}
              </span>
            )}
          </div>

          {/* Termini */}
          {selectedAppts.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="icon-sm icon-blue">
                  <CalendarDays size={13} strokeWidth={2.25} />
                </div>
                <h3 className="text-sm" style={{ fontWeight: 700 }}>
                  Zakazani termini
                </h3>
              </div>
              <div
                className="rounded-2xl p-3 space-y-2"
                style={{
                  background: "linear-gradient(135deg, var(--blue-tint) 0%, #EFF6FF 100%)",
                  border: "1px solid rgba(37,99,235,0.15)",
                }}
              >
              {selectedAppts.map((a) => {
                const isCancelled = a.status === "cancelled"
                const isNoShow    = a.status === "no_show"
                return (
                  <Link
                    key={a.id}
                    href="/klijent"
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{
                      background: "rgba(255,255,255,0.75)",
                      backdropFilter: "blur(8px)",
                      opacity: isCancelled || isNoShow ? 0.6 : 1,
                    }}
                  >
                    <div className="flex flex-col items-center shrink-0" style={{ minWidth: 44 }}>
                      <span
                        className="text-[10px] uppercase"
                        style={{ fontWeight: 700, letterSpacing: "0.06em", color: "var(--text-muted)" }}
                      >
                        {formatTimeBelgrade(a.scheduled_at)}
                      </span>
                      <PetAvatar photoUrl={a.pet_photo_url} species={a.pet_species} size={28} />
                    </div>

                    <div
                      className="w-px self-stretch shrink-0"
                      style={{ background: "var(--border)" }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className="text-sm leading-snug"
                          style={{
                            fontWeight: 600,
                            textDecoration: isCancelled ? "line-through" : "none",
                          }}
                        >
                          {a.service_name}
                        </p>
                        {a.booked_by === "vet" && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                            style={{
                              fontWeight: 600,
                              background: "var(--brand-tint)",
                              color: "var(--brand)",
                              border: "1px solid rgba(43,181,160,0.2)",
                            }}
                          >
                            <Stethoscope size={9} strokeWidth={2.5} />
                            Zakazao veterinar
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {a.pet_name}
                        {isCancelled && " · Otkazano"}
                        {isNoShow && " · Nije došao"}
                      </p>
                    </div>

                    <ChevronRight
                      size={14}
                      strokeWidth={2}
                      style={{ color: "var(--text-muted)" }}
                    />
                  </Link>
                )
              })}
              </div>
            </section>
          )}

          {/* Podsetnici */}
          {selectedReminders.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="icon-sm icon-amber">
                  <Sparkles size={13} strokeWidth={2.25} />
                </div>
                <h3 className="text-sm" style={{ fontWeight: 700 }}>
                  Podsetnici
                </h3>
              </div>
              <div
                className="rounded-2xl p-3 space-y-2"
                style={{
                  background: "linear-gradient(135deg, var(--amber-tint) 0%, #FFFBEB 100%)",
                  border: "1px solid rgba(217,119,6,0.15)",
                }}
              >
                {selectedReminders.map((r) => (
                  <div
                    key={`${r.pet.id}-${r.type}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{
                      background: "rgba(255,255,255,0.75)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <PetAvatar photoUrl={r.pet.photo_url} species={r.pet.species} size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug" style={{ fontWeight: 600 }}>
                        {r.pet.name}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {r.type === "vaccine" ? "Vakcinacija" : "Kontrolni pregled"}
                      </p>
                    </div>
                    <span className="badge badge-amber" style={{ gap: 4 }}>
                      {r.type === "vaccine"
                        ? <Syringe size={10} strokeWidth={2.5} />
                        : <Stethoscope size={10} strokeWidth={2.5} />
                      }
                      {formatDateNumeric(r.date)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* No appointments / no reminders hint */}
          {selectedAppts.length === 0 && selectedReminders.length === 0 && !loading && (
            <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Ovog dana nema zakazanih termina.
            </p>
          )}

          {/* Privatna beleška */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="icon-sm icon-yellow">
                  <NotebookPen size={13} strokeWidth={2.25} />
                </div>
                <h3 className="text-sm" style={{ fontWeight: 700 }}>
                  Privatna beleška
                </h3>
              </div>
              {/* Save indicator */}
              <div className="flex items-center gap-1 text-[11px]" style={{ minHeight: 16 }}>
                {saveStatus === "saving" && (
                  <>
                    <Loader2 size={11} strokeWidth={2.25} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Čuvanje…</span>
                  </>
                )}
                {saveStatus === "saved" && (
                  <>
                    <Check size={12} strokeWidth={2.5} style={{ color: "var(--green)" }} />
                    <span style={{ color: "var(--green)", fontWeight: 600 }}>Sačuvano</span>
                  </>
                )}
              </div>
            </div>

            <div
              className="flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5"
              style={{
                background: "var(--yellow-tint)",
                color: "var(--yellow-text)",
                border: "1px solid rgba(234,179,8,0.2)",
                fontWeight: 600,
              }}
            >
              <Lock size={11} strokeWidth={2.25} />
              Ove beleške vidite samo Vi. Veterinar nema pristup.
            </div>

            <textarea
              ref={textareaRef}
              value={selectedNote}
              onChange={(e) => onNoteChange(e.target.value)}
              onFocus={() => {
                const el = textareaRef.current
                if (!el) return
                setTimeout(() => {
                  el.scrollIntoView({ behavior: "smooth", block: "center" })
                }, 120)
              }}
              placeholder="Napišite belešku samo za sebe — veterinar je ne vidi."
              maxLength={500}
              rows={4}
              inputMode="text"
              autoCapitalize="sentences"
              enterKeyHint="done"
              className="w-full rounded-2xl px-4 py-3 text-sm resize-none transition-all outline-none"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                minHeight: 110,
                lineHeight: 1.55,
              }}
              onBlur={(e) => e.currentTarget.style.borderColor = "var(--border)"}
            />

            <div className="flex justify-end">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {selectedNote.length}/500
              </span>
            </div>
          </section>

        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}
