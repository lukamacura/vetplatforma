"use client"

import { useEffect, useState, useCallback } from "react"
import { CalendarDays, Users, Clock, ChevronRight, UserX, ChevronLeft, CalendarPlus } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { AppointmentWithDetails } from "@/lib/types"

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Monday-first: if Sunday (0) treat as 7
  const diff = (day === 0 ? 7 : day) - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

const SPECIES_LABEL: Record<string, string> = {
  dog: "Pas", cat: "Mačka", bird: "Ptica", other: "Ostalo",
}
const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}

/* ── Stat card ── */
function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
  delay,
}: {
  icon: React.ElementType
  label: string
  value: number | string
  iconClass: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.28 }}
      whileHover={{ y: -3, boxShadow: "0 8px 28px rgba(0,0,0,0.09)" }}
      className="solid-card rounded-2xl p-5 cursor-default"
      style={{ transition: "box-shadow .2s, transform .2s" }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        <div className={`icon-sm ${iconClass}`}>
          <Icon size={15} strokeWidth={2} />
        </div>
      </div>
      <p className="text-3xl tracking-tight leading-none" style={{ color: "var(--text-primary)", fontWeight: 800 }}>
        {value}
      </p>
    </motion.div>
  )
}

/* ── Appointment row ── */
function AppointmentRow({
  appt,
  index,
  isToday,
  onNoShow,
}: {
  appt: AppointmentWithDetails
  index: number
  isToday: boolean
  onNoShow: (id: string) => void
}) {
  const now   = new Date()
  const start = new Date(appt.scheduled_at)
  const end   = new Date(start.getTime() + appt.service_duration * 60_000)
  const isNow      = isToday && now >= start && now <= end
  const isPast     = isToday && now > end
  const isNoShow   = appt.status === "no_show"
  const isCancelled = appt.status === "cancelled"

  const timeColor = isNoShow || isCancelled ? "var(--text-muted)" : isNow ? "var(--brand)" : isPast ? "var(--text-muted)" : "var(--blue)"

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.045, duration: 0.22 }}
      className="flex items-center gap-4 rounded-xl px-4 py-3 cursor-default"
      style={{
        background:  isNow && !isNoShow && !isCancelled ? "var(--brand-tint)" : "transparent",
        border:      `1px solid ${isNow && !isNoShow && !isCancelled ? "rgba(43,181,160,0.28)" : "var(--border)"}`,
        opacity:     (isPast || isNoShow || isCancelled) ? 0.5 : 1,
        transition:  "background .15s, border-color .15s",
      }}
      onMouseEnter={(e) => {
        if (!isNow || isNoShow || isCancelled) e.currentTarget.style.background = "var(--surface-raised)"
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isNow && !isNoShow && !isCancelled ? "var(--brand-tint)" : "transparent"
      }}
    >
      {/* Time column */}
      <div className="w-[52px] shrink-0 text-center">
        <span className="text-sm tabular-nums leading-none" style={{ color: timeColor, fontWeight: 700 }}>
          {formatTime(appt.scheduled_at)}
        </span>
        {isNow && !isNoShow && !isCancelled && (
          <span className="badge badge-brand mt-1 block text-center" style={{ fontSize: 9, padding: "2px 6px" }}>
            <span className="pulse-dot" />
            SADA
          </span>
        )}
      </div>

      {/* Divider */}
      <div
        className="w-px self-stretch rounded-full shrink-0"
        style={{ background: isNow && !isNoShow && !isCancelled ? "var(--brand)" : "var(--border)" }}
      />

      {/* Pet + service */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm leading-none">{SPECIES_EMOJI[appt.pet_species]}</span>
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
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
          {appt.service_name} · {appt.owner_name}
        </p>
      </div>

      {/* Status badges + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {isNoShow ? (
          <span className="badge badge-red">
            <UserX size={10} strokeWidth={2} />
            Nije došao
          </span>
        ) : isCancelled ? (
          <span className="badge badge-muted">Otkazano</span>
        ) : (
          <>
            <div className="badge badge-blue" style={{ gap: 4 }}>
              <Clock size={11} strokeWidth={2} />
              {appt.service_duration} min
            </div>
            {isToday && (isPast || isNow) && (
              <button
                onClick={() => onNoShow(appt.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors"
                style={{
                  fontWeight: 600,
                  background: "var(--red-tint)",
                  color: "var(--red-text)",
                  border: "1px solid rgba(220,38,38,0.15)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--red)"; e.currentTarget.style.color = "#fff" }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--red-tint)"; e.currentTarget.style.color = "var(--red-text)" }}
              >
                <UserX size={11} strokeWidth={2} />
                Nije došao
              </button>
            )}
          </>
        )}
        {!isNoShow && !isCancelled && (
          <ChevronRight size={14} strokeWidth={1.75} style={{ color: "var(--text-muted)" }} />
        )}
      </div>
    </motion.div>
  )
}

/* ── Page ── */
export default function DashboardPage() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [selectedDate,    setSelectedDate]    = useState<Date>(new Date())
  const [weekStart,       setWeekStart]       = useState<Date>(() => startOfWeek(new Date()))
  const [appointments,    setAppointments]    = useState<AppointmentWithDetails[]>([])
  const [connectedCount,  setConnectedCount]  = useState(0)
  const [clinicName,      setClinicName]      = useState("")
  const [clinicId,        setClinicId]        = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)

  const isToday = isSameDay(selectedDate, new Date())

  const handleNoShow = useCallback(async (id: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from("appointments")
      .update({ status: "no_show" })
      .eq("id", id)
    if (!error) {
      setAppointments((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: "no_show" } : a)
      )
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
          supabase.from("pets").select("id, name, species").in("id", petIds),
          supabase.from("profiles").select("id, full_name").in("id", ownerIds),
          supabase.from("services").select("id, name, duration_minutes").in("id", serviceIds),
        ])

        const petMap     = Object.fromEntries((pets     ?? []).map((p) => [p.id, p]))
        const ownerMap   = Object.fromEntries((owners   ?? []).map((p) => [p.id, p.full_name]))
        const serviceMap = Object.fromEntries((services ?? []).map((s) => [s.id, s]))

        setAppointments(apptData.map((a) => ({
          ...a,
          pet_name:         petMap[a.pet_id]?.name           ?? "—",
          pet_species:      petMap[a.pet_id]?.species        ?? "other",
          owner_name:       ownerMap[a.owner_id]             ?? "—",
          service_name:     serviceMap[a.service_id]?.name   ?? "—",
          service_duration: serviceMap[a.service_id]?.duration_minutes ?? 30,
        })))
      } else {
        setAppointments([])
      }
      setLoading(false)
    }
    loadAppointments()
  }, [clinicId, selectedDate])

  const weekDays = getWeekDays(weekStart)

  const selectedDateLabel = isToday
    ? new Date().toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    : selectedDate.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })

  const statLabel = isToday
    ? "Zakazivanja danas"
    : `Zakazivanja — ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}`

  return (
    <div className="space-y-7">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex items-start justify-between gap-4"
      >
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
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-white shrink-0"
          style={{ background: "var(--brand)", fontWeight: 600 }}
        >
          <CalendarPlus size={15} strokeWidth={2} />
          <span className="hidden sm:inline">Nova zakazivanje</span>
          <span className="sm:hidden">Zakaži</span>
        </Link>
      </motion.div>

      {/* Week strip navigator */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.06, duration: 0.26 }}
        className="solid-card rounded-2xl p-3"
      >
        <div className="flex items-center gap-2">
          {/* Prev week */}
          <button
            onClick={() => {
              const prev = new Date(weekStart)
              prev.setDate(prev.getDate() - 7)
              setWeekStart(prev)
            }}
            className="icon-sm icon-muted shrink-0"
            style={{ cursor: "pointer" }}
          >
            <ChevronLeft size={15} strokeWidth={2} />
          </button>

          {/* Day chips */}
          <div className="flex flex-1 gap-1 justify-between overflow-x-auto">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate)
              const isDayToday = isSameDay(day, new Date())
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(new Date(day))}
                  className="flex flex-col items-center rounded-xl px-2 py-2 min-w-[36px] transition-all"
                  style={{
                    background:  isSelected ? "var(--brand)" : isDayToday ? "var(--brand-tint)" : "transparent",
                    color:       isSelected ? "#fff" : isDayToday ? "var(--brand)" : "var(--text-secondary)",
                  }}
                >
                  <span className="text-xs" style={{ fontWeight: 500, fontSize: 10, opacity: isSelected ? 0.85 : 1 }}>
                    {day.toLocaleDateString("sr-Latn-RS", { weekday: "short" })}
                  </span>
                  <span className="text-sm mt-0.5" style={{ fontWeight: isSelected || isDayToday ? 700 : 500 }}>
                    {day.getDate()}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Next week */}
          <button
            onClick={() => {
              const next = new Date(weekStart)
              next.setDate(next.getDate() + 7)
              setWeekStart(next)
            }}
            className="icon-sm icon-muted shrink-0"
            style={{ cursor: "pointer" }}
          >
            <ChevronRight size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Danas button */}
        {!isToday && (
          <div className="mt-2 text-center">
            <button
              onClick={() => {
                const now = new Date()
                setSelectedDate(now)
                setWeekStart(startOfWeek(now))
              }}
              className="text-xs rounded-lg px-3 py-1"
              style={{ color: "var(--brand)", background: "var(--brand-tint)", fontWeight: 600 }}
            >
              Danas
            </button>
          </div>
        )}
      </motion.div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={CalendarDays}
          label={statLabel}
          value={loading ? "—" : appointments.filter((a) => a.status === "confirmed").length}
          iconClass="icon-blue"
          delay={0.08}
        />
        <StatCard
          icon={Users}
          label="Povezani klijenti"
          value={loading ? "—" : connectedCount}
          iconClass="icon-brand"
          delay={0.14}
        />
      </div>

      {/* Schedule */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.28 }}
        className="solid-card rounded-2xl overflow-hidden"
      >
        {/* Card header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h3 className="text-sm" style={{ fontWeight: 700 }}>
              {isToday ? "Raspored za danas" : `Raspored — ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
            </h3>
            {!loading && appointments.length > 0 && (
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {appointments.length} {appointments.length === 1 ? "termin" : "termina"}
              </p>
            )}
          </div>
          {!loading && appointments.length > 0 && (
            <span className={`badge ${isToday ? "badge-brand" : "badge-blue"}`}>
              <CalendarDays size={11} strokeWidth={2} />
              {isToday ? "Danas" : selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}
            </span>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
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
                Vlasnici mogu zakazati termin sami — bez telefonskog poziva.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {appointments.map((a, i) => (
                <AppointmentRow key={a.id} appt={a} index={i} isToday={isToday} onNoShow={handleNoShow} />
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
