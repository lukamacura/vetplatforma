"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  CalendarDays, Clock, UserX, ChevronLeft, NotebookPen,
  Lock, Loader2, Check, CalendarPlus,
} from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import Link from "next/link"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { SPECIES_LABEL } from "@/lib/species"
import type { AppointmentWithDetails } from "@/lib/types"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dayKeyFromLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/* ── Appointment row (identical logic to dashboard) ── */
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
  const now        = new Date()
  const start      = new Date(appt.scheduled_at)
  const end        = new Date(start.getTime() + appt.service_duration * 60_000)
  const isNow      = isToday && now >= start && now <= end
  const isPast     = isToday && now > end
  const isNoShow   = appt.status === "no_show"
  const isCancelled = appt.status === "cancelled"

  const timeColor = isNoShow || isCancelled
    ? "var(--text-muted)"
    : isNow ? "var(--blue)" : isPast ? "var(--text-muted)" : "var(--blue)"

  const isActive = isNow && !isNoShow && !isCancelled
  const hasNotes = !!(appt.vet_notes && appt.vet_notes.trim().length > 0)

  return (
    <motion.div variants={stagger.row} className="space-y-0">
      <div
        className={`appt-row flex items-center gap-4 rounded-xl px-4 py-3 cursor-pointer ${isActive ? "appt-row-active" : ""}`}
        style={{ opacity: isPast || isNoShow || isCancelled ? 0.5 : 1 }}
        role="button"
        tabIndex={0}
        onClick={() => onToggleExpand(appt.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggleExpand(appt.id) }
        }}
      >
        {/* Time */}
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
              <NotebookPen size={11} strokeWidth={2.25} style={{ color: "var(--yellow)", opacity: 0.85 }} />
            )}
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            {appt.service_name} · {appt.owner_name}
          </p>
        </div>

        {/* Status + actions */}
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
        </div>
      </div>

      {/* Notes panel */}
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
                  <h4 className="text-xs truncate" style={{ fontWeight: 700 }}>Beleška sa posete</h4>
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
export default function RasporedPage() {
  const searchParams = useSearchParams()
  const router       = useRouter()

  const dateParam    = searchParams.get("date")
  const selectedDate = dateParam ? new Date(dateParam + "T12:00:00") : new Date()
  const today        = new Date()
  today.setHours(0, 0, 0, 0)
  const isToday = isSameDay(selectedDate, new Date())

  const [appointments,   setAppointments]   = useState<AppointmentWithDetails[]>([])
  const [loading,        setLoading]        = useState(true)
  const [noShowError,    setNoShowError]    = useState<string | null>(null)
  const [clinicId,       setClinicId]       = useState<string | null>(null)

  const [expandedApptId, setExpandedApptId] = useState<string | null>(null)
  const [apptNotesDraft, setApptNotesDraft] = useState<Record<string, string>>({})
  const [apptNoteStatus, setApptNoteStatus] = useState<Record<string, "idle" | "saving" | "saved">>({})

  const debounceRefs  = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savedHideRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Flush debounces on unmount
  useEffect(() => {
    const d = debounceRefs.current
    const h = savedHideRefs.current
    return () => {
      for (const t of Object.values(d)) clearTimeout(t)
      for (const t of Object.values(h)) clearTimeout(t)
    }
  }, [])

  // Get clinic id
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      const { data: profile } = await supabase
        .from("profiles").select("clinic_id").eq("id", user.id).single()
      let cid = profile?.clinic_id

      if (!cid) {
        const { data: ownedClinic } = await supabase
          .from("clinics").select("id").eq("owner_id", user.id).single()
        if (!ownedClinic) return
        cid = ownedClinic.id
        await supabase.from("profiles").update({ clinic_id: cid }).eq("id", user.id)
      }

      setClinicId(cid)
    }
    init()
  }, [router])

  // Load appointments
  useEffect(() => {
    if (!clinicId) return
    async function load() {
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
          pet_name:         petMap[a.pet_id]?.name                     ?? "-",
          pet_species:      petMap[a.pet_id]?.species                  ?? "other",
          pet_photo_url:    petMap[a.pet_id]?.photo_url                ?? null,
          owner_name:       ownerMap[a.owner_id]                       ?? "-",
          service_name:     serviceMap[a.service_id]?.name             ?? "-",
          service_duration: serviceMap[a.service_id]?.duration_minutes ?? 30,
        })))
      } else {
        setAppointments([])
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, dateParam])

  const handleNoShow = useCallback(async (id: string) => {
    setNoShowError(null)
    const supabase = createClient()
    const { error } = await supabase.from("appointments").update({ status: "no_show" }).eq("id", id)
    if (error) {
      setNoShowError("Greška pri označavanju statusa. Pokušajte ponovo.")
    } else {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "no_show" } : a))
    }
  }, [])

  const handleUndoNoShow = useCallback(async (id: string) => {
    setNoShowError(null)
    const supabase = createClient()
    const { error } = await supabase.from("appointments").update({ status: "confirmed" }).eq("id", id)
    if (error) {
      setNoShowError("Greška pri poništavanju statusa. Pokušajte ponovo.")
    } else {
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: "confirmed" } : a))
    }
  }, [])

  const saveApptNote = useCallback(async (id: string, value: string) => {
    const text = value.trim()
    const supabase = createClient()
    const { error } = await supabase.from("appointments").update({ vet_notes: text || null }).eq("id", id)
    if (error) {
      setApptNoteStatus((prev) => ({ ...prev, [id]: "idle" }))
      return
    }
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, vet_notes: text || null } : a))
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

  const dateLabel = selectedDate.toLocaleDateString("sr-Latn-RS", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  })

  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.back()}
            className="icon-sm icon-muted mt-0.5 shrink-0"
            style={{ cursor: "pointer" }}
            aria-label="Nazad"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
          <div>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "var(--brand)", fontWeight: 700 }}>
              {dateLabel}
            </p>
            <h1 className="text-2xl">
              {isToday ? "Raspored za danas" : "Raspored"}
            </h1>
            {!loading && (
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
                {confirmedCount} {confirmedCount === 1 ? "termin zakazan" : "termina zakazano"}
              </p>
            )}
          </div>
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

      {/* Schedule card */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl overflow-hidden">
        <div
          className="flex items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <div className="icon-sm icon-blue shrink-0">
              <CalendarDays size={13} strokeWidth={2.25} />
            </div>
            <h3 className="text-sm" style={{ fontWeight: 700 }}>Termini</h3>
          </div>
          {!loading && appointments.length > 0 && (
            <span className="badge badge-blue">
              <CalendarDays size={11} strokeWidth={2} />
              {isToday
                ? "Danas"
                : selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}
            </span>
          )}
        </div>

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
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="py-16 text-center">
              <div className="icon-lg icon-blue mx-auto mb-4">
                <CalendarDays size={22} strokeWidth={1.75} />
              </div>
              <p className="text-sm mb-1" style={{ fontWeight: 600 }}>
                {isToday ? "Nema zakazivanja za danas" : "Nema zakazivanja za ovaj dan"}
              </p>
              <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
                Vlasnici mogu zakazati termin sami — bez telefonskog poziva.
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
    </motion.div>
  )
}
