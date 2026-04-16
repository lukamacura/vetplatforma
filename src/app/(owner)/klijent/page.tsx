"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  PawPrint, CalendarDays, X, History, Syringe, Stethoscope,
  Clock, ChevronRight, Sparkles, AlertTriangle, ChevronDown,
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { PetCard } from "@/components/ui/pet-card"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import type { Pet, Appointment, Species } from "@/lib/types"

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })}`
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short" })
}

function canCancel(scheduledAt: string): boolean {
  return new Date(scheduledAt).getTime() - Date.now() > 2 * 60 * 60 * 1000
}

function greetingForTime(): string {
  const h = new Date().getHours()
  if (h < 6) return "Dobro veče"
  if (h < 12) return "Dobro jutro"
  if (h < 18) return "Dobar dan"
  return "Dobro veče"
}

type DateSeverity = "overdue" | "soon" | "ok" | null

function dateStatus(dateStr: string | null | undefined): DateSeverity {
  if (!dateStr) return null
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "overdue"
  if (days <= 14) return "soon"
  return "ok"
}

function daysUntilText(dateStr: string): string {
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${Math.abs(days)}d kasni`
  if (days === 0) return "Danas"
  if (days === 1) return "Sutra"
  return `Za ${days} dana`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type AppointmentRow = Appointment & { service_name: string; pet_name: string }

type Reminder = {
  petId: string
  petName: string
  petSpecies: Species
  petPhotoUrl: string | null
  type: "vaccine" | "control"
  date: string
  severity: "overdue" | "soon" | "ok"
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function OwnerHomePage() {
  const [pets, setPets] = useState<Pet[]>([])
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [pastAppts, setPastAppts] = useState<AppointmentRow[]>([])
  const [ownerName, setOwnerName] = useState("")
  const [loading, setLoading] = useState(true)
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AppointmentRow | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [lastVisitMap, setLastVisitMap] = useState<Record<string, string>>({})
  const [nextApptMap, setNextApptMap] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).single()
      setOwnerName(profile?.full_name ?? "")

      const { data: petsData } = await supabase
        .from("pets")
        .select("id, owner_id, name, species, breed, birth_date, weight_kg, next_vaccine_date, next_control_date, chip_id, passport_number, gender, color, photo_url, owner_notes, vaccine_note, created_at")
        .eq("owner_id", user.id)
        .order("name")
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
        const petIds = [...new Set(allAppts.map((a) => a.pet_id))]
        const [{ data: services }, { data: petsList }] = await Promise.all([
          supabase.from("services").select("id, name").in("id", serviceIds),
          supabase.from("pets").select("id, name").in("id", petIds),
        ])
        const sMap = Object.fromEntries((services ?? []).map((s: { id: string; name: string }) => [s.id, s.name]))
        const pMap = Object.fromEntries((petsList ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
        const enrich = (a: Appointment) => ({
          ...a,
          service_name: sMap[a.service_id] ?? "—",
          pet_name: pMap[a.pet_id] ?? "—",
        })
        setAppointments((upcomingData ?? []).map(enrich))
        setPastAppts((pastData ?? []).map(enrich))
      } else {
        setAppointments([])
        setPastAppts([])
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

  // Build reminders from pet vaccine/control dates
  const reminders: Reminder[] = pets.flatMap((pet) => {
    const items: Reminder[] = []
    const vs = dateStatus(pet.next_vaccine_date)
    if (vs && pet.next_vaccine_date) {
      items.push({
        petId: pet.id, petName: pet.name, petSpecies: pet.species,
        petPhotoUrl: pet.photo_url,
        type: "vaccine", date: pet.next_vaccine_date, severity: vs,
      })
    }
    const cs = dateStatus(pet.next_control_date)
    if (cs && pet.next_control_date) {
      items.push({
        petId: pet.id, petName: pet.name, petSpecies: pet.species,
        petPhotoUrl: pet.photo_url,
        type: "control", date: pet.next_control_date, severity: cs,
      })
    }
    return items
  })

  const urgentReminders = reminders.filter((r) => r.severity === "overdue" || r.severity === "soon")
  const okReminders = reminders.filter((r) => r.severity === "ok")

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="grid gap-4 grid-cols-2">
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
          <div className="h-40 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5 pb-4"
    >

      {/* ── Greeting header ── */}
      <motion.div variants={stagger.item}>
        <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>
          {greetingForTime()}{ownerName ? `, ${ownerName.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
          Zdravstveni podaci i termini Vaših ljubimaca
        </p>
      </motion.div>

      {/* ── Urgent reminders banner ── */}
      {urgentReminders.length > 0 && (
        <motion.div variants={stagger.item}>
          <div
            className="rounded-2xl p-4"
            style={{
              background: urgentReminders.some((r) => r.severity === "overdue")
                ? "linear-gradient(135deg, var(--red-tint) 0%, #FFF5F5 100%)"
                : "linear-gradient(135deg, var(--amber-tint) 0%, #FFFBEB 100%)",
              border: urgentReminders.some((r) => r.severity === "overdue")
                ? "1px solid rgba(220,38,38,0.18)"
                : "1px solid rgba(217,119,6,0.18)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="icon-sm shrink-0"
                style={{
                  background: urgentReminders.some((r) => r.severity === "overdue")
                    ? "rgba(220,38,38,0.12)" : "rgba(217,119,6,0.12)",
                  color: urgentReminders.some((r) => r.severity === "overdue")
                    ? "var(--red)" : "var(--amber)",
                  borderRadius: 8,
                }}
              >
                <AlertTriangle size={14} strokeWidth={2.25} />
              </div>
              <h2 className="text-sm" style={{ fontWeight: 700 }}>
                {urgentReminders.some((r) => r.severity === "overdue")
                  ? "Potrebna pažnja"
                  : "Uskoro ističe"}
              </h2>
            </div>

            <div className="space-y-2">
              {urgentReminders.map((r) => (
                <div
                  key={`${r.petId}-${r.type}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: "rgba(255,255,255,0.7)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <PetAvatar photoUrl={r.petPhotoUrl} species={r.petSpecies} size={32} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{ fontWeight: 600 }}>
                      {r.petName}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {r.type === "vaccine" ? "Vakcinacija" : "Kontrolni pregled"}
                    </p>
                  </div>
                  <span
                    className={`badge ${r.severity === "overdue" ? "badge-red" : "badge-amber"}`}
                    style={{ gap: 4 }}
                  >
                    {r.severity === "overdue" && <span className="pulse-dot" />}
                    {r.type === "vaccine"
                      ? <Syringe size={10} strokeWidth={2.5} />
                      : <Stethoscope size={10} strokeWidth={2.5} />
                    }
                    {daysUntilText(r.date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Upcoming appointments ── */}
      <motion.div variants={stagger.item} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="icon-sm icon-brand">
              <CalendarDays size={13} strokeWidth={2.25} />
            </div>
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Predstojeći termini</h2>
          </div>
          <Link
            href="/klijent/zakazivanje"
            className="flex items-center gap-1 text-xs"
            style={{ color: "var(--brand)", fontWeight: 600 }}
          >
            Zakaži novi
            <ChevronRight size={14} strokeWidth={2} />
          </Link>
        </div>

        {appointments.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "linear-gradient(135deg, var(--brand-tint) 0%, #F0FDF9 100%)",
              border: "1px solid rgba(43,181,160,0.15)",
            }}
          >
            <div className="icon-lg icon-brand mx-auto mb-3">
              <Sparkles size={22} strokeWidth={1.75} />
            </div>
            <p className="text-sm" style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              Nemate zakazanih termina
            </p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
              Zakažite pregled za Vašeg ljubimca u par koraka
            </p>
            <Link href="/klijent/zakazivanje">
              <button className="btn-primary px-5 py-2.5 text-sm">
                Zakaži termin
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {(showAllUpcoming ? appointments : appointments.slice(0, 3)).map((a) => {
              const d = new Date(a.scheduled_at)
              const isToday = new Date().toDateString() === d.toDateString()
              const isTomorrow = new Date(new Date().getTime() + 86_400_000).toDateString() === d.toDateString()
              const dayLabel = isToday ? "Danas" : isTomorrow ? "Sutra" : formatDateShort(a.scheduled_at)
              const timeStr = d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })

              return (
                <motion.div
                  key={a.id}
                  variants={stagger.row}
                  className="solid-card rounded-2xl p-3.5 flex items-center gap-3"
                  style={isToday ? {
                    background: "var(--brand-tint)",
                    borderColor: "rgba(43,181,160,0.22)",
                  } : undefined}
                >
                  <div className="flex flex-col items-center shrink-0" style={{ minWidth: 44 }}>
                    <span
                      className="text-[10px] uppercase"
                      style={{
                        fontWeight: 700, letterSpacing: "0.06em",
                        color: isToday ? "var(--brand)" : isTomorrow ? "var(--amber)" : "var(--text-muted)",
                      }}
                    >
                      {dayLabel}
                    </span>
                    <span className="text-sm" style={{ fontWeight: 700 }}>
                      {timeStr}
                    </span>
                  </div>

                  <div
                    className="w-px self-stretch shrink-0"
                    style={{ background: isToday ? "rgba(43,181,160,0.25)" : "var(--border)" }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm leading-snug" style={{ fontWeight: 600 }}>
                        {a.service_name}
                      </p>
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
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {a.pet_name} · {formatDateTime(a.scheduled_at)}
                    </p>
                  </div>

                  {canCancel(a.scheduled_at) ? (
                    <button
                      type="button"
                      onClick={() => setCancelTarget(a)}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs"
                      style={{
                        fontWeight: 600,
                        background: "var(--red-tint)",
                        color: "var(--red-text)",
                        border: "1px solid rgba(220,38,38,0.15)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      Otkaži
                    </button>
                  ) : (
                    <div className="icon-sm icon-brand shrink-0">
                      <Clock size={13} strokeWidth={2} />
                    </div>
                  )}
                </motion.div>
              )
            })}
            {!showAllUpcoming && appointments.length > 3 && (
              <button
                type="button"
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
      </motion.div>

      {/* ── Reminders (all clear / ok) ── */}
      {okReminders.length > 0 && urgentReminders.length === 0 && (
        <motion.div variants={stagger.item}>
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, var(--green-tint) 0%, #F0FDF4 100%)",
              border: "1px solid rgba(22,163,74,0.15)",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="icon-sm icon-green shrink-0">
                <Sparkles size={13} strokeWidth={2.25} />
              </div>
              <p className="text-sm" style={{ fontWeight: 700, color: "var(--green-text)" }}>
                Sve je u redu!
              </p>
            </div>
            <p className="text-xs ml-9" style={{ color: "var(--text-muted)" }}>
              Vakcinacije i pregledi su redovni za sve ljubimce.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Pet cards grid ── */}
      <motion.div variants={stagger.item} className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="icon-sm icon-blue">
              <PawPrint size={13} strokeWidth={2.25} />
            </div>
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Vaši ljubimci</h2>
          </div>
          {pets.length > 0 && (
            <Link
              href="/klijent/ljubimci"
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--brand)", fontWeight: 600 }}
            >
              Svi
              <ChevronRight size={14} strokeWidth={2} />
            </Link>
          )}
        </div>

        {pets.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "linear-gradient(135deg, var(--blue-tint) 0%, #EFF6FF 100%)",
              border: "1px solid rgba(37,99,235,0.12)",
            }}
          >
            <div className="icon-lg icon-blue mx-auto mb-3">
              <PawPrint size={22} strokeWidth={1.75} />
            </div>
            <p className="text-sm" style={{ fontWeight: 600 }}>Još nemate dodanih ljubimaca</p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--text-muted)" }}>
              Dodajte ljubimca da pratite vakcinacije i termine
            </p>
            <Link href="/klijent/ljubimci/novi">
              <button className="btn-primary px-5 py-2.5 text-sm">
                Dodaj ljubimca
              </button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1">
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
      </motion.div>

      {/* ── Vaccine schedule overview ── */}
      {okReminders.length > 0 && (
        <motion.div variants={stagger.item}>
          <div className="solid-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="icon-sm icon-amber shrink-0">
                <Syringe size={13} strokeWidth={2.25} />
              </div>
              <h3 className="text-sm" style={{ fontWeight: 700 }}>Raspored vakcinacija</h3>
            </div>
            <div className="space-y-2">
              {reminders
                .filter((r) => r.type === "vaccine")
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((r) => (
                  <div
                    key={`sched-${r.petId}`}
                    className="flex items-center gap-3 py-2 px-1"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <PetAvatar photoUrl={r.petPhotoUrl} species={r.petSpecies} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ fontWeight: 600 }}>{r.petName}</p>
                    </div>
                    <span className={`badge ${r.severity === "overdue" ? "badge-red" : r.severity === "soon" ? "badge-amber" : "badge-green"}`}>
                      {r.severity !== "ok" && <span className="pulse-dot" />}
                      {formatDateShort(r.date)}
                    </span>
                  </div>
                ))}

              {reminders
                .filter((r) => r.type === "control")
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((r) => (
                  <div
                    key={`ctrl-${r.petId}`}
                    className="flex items-center gap-3 py-2 px-1"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <PetAvatar photoUrl={r.petPhotoUrl} species={r.petSpecies} size={28} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ fontWeight: 600 }}>{r.petName}</p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>Kontrolni pregled</p>
                    </div>
                    <span className={`badge ${r.severity === "overdue" ? "badge-red" : r.severity === "soon" ? "badge-amber" : "badge-green"}`}>
                      {r.severity !== "ok" && <span className="pulse-dot" />}
                      <Stethoscope size={10} strokeWidth={2.5} />
                      {formatDateShort(r.date)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </motion.div>
      )}

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

              <div
                className="px-4 py-3 flex gap-2"
                style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
              >
                <Link href={`/klijent/zakazivanje?petId=${selectedPet.id}`} className="flex-1">
                  <button className="btn-primary w-full text-sm py-2.5">
                    Zakaži termin
                  </button>
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
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn-danger px-5 py-2.5 text-sm"
            >
              {cancelling ? "Otkazivanje..." : "Da, otkaži termin"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </motion.div>
  )
}
