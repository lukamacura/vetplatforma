"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Users, CheckCircle2, CalendarDays, Clock, ChevronLeft, ChevronRight, Banknote, Sparkles, AlertTriangle, Search, PawPrint } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import {
  generateOptimizedSlots,
  formatSlot,
  toLocalDateStr,
  type RankedSlot,
} from "@/lib/scheduling"
import { belgradeDayBoundsUTC, belgradeWeekday } from "@/lib/time"
import type { Pet, Service, ClinicHours } from "@/lib/types"

type OwnerPetRow = {
  owner_id:   string
  owner_name: string
  pet:        Pet
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
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

// Flow: 1 = Vlasnik+Ljubimac, 2 = Usluga, 3 = Datum+Termin, 4 = Uspeh
type Step = 1 | 2 | 3 | 4

function norm(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
}

function VetBookingPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preselectedPetId   = searchParams.get("petId")
  const preselectedOwnerId = searchParams.get("ownerId")

  const [clinicId,   setClinicId]   = useState<string | null>(null)
  const [step,       setStep]       = useState<Step>(1)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)

  const [rows,          setRows]          = useState<OwnerPetRow[]>([])
  const [query,         setQuery]         = useState("")
  const [selectedRow,   setSelectedRow]   = useState<OwnerPetRow | null>(null)

  const [services,        setServices]        = useState<Service[]>([])
  const [selectedService, setSelectedService] = useState<Service | null>(null)

  const [clinicHoursMap,  setClinicHoursMap]  = useState<Map<number, ClinicHours>>(new Map())
  const [weekStart,       setWeekStart]       = useState<Date>(() => startOfWeek(new Date()))
  const [selectedDate,    setSelectedDate]    = useState<Date | null>(null)
  const [rankedSlots,     setRankedSlots]     = useState<RankedSlot[]>([])
  const [selectedSlot,    setSelectedSlot]    = useState("")
  const [loadingSlots,    setLoadingSlots]    = useState(false)
  const [errorMsg,        setErrorMsg]        = useState("")
  const [showAllSlots,    setShowAllSlots]    = useState(false)

  // Initial load — owners + their pets folded into a single searchable list.
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      // Resolve clinic_id
      const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("id", user.id).single()
      let cid = profile?.clinic_id
      if (!cid) {
        const { data: owned } = await supabase.from("clinics").select("id").eq("owner_id", user.id).single()
        cid = owned?.id ?? null
      }
      if (!cid) { setLoading(false); return }
      setClinicId(cid)

      // Connected owners → pets → flatten
      const { data: conns } = await supabase.from("connections").select("owner_id").eq("clinic_id", cid)
      const ownerIds = (conns ?? []).map((c) => c.owner_id)

      const [{ data: profiles }, { data: pets }, { data: svcData }, { data: hoursData }] = await Promise.all([
        ownerIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", ownerIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
        ownerIds.length > 0
          ? supabase.from("pets").select("*").in("owner_id", ownerIds).order("name")
          : Promise.resolve({ data: [] as Pet[] }),
        supabase.from("services").select("*").eq("clinic_id", cid).eq("is_active", true).order("name"),
        supabase.from("clinic_hours").select("*").eq("clinic_id", cid),
      ])

      const nameById: Record<string, string> = {}
      for (const p of (profiles as { id: string; full_name: string }[] | null) ?? []) {
        nameById[p.id] = p.full_name
      }
      const rowList: OwnerPetRow[] = ((pets as Pet[] | null) ?? []).map((pet) => ({
        owner_id:   pet.owner_id,
        owner_name: nameById[pet.owner_id] ?? "—",
        pet,
      }))
      rowList.sort((a, b) => a.owner_name.localeCompare(b.owner_name, "sr"))

      setRows(rowList)
      setServices((svcData as Service[]) ?? [])
      const map = new Map<number, ClinicHours>()
      for (const h of (hoursData as ClinicHours[]) ?? []) map.set(h.weekday, h)
      setClinicHoursMap(map)

      // Handle preselection from podsetnici
      if (preselectedOwnerId && preselectedPetId) {
        const match = rowList.find((r) => r.owner_id === preselectedOwnerId && r.pet.id === preselectedPetId)
        if (match) { setSelectedRow(match); setStep(2) }
      } else if (preselectedOwnerId) {
        setQuery(nameById[preselectedOwnerId] ?? "")
      }

      setLoading(false)
    }
    init()
  }, [preselectedOwnerId, preselectedPetId])

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = norm(query.trim())
    return rows.filter((r) =>
      norm(r.owner_name).includes(q) ||
      norm(r.pet.name).includes(q) ||
      (r.pet.breed ? norm(r.pet.breed).includes(q) : false)
    )
  }, [rows, query])

  const loadSlots = useCallback(async () => {
    if (!selectedDate || !selectedService || !clinicId) return
    setLoadingSlots(true)
    setShowAllSlots(false)
    const supabase = createClient()
    const dayStr   = toLocalDateStr(selectedDate)
    const [startISO, endISO] = belgradeDayBoundsUTC(dayStr)

    const { data: apptData } = await supabase
      .from("appointments")
      .select("scheduled_at, duration_minutes, buffer_after_minutes, service_id")
      .eq("clinic_id", clinicId)
      .eq("status", "confirmed")
      .gte("scheduled_at", startISO)
      .lt("scheduled_at", endISO)

    const appts = apptData ?? []
    const legacyIds = appts.filter((a) => a.duration_minutes == null).map((a) => a.service_id)
    let serviceMap: Record<string, { duration_minutes: number; buffer_after_minutes: number }> = {}
    if (legacyIds.length > 0) {
      const { data: legacy } = await supabase
        .from("services")
        .select("id, duration_minutes, buffer_after_minutes")
        .in("id", [...new Set(legacyIds)])
      serviceMap = Object.fromEntries(
        (legacy ?? []).map((s: { id: string; duration_minutes: number; buffer_after_minutes: number }) => [
          s.id, { duration_minutes: s.duration_minutes, buffer_after_minutes: s.buffer_after_minutes },
        ])
      )
    }

    const intervals = appts.map((a) => {
      const start = new Date(a.scheduled_at).getTime()
      const dur   = a.duration_minutes ?? serviceMap[a.service_id]?.duration_minutes     ?? 30
      const buf   = a.buffer_after_minutes ?? serviceMap[a.service_id]?.buffer_after_minutes ?? 0
      return { start, end: start + (dur + buf) * 60_000 }
    })

    const weekday   = belgradeWeekday(dayStr)
    const hours     = clinicHoursMap.get(weekday)
    const openTime  = hours?.open_time  ?? "09:00"
    const closeTime = hours?.close_time ?? "17:00"

    const ranked = generateOptimizedSlots(
      {
        date:        dayStr,
        durationMin: selectedService.duration_minutes,
        intervals,
        openTime,
        closeTime,
        // Vets can book walk-ins right now; no lead-time guard, just skip past slots.
        notBefore:   new Date(),
      },
      "advisory",
      selectedService.duration_minutes,
    )
    setRankedSlots(ranked)
    setLoadingSlots(false)
  }, [selectedDate, selectedService, clinicId, clinicHoursMap])

  useEffect(() => { loadSlots() }, [loadSlots])

  async function handleConfirm() {
    if (!selectedRow || !selectedService || !selectedSlot || !clinicId) return
    setSaving(true)
    setErrorMsg("")
    const supabase = createClient()
    const { error } = await supabase.from("appointments").insert({
      clinic_id:    clinicId,
      pet_id:       selectedRow.pet.id,
      service_id:   selectedService.id,
      owner_id:     selectedRow.owner_id,
      scheduled_at: selectedSlot,
      status:       "confirmed",
      booked_by:    "vet",
    })
    setSaving(false)
    if (!error) { setStep(4); return }
    if (error.code === "23P01") {
      setErrorMsg("Termin je upravo zauzet. Odaberite drugi.")
      setSelectedSlot("")
      await loadSlots()
      return
    }
    setErrorMsg("Greška pri zakazivanju termina. Pokušajte ponovo.")
  }

  const weekDays = getWeekDays(weekStart)

  function isDayClosed(day: Date): boolean {
    const weekday = belgradeWeekday(toLocalDateStr(day))
    const hours   = clinicHoursMap.get(weekday)
    if (hours) return hours.is_closed
    return weekday === 0 || weekday === 6
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }

  if (step === 4) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="py-20 text-center space-y-5"
      >
        <div className="icon-lg icon-brand mx-auto" style={{ width: 64, height: 64, borderRadius: 18 }}>
          <CheckCircle2 size={32} strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl">Termin zakazan!</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {selectedRow?.pet.name} · {selectedService?.name}
            <br />
            {selectedRow?.owner_name}
            <br />
            {selectedSlot && (() => {
              const d = new Date(selectedSlot)
              return `${d.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Belgrade" })} ${d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Belgrade" })}`
            })()}
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm"
        >
          Nazad na pregled dana
        </button>
      </motion.div>
    )
  }

  return (
    <div className="space-y-7 max-w-2xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => {
              if (step > 1) setStep((s) => (s - 1) as Step)
              else router.back()
            }}
            className="icon-sm icon-muted"
            style={{ cursor: "pointer" }}
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>
          <div>
            <h1 className="text-2xl">Novo zakazivanje</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Korak {step} od 3
            </p>
          </div>
        </div>
      </motion.div>

      {/* Step 1 — Owner + pet (combined searchable list) */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-sm icon-blue">
              <Users size={14} strokeWidth={2} />
            </div>
            <h2 className="text-base" style={{ fontWeight: 700 }}>Vlasnik i ljubimac</h2>
          </div>

          {rows.length === 0 ? (
            <div className="solid-card rounded-2xl py-14 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema povezanih vlasnika.</p>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
              >
                <Search size={14} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Pretraga po vlasniku ili imenu ljubimca…"
                  className="flex-1 bg-transparent outline-none text-sm"
                  autoFocus
                />
              </div>

              {filteredRows.length === 0 ? (
                <div className="solid-card rounded-2xl py-10 text-center">
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema rezultata za „{query}“.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRows.map((r, i) => (
                    <motion.button
                      key={`${r.owner_id}:${r.pet.id}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.25), duration: 0.18 }}
                      onClick={() => { setSelectedRow(r); setStep(2) }}
                      className="w-full text-left solid-card rounded-xl p-3.5 flex items-center gap-3 transition-all"
                      style={{
                        border: selectedRow?.pet.id === r.pet.id ? "1px solid var(--brand)" : "1px solid var(--border)",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)" }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedRow?.pet.id === r.pet.id ? "var(--brand)" : "var(--border)" }}
                    >
                      <div className="icon-md icon-brand flex-none">
                        <PawPrint size={16} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm truncate" style={{ fontWeight: 600 }}>
                          {r.pet.name}
                          {r.pet.breed && (
                            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> · {r.pet.breed}</span>
                          )}
                        </p>
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                          {r.owner_name}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Step 2 — Select service */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-3">
          <div className="mb-2">
            <h2 className="text-base" style={{ fontWeight: 700 }}>Odaberite uslugu</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {selectedRow?.pet.name} · {selectedRow?.owner_name}
            </p>
          </div>
          {services.length === 0 ? (
            <div className="solid-card rounded-2xl py-14 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Klinika nema aktivnih usluga.</p>
            </div>
          ) : (
            services.map((svc, i) => (
              <motion.button
                key={svc.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22 }}
                onClick={() => {
                  setSelectedService(svc)
                  setSelectedDate(null)
                  setSelectedSlot("")
                  setStep(3)
                }}
                className="w-full text-left solid-card rounded-xl p-4 flex items-center justify-between gap-4 transition-all"
                style={{
                  border: selectedService?.id === svc.id ? "1px solid var(--brand)" : "1px solid var(--border)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedService?.id === svc.id ? "var(--brand)" : "var(--border)" }}
              >
                <div>
                  <p className="text-sm" style={{ fontWeight: 600 }}>{svc.name}</p>
                  {svc.description && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{svc.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="badge badge-blue">
                    <Clock size={10} strokeWidth={2} />
                    {svc.duration_minutes} min
                  </span>
                  <span className="badge badge-green" style={{ gap: 4 }}>
                    <Banknote size={10} strokeWidth={2} />
                    {svc.price_rsd.toLocaleString("sr-Latn-RS")} RSD
                  </span>
                </div>
              </motion.button>
            ))
          )}
        </motion.div>
      )}

      {/* Step 3 — Select date + slot */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-5">
          <div className="mb-2">
            <h2 className="text-base" style={{ fontWeight: 700 }}>Odaberite datum i termin</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {selectedRow?.pet.name} · {selectedService?.name}
            </p>
          </div>

          {/* Week navigator */}
          <div className="solid-card rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { const p = new Date(weekStart); p.setDate(p.getDate() - 7); setWeekStart(p) }}
                className="icon-sm icon-muted shrink-0"
                style={{ cursor: "pointer" }}
              >
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
              <div className="flex flex-1 gap-1 justify-between overflow-x-auto">
                {weekDays.map((day) => {
                  const closed     = isDayClosed(day)
                  const isPast     = day < new Date(new Date().setHours(0, 0, 0, 0))
                  const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
                  const isToday    = isSameDay(day, new Date())
                  const disabled   = closed || isPast
                  return (
                    <button
                      key={day.toISOString()}
                      disabled={disabled}
                      onClick={() => { if (!disabled) { setSelectedDate(new Date(day)); setSelectedSlot("") } }}
                      className="flex flex-col items-center rounded-xl px-2 py-2 min-w-[36px] transition-all"
                      style={{
                        background: isSelected ? "var(--brand)" : isToday ? "var(--brand-tint)" : "transparent",
                        color:      isSelected ? "#fff" : isToday ? "var(--brand)" : disabled ? "var(--text-muted)" : "var(--text-secondary)",
                        opacity:    disabled ? 0.4 : 1,
                        cursor:     disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: 10, opacity: isSelected ? 0.85 : 1 }}>
                        {day.toLocaleDateString("sr-Latn-RS", { weekday: "short" })}
                      </span>
                      <span className="text-sm mt-0.5" style={{ fontWeight: isSelected || isToday ? 700 : 500 }}>
                        {day.getDate()}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => { const n = new Date(weekStart); n.setDate(n.getDate() + 7); setWeekStart(n) }}
                className="icon-sm icon-muted shrink-0"
                style={{ cursor: "pointer" }}
              >
                <ChevronRight size={15} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Slots */}
          {selectedDate && (() => {
            const hasRecommended = rankedSlots.some((s) => s.rank.isContiguous)
            const hasNonRecommended = rankedSlots.some((s) => !s.rank.isContiguous)
            const visibleSlots = showAllSlots ? rankedSlots : rankedSlots.filter((s) => s.rank.isContiguous)
            const displaySlots = visibleSlots.length > 0 ? visibleSlots : rankedSlots

            return (
              <motion.div
                key={selectedDate.toISOString()}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="solid-card rounded-2xl p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="icon-sm icon-blue">
                      <CalendarDays size={14} strokeWidth={2} />
                    </div>
                    <p className="text-sm" style={{ fontWeight: 600 }}>
                      {selectedDate.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "long" })}
                    </p>
                  </div>
                  {hasRecommended && hasNonRecommended && (
                    <button
                      onClick={() => setShowAllSlots((v) => !v)}
                      className="text-xs px-2.5 py-1 rounded-lg transition-all"
                      style={{
                        color: showAllSlots ? "var(--text-muted)" : "var(--brand)",
                        background: showAllSlots ? "var(--surface-raised)" : "var(--brand-tint)",
                        border: `1px solid ${showAllSlots ? "var(--border)" : "rgba(43,181,160,0.25)"}`,
                        fontWeight: 600,
                      }}
                    >
                      {showAllSlots ? "Samo preporučeni" : "Prikaži sve termine"}
                    </button>
                  )}
                </div>
                {loadingSlots ? (
                  <div className="grid grid-cols-4 gap-2">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
                    ))}
                  </div>
                ) : rankedSlots.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "var(--text-muted)" }}>
                    Nema slobodnih termina za ovaj dan.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      {displaySlots.map((slot) => {
                        const isSelected = selectedSlot === slot.iso
                        const isRecommended = slot.rank.isContiguous
                        return (
                          <button
                            key={slot.iso}
                            onClick={() => setSelectedSlot(slot.iso)}
                            className="relative py-2.5 rounded-xl text-sm font-medium transition-all"
                            style={{
                              background: isSelected
                                ? "var(--brand)"
                                : isRecommended
                                  ? "var(--brand-tint)"
                                  : "var(--surface-raised)",
                              color: isSelected
                                ? "#fff"
                                : isRecommended
                                  ? "var(--brand)"
                                  : "var(--text-secondary)",
                              border: `1px solid ${
                                isSelected
                                  ? "var(--brand)"
                                  : isRecommended
                                    ? "rgba(43,181,160,0.25)"
                                    : "var(--border)"
                              }`,
                              fontWeight: isSelected || isRecommended ? 700 : 500,
                              opacity: !isRecommended && !isSelected ? 0.75 : 1,
                            }}
                            title={
                              isRecommended
                                ? "Preporučeno — bez praznine"
                                : `Ostavlja prazninu od ${slot.rank.gapMinutes} min`
                            }
                          >
                            {formatSlot(slot.iso)}
                            {isRecommended && !isSelected && (
                              <span
                                className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full"
                                style={{
                                  width: 16,
                                  height: 16,
                                  background: "var(--green)",
                                  color: "#fff",
                                }}
                              >
                                <Sparkles size={8} strokeWidth={2.5} />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                    {selectedSlot && !rankedSlots.find((s) => s.iso === selectedSlot)?.rank.isContiguous && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                        style={{
                          background: "var(--amber-tint)",
                          color: "var(--amber-text)",
                          border: "1px solid rgba(217,119,6,0.18)",
                          fontWeight: 600,
                        }}
                      >
                        <AlertTriangle size={12} strokeWidth={2.5} />
                        Ostavlja prazninu od {rankedSlots.find((s) => s.iso === selectedSlot)?.rank.gapMinutes ?? 0} min u rasporedu
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )
          })()}

          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--red-tint)", color: "var(--red)", fontWeight: 600, border: "1px solid rgba(220,38,38,0.18)" }}
            >
              {errorMsg}
            </motion.div>
          )}

          {selectedSlot && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleConfirm}
              disabled={saving}
              className="btn-primary w-full rounded-xl py-3.5 text-sm"
            >
              {saving ? "Zakazivanje..." : "Potvrdi termin"}
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default function VetBookingPage() {
  return (
    <Suspense fallback={
      <div className="space-y-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    }>
      <VetBookingPageInner />
    </Suspense>
  )
}
