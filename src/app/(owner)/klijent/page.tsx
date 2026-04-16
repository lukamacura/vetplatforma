"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PawPrint, CalendarDays, X, History, Stethoscope, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { PetCard } from "@/components/ui/pet-card"
import { createClient } from "@/lib/supabase/client"
import type { Pet, Appointment } from "@/lib/types"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })}`
}

function canCancel(scheduledAt: string): boolean {
  return new Date(scheduledAt).getTime() - Date.now() > 2 * 60 * 60 * 1000
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type AppointmentRow = Appointment & { service_name: string; pet_name: string }

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerHomePage() {
  const [pets,         setPets]         = useState<Pet[]>([])
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [pastAppts,    setPastAppts]    = useState<AppointmentRow[]>([])
  const [ownerName,    setOwnerName]    = useState("")
  const [loading,      setLoading]      = useState(true)
  const [selectedPet,  setSelectedPet]  = useState<Pet | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null)
  const [cancelling,   setCancelling]   = useState(false)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [lastVisitMap,  setLastVisitMap]  = useState<Record<string, string>>({})
  const [nextApptMap,   setNextApptMap]   = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single()
      setOwnerName(profile?.full_name ?? "")

      const { data: petsData } = await supabase
        .from("pets").select("id, owner_id, name, species, breed, birth_date, weight_kg, next_vaccine_date, next_control_date, chip_id, passport_number, gender, color, owner_notes, vaccine_note, created_at").eq("owner_id", user.id).order("name")
      setPets((petsData as Pet[]) ?? [])

      const now = new Date().toISOString()

      const apptCols = "id, clinic_id, pet_id, service_id, owner_id, scheduled_at, status, booked_by, vet_notes, created_at"
      const [{ data: upcomingData }, { data: pastData }] = await Promise.all([
        supabase.from("appointments").select(apptCols)
          .eq("owner_id", user.id)
          .in("status", ["confirmed"])
          .gte("scheduled_at", now)
          .order("scheduled_at"),
        supabase.from("appointments").select(apptCols)
          .eq("owner_id", user.id)
          .lt("scheduled_at", now)
          .order("scheduled_at", { ascending: false })
          .limit(10),
      ])

      const allAppts = [...(upcomingData ?? []), ...(pastData ?? [])]
      if (allAppts.length) {
        const serviceIds = [...new Set(allAppts.map((a) => a.service_id))]
        const petIds     = [...new Set(allAppts.map((a) => a.pet_id))]
        const [{ data: services }, { data: petsList }] = await Promise.all([
          supabase.from("services").select("id, name").in("id", serviceIds),
          supabase.from("pets").select("id, name").in("id", petIds),
        ])
        const sMap = Object.fromEntries((services ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
        const pMap = Object.fromEntries((petsList ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
        const enrich = (a: Appointment) => ({
          ...a,
          service_name: sMap[a.service_id] ?? "—",
          pet_name:     pMap[a.pet_id]     ?? "—",
        })
        setAppointments((upcomingData ?? []).map(enrich))
        setPastAppts((pastData ?? []).map(enrich))
      }

      const lvMap: Record<string, string> = {}
      const naMap: Record<string, string> = {}
      for (const a of (pastData ?? [])) {
        if (a.status === "confirmed" && !lvMap[a.pet_id]) lvMap[a.pet_id] = a.scheduled_at
      }
      for (const a of (upcomingData ?? [])) {
        if (a.status === "confirmed" && !naMap[a.pet_id]) naMap[a.pet_id] = a.scheduled_at
      }
      setLastVisitMap(lvMap)
      setNextApptMap(naMap)

      setLoading(false)
    }
    load()
  }, [])

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("appointments").update({ status: "cancelled" }).eq("id", cancelTarget.id)
    setCancelling(false)
    if (!error) {
      setAppointments((prev) => prev.filter((a) => a.id !== cancelTarget.id))
      setCancelTarget(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-36 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold">
          Dobrodošli{ownerName ? `, ${ownerName.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Zdravstveni podaci Vaših ljubimaca
        </p>
      </div>

      {/* ── Pet cards grid ── */}
      {pets.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <PawPrint className="h-10 w-10 mx-auto" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Još nemate dodanih ljubimaca.</p>
            <Link href="/klijent/ljubimci/novi">
              <Button style={{ background: "var(--brand)", color: "#fff", border: "none" }}>
                Dodaj ljubimca
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              variant="owner"
              onClick={() => setSelectedPet(pet)}
              lastVisitDate={lastVisitMap[pet.id]}
              nextApptDate={nextApptMap[pet.id]}
            />
          ))}
        </div>
      )}

      {/* ── Upcoming appointments ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Predstojeći termini</h2>
          <Link href="/klijent/zakazivanje" className="text-sm font-medium" style={{ color: "var(--brand)" }}>
            Zakaži novi →
          </Link>
        </div>

        {appointments.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center space-y-3">
              <CalendarDays className="h-8 w-8 mx-auto" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nemate zakazanih termina.</p>
              <Link href="/klijent/zakazivanje">
                <Button variant="outline" size="sm">Zakažite odmah</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {(showAllUpcoming ? appointments : appointments.slice(0, 3)).map((a) => (
              <div key={a.id} className="solid-card rounded-xl p-3 flex items-center gap-3">
                <div className="icon-sm icon-brand flex-none">
                  <CalendarDays size={14} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm" style={{ fontWeight: 600 }}>{a.service_name}</p>
                    {a.booked_by === "vet" && (
                      <span
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]"
                        style={{
                          fontWeight: 600,
                          background: "var(--blue-tint)",
                          color: "var(--blue)",
                          border: "1px solid rgba(37,99,235,0.15)",
                        }}
                      >
                        <Stethoscope size={9} strokeWidth={2.5} />
                        Zakazao veterinar
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {a.pet_name} · {formatDateTime(a.scheduled_at)}
                  </p>
                </div>
                {canCancel(a.scheduled_at) && (
                  <button
                    onClick={() => setCancelTarget(a)}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-xs"
                    style={{
                      fontWeight: 600,
                      background: "var(--red-tint)",
                      color:      "var(--red-text)",
                      border:     "1px solid rgba(220,38,38,0.15)",
                    }}
                  >
                    Otkaži
                  </button>
                )}
              </div>
            ))}
            {!showAllUpcoming && appointments.length > 3 && (
              <button
                onClick={() => setShowAllUpcoming(true)}
                className="w-full py-2 text-xs flex items-center justify-center gap-1 rounded-lg"
                style={{
                  fontWeight: 600,
                  color: "var(--brand)",
                  background: "var(--brand-tint)",
                  border: "1px solid rgba(43,181,160,0.15)",
                  transition: "all 0.3s ease",
                }}
              >
                <ChevronDown size={14} strokeWidth={2} />
                Prikaži sve ({appointments.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Past appointment history ── */}
      {pastAppts.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History size={16} strokeWidth={2} style={{ color: "var(--text-muted)" }} />
            <h2 className="font-semibold">Istorija poseta</h2>
          </div>
          <div className="space-y-2">
            {pastAppts.map((a) => {
              const statusCfg =
                a.status === "confirmed"
                  ? { cls: "badge-brand", label: "Završen" }
                  : a.status === "cancelled"
                    ? { cls: "badge-muted", label: "Otkazan" }
                    : { cls: "badge-red", label: "Nije došao" }
              return (
                <div key={a.id} className="solid-card rounded-xl p-3 flex items-center gap-3" style={{ opacity: 0.85 }}>
                  <div className="icon-sm icon-muted flex-none">
                    <CalendarDays size={14} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ fontWeight: 600 }}>{a.service_name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {a.pet_name} · {formatDateTime(a.scheduled_at)}
                    </p>
                  </div>
                  <span className={`badge shrink-0 ${statusCfg.cls}`}>{statusCfg.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Pet detail dialog ── */}
      <Dialog open={!!selectedPet} onOpenChange={(open) => !open && setSelectedPet(null)}>
        <DialogContent className="max-w-sm p-0 overflow-hidden gap-0">
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedPet?.name ?? "Karton ljubimca"}</DialogTitle>
          </DialogHeader>

          {selectedPet && (
            <>
              <PetCard
                pet={selectedPet}
                variant="owner"
                className="rounded-none border-0 shadow-none"
                lastVisitDate={lastVisitMap[selectedPet.id]}
                nextApptDate={nextApptMap[selectedPet.id]}
              />

              {/* Action footer */}
              <div
                className="px-4 py-3 flex gap-2"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
              >
                <Link href={`/klijent/zakazivanje?petId=${selectedPet.id}`} className="flex-1">
                  <Button
                    className="w-full text-white"
                    style={{ background: "var(--brand)", border: "none" }}
                  >
                    Zakaži termin
                  </Button>
                </Link>
                <DialogClose asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <X size={16} strokeWidth={2} />
                  </Button>
                </DialogClose>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Cancel confirmation dialog ── */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Otkazivanje termina</DialogTitle>
          </DialogHeader>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Da li ste sigurni? Otkazivanje je moguće do 2 sata pre termina.
          </p>
          {cancelTarget && (
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
            >
              <p style={{ fontWeight: 600 }}>{cancelTarget.service_name}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {cancelTarget.pet_name} · {formatDateTime(cancelTarget.scheduled_at)}
              </p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Nazad</Button>
            <Button
              onClick={handleCancel}
              disabled={cancelling}
              style={{ background: "var(--red)", color: "#fff", border: "none" }}
            >
              {cancelling ? "Otkazivanje..." : "Da, otkaži termin"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}
