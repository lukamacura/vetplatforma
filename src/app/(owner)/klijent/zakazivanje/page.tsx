"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, CheckCircle2, Clock, Banknote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import {
  generateFreeSlots,
  intervalsFromAppointments,
  getAvailableDays,
  formatSlot,
} from "@/lib/scheduling"
import { belgradeDayBoundsUTC, belgradeWeekday } from "@/lib/time"
import type { Pet, Service, Clinic, ClinicHours } from "@/lib/types"

// Owners can't book in the past; enforce a 15-minute minimum lead time
// so they don't scramble a vet with an "in 2 minutes" slot.
const OWNER_MIN_LEAD_MS = 15 * 60_000

function BookingPageInner() {
  const router           = useRouter()
  const searchParams     = useSearchParams()
  const preselectedPetId = searchParams.get("petId")

  const [pets, setPets]                     = useState<Pet[]>([])
  const [connectedClinics, setConnectedClinics] = useState<Clinic[]>([])
  const [services, setServices]             = useState<Service[]>([])
  const [clinicHoursMap, setClinicHoursMap] = useState<Map<number, ClinicHours>>(new Map())
  const [userId, setUserId]                 = useState<string | null>(null)

  const [loading, setLoading]               = useState(true)
  const [loadingServices, setLoadingServices] = useState(false)
  const [noClinic, setNoClinic]             = useState(false)
  const [clinicSelected, setClinicSelected] = useState(false)
  const [step, setStep]                     = useState<1 | 2 | 3 | 4>(1)

  const [selectedClinic, setSelectedClinic]   = useState<Clinic | null>(null)
  const [selectedPet, setSelectedPet]         = useState<Pet | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDay, setSelectedDay]         = useState("")
  const [selectedSlot, setSelectedSlot]       = useState("")
  const [availableSlots, setAvailableSlots]   = useState<string[]>([])
  const [saving, setSaving]                   = useState(false)
  const [errorMsg, setErrorMsg]               = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [{ data: petsData }, { data: connsData }] = await Promise.all([
        supabase.from("pets").select("id, owner_id, name, species, breed, birth_date, weight_kg, next_vaccine_date, next_control_date, chip_id, passport_number, gender, color, owner_notes, vaccine_note, created_at").eq("owner_id", user.id).order("name"),
        supabase.from("connections").select("clinic_id").eq("owner_id", user.id),
      ])

      const loadedPets = (petsData as Pet[]) ?? []
      setPets(loadedPets)

      if (preselectedPetId) {
        const match = loadedPets.find((p) => p.id === preselectedPetId)
        if (match) { setSelectedPet(match); setStep(2) }
      }

      if (!connsData?.length) { setNoClinic(true); setLoading(false); return }

      const clinicIds = connsData.map((c) => c.clinic_id)
      const { data: clinicsData } = await supabase
        .from("clinics").select("*").in("id", clinicIds).order("name")

      const clinics = (clinicsData as Clinic[]) ?? []
      setConnectedClinics(clinics)

      if (clinics.length === 1) { setSelectedClinic(clinics[0]); setClinicSelected(true) }

      setLoading(false)
    }
    load()
  }, [preselectedPetId])

  // Load services + clinic hours when clinic is selected
  useEffect(() => {
    if (!selectedClinic) return
    async function loadServicesAndHours() {
      setLoadingServices(true)
      const supabase = createClient()
      const [{ data: servicesData }, { data: hoursData }] = await Promise.all([
        supabase.from("services").select("*").eq("clinic_id", selectedClinic!.id).eq("is_active", true).order("name"),
        supabase.from("clinic_hours").select("*").eq("clinic_id", selectedClinic!.id),
      ])
      setServices((servicesData as Service[]) ?? [])
      const map = new Map<number, ClinicHours>()
      for (const h of (hoursData as ClinicHours[]) ?? []) map.set(h.weekday, h)
      setClinicHoursMap(map)
      setLoadingServices(false)
    }
    loadServicesAndHours()
  }, [selectedClinic])

  const availableDays = useMemo(
    () => selectedClinic ? getAvailableDays(clinicHoursMap) : [],
    [clinicHoursMap, selectedClinic],
  )

  const loadSlots = useCallback(async () => {
    if (!selectedDay || !selectedService || !selectedClinic) return
    const supabase = createClient()
    const [startISO, endISO] = belgradeDayBoundsUTC(selectedDay)

    // `ends_at` is snapshot by the DB trigger at booking time and already
    // includes the clinic buffer that applied then — so we can use it as-is.
    const { data: apptData } = await supabase
      .from("appointments")
      .select("scheduled_at, ends_at")
      .eq("clinic_id", selectedClinic.id)
      .eq("status", "confirmed")
      .gte("scheduled_at", startISO)
      .lt("scheduled_at", endISO)

    const intervals = intervalsFromAppointments(
      (apptData ?? []) as { scheduled_at: string; ends_at: string }[],
    )

    const weekday   = belgradeWeekday(selectedDay)
    const hours     = clinicHoursMap.get(weekday)
    const openTime  = hours?.open_time  ?? "09:00"
    const closeTime = hours?.close_time ?? "17:00"

    const slots = generateFreeSlots({
      date:        selectedDay,
      durationMin: selectedService.duration_minutes,
      bufferMin:   selectedClinic.buffer_minutes ?? 10,
      intervals,
      openTime,
      closeTime,
      notBefore:   new Date(Date.now() + OWNER_MIN_LEAD_MS),
    })
    setAvailableSlots(slots)
  }, [selectedDay, selectedService, selectedClinic, clinicHoursMap])

  useEffect(() => { loadSlots() }, [loadSlots])

  async function handleConfirm() {
    if (!selectedPet || !selectedService || !selectedSlot || !selectedClinic || !userId) return
    setSaving(true)
    setErrorMsg("")
    const supabase = createClient()
    const { error } = await supabase.from("appointments").insert({
      clinic_id:    selectedClinic.id,
      pet_id:       selectedPet.id,
      service_id:   selectedService.id,
      owner_id:     userId,
      scheduled_at: selectedSlot,
      status:       "confirmed",
      booked_by:    "owner",
    })
    setSaving(false)
    if (!error) { setStep(4); return }
    // Postgres exclusion-constraint violation — slot was taken between
    // slot-fetch and tap. Refresh the list so the user sees the new reality.
    if (error.code === "23P01") {
      setErrorMsg("Taj termin je upravo rezervisan. Molimo odaberite drugi.")
      setSelectedSlot("")
      await loadSlots()
      return
    }
    setErrorMsg("Greška pri zakazivanju. Pokušajte ponovo.")
  }

  if (loading) {
    return <div className="py-20 text-center text-sm" style={{ color: "var(--text-muted)" }}>Učitavanje...</div>
  }

  if (noClinic) {
    return (
      <div className="py-20 text-center space-y-4">
        <div className="icon-lg icon-muted mx-auto">
          <Building2 size={22} strokeWidth={1.75} />
        </div>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Niste još uvek povezani sa klinikom.</p>
        <Link href="/klijent/klinike">
          <Button style={{ background: "var(--brand)", color: "#fff", border: "none" }}>
            Pronađite kliniku
          </Button>
        </Link>
      </div>
    )
  }

  if (!clinicSelected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold">Zakažite termin</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Odaberite kliniku</p>
        </div>
        <div className="space-y-3">
          {connectedClinics.map((clinic) => (
            <button
              key={clinic.id}
              onClick={() => { setSelectedClinic(clinic); setClinicSelected(true); setStep(1) }}
              className="w-full text-left solid-card rounded-xl p-4 flex items-center gap-4"
            >
              <div className="icon-md icon-brand flex-none">
                <Building2 size={18} strokeWidth={1.75} />
              </div>
              <p className="font-semibold">{clinic.name}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (step === 4) {
    return (
      <div className="py-20 text-center space-y-5">
        <div className="icon-lg icon-brand mx-auto" style={{ width: 56, height: 56, borderRadius: 16 }}>
          <CheckCircle2 size={28} strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Termin zakazan!</h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {selectedPet?.name} · {selectedService?.name}
            {" · "}<span style={{ color: "var(--green)", fontWeight: 600 }}>{selectedService?.price_rsd.toLocaleString("sr-Latn-RS")} RSD</span>
            <br />{selectedClinic?.name}<br />
            {selectedSlot && (() => {
              const d = new Date(selectedSlot)
              return `${d.toLocaleDateString("sr-Latn-RS", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })}`
            })()}
          </p>
        </div>
        <Button onClick={() => router.push("/klijent")} style={{ background: "var(--brand)", color: "#fff", border: "none" }}>
          Idi na početnu
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3)
            else if (connectedClinics.length > 1) setClinicSelected(false)
            else router.back()
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Zakažite termin</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {selectedClinic?.name} · Korak {step} od 3
          </p>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">1. Odaberite ljubimca</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {pets.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema ljubimaca. Prvo dodajte ljubimca.</p>
            ) : (
              pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => { setSelectedPet(pet); setStep(2) }}
                  className="w-full text-left p-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: selectedPet?.id === pet.id ? "var(--brand)" : "var(--border)",
                    background:  selectedPet?.id === pet.id ? "var(--brand-tint)" : "transparent",
                  }}
                >
                  <p className="font-medium">{pet.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{pet.breed || "—"}</p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">2. Odaberite uslugu</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loadingServices ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Učitavanje usluga...</p>
            ) : services.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Klinika nema aktivnih usluga.</p>
            ) : (
              services.map((svc) => (
                <button
                  key={svc.id}
                  onClick={() => { setSelectedService(svc); setSelectedDay(""); setSelectedSlot(""); setStep(3) }}
                  className="w-full text-left p-3 rounded-lg border transition-colors"
                  style={{
                    borderColor: selectedService?.id === svc.id ? "var(--brand)" : "var(--border)",
                    background:  selectedService?.id === svc.id ? "var(--brand-tint)" : "transparent",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{svc.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {svc.description || ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        style={{ background: "var(--blue-tint, rgba(37,99,235,0.08))", color: "var(--blue)" }}>
                        <Clock size={10} strokeWidth={2.5} />
                        {svc.duration_minutes} min
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                        style={{ background: "var(--green-tint, rgba(22,163,74,0.08))", color: "var(--green)", fontWeight: 600 }}>
                        <Banknote size={10} strokeWidth={2.5} />
                        {svc.price_rsd.toLocaleString("sr-Latn-RS")} RSD
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">3. Odaberite termin</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Datum</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {availableDays.map((day) => (
                    <button
                      key={day}
                      onClick={() => { setSelectedDay(day); setSelectedSlot("") }}
                      className="flex-none px-3 py-2 rounded-lg border text-sm transition-colors"
                      style={{
                        background:  selectedDay === day ? "var(--brand)" : "transparent",
                        color:       selectedDay === day ? "#fff" : "var(--text-primary)",
                        borderColor: selectedDay === day ? "var(--brand)" : "var(--border)",
                      }}
                    >
                      <span className="block font-medium">
                        {new Date(day + "T12:00:00").toLocaleDateString("sr-Latn-RS", { weekday: "short" })}
                      </span>
                      <span className="block text-xs">
                        {new Date(day + "T12:00:00").toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedDay && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Slobodni termini</p>
                  {availableSlots.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema slobodnih termina za ovaj dan.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots.map((slot) => (
                        <button
                          key={slot}
                          onClick={() => setSelectedSlot(slot)}
                          className="py-2 rounded-lg border text-sm font-medium transition-colors"
                          style={{
                            background:  selectedSlot === slot ? "var(--brand)" : "transparent",
                            color:       selectedSlot === slot ? "#fff" : "var(--text-primary)",
                            borderColor: selectedSlot === slot ? "var(--brand)" : "var(--border)",
                          }}
                        >
                          {formatSlot(slot)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {errorMsg && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                background: "var(--red-tint, rgba(220,38,38,0.08))",
                color:      "var(--red)",
                border:     "1px solid rgba(220,38,38,0.18)",
                fontWeight: 600,
              }}
            >
              {errorMsg}
            </div>
          )}

          {selectedSlot && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "var(--green-tint, rgba(22,163,74,0.08))", border: "1px solid rgba(22,163,74,0.15)" }}>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Cena usluge</span>
                <span className="text-base" style={{ color: "var(--green)", fontWeight: 700 }}>
                  {selectedService?.price_rsd.toLocaleString("sr-Latn-RS")} RSD
                </span>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={saving}
                className="w-full h-12 text-base"
                style={{ background: "var(--brand)", color: "#fff", border: "none" }}
              >
                {saving ? "Zakazivanje..." : "Potvrdi termin"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center text-sm" style={{ color: "var(--text-muted)" }}>Učitavanje...</div>
    }>
      <BookingPageInner />
    </Suspense>
  )
}
