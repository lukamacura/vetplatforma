"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarDays, Users, ChevronRight, ChevronLeft, CalendarPlus, MessageSquare, Eye, UserPlus, Check, ChevronDown, Phone } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { SPECIES_LABEL } from "@/lib/species"
import type { AppointmentWithDetails, Species } from "@/lib/types"

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
  const [unreadCount,     setUnreadCount]     = useState(0)
  const [vetId,           setVetId]           = useState<string | null>(null)
  const [connectedCount,  setConnectedCount]  = useState(0)
  const [clinicName,      setClinicName]      = useState("")
  const [clinicId,        setClinicId]        = useState<string | null>(null)
  const [loading,         setLoading]         = useState(true)

  type PendingConn = { id: string; owner_id: string; connected_at: string; owner_name: string; phone: string | null }
  const [pendingRequests,  setPendingRequests]  = useState<PendingConn[]>([])
  const [approvingId,      setApprovingId]      = useState<string | null>(null)
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null)

  const isToday = isSameDay(selectedDate, new Date())

  const [ownerDayNotes, setOwnerDayNotes] = useState<Record<string, string>>({})
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({})

  // Initial load: get clinic info + connected count
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setVetId(user.id)

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

      const [{ count }, { data: pendingConns }] = await Promise.all([
        supabase
          .from("connections").select("id", { count: "exact", head: true })
          .eq("clinic_id", cid)
          .eq("status", "confirmed"),
        supabase
          .from("connections").select("id, owner_id, connected_at")
          .eq("clinic_id", cid)
          .eq("status", "pending"),
      ])
      setConnectedCount(count ?? 0)

      if (pendingConns?.length) {
        const ownerIds = pendingConns.map((c) => c.owner_id)
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name, phone").in("id", ownerIds)
        const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
        setPendingRequests(pendingConns.map((c) => ({
          id: c.id,
          owner_id: c.owner_id,
          connected_at: c.connected_at,
          owner_name: profileMap[c.owner_id]?.full_name ?? "Nepoznat vlasnik",
          phone: profileMap[c.owner_id]?.phone ?? null,
        })))
      }
    }
    init()
  }, [])

  // Reload confirmed-connection count (for focus refresh)
  const loadConnectedCount = useCallback(async () => {
    if (!clinicId) return
    const supabase = createClient()
    const { count } = await supabase
      .from("connections").select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("status", "confirmed")
    setConnectedCount(count ?? 0)
  }, [clinicId])

  // Load appointments + owner notes for the selected day.
  // `silent` skips the loading flicker for background (realtime/focus) refreshes.
  const loadAppointments = useCallback(async (silent = false) => {
    if (!clinicId) return
    if (!silent) setLoading(true)
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

      // Fetch owner notes for this day — RLS restricts to connected owners automatically.
      // Runs regardless of whether appointments exist on this day.
      const dayKey = dayKeyFromLocal(dayStart)
      const { data: noteRows } = await supabase
        .from("owner_day_notes")
        .select("owner_id, note")
        .eq("day", dayKey)
        .neq("note", "")
      const noteMap: Record<string, string> = {}
      for (const row of noteRows ?? []) {
        if (row.note?.trim()) noteMap[row.owner_id] = row.note
      }
      setOwnerDayNotes(noteMap)

      const noteOwnerIds = Object.keys(noteMap)
      if (noteOwnerIds.length) {
        const { data: noteOwners } = await supabase
          .from("profiles").select("id, full_name").in("id", noteOwnerIds)
        setOwnerNames(Object.fromEntries((noteOwners ?? []).map((p) => [p.id, p.full_name])))
      } else {
        setOwnerNames({})
      }

      if (!silent) setLoading(false)
  }, [clinicId, selectedDate])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  // Load appointment counts for each day in the viewed month (dots)
  const loadMonthCounts = useCallback(async () => {
    if (!clinicId) return
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
  }, [clinicId, viewYear, viewMonth])

  useEffect(() => { loadMonthCounts() }, [loadMonthCounts])

  // Load pet reminders (vaccines + controls) for the viewed month.
  // RLS pets_vet restricts this to pets of connected owners.
  const loadMonthReminders = useCallback(async () => {
    if (!clinicId) return
    const supabase = createClient()
      const monthStart = dayKeyFromLocal(new Date(viewYear, viewMonth, 1))
      const monthEnd   = dayKeyFromLocal(new Date(viewYear, viewMonth + 1, 0))

      const { data: connRows } = await supabase
        .from("connections").select("owner_id")
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
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
  }, [clinicId, viewYear, viewMonth])

  useEffect(() => { loadMonthReminders() }, [loadMonthReminders])

  // Realtime: listen for new pending connection requests
  useEffect(() => {
    if (!clinicId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`connections-vet-${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "connections",
          filter: `clinic_id=eq.${clinicId}`,
        },
        async (payload) => {
          const row = payload.new as { id: string; owner_id: string; connected_at: string; status: string }
          if (row.status !== "pending") return
          const supabase2 = createClient()
          const { data: profile } = await supabase2
            .from("profiles").select("full_name, phone").eq("id", row.owner_id).single()
          setPendingRequests((prev) => [
            ...prev,
            {
              id: row.id,
              owner_id: row.owner_id,
              connected_at: row.connected_at,
              owner_name: profile?.full_name ?? "Nepoznat vlasnik",
              phone: profile?.phone ?? null,
            },
          ])
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [clinicId])

  async function handleApprove(connId: string) {
    setApprovingId(connId)
    const supabase = createClient()
    await supabase.from("connections").update({ status: "confirmed" }).eq("id", connId)
    setPendingRequests((prev) => prev.filter((c) => c.id !== connId))
    setConnectedCount((n) => n + 1)
    setApprovingId(null)
  }

  const remindersByKey = useMemo(() => {
    const m: Record<string, VetReminder[]> = {}
    for (const r of monthReminders) {
      ;(m[r.date] ??= []).push(r)
    }
    return m
  }, [monthReminders])


  // Load total unread messages count for this vet
  const loadUnread = useCallback(async () => {
    if (!clinicId || !vetId) return
    const supabase = createClient()
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("receiver_id", vetId)
      .eq("is_read", false)
    setUnreadCount(count ?? 0)
  }, [clinicId, vetId])

  useEffect(() => { loadUnread() }, [loadUnread])

  // Keep the latest loaders in a ref so realtime / focus handlers can call them
  // without re-subscribing on every selectedDate or month change.
  const loadersRef = useRef({
    loadAppointments, loadMonthCounts, loadMonthReminders, loadUnread, loadConnectedCount,
  })
  useEffect(() => {
    loadersRef.current = {
      loadAppointments, loadMonthCounts, loadMonthReminders, loadUnread, loadConnectedCount,
    }
  })

  // Realtime: new bookings / cancellations for this clinic → refresh day + month dots
  useEffect(() => {
    if (!clinicId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`appointments-vet-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `clinic_id=eq.${clinicId}` },
        () => {
          loadersRef.current.loadAppointments(true)
          loadersRef.current.loadMonthCounts()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [clinicId])

  // Realtime: keep the unread message badge live
  useEffect(() => {
    if (!clinicId || !vetId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`messages-vet-dash-${clinicId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as { receiver_id?: string }
          if (row?.receiver_id !== vetId) return
          loadersRef.current.loadUnread()
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [clinicId, vetId])

  // Catch-all: refresh everything when the tab regains focus
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return
      const l = loadersRef.current
      l.loadAppointments(true)
      l.loadMonthCounts()
      l.loadMonthReminders()
      l.loadUnread()
      l.loadConnectedCount()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  const monthGrid = getMonthGrid(viewYear, viewMonth)

  const selectedDateLabel = isToday
    ? new Date().toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })
    : selectedDate.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })

  const statLabel = isToday
    ? "Raspored za danas"
    : `Raspored - ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}`


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
          href="/dashboard/pacijenti"
        />
        <StatCard
          icon={MessageSquare}
          label="Nepročitanih poruka"
          value={loading ? "-" : unreadCount}
          iconClass="icon-blue"
          href="/dashboard/poruke"
        />

      </div>

      {/* Pending connection requests */}
      {pendingRequests.length > 0 && (
        <motion.div
          variants={stagger.item}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1.5px solid rgba(217,119,6,0.3)", background: "var(--surface)" }}
        >
          <div
            className="flex items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(217,119,6,0.2)", background: "linear-gradient(135deg, rgba(217,119,6,0.06) 0%, transparent 100%)" }}
          >
            <div className="flex items-center gap-2">
              <div className="icon-sm icon-amber shrink-0">
                <UserPlus size={13} strokeWidth={2.25} />
              </div>
              <div>
                <h3 className="text-sm" style={{ fontWeight: 700 }}>Zahtevi za povezivanje</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {pendingRequests.length} {pendingRequests.length === 1 ? "vlasnik čeka odobrenje" : "vlasnika čeka odobrenje"}
                </p>
              </div>
            </div>
            <span className="badge badge-amber">
              <UserPlus size={11} strokeWidth={2} />
              {pendingRequests.length}
            </span>
          </div>
          <div className="p-4 space-y-2">
            {pendingRequests.map((req) => {
              const expanded = expandedPendingId === req.id
              return (
                <div
                  key={req.id}
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid rgba(217,119,6,0.15)" }}
                >
                  {/* Summary row — click to toggle details */}
                  <button
                    type="button"
                    onClick={() => setExpandedPendingId(expanded ? null : req.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                    style={{ background: "linear-gradient(135deg, var(--amber-tint) 0%, #FFFBEB 100%)" }}
                  >
                    <div className="icon-sm icon-amber shrink-0">
                      <UserPlus size={13} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ fontWeight: 600 }}>{req.owner_name}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Zahtev za povezivanje
                      </p>
                    </div>
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      style={{
                        color: "var(--amber)",
                        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s ease",
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  {/* Expanded info panel */}
                  {expanded && (
                    <div
                      className="px-4 pb-4 pt-3 space-y-3"
                      style={{ borderTop: "1px solid rgba(217,119,6,0.12)", background: "#FFFDF5" }}
                    >
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                          Kontakt
                        </p>
                        {req.phone ? (
                          <a
                            href={`tel:${req.phone}`}
                            className="inline-flex items-center gap-2 text-sm"
                            style={{ color: "var(--brand)", fontWeight: 600 }}
                          >
                            <Phone size={13} strokeWidth={2.25} />
                            {req.phone}
                          </a>
                        ) : (
                          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Broj telefona nije unet</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                          Datum zahteva
                        </p>
                        <p className="text-sm" style={{ color: "var(--text-primary)" }}>
                          {new Date(req.connected_at).toLocaleDateString("sr-Latn-RS", {
                            day: "2-digit", month: "long", year: "numeric",
                          })}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApprove(req.id)}
                        disabled={approvingId === req.id}
                        className="w-full rounded-xl px-3 py-2 text-xs flex items-center justify-center gap-1.5 transition-all"
                        style={{
                          background: "var(--brand-tint)",
                          color: "var(--brand)",
                          border: "1px solid rgba(43,181,160,0.25)",
                          fontWeight: 600,
                          opacity: approvingId === req.id ? 0.6 : 1,
                        }}
                      >
                        <Check size={11} strokeWidth={2.5} />
                        {approvingId === req.id ? "Odobravnje..." : "Odobri povezivanje"}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Day detail — Beleške vlasnika */}
      <div className="grid grid-cols-1 gap-4 lg:gap-5 items-start">

        {/* Beleške vlasnika card */}
        <motion.div variants={stagger.item} className="rounded-2xl overflow-hidden h-full" style={{ border: "1.5px solid rgba(43,181,160,0.30)", background: "var(--surface)" }}>

          {/* Card header */}
          <div
            className="flex items-center justify-between gap-3 px-5 py-4"
            style={{ borderBottom: "1px solid rgba(43,181,160,0.20)", background: "linear-gradient(135deg, rgba(43,181,160,0.07) 0%, transparent 100%)" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="icon-sm icon-brand shrink-0">
                <Eye size={13} strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm truncate" style={{ fontWeight: 700 }}>
                  {isToday ? "Beleške vlasnika" : `Beleške vlasnika - ${selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })}`}
                </h3>
                {Object.keys(ownerDayNotes).length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {Object.keys(ownerDayNotes).length}{" "}
                    {Object.keys(ownerDayNotes).length === 1 ? "beleška" : "beleški"}
                  </p>
                )}
              </div>
            </div>
            <span className="badge badge-brand shrink-0">
              <Eye size={11} strokeWidth={2} />
              {isToday ? "Danas" : selectedDate.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}
            </span>
          </div>

          {/* Card body */}
          <div className="p-4">
            {Object.keys(ownerDayNotes).length === 0 ? (
              <div className="py-14 text-center">
                <div className="icon-lg icon-brand mx-auto mb-4">
                  <Eye size={22} strokeWidth={1.75} />
                </div>
                <p className="text-sm mb-1" style={{ fontWeight: 600 }}>
                  {isToday ? "Nema beleški vlasnika za danas" : "Nema beleški vlasnika za ovaj dan"}
                </p>
                <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
                  Vlasnici mogu ostaviti poruku za kliniku uz termin.
                </p>
              </div>
            ) : (
              <motion.div variants={stagger.container} initial="hidden" animate="visible" className="space-y-3">
                {Object.entries(ownerDayNotes).map(([ownerId, note]) => {
                  const ownerName = ownerNames[ownerId] ?? appointments.find((a) => a.owner_id === ownerId)?.owner_name
                  return (
                    <motion.div
                      key={ownerId}
                      variants={stagger.row}
                      className="rounded-xl p-4 space-y-2"
                      style={{
                        background: "linear-gradient(135deg, var(--brand-tint) 0%, #dff4f1 100%)",
                        border: "1px solid rgba(43,181,160,0.22)",
                      }}
                    >
                      <p
                        className="text-xs"
                        style={{ fontWeight: 700, color: "var(--brand)", letterSpacing: "0.04em", textTransform: "uppercase" }}
                      >
                        {ownerName ?? "Vlasnik"}
                      </p>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap" }}
                      >
                        {note}
                      </p>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </div>
        </motion.div>

      </div>
    </motion.div>
  )
}
