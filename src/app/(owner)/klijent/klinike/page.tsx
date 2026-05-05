"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search, Building2, PawPrint, Check, MapPin, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

type ClinicRow = {
  id: string
  name: string
  description: string | null
  address: string | null
  logo_url: string | null
}

type ConnStatus = "pending" | "confirmed"

export default function KlinikePage() {
  const [clinics, setClinics] = useState<ClinicRow[]>([])
  const [connMap, setConnMap] = useState<Map<string, ConnStatus>>(new Map())
  const [search, setSearch] = useState("")
  const [busyClinicId, setBusyClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [{ data: clinicsData }, { data: connsData }] = await Promise.all([
        supabase.from("clinics").select("id, name, description, address, logo_url").order("name"),
        supabase.from("connections").select("clinic_id, status").eq("owner_id", user.id),
      ])

      setClinics((clinicsData as ClinicRow[]) ?? [])
      const map = new Map<string, ConnStatus>()
      for (const c of (connsData ?? [])) {
        map.set(c.clinic_id, c.status as ConnStatus)
      }
      setConnMap(map)
      setLoading(false)
    }
    load()
  }, [])

  // Realtime: listen for vet approval (UPDATE on own connections)
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`connections-owner-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "connections",
          filter: `owner_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as { clinic_id: string; status: ConnStatus }
          if (row.status === "confirmed") {
            setConnMap((prev) => new Map(prev).set(row.clinic_id, "confirmed"))
          }
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [userId])

  async function handleConnect(e: React.MouseEvent, clinicId: string) {
    e.preventDefault()
    if (!userId) return
    setBusyClinicId(clinicId)
    const supabase = createClient()
    await supabase.from("connections").insert({ owner_id: userId, clinic_id: clinicId, status: "pending" })
    setConnMap((prev) => new Map(prev).set(clinicId, "pending"))
    setBusyClinicId(null)
  }

  async function handleDisconnect(e: React.MouseEvent, clinicId: string) {
    e.preventDefault()
    if (!userId) return
    setBusyClinicId(clinicId)
    const supabase = createClient()
    await supabase.from("connections").delete().eq("owner_id", userId).eq("clinic_id", clinicId)
    setConnMap((prev) => {
      const next = new Map(prev)
      next.delete(clinicId)
      return next
    })
    setBusyClinicId(null)
  }

  const filtered = clinics.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>Klinike</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
          Pronađite svog veterinara i povežite se.
        </p>
      </div>

      <div className="relative">
        <Search
          size={16}
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <Input
          placeholder="Pretraži klinike..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-10 text-center"
          style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
        >
          <Building2 size={32} strokeWidth={1.5} className="mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {clinics.length === 0 ? "Nema registrovanih klinika." : "Nema rezultata pretrage."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((clinic) => {
            const status = connMap.get(clinic.id)
            const busy = busyClinicId === clinic.id
            return (
              <div key={clinic.id} className="relative solid-card rounded-2xl p-4 transition-all">
                <Link
                  href={`/klijent/klinike/${clinic.id}`}
                  className="absolute inset-0 rounded-2xl"
                  aria-label={clinic.name}
                />

                {/* Header row */}
                <div className="flex items-start gap-3">
                  {clinic.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clinic.logo_url}
                      alt={clinic.name}
                      width={44}
                      height={44}
                      className="rounded-full object-cover shrink-0"
                      style={{ width: 44, height: 44, border: "1px solid var(--border)" }}
                    />
                  ) : (
                    <div className="icon-md icon-muted shrink-0" style={{ borderRadius: "50%" }}>
                      <PawPrint size={16} strokeWidth={2} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm" style={{ fontWeight: 700 }}>{clinic.name}</p>
                      {status === "confirmed" && (
                        <span className="inline-flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--green)", fontWeight: 600 }}>
                          <Check size={10} strokeWidth={3} />
                          Povezani
                        </span>
                      )}
                      {status === "pending" && (
                        <span className="inline-flex items-center gap-1 text-[11px] shrink-0" style={{ color: "var(--amber)", fontWeight: 600 }}>
                          <Clock size={10} strokeWidth={2.5} />
                          Čeka odobrenje
                        </span>
                      )}
                    </div>
                    {clinic.address && (
                      <span className="inline-flex items-center gap-1 mt-0.5 text-[11px]" style={{ color: "var(--text-muted)", fontWeight: 500 }}>
                        <MapPin size={10} strokeWidth={2.5} />
                        {clinic.address}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                {clinic.description && (
                  <p className="mt-3 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    {clinic.description}
                  </p>
                )}

                {/* Connect action */}
                <div className="relative z-10 mt-3 pt-3 flex justify-end" style={{ borderTop: "1px solid var(--border)" }}>
                  {status === "confirmed" ? (
                    <button
                      type="button"
                      onClick={(e) => handleDisconnect(e, clinic.id)}
                      disabled={busy}
                      className="rounded-xl px-3 py-1.5 text-xs transition-all"
                      style={{
                        background: "var(--red-tint)",
                        color: "var(--red)",
                        border: "1px solid rgba(220,38,38,0.15)",
                        fontWeight: 600,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? "..." : "Prekini vezu"}
                    </button>
                  ) : status === "pending" ? (
                    <span
                      className="rounded-xl px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
                      style={{
                        background: "var(--amber-tint)",
                        color: "var(--amber)",
                        border: "1px solid rgba(217,119,6,0.2)",
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={11} strokeWidth={2.5} />
                      Čeka odobrenje
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => handleConnect(e, clinic.id)}
                      disabled={busy}
                      className="rounded-xl px-3 py-1.5 text-xs transition-all"
                      style={{
                        background: "var(--brand-tint)",
                        color: "var(--brand)",
                        border: "1px solid rgba(43,181,160,0.25)",
                        fontWeight: 600,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? "..." : "Poveži se"}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
