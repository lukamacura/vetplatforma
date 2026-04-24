"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { CalendarDays, Users, Clock, ChevronRight, UserX, ChevronLeft, ChevronDown, CalendarPlus, Banknote, Sparkles, Syringe, Stethoscope, NotebookPen, Lock, Loader2, Check } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { SPECIES_LABEL } from "@/lib/species"
import type { AppointmentWithDetails, Species } from "@/lib/types"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

type VetReminder = {
  petId: string
  ownerId: string
  petName: string
  petSpecies: Species
  petPhotoUrl: string | null
  type: "vaccine" | "control"
  date: string // YYYY-MM-DD
}

function dayKeyFromLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatDateNumeric(dateStr: string): string {
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}.`
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

/* ── Stat card ── */
function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
  sublineStat,
  hint,
  href,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  iconClass: string
  sublineStat?: string
  hint?: string
  href?: string
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`icon-sm ${iconClass}`}>
            <Icon size={15} strokeWidth={2} />
          </div>
          {href && (
            <ChevronRight size={14} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
          )}
        </div>
      </div>
      <p className="text-3xl tracking-tight leading-none" style={{ color: "var(--text-primary)", fontWeight: 800 }}>
        {value}
      </p>
      {sublineStat && (
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
          {sublineStat}
        </p>
      )}
      {hint && (
        <p className="text-[11px] mt-1.5 leading-snug" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
          {hint}
        </p>
      )}
    </>
  )

  if (href) {
    return (
      <motion.div variants={stagger.item} whileHover={{ y: -3, boxShadow: "0 8px 28px rgba(0,0,0,0.09)" }}>
        <Link href={href} className="solid-card rounded-2xl p-5 block">
          {inner}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div
      variants={stagger.item}
      whileHover={{ y: -3, boxShadow: "0 8px 28px rgba(0,0,0,0.09)" }}
      className="solid-card rounded-2xl p-5 cursor-default"
    >
      {inner}
    </motion.div>
  )
}

/* ── Appointment row ── */
function AppointmentRow({
  appt,
  isToday,
  onNoShow,
  onUndoNoShow,
  isExpanded,
  onToggleExpand,
  noteDraft,
  onNoteDraftChange,
  noteStatus,
}: {
  appt: AppointmentWithDetails
  isToday: boolean
  onNoShow: (id: string) => void
  onUndoNoShow: (id: string) => void
  isExpanded: boolean
  onToggleExpand: (id: string) => void
  noteDraft: string
  onNoteDraftChange: (id: string, value: string) => void
  noteStatus: "idle" | "saving" | "saved"
}) {
  const now   = new Date()
  const start = new Date(appt.scheduled_at)
  const end   = new Date(start.getTime() + appt.service_duration * 60_000)
  const isNow      = isToday && now >= start && now <= end
  const isPast     = isToday && now > end
  const isNoShow   = appt.status === "no_show"
  const isCancelled = appt.status === "cancelled"

  const timeColor = isNoShow || isCancelled ? "var(--text-muted)" : isNow ? "var(--blue)" : isPast ? "var(--text-muted)" : "var(--blue)"

  const isActive = isNow && !isNoShow && !isCancelled
  const hasNotes = !!(appt.vet_notes && appt.vet_notes.trim().length > 0)

  return (
    <motion.div variants={stagger.row} className="space-y-0">
      <div
        className={`appt-row flex items-center gap-4 rounded-xl px-4 py-3 cursor-pointer ${isActive ? "appt-row-active" : ""}`}
        style={{
          opacity: (isPast || isNoShow || isCancelled) ? 0.5 : 1,
        }}
        role="button"
        tabIndex={0}
        onClick={() => onToggleExpand(appt.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggleExpand(appt.id)
          }
        }}
      >
        {/* Time column */}
        <div className="w-13 shrink-0 text-center">
          <span className="text-sm tabular-nums leading-none" style={{ color: timeColor, fontWeight: 700 }}>
            {formatTime(appt.scheduled_at)}
          </span>
          {isNow && !isNoShow && !isCancelled && (
            <span className="badge badge-blue mt-1 block text-center" style={{ fontSize: 9, padding: "2px 6px" }}>
              <span className="pulse-dot" />
              SADA
            </span>
          )}
        </div>

        {/* Divider */}
        <div
          className="w-px self-stretch rounded-full shrink-0"
          style={{ background: isNow && !isNoShow && !isCancelled ? "var(--blue)" : "var(--border)" }}
        />

        {/* Pet + service */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <PetAvatar photoUrl={appt.pet_photo_url} species={appt.pet_species} size={22} />
            <span
              className="text-sm truncate"
              style={{
                color: "var(--text-primary)",
                fontWeight: 600,
                textDecoration: isCancelled ? "line-through" : "none",
              }}
            >
              {appt.pet_name}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              · {SPECIES_LABEL[appt.pet_species]}
            </span>
            {hasNotes && !isExpanded && (
              <NotebookPen
                size={11}
                strokeWidth={2.25}
                style={{ color: "var(--yellow)", opacity: 0.85 }}
                aria-label="Ima belešku"
              />
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            {appt.service_name} · {appt.owner_name}
          </p>
        </div>

        {/* Status badges + actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isCancelled ? (
            <span className="badge badge-muted">Otkazano</span>
          ) : (
            <>
              <div className="badge badge-blue" style={{ gap: 4 }}>
                <Clock size={11} strokeWidth={2} />
                {appt.service_duration} min
              </div>
              {isToday && (isPast || isNow) && (
                isNoShow ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onUndoNoShow(appt.id) }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all"
                    style={{ background: "rgba(220,38,38,0.1)", color: "var(--red)", fontWeight: 600, border: "1px solid rgba(220,38,38,0.2)" }}
                  >
                    <UserX size={11} strokeWidth={2} />
                    Nije došao
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onNoShow(appt.id) }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all"
                    style={{ background: "rgba(22,163,74,0.1)", color: "var(--green)", fontWeight: 600, border: "1px solid rgba(22,163,74,0.2)" }}
                  >
                    <Check size={11} strokeWidth={2.5} />
                    Došao
                  </button>
                )
              )}
              {!isToday && isNoShow && (
                <span className="badge badge-red">
                  <UserX size={10} strokeWidth={2} />
                  Nije došao
                </span>
              )}
            </>
          )}
          <ChevronDown
            size={14}
            strokeWidth={2}
            className="transition-transform duration-200"
            style={{
              color: "var(--text-muted)",
              transform: isExpanded ? "rotate(180deg)" : undefined,
            }}
          />
        </div>
      </div>

      {/* Yellow private-notes editor - mirrors owner's "Privatna beleška" psychology */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="overflow-hidden"
          >
            <div
              className="rounded-xl p-3 mt-2 space-y-2"
              style={{
                background: "linear-gradient(135deg, var(--yellow-tint) 0%, #FEFCE8 100%)",
                border: "1px solid rgba(234,179,8,0.22)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="icon-sm icon-yellow shrink-0">
                    <NotebookPen size={12} strokeWidth={2.25} />
                  </div>
                  <h4 className="text-xs truncate" style={{ fontWeight: 700 }}>
                    Beleška sa posete
                  </h4>
                </div>
                <div className="flex items-center gap-1 text-[11px] shrink-0" style={{ minHeight: 16 }}>
                  {noteStatus === "saving" && (
                    <>
                      <Loader2 size={11} strokeWidth={2.25} className="animate-spin" style={{ color: "var(--text-muted)" }} />
                      <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Čuvanje…</span>
                    </>
                  )}
                  {noteStatus === "saved" && (
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
                  background: "rgba(255,255,255,0.6)",
                  color: "var(--yellow-text)",
                  border: "1px solid rgba(234,179,8,0.22)",
                  fontWeight: 600,
                }}
              >
                <Lock size={11} strokeWidth={2.25} />
                Privatna beleška (vlasnik ne vidi)
              </div>

              <textarea
                value={noteDraft}
                onChange={(e) => onNoteDraftChange(appt.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Dodaj beleške za ovu posetu…"
                rows={3}
                className="w-full rounded-xl px-3 py-2 text-sm resize-y outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(234,179,8,0.25)",
                  color: "var(--text-primary)",
                  minHeight: 80,
                  lineHeight: 1.55,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* ── Page ── */
export default function DashboardPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selectedDate,    setSelectedDate]    = useState<Date>(new Date())
  const [viewYear,        setViewYear]        = useState(() => new Date().getFullYear())
  const [viewMonth,       setViewMonth]       = useState(() => new Date().getMonth())
  const [appointments,    setAppointments]    = useState<AppointmentWithDetails[]>([])
  const [monthDotCounts,  setMonthDotCounts]  = useState<Record<string, number>>({})
  const [monthReminders,  setMonthReminders]  = useState<VetReminder[]>([])
  const [monthlyRevenue,        setMonthlyRevenue]        = useState<number | null>(null)
  const [monthlyApptCount,      setMonthlyApptCount]      = useState(0)
  const [monthlyCancelledCount, setMonthlyCancelledCount] = useState(0)
  const [connectedCount,  setConnectedCount]  = useState(0)
  const [clinicName,      setClinicName]      = useState("")
  const [clinicId,        setClinicId]        = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)

  const isToday = isSameDay(selectedDate, new Date())

  const [noShowError, setNoShowError] = useState<string | null>(null)

  // Per-appointment vet notes editor state (debounced auto-save)
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null)
  const [apptNotesDraft, setApptNotesDraft] = useState<Record<string, string>>({})
  const [apptNoteStatus, setApptNoteStatus] = useState<Record<string, "idle" | "saving" | "saved">>({})

  const debounceRefs  = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savedHideRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleNoShow = useCallback(async (id: string) => {
    setNoShowError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from("appointments")
      .update({ status: "no_show" })
      .eq("id", id)
    if (error) {
      setNoShowError("Greška pri označavanju statusa. Pokušajte ponovo.")
    } else {
      setAppointments((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: "no_show" } : a)
      )
    }
  }, [])

  const handleUndoNoShow = useCallback(async (id: string) => {
    setNoShowError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", id)
    if (error) {
      setNoShowError("Greška pri poništavanju statusa. Pokušajte ponovo.")
    } else {
      setAppointments((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: "confirmed" } : a)
      )
    }
  }, [])

  const saveApptNote = useCallback(async (id: string, value: string) => {
    const text = value.trim()
    const supabase = createClient()
    const { error } = await supabase
      .from("appointments")
      .update({ vet_notes: text || null })
      .eq("id", id)
    if (error) {
      setApptNoteStatus((prev) => ({ ...prev, [id]: "idle" }))
      return
    }
    setAppointments((prev) =>
      prev.map((a) => a.id === id ? { ...a, vet_notes: text || null } : a)
    )
    setApptNoteStatus((prev) => ({ ...prev, [id]: "saved" }))
    if (savedHideRefs.current[id]) clearTimeout(savedHideRefs.current[id])
    savedHideRefs.current[id] = setTimeout(() => {
      setApptNoteStatus((prev) => ({ ...prev, [id]: "idle" }))
    }, 1800)
  }, [])

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedApptId((prev) => (prev === id ? null : id))
    setApptNotesDraft((prev) => {
      if (id in prev) return prev
      const existing = appointments.find((a) => a.id === id)
      return { ...prev, [id]: existing?.vet_notes ?? "" }
    })
  }, [appointments])

  const handleNoteDraftChange = useCallback((id: string, value: string) => {
    setApptNotesDraft((prev) => ({ ...prev, [id]: value }))
    setApptNoteStatus((prev) => ({ ...prev, [id]: "saving" }))
    if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id])
    debounceRefs.current[id] = setTimeout(() => { saveApptNote(id, value) }, 600)
  }, [saveApptNote])

  // Collapse the expanded row when switching to a different day
  useEffect(() => {
    setExpandedApptId(null)
  }, [selectedDate])

  // Flush pending debounces on unmount
  useEffect(() => {
    const debounces = debounceRefs.current
    const hides     = savedHideRefs.current
    return () => {
      for (const t of Object.values(debounces)) clearTimeout(t)
      for (const t of Object.values(hides))     clearTimeout(t)
    }
  }, [])

  // Initial load: get clinic info + connected count
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from("profiles").select("clinic_id").eq("id", user.id).single()

      let cid = profile?.clinic_id
      if (!cid) {
        const { data: ownedClinic } = await supabase
          .from("clinics").select("id, name").eq("owner_id", user.id).single()
        if (!ownedClinic) { setLoading(false); return }
        cid = ownedClinic.id
        setClinicName(ownedClinic.name)
        await supabase.from("profiles").update({ clinic_id: cid }).eq("id", user.id)
      } else {
        const { data: clinic } = await supabase
          .from("clinics").select("name").eq("id", cid).single()
        setClinicName(clinic?.name ?? "")
      }

      setClinicId(cid)

      const { count } = await supabase
        .from("connections").select("id", { count: "exact", head: true })
        .eq("clinic_id", cid)
      setConnectedCount(count ?? 0)
    }
    init()
  }, [])

  // Load appointments when clinicId or selectedDate changes
  useEffect(() => {
    if (!clinicId) return
    async function loadAppointments() {
      setLoading(true)
      const supabase = createClient()

      const dayStart = new Date(selectedDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(selectedDate)
      dayEnd.setHours(23, 59, 59, 999)

      const { data: apptData } = await supabase
        .from("appointments").select("*")
        .eq("clinic_id", clinicId)
        .gte("scheduled_at", dayStart.toISOString())
        .lte("scheduled_at", dayEnd.toISOString())
        .order("scheduled_at")

      if (apptData?.length) {
        const petIds     = [...new Set(apptData.map((a) => a.pet_id))]
        const ownerIds   = [...new Set(apptData.map((a) => a.owner_id))]
        const serviceIds = [...new Set(apptData.map((a) => a.service_id))]

        const [{ data: pets }, { data: owners }, { data: services }] = await Promise.all([
          supabase.from("pets").select("id, name, species, photo_url").in("id", petIds),
          supabase.from("profiles").select("id, full_name").in("id", ownerIds),
          supabase.from("services").select("id, name, duration_minutes").in("id", serviceIds),
        ])

        const petMap     = Object.fromEntries((pets     ?? []).map((p) => [p.id, p]))
        const ownerMap   = Object.fromEntries((owners   ?? []).map((p) => [p.id, p.full_name]))
        const serviceMap = Object.fromEntries((services ?? []).map((s) => [s.id, s]))

        setAppointments(apptData.map((a) => ({
          ...a,
          pet_name:         petMap[a.pet_id]?.name           ?? "-",
          pet_species:      petMap[a.pet_id]?.species        ?? "other",
          pet_photo_url:    petMap[a.pet_id]?.photo_url      ?? null,
          owner_name:       ownerMap[a.owner_id]             ?? "-",
          service_name:     serviceMap[a.service_id]?.name   ?? "-",
          service_duration: serviceMap[a.service_id]?.duration_minutes ?? 30,
        })))
      } else {
        setAppointments([])
      }
      setLoading(false)
    }
    loadAppointments()
  }, [clinicId, selectedDate])

  // Load appointment counts for each day in the viewed month (dots)
  useEffect(() => {
    if (!clinicId) return
    async function loadMonthCounts() {
      const supabase = createClient()
      const monthStart = new Date(viewYear, viewMonth, 1)
      const monthEnd   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999)
      const { data } = await supabase
        .from("appointments").select("scheduled_at")
        .eq("clinic_id", clinicId)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())
        .neq("status", "cancelled")
      const counts: Record<string, number> = {}
      for (const row of data ?? []) {
        const key = new Date(row.scheduled_at).toDateString()
        counts[key] = (counts[key] ?? 0) + 1
      }
      setMonthDotCounts(counts)
    }
    loadMonthCounts()
  }, [clinicId, viewYear, viewMonth])

  // Load pet reminders (vaccines + controls) for the viewed month.
  // RLS pets_vet restricts this to pets of connected owners.
  useEffect(() => {
    if (!clinicId) return
    async function loadMonthReminders() {
      const supabase = createClient()
      const monthStart = dayKeyFromLocal(new Date(viewYear, viewMonth, 1))
      const monthEnd   = dayKeyFromLocal(new Date(viewYear, viewMonth + 1, 0))

      const { data: connRows } = await supabase
        .from("connections").select("owner_id")
        .eq("clinic_id", clinicId)
      const ownerIds = [...new Set((connRows ?? []).map((c) => c.owner_id))]
      if (ownerIds.length === 0) { setMonthReminders([]); return }

      const { data: petRows } = await supabase
        .from("pets")
        .select("id, owner_id, name, species, photo_url, next_vaccine_date, next_control_date")
        .in("owner_id", ownerIds)
        .or(
          `and(next_vaccine_date.gte.${monthStart},next_vaccine_date.lte.${monthEnd}),` +
          `and(next_control_date.gte.${monthStart},next_control_date.lte.${monthEnd})`
        )

      const reminders: VetReminder[] = []
      for (const p of (petRows ?? [])) {
        if (p.next_vaccine_date && p.next_vaccine_date >= monthStart && p.next_vaccine_date <= monthEnd) {
          reminders.push({
            petId: p.id, ownerId: p.owner_id, petName: p.name,
            petSpecies: p.species as Species, petPhotoUrl: p.photo_url,
            type: "vaccine", date: p.next_vaccine_date,
          })
        }
        if (p.next_control_date && p.next_control_date >= monthStart && p.next_control_date <= monthEnd) {
          reminders.push({
            petId: p.id, ownerId: p.owner_id, petName: p.name,
            petSpecies: p.species as Species, petPhotoUrl: p.photo_url,
            type: "control", date: p.next_control_date,
          })
        }
      }
      setMonthReminders(reminders)
    }
    loadMonthReminders()
  }, [clinicId, viewYear, viewMonth])

  const remindersByKey = useMemo(() => {
    const m: Record<string, VetReminder[]> = {}
    for (const r of monthReminders) {
      ;(m[r.date] ??= []).push(r)
    }
    return m
  }, [monthReminders])

  const selectedDayKey    = dayKeyFromLocal(selectedDate)
  const selectedReminders = remindersByKey[selectedDayKey] ?? []

  // Load planned revenue for the viewed month: sum services.price_rsd
  // over non-cancelled / non-no-show appointments.
  useEffect(() => {
    if (!clinicId) return
    async function loadMonthlyRevenue() {
      const supabase = createClient()
      const monthStart = new Date(viewYear, viewMonth, 1)
      const monthEnd   = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59, 999)

      const { data: apptRows } = await supabase
        .from("appointments").select("service_id, status")
        .eq("clinic_id", clinicId)
        .gte("scheduled_at", monthStart.toISOString())
        .lte("scheduled_at", monthEnd.toISOString())

      if (!apptRows?.length) {
        setMonthlyRevenue(0)
        setMonthlyApptCount(0)
        setMonthlyCancelledCount(0)
        return
      }

      const serviceIds = [...new Set(apptRows.map((a) => a.service_id))]
      const { data: svcRows } = await supabase
        .from("services").select("id, price_rsd")
        .in("id", serviceIds)

      const priceMap: Record<string, number> = Object.fromEntries(
        (svcRows ?? []).map((s) => [s.id, s.price_rsd ?? 0])
      )

      let revenue = 0
      let confirmed = 0
      let cancelled = 0
      for (const row of apptRows) {
        if (row.status === "cancelled") {
          cancelled += 1
          continue
        }
        if (row.status === "no_show") continue
        revenue += priceMap[row.service_id] ?? 0
        confirmed += 1
      }

      setMonthlyRevenue(revenue)
      setMonthlyApptCount(confirmed)
      setMonthlyCancelledCount(cancelled)
    }
    loadMonthlyRevenue()
  }, [clinicId, viewYear, viewMonth])

  const monthGrid = getMonthGrid(viewYear, viewMonth)

  const selectedDateLabel = isToday
    ? new Date().toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    : selectedDate.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })

  const statLabel = isToday
    ? "Raspored za danas"
    : `Raspored - ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}`

  const now = new Date()
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()
  const viewedMonthName = new Date(viewYear, viewMonth).toLocaleDateString("sr-Latn-RS", { month: "long" })
  const revenueLabel = isCurrentMonth
    ? "Planirani prihod ovog meseca"
    : `Planirani prihod - ${viewedMonthName}`
  const revenueValue = monthlyRevenue === null
    ? "-"
    : `${monthlyRevenue.toLocaleString("sr-Latn-RS")} RSD`
  const revenueSubline = monthlyRevenue === null
    ? undefined
    : `${monthlyApptCount} ${monthlyApptCount === 1 ? "termin zakazan" : "termina zakazano"}` +
      (monthlyCancelledCount > 0 ? ` · ${monthlyCancelledCount} otkazano` : "")

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-7"
    >

      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--brand)", fontWeight: 700 }}>
            {selectedDateLabel}
          </p>
          <h1 className="text-2xl">Pregled dana</h1>
          {clinicName && (
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              {clinicName}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/zakazivanje"
          className="btn-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm shrink-0"
        >
          <CalendarPlus size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Nova zakazivanje</span>
          <span className="sm:hidden">Zakaži</span>
        </Link>
      </motion.div>

      {/* Bento grid: Calendar + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">

      {/* Mini month calendar - spans 3 rows on desktop to match 3 stat cards */}
      <motion.div variants={stagger.item} className="lg:col-span-2 lg:row-span-3 solid-card rounded-2xl p-4">

        {/* Month header */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => {
              if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
              else setViewMonth(m => m - 1)
            }}
            className="icon-sm icon-muted"
            style={{ cursor: "pointer" }}
          >
            <ChevronLeft size={14} strokeWidth={2} />
          </button>

          <button
            onClick={() => {
              const now = new Date()
              setSelectedDate(now)
              setViewYear(now.getFullYear())
              setViewMonth(now.getMonth())
            }}
            className="flex items-center gap-1.5"
            style={{ cursor: "pointer" }}
          >
            <span className="text-sm" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {new Date(viewYear, viewMonth).toLocaleDateString("sr-Latn-RS", { month: "long", year: "numeric" })}
            </span>
            {(viewYear !== new Date().getFullYear() || viewMonth !== new Date().getMonth()) && (
              <span
                className="text-xs rounded-md px-2 py-0.5"
                style={{ background: "var(--brand-tint)", color: "var(--brand)", fontWeight: 600 }}
              >
                Danas
              </span>
            )}
          </button>

          <button
            onClick={() => {
              if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
              else setViewMonth(m => m + 1)
            }}
            className="icon-sm icon-muted"
            style={{ cursor: "pointer" }}
          >
            <ChevronRight size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Weekday labels */}
        <div className="grid grid-cols-7 mb-1">
          {["Po", "Ut", "Sr", "Če", "Pe", "Su", "Ne"].map((d) => (
            <div key={d} className="text-center py-1">
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {d}
              </span>
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {monthGrid.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} />
            const isSelected  = isSameDay(day, selectedDate)
            const isDayToday  = isSameDay(day, new Date())
            const dotCount    = monthDotCounts[day.toDateString()] ?? 0
            const hasReminder = (remindersByKey[dayKeyFromLocal(day)] ?? []).length > 0
            const isWeekend   = day.getDay() === 0 || day.getDay() === 6
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(new Date(day))}
                className="cal-day flex flex-col items-center justify-center py-1"
                data-selected={isSelected}
                data-today={isDayToday}
              >
                <div
                  className="cal-day-inner flex items-center justify-center rounded-full transition-all"
                  style={{ width: 30, height: 30 }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: isSelected || isDayToday ? 700 : 400,
                      color: isSelected
                        ? "#fff"
                        : isDayToday
                        ? "var(--brand)"
                        : isWeekend
                        ? "var(--text-muted)"
                        : "var(--text-primary)",
                      lineHeight: 1,
                    }}
                  >
                    {day.getDate()}
                  </span>
                </div>
                {/* Appointment dots */}
                <div className="flex gap-0.5 mt-1 h-1 items-center">
                  {dotCount >= 1 && (
                    <div
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.95)" : "var(--blue)",
                      }}
                    />
                  )}
                  {hasReminder && (
                    <div
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.95)" : "var(--amber)",
                      }}
                    />
                  )}
                  {dotCount >= 8 && (
                    <div
                      style={{
                        width: 4, height: 4, borderRadius: "50%",
                        background: isSelected ? "rgba(255,255,255,0.75)" : "var(--text-muted)",
                        opacity: 0.6,
                      }}
                    />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Dot legend */}
        <div
          className="flex items-center justify-center gap-3 flex-wrap mt-3 pt-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--blue)" }} />
            Termin
          </span>
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--amber)" }} />
            Podsetnik
          </span>
        </div>
      </motion.div>

        {/* Stat cards - stacked on the right in bento */}
        <StatCard
          icon={CalendarDays}
          label={statLabel}
          value={loading ? "-" : appointments.filter((a) => a.status === "confirmed").length}
          iconClass="icon-blue"
          href={`/dashboard/raspored?date=${dayKeyFromLocal(selectedDate)}`}
        />
        <StatCard
          icon={Users}
          label="Povezani klijenti"
          value={loading ? "-" : connectedCount}
          iconClass="icon-brand"
        />
        <StatCard
          icon={Banknote}
          label={revenueLabel}
          value={revenueValue}
          iconClass="icon-green"
          sublineStat={revenueSubline}
          hint="Ne uračunava otkazane termine."
        />

      </div>

      {/* Day detail - Schedule + Podsetnici side-by-side on desktop */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 lg:grid-cols-2 items-start">

        {/* Schedule card */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl overflow-hidden h-full">

          {/* Card header */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="icon-sm icon-blue shrink-0">
                <CalendarDays size={13} strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm truncate" style={{ fontWeight: 700 }}>
                  {isToday ? "Raspored za danas" : `Raspored - ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                </h3>
                {!loading && appointments.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {appointments.length} {appointments.length === 1 ? "termin" : "termina"}
                  </p>
                )}
              </div>
            </div>
            {!loading && appointments.length > 0 && (
              <span className="badge badge-blue shrink-0">
                <CalendarDays size={11} strokeWidth={2} />
                {isToday ? "Danas" : selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}
              </span>
            )}
          </div>

          {/* Card body */}
          <div className="p-4">
            {noShowError && (
              <div
                className="rounded-xl px-4 py-3 mb-3 text-sm"
                style={{ background: "var(--red-tint)", color: "var(--red)", fontWeight: 600, border: "1px solid rgba(220,38,38,0.18)" }}
              >
                {noShowError}
              </div>
            )}
            {loading ? (
              <div className="space-y-2.5 py-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl animate-pulse"
                    style={{ background: "var(--surface-raised)" }}
                  />
                ))}
              </div>
            ) : appointments.length === 0 ? (
              <div className="py-14 text-center">
                <div className="icon-lg icon-blue mx-auto mb-4">
                  <CalendarDays size={22} strokeWidth={1.75} />
                </div>
                <p className="text-sm mb-1" style={{ fontWeight: 600 }}>
                  {isToday ? "Nema zakazivanja za danas" : "Nema zakazivanja za ovaj dan"}
                </p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
                  Vlasnici mogu zakazati termin sami - bez telefonskog poziva.
                </p>
              </div>
            ) : (
              <motion.div variants={stagger.container} initial="hidden" animate="visible" className="space-y-2">
                {appointments.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appt={a}
                    isToday={isToday}
                    onNoShow={handleNoShow}
                    onUndoNoShow={handleUndoNoShow}
                    isExpanded={expandedApptId === a.id}
                    onToggleExpand={handleToggleExpand}
                    noteDraft={apptNotesDraft[a.id] ?? a.vet_notes ?? ""}
                    onNoteDraftChange={handleNoteDraftChange}
                    noteStatus={apptNoteStatus[a.id] ?? "idle"}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Podsetnici card - vaccines & controls for the selected day */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl overflow-hidden h-full">

          {/* Card header */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="icon-sm icon-amber shrink-0">
                <Sparkles size={13} strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm truncate" style={{ fontWeight: 700 }}>
                  {isToday
                    ? "Podsetnici za danas"
                    : `Podsetnici - ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                </h3>
                {selectedReminders.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {selectedReminders.length} {selectedReminders.length === 1 ? "podsetnik" : "podsetnika"}
                  </p>
                )}
              </div>
            </div>
            <span className="badge badge-amber shrink-0">
              <Sparkles size={11} strokeWidth={2} />
              {isToday ? "Danas" : selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}
            </span>
          </div>

          {/* Card body */}
          <div className="p-4">
            {selectedReminders.length === 0 ? (
              <div className="py-14 text-center">
                <div className="icon-lg icon-amber mx-auto mb-4">
                  <Sparkles size={22} strokeWidth={1.75} />
                </div>
                <p className="text-sm mb-1" style={{ fontWeight: 600 }}>
                  {isToday ? "Nema podsetnika za danas" : "Nema podsetnika za ovaj dan"}
                </p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
                  Vakcinacije i kontrolni pregledi zakazani za ovaj dan pojaviće se ovde.
                </p>
              </div>
            ) : (
              <motion.div variants={stagger.container} initial="hidden" animate="visible" className="space-y-2">
                {selectedReminders.map((r) => (
                  <motion.div
                    key={`${r.petId}-${r.type}`}
                    variants={stagger.row}
                    className="appt-row flex items-center gap-4 rounded-xl px-4 py-3"
                  >
                    <PetAvatar photoUrl={r.petPhotoUrl} species={r.petSpecies} size={32} />
                    <div
                      className="w-px self-stretch rounded-full shrink-0"
                      style={{ background: "var(--border)" }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug truncate" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                        {r.petName}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {r.type === "vaccine" ? "Vakcinacija" : "Kontrolni pregled"}
                      </p>
                    </div>
                    <span className="badge badge-amber shrink-0" style={{ gap: 4 }}>
                      {r.type === "vaccine"
                        ? <Syringe size={10} strokeWidth={2.5} />
                        : <Stethoscope size={10} strokeWidth={2.5} />
                      }
                      {formatDateNumeric(r.date)}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

      </div>
    </motion.div>
  )
}
