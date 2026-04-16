"use client"

import { Suspense, useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Users, CheckCircle2, CalendarDays, Clock, ChevronLeft, ChevronRight, Banknote, Sparkles, AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import {
  buildOccupiedIntervals,
  generateOptimizedSlots,
  formatSlot,
  toLocalDateStr,
  type RankedSlot,
} from "@/lib/scheduling"
import type { Pet, Service, ClinicHours } from "@/lib/types"

type ConnectedOwner = {
  id: string
  full_name: string
  petCount: number
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

type Step = 1 | 2 | 3 | 4 | 5

function VetBookingPageInner() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const preselectedPetId   = searchParams.get("petId")
  const preselectedOwnerId = searchParams.get("ownerId")

  const [clinicId,   setClinicId]   = useState<string | null>(null)
  const [step,       setStep]       = useState<Step>(1)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)

  const [owners,          setOwners]          = useState<ConnectedOwner[]>([])
  const [selectedOwner,   setSelectedOwner]   = useState<ConnectedOwner | null>(null)

  const [pets,            setPets]            = useState<Pet[]>([])
  const [selectedPet,     setSelectedPet]     = useState<Pet | null>(null)

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

  // Initial load
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

      // Load connected owners
      const { data: conns } = await supabase.from("connections").select("owner_id").eq("clinic_id", cid)
      if (!conns?.length) { setLoading(false); return }
      const ownerIds = conns.map((c) => c.owner_id)

      const [{ data: profiles }, { data: petCounts }] = await Promise.all([
        supabase.from("profiles").select("id, full_name").in("id", ownerIds),
        supabase.from("pets").select("id, owner_id").in("owner_id", ownerIds),
      ])

      const countMap: Record<string, number> = {}
      for (const p of petCounts ?? []) {
        countMap[p.owner_id] = (countMap[p.owner_id] ?? 0) + 1
      }

      const ownerList: ConnectedOwner[] = (profiles ?? []).map((p: { id: string; full_name: string }) => ({
        id:        p.id,
        full_name: p.full_name,
        petCount:  countMap[p.id] ?? 0,
      }))
      setOwners(ownerList)

      // Load services and hours
      const [{ data: svcData }, { data: hoursData }] = await Promise.all([
        supabase.from("services").select("*").eq("clinic_id", cid).eq("is_active", true).order("name"),
        supabase.from("clinic_hours").select("*").eq("clinic_id", cid),
      ])
      setServices((svcData as Service[]) ?? [])
      const map = new Map<number, ClinicHours>()
      for (const h of (hoursData as ClinicHours[]) ?? []) map.set(h.weekday, h)
      setClinicHoursMap(map)

      // Handle preselected params from podsetnici
      if (preselectedOwnerId) {
        const matchOwner = ownerList.find((o) => o.id === preselectedOwnerId)
        if (matchOwner) {
          setSelectedOwner(matchOwner)
          // load pets for this owner
          const { data: ownerPets } = await supabase.from("pets").select("*").eq("owner_id", preselectedOwnerId).order("name")
          const loadedPets = (ownerPets as Pet[]) ?? []
          setPets(loadedPets)
          if (preselectedPetId) {
            const matchPet = loadedPets.find((p) => p.id === preselectedPetId)
            if (matchPet) {
              setSelectedPet(matchPet)
              setStep(3)
            } else {
              setStep(2)
            }
          } else {
            setStep(2)
          }
        }
      }

      setLoading(false)
    }
    init()
  }, [preselectedOwnerId, preselectedPetId])

  // Load pets when owner selected
  const loadPets = useCallback(async (ownerId: string) => {
    const supabase = createClient()
    const { data } = await supabase.from("pets").select("*").eq("owner_id", ownerId).order("name")
    setPets((data as Pet[]) ?? [])
  }, [])

  // Load slots when date + service + clinic ready
  useEffect(() => {
    if (!selectedDate || !selectedService || !clinicId) return
    async function loadSlots() {
      setLoadingSlots(true)
      setShowAllSlots(false)
      const supabase = createClient()
      const dayStr   = toLocalDateStr(selectedDate!)
      const dayStartDate = new Date(`${dayStr}T00:00:00`)
      const dayEndDate   = new Date(`${dayStr}T23:59:59`)

      const { data: apptData } = await supabase
        .from("appointments")
        .select("scheduled_at, service_id")
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
        .gte("scheduled_at", dayStartDate.toISOString())
        .lte("scheduled_at", dayEndDate.toISOString())

      const appts = apptData ?? []
      let serviceMap: Record<string, { duration_minutes: number; buffer_after_minutes: number }> = {}

      if (appts.length > 0) {
        const bookedServiceIds = [...new Set(appts.map((a: { service_id: string }) => a.service_id))]
        const { data: bookedSvcs } = await supabase
          .from("services")
          .select("id, duration_minutes, buffer_after_minutes")
          .in("id", bookedServiceIds)
        serviceMap = Object.fromEntries(
          (bookedSvcs ?? []).map((s: { id: string; duration_minutes: number; buffer_after_minutes: number }) => [
            s.id,
            { duration_minutes: s.duration_minutes, buffer_after_minutes: s.buffer_after_minutes },
          ])
        )
      }

      const intervals = buildOccupiedIntervals(appts, serviceMap)

      const weekday   = selectedDate!.getDay()
      const hours     = clinicHoursMap.get(weekday)
      const openTime  = hours?.open_time  ?? "09:00"
      const closeTime = hours?.close_time ?? "17:00"

      const ranked = generateOptimizedSlots(
        { date: dayStr, durationMin: selectedService!.duration_minutes, intervals, openTime, closeTime },
        "advisory",
        selectedService!.duration_minutes,
      )
      setRankedSlots(ranked)
      setLoadingSlots(false)
    }
    loadSlots()
  }, [selectedDate, selectedService, clinicId, clinicHoursMap])

  async function handleConfirm() {
    if (!selectedPet || !selectedService || !selectedSlot || !clinicId || !selectedOwner) return
    setSaving(true)
    setErrorMsg("")
    const supabase = createClient()
    const { error } = await supabase.from("appointments").insert({
      clinic_id:    clinicId,
      pet_id:       selectedPet.id,
      service_id:   selectedService.id,
      owner_id:     selectedOwner.id,
      scheduled_at: selectedSlot,
      status:       "confirmed",
      booked_by:    "vet",
    })
    setSaving(false)
    if (error) {
      setErrorMsg("Greška pri zakazivanju termina. Pokušajte ponovo.")
    } else {
      setStep(5)
    }
  }

  const weekDays = getWeekDays(weekStart)

  // Determine if a weekday should be skipped
  function isDayClosed(day: Date): boolean {
    const weekday = day.getDay()
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

  if (step === 5) {
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
            {selectedPet?.name} · {selectedService?.name}
            <br />
            {selectedOwner?.full_name}
            <br />
            {selectedSlot && (() => {
              const d = new Date(selectedSlot)
              return `${d.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })}`
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
            <h1 className="text-2xl">Nova zakazivanje</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Korak {step} od 4
            </p>
          </div>
        </div>
      </motion.div>

      {/* Step 1 — Select owner */}
      {step === 1 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="icon-sm icon-blue">
              <Users size={14} strokeWidth={2} />
            </div>
            <h2 className="text-base" style={{ fontWeight: 700 }}>Odaberite vlasnika</h2>
          </div>
          {owners.length === 0 ? (
            <div className="solid-card rounded-2xl py-14 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema povezanih vlasnika.</p>
            </div>
          ) : (
            owners.map((owner, i) => (
              <motion.button
                key={owner.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22 }}
                onClick={async () => {
                  setSelectedOwner(owner)
                  await loadPets(owner.id)
                  setStep(2)
                }}
                className="w-full text-left solid-card rounded-xl p-4 flex items-center gap-4 transition-all"
                style={{
                  border: selectedOwner?.id === owner.id ? "1px solid var(--brand)" : "1px solid var(--border)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedOwner?.id === owner.id ? "var(--brand)" : "var(--border)" }}
              >
                <div className="icon-md icon-brand flex-none">
                  <Users size={16} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-sm" style={{ fontWeight: 600 }}>{owner.full_name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {owner.petCount} {owner.petCount === 1 ? "ljubimac" : owner.petCount < 5 ? "ljubimca" : "ljubimaca"}
                  </p>
                </div>
              </motion.button>
            ))
          )}
        </motion.div>
      )}

      {/* Step 2 — Select pet */}
      {step === 2 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-3">
          <div className="mb-2">
            <h2 className="text-base" style={{ fontWeight: 700 }}>Odaberite ljubimca</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selectedOwner?.full_name}</p>
          </div>
          {pets.length === 0 ? (
            <div className="solid-card rounded-2xl py-14 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Vlasnik nema dodanih ljubimaca.</p>
            </div>
          ) : (
            pets.map((pet, i) => (
              <motion.button
                key={pet.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.22 }}
                onClick={() => { setSelectedPet(pet); setStep(3) }}
                className="w-full text-left solid-card rounded-xl p-4 flex items-center gap-4 transition-all"
                style={{
                  border: selectedPet?.id === pet.id ? "1px solid var(--brand)" : "1px solid var(--border)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--brand)" }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = selectedPet?.id === pet.id ? "var(--brand)" : "var(--border)" }}
              >
                <p className="text-sm" style={{ fontWeight: 600 }}>{pet.name}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pet.breed ?? "—"}</p>
              </motion.button>
            ))
          )}
        </motion.div>
      )}

      {/* Step 3 — Select service */}
      {step === 3 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-3">
          <div className="mb-2">
            <h2 className="text-base" style={{ fontWeight: 700 }}>Odaberite uslugu</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{selectedPet?.name}</p>
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
                  setStep(4)
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

      {/* Step 4 — Select date + slot */}
      {step === 4 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="space-y-5">
          <div className="mb-2">
            <h2 className="text-base" style={{ fontWeight: 700 }}>Odaberite datum i termin</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {selectedPet?.name} · {selectedService?.name}
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
