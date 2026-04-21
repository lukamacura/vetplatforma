"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, MapPin, PawPrint, Clock } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import type { Service, ClinicHours } from "@/lib/types"

type ClinicDetail = {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  address: string | null
}

export default function KlinikaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [clinic, setClinic] = useState<ClinicDetail | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [hours, setHours] = useState<ClinicHours[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [{ data: clinicData }, { data: conn }, { data: servicesData }, { data: hoursData }] = await Promise.all([
        supabase.from("clinics").select("id, name, description, logo_url, address").eq("id", id).single(),
        supabase.from("connections").select("id").eq("owner_id", user.id).eq("clinic_id", id).maybeSingle(),
        supabase.from("services").select("*").eq("clinic_id", id).eq("is_active", true).order("name"),
        supabase.from("clinic_hours").select("*").eq("clinic_id", id).order("weekday"),
      ])

      if (clinicData) setClinic(clinicData as ClinicDetail)
      setIsConnected(!!conn)
      setServices((servicesData as Service[]) ?? [])
      setHours((hoursData as ClinicHours[]) ?? [])
      setLoading(false)
    }
    load()
  }, [id])

  async function handleConnect() {
    if (!userId) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from("connections").upsert(
      { owner_id: userId, clinic_id: id },
      { onConflict: "owner_id,clinic_id" },
    )
    setIsConnected(true)
    setBusy(false)
  }

  async function handleDisconnect() {
    if (!userId) return
    setBusy(true)
    const supabase = createClient()
    await supabase.from("connections").delete().eq("owner_id", userId).eq("clinic_id", id)
    setIsConnected(false)
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }

  if (!clinic) {
    return (
      <div className="text-center py-20">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Klinika nije pronađena.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm"
          style={{ color: "var(--brand)", fontWeight: 600 }}
        >
          Nazad
        </button>
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5 pb-6"
    >
      {/* Back */}
      <motion.button
        variants={stagger.item}
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm transition-all"
        style={{ color: "var(--text-muted)", fontWeight: 600 }}
      >
        <ArrowLeft size={15} strokeWidth={2.5} />
        Nazad
      </motion.button>

      {/* Header card */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5">
        <div className="flex items-start gap-4">
          {clinic.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clinic.logo_url}
              alt={clinic.name}
              width={72}
              height={72}
              className="rounded-full object-cover shrink-0"
              style={{ width: 72, height: 72, border: "2px solid var(--border)" }}
            />
          ) : (
            <div
              className="icon-lg icon-brand shrink-0"
              style={{ width: 72, height: 72, borderRadius: "50%" }}
            >
              <PawPrint size={28} strokeWidth={1.75} />
            </div>
          )}

          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="text-xl" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
              {clinic.name}
            </h1>
            {clinic.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(clinic.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-1.5 text-xs"
                style={{ color: "var(--brand)", fontWeight: 600 }}
              >
                <MapPin size={12} strokeWidth={2.5} />
                {clinic.address}
              </a>
            )}
          </div>
        </div>

        {clinic.description && (
          <p className="mt-4 text-sm" style={{ color: "var(--text-secondary)", lineHeight: 1.65 }}>
            {clinic.description}
          </p>
        )}

        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          {isConnected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="text-sm transition-all"
              style={{ color: "var(--red)", fontWeight: 600, opacity: busy ? 0.6 : 1, background: "rgba(220,38,38,0.08)", borderRadius: 10, padding: "6px 14px" }}
            >
              {busy ? "..." : "Prekini vezu"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy}
              className="text-sm transition-all"
              style={{ color: "var(--green)", fontWeight: 600, opacity: busy ? 0.6 : 1, background: "rgba(22,163,74,0.08)", borderRadius: 10, padding: "6px 14px" }}
            >
              {busy ? "Povezivanje..." : "Poveži se sa klinikom"}
            </button>
          )}
        </div>
      </motion.div>

      {/* Services */}
      <motion.div variants={stagger.item} className="space-y-3">
        <h2 className="text-sm px-1" style={{ fontWeight: 700 }}>Usluge</h2>

        {services.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Klinika još nije dodala usluge.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {services.map((s) => (
              <motion.div
                key={s.id}
                variants={stagger.row}
                className="solid-card rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm" style={{ fontWeight: 700 }}>{s.name}</p>
                    {s.description && (
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)", lineHeight: 1.55 }}>
                        {s.description}
                      </p>
                    )}
                    <span
                      className="inline-flex items-center gap-1 mt-2 text-[11px]"
                      style={{ color: "var(--text-muted)", fontWeight: 500 }}
                    >
                      <Clock size={11} strokeWidth={2.5} />
                      {s.duration_minutes} min
                    </span>
                  </div>
                  <p className="text-sm shrink-0" style={{ fontWeight: 700, color: "var(--brand)" }}>
                    {s.price_rsd.toLocaleString("sr-Latn-RS")} RSD
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Working hours */}
      <motion.div variants={stagger.item} className="space-y-3">
        <h2 className="text-sm px-1" style={{ fontWeight: 700 }}>Radno vreme</h2>
        {hours.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center"
            style={{ background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Klinika još nije podesila radno vreme.
            </p>
          </div>
        ) : (
          <div className="solid-card rounded-2xl divide-y divide-(--border)">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const entry = hours.find((h) => h.weekday === day)
              const labels = ["Ned", "Pon", "Uto", "Sre", "Čet", "Pet", "Sub"]
              const today = new Date().getDay()
              const isToday = today === day
              return (
                <div
                  key={day}
                  className="flex items-center justify-between px-4 py-3"
                  style={isToday ? { background: "var(--brand-tint)" } : undefined}
                >
                  <span
                    className="text-sm w-8"
                    style={{ fontWeight: isToday ? 700 : 500, color: isToday ? "var(--brand)" : "var(--text-primary)" }}
                  >
                    {labels[day]}
                  </span>
                  {!entry || entry.is_closed ? (
                    <span className="text-xs" style={{ color: "var(--text-muted)", fontWeight: 500 }}>Zatvoreno</span>
                  ) : (
                    <span className="text-sm" style={{ fontWeight: isToday ? 700 : 500, color: isToday ? "var(--brand)" : "var(--text-secondary)" }}>
                      <Clock size={11} strokeWidth={2.5} className="inline mr-1" style={{ verticalAlign: "middle" }} />
                      {entry.open_time?.slice(0, 5)} – {entry.close_time?.slice(0, 5)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
