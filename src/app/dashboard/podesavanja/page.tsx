"use client"

import { useEffect, useState, useCallback, useTransition } from "react"
import { Settings, Copy, Check, Clock, CreditCard, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { createCheckoutSession } from "@/app/dashboard/upgrade/actions"
import type { ClinicHours } from "@/lib/types"

const WEEKDAYS = [
  { index: 1, label: "Ponedeljak" },
  { index: 2, label: "Utorak"     },
  { index: 3, label: "Sreda"      },
  { index: 4, label: "Četvrtak"   },
  { index: 5, label: "Petak"      },
  { index: 6, label: "Subota"     },
  { index: 0, label: "Nedelja"    },
]

type HoursRow = {
  weekday:   number
  is_closed: boolean
  open_time:  string
  close_time: string
}

const DEFAULT_HOURS: HoursRow[] = WEEKDAYS.map(({ index }) => ({
  weekday:    index,
  is_closed:  index === 0 || index === 6,
  open_time:  index === 6 ? "09:00" : "09:00",
  close_time: index === 6 ? "13:00" : "17:00",
}))

export default function PodesavanjaPage() {
  const [clinicId,            setClinicId]            = useState<string | null>(null)
  const [clinicSlug,          setClinicSlug]          = useState("")
  const [clinicName,          setClinicName]          = useState("")
  const [phone,               setPhone]               = useState("")
  const [hours,               setHours]               = useState<HoursRow[]>(DEFAULT_HOURS)
  const [subscriptionStatus,  setSubscriptionStatus]  = useState<string>("trial")
  const [planExpiry,          setPlanExpiry]          = useState<string | null>(null)

  const [savingClinic, setSavingClinic] = useState(false)
  const [savingPhone,  setSavingPhone]  = useState(false)
  const [savingHours,  setSavingHours]  = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [isPending,    startTransition]  = useTransition()

  const [clinicMsg, setClinicMsg] = useState<string | null>(null)
  const [phoneMsg,  setPhoneMsg]  = useState<string | null>(null)
  const [hoursMsg,  setHoursMsg]  = useState<string | null>(null)

  const inviteUrl =
    typeof window !== "undefined" && clinicSlug
      ? `${window.location.origin}/join/${clinicSlug}`
      : ""

  const handleCopy = useCallback(() => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [inviteUrl])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from("profiles").select("clinic_id, phone").eq("id", user.id).single()

      function applyClinic(c: { name: string; slug: string; subscription_status: string | null; trial_started_at: string | null; subscription_current_period_end: string | null }) {
        setClinicName(c.name)
        setClinicSlug(c.slug)
        const status = c.subscription_status ?? "trial"
        setSubscriptionStatus(status)
        if (status === "active" && c.subscription_current_period_end) {
          setPlanExpiry(new Date(c.subscription_current_period_end).toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "long", year: "numeric" }))
        } else if (c.trial_started_at) {
          const exp = new Date(c.trial_started_at)
          exp.setDate(exp.getDate() + 30)
          setPlanExpiry(exp.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "long", year: "numeric" }))
        }
      }

      let cid = profile?.clinic_id
      if (!cid) {
        const { data: owned } = await supabase.from("clinics").select("id, name, slug, subscription_status, trial_started_at, subscription_current_period_end").eq("owner_id", user.id).single()
        cid = owned?.id ?? null
        if (owned) applyClinic(owned)
      } else {
        const { data: clinic } = await supabase.from("clinics").select("name, slug, subscription_status, trial_started_at, subscription_current_period_end").eq("id", cid).single()
        if (clinic) applyClinic(clinic)
      }
      setPhone(profile?.phone ?? "")
      setClinicId(cid ?? null)

      if (cid) {
        const { data: hoursData } = await supabase
          .from("clinic_hours").select("*").eq("clinic_id", cid)

        if (hoursData && hoursData.length > 0) {
          const map = Object.fromEntries((hoursData as ClinicHours[]).map((h) => [h.weekday, h]))
          setHours(
            WEEKDAYS.map(({ index }) => ({
              weekday:    index,
              is_closed:  map[index]?.is_closed  ?? (index === 0 || index === 6),
              open_time:  map[index]?.open_time  ?? (index === 6 ? "09:00" : "09:00"),
              close_time: map[index]?.close_time ?? (index === 6 ? "13:00" : "17:00"),
            }))
          )
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveClinic(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicId || !clinicName.trim()) return
    setSavingClinic(true)
    const supabase = createClient()
    const { error } = await supabase.from("clinics").update({ name: clinicName.trim() }).eq("id", clinicId)
    setSavingClinic(false)
    setClinicMsg(error ? "Greška pri čuvanju." : "Sačuvano!")
    setTimeout(() => setClinicMsg(null), 2500)
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault()
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSavingPhone(true)
    const { error } = await supabase.from("profiles").update({ phone: phone.trim() || null }).eq("id", user.id)
    setSavingPhone(false)
    setPhoneMsg(error ? "Greška pri čuvanju." : "Sačuvano!")
    setTimeout(() => setPhoneMsg(null), 2500)
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault()
    if (!clinicId) return
    setSavingHours(true)
    const supabase = createClient()
    const rows = hours.map((h) => ({
      clinic_id:  clinicId,
      weekday:    h.weekday,
      is_closed:  h.is_closed,
      open_time:  h.is_closed ? null : h.open_time,
      close_time: h.is_closed ? null : h.close_time,
    }))
    const { error } = await supabase
      .from("clinic_hours")
      .upsert(rows, { onConflict: "clinic_id,weekday" })
    setSavingHours(false)
    setHoursMsg(error ? "Greška pri čuvanju." : "Radni sati sačuvani!")
    setTimeout(() => setHoursMsg(null), 2500)
  }

  function updateHoursRow(weekday: number, patch: Partial<HoursRow>) {
    setHours((prev) => prev.map((r) => r.weekday === weekday ? { ...r, ...patch } : r))
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

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="icon-md icon-muted">
            <Settings size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl">Podešavanja</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Podaci klinike i radni sati
            </p>
          </div>
        </div>
      </motion.div>

      {/* Section 1 — Clinic name */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.24 }} className="solid-card rounded-2xl p-6">
        <h2 className="text-sm mb-4" style={{ fontWeight: 700 }}>Naziv klinike</h2>
        <form onSubmit={handleSaveClinic} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="clinic-name">Naziv</Label>
            <Input
              id="clinic-name"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              placeholder="npr. Veterinarska ordinacija Đorđić"
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingClinic || !clinicName.trim()}
              className="rounded-xl px-5 py-2 text-sm text-white"
              style={{ background: "var(--brand)", fontWeight: 600, opacity: savingClinic ? 0.7 : 1 }}
            >
              {savingClinic ? "Čuvanje..." : "Sačuvaj naziv"}
            </button>
            {clinicMsg && (
              <span className="text-sm" style={{ color: clinicMsg === "Sačuvano!" ? "var(--green)" : "var(--red)" }}>
                {clinicMsg}
              </span>
            )}
          </div>
        </form>
      </motion.div>

      {/* Section 2 — Invite link */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.24 }} className="solid-card rounded-2xl p-6">
        <h2 className="text-sm mb-1" style={{ fontWeight: 700 }}>Link za poziv vlasnika</h2>
        <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
          Pošaljite ovaj link vlasniku ljubimca da se poveže sa vašom klinikom.
        </p>
        <div className="flex items-center gap-2">
          <div
            className="flex-1 rounded-xl px-3 py-2.5 text-sm truncate"
            style={{
              background: "var(--surface-raised)",
              border:     "1px solid var(--border)",
              color:      "var(--text-secondary)",
              fontFamily: "monospace",
            }}
          >
            {inviteUrl || "—"}
          </div>
          <button
            onClick={handleCopy}
            disabled={!inviteUrl}
            className="icon-md shrink-0 transition-all"
            style={{
              background: copied ? "var(--green-tint)" : "var(--brand-tint)",
              color:      copied ? "var(--green)" : "var(--brand)",
              border:     `1px solid ${copied ? "rgba(22,163,74,0.2)" : "rgba(43,181,160,0.25)"}`,
            }}
          >
            {copied ? <Check size={16} strokeWidth={2.5} /> : <Copy size={15} strokeWidth={2} />}
          </button>
        </div>
        {copied && (
          <p className="text-xs mt-2" style={{ color: "var(--green)" }}>Link kopiran!</p>
        )}
      </motion.div>

      {/* Section 3 — Phone */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.24 }} className="solid-card rounded-2xl p-6">
        <h2 className="text-sm mb-4" style={{ fontWeight: 700 }}>Telefon</h2>
        <form onSubmit={handleSavePhone} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Broj telefona</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="npr. +381 60 123 4567"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingPhone}
              className="rounded-xl px-5 py-2 text-sm text-white"
              style={{ background: "var(--brand)", fontWeight: 600, opacity: savingPhone ? 0.7 : 1 }}
            >
              {savingPhone ? "Čuvanje..." : "Sačuvaj telefon"}
            </button>
            {phoneMsg && (
              <span className="text-sm" style={{ color: phoneMsg === "Sačuvano!" ? "var(--green)" : "var(--red)" }}>
                {phoneMsg}
              </span>
            )}
          </div>
        </form>
      </motion.div>

      {/* Section 4 — Subscription / Plan */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.24 }} className="solid-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={`icon-sm ${subscriptionStatus === "active" ? "icon-green" : subscriptionStatus === "expired" ? "icon-muted" : "icon-amber"}`}>
            <CreditCard size={14} strokeWidth={2} />
          </div>
          <h2 className="text-sm" style={{ fontWeight: 700 }}>Plan i pretplata</h2>
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            {subscriptionStatus === "active" ? (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} strokeWidth={2} style={{ color: "var(--green)" }} />
                  <span className="text-sm" style={{ fontWeight: 600, color: "var(--green)" }}>Pretplata aktivna</span>
                </div>
                {planExpiry && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Sledeće plaćanje: {planExpiry}</p>
                )}
              </>
            ) : subscriptionStatus === "expired" || subscriptionStatus === "cancelled" ? (
              <>
                <span className="text-sm" style={{ fontWeight: 600, color: "var(--red)" }}>Pretplata istekla</span>
                {planExpiry && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Isteklo: {planExpiry}</p>
                )}
              </>
            ) : (
              <>
                <span className="text-sm" style={{ fontWeight: 600, color: "var(--amber)" }}>Probni period</span>
                {planExpiry && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Ističe: {planExpiry}</p>
                )}
              </>
            )}
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>VetPlatforma Pro · €49/mesec</p>
          </div>

          {subscriptionStatus !== "active" && (
            <form action={() => startTransition(() => createCheckoutSession())}>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl px-5 py-2 text-sm text-white shrink-0 transition-opacity"
                style={{ background: "var(--brand)", fontWeight: 600, opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? "Preusmeravanje..." : "Aktiviraj pretplatu"}
              </button>
            </form>
          )}
        </div>
      </motion.div>

      {/* Section 5 — Working hours */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22, duration: 0.24 }} className="solid-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="icon-sm icon-blue">
            <Clock size={14} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Radni sati</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Prikazuju se vlasnicima pri zakazivanju</p>
          </div>
        </div>
        <form onSubmit={handleSaveHours} className="space-y-3">
          {WEEKDAYS.map(({ index, label }) => {
            const row = hours.find((h) => h.weekday === index)!
            return (
              <div key={index} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--border)" }}>
                {/* Weekday label */}
                <span className="w-[108px] text-sm shrink-0" style={{ fontWeight: 500 }}>{label}</span>

                {/* Open/Closed toggle */}
                <button
                  type="button"
                  onClick={() => updateHoursRow(index, { is_closed: !row.is_closed })}
                  className="rounded-lg px-3 py-1.5 text-xs shrink-0 transition-all"
                  style={{
                    background:  row.is_closed ? "var(--surface-raised)" : "var(--brand-tint)",
                    color:       row.is_closed ? "var(--text-muted)" : "var(--brand)",
                    border:      `1px solid ${row.is_closed ? "var(--border)" : "rgba(43,181,160,0.25)"}`,
                    fontWeight:  600,
                    minWidth:    72,
                  }}
                >
                  {row.is_closed ? "Zatvoreno" : "Otvoreno"}
                </button>

                {/* Time inputs */}
                {!row.is_closed && (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={row.open_time}
                      onChange={(e) => updateHoursRow(index, { open_time: e.target.value })}
                      className="rounded-lg px-2 py-1.5 text-sm"
                      style={{
                        background:  "var(--surface-raised)",
                        border:      "1px solid var(--border)",
                        color:       "var(--text-primary)",
                        minWidth:    88,
                      }}
                    />
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>–</span>
                    <input
                      type="time"
                      value={row.close_time}
                      onChange={(e) => updateHoursRow(index, { close_time: e.target.value })}
                      className="rounded-lg px-2 py-1.5 text-sm"
                      style={{
                        background:  "var(--surface-raised)",
                        border:      "1px solid var(--border)",
                        color:       "var(--text-primary)",
                        minWidth:    88,
                      }}
                    />
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={savingHours}
              className="rounded-xl px-5 py-2 text-sm text-white"
              style={{ background: "var(--brand)", fontWeight: 600, opacity: savingHours ? 0.7 : 1 }}
            >
              {savingHours ? "Čuvanje..." : "Sačuvaj radne sate"}
            </button>
            {hoursMsg && (
              <span className="text-sm" style={{ color: hoursMsg.includes("Greška") ? "var(--red)" : "var(--green)" }}>
                {hoursMsg}
              </span>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  )
}
