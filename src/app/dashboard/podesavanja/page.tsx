"use client"

import { useEffect, useRef, useState, useCallback, useTransition } from "react"
import { Settings, Copy, Check, Clock, CreditCard, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { createCheckoutSession, createBillingPortalSession } from "@/app/dashboard/upgrade/actions"
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

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
  return (
    <div className="flex items-center gap-1 text-[11px]" style={{ minHeight: 16 }}>
      {status === "saving" && (
        <>
          <Loader2 size={11} strokeWidth={2.25} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Čuvanje…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check size={12} strokeWidth={2.5} style={{ color: "var(--green)" }} />
          <span style={{ color: "var(--green)", fontWeight: 600 }}>Sačuvano</span>
        </>
      )}
    </div>
  )
}

export default function PodesavanjaPage() {
  const [clinicId,            setClinicId]            = useState<string | null>(null)
  const [clinicSlug,          setClinicSlug]          = useState("")
  const [clinicName,          setClinicName]          = useState("")
  const [phone,               setPhone]               = useState("")
  const [hours,               setHours]               = useState<HoursRow[]>(DEFAULT_HOURS)
  const [subscriptionStatus,  setSubscriptionStatus]  = useState<string>("trial")
  const [planExpiry,          setPlanExpiry]          = useState<string | null>(null)
  const [hasCardOnFile,       setHasCardOnFile]       = useState(false)
  const [cancelAtPeriodEnd,   setCancelAtPeriodEnd]   = useState(false)

  type SaveStatus = "idle" | "saving" | "saved"
  const [clinicStatus, setClinicStatus] = useState<SaveStatus>("idle")
  const [phoneStatus,  setPhoneStatus]  = useState<SaveStatus>("idle")
  const [savingHours,  setSavingHours]  = useState(false)
  const [copied,       setCopied]       = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [isPending,    startTransition]  = useTransition()

  const [hoursMsg,  setHoursMsg]  = useState<string | null>(null)

  // Debounce + "Sačuvano" auto-hide timers for inline auto-save
  const clinicDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clinicSavedRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phoneDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phoneSavedRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Don't save while initial data is still loading into the inputs
  const loadedRef = useRef(false)

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

      function applyClinic(c: { name: string; slug: string; subscription_status: string | null; trial_started_at: string | null; subscription_current_period_end: string | null; stripe_customer_id: string | null; subscription_cancel_at_period_end: boolean | null }) {
        setClinicName(c.name)
        setClinicSlug(c.slug)
        let status = c.subscription_status ?? "trial"
        // Treat trial past 30 days as expired even before middleware persists it.
        if (status === "trial" && c.trial_started_at) {
          const exp = new Date(c.trial_started_at)
          exp.setDate(exp.getDate() + 30)
          if (exp.getTime() < Date.now()) status = "expired"
        }
        setSubscriptionStatus(status)
        setCancelAtPeriodEnd(!!c.subscription_cancel_at_period_end)

        // Card on file = Stripe subscription exists (webhook set period_end).
        // Distinguishes "trial, no card" from "trial, card entered via Checkout".
        const cardOnFile = !!c.stripe_customer_id && !!c.subscription_current_period_end
        setHasCardOnFile(cardOnFile)

        if (cardOnFile && c.subscription_current_period_end) {
          setPlanExpiry(new Date(c.subscription_current_period_end).toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "long", year: "numeric" }))
        } else if (c.trial_started_at) {
          const exp = new Date(c.trial_started_at)
          exp.setDate(exp.getDate() + 30)
          setPlanExpiry(exp.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "long", year: "numeric" }))
        }
      }

      let cid = profile?.clinic_id
      if (!cid) {
        const { data: owned } = await supabase.from("clinics").select("id, name, slug, subscription_status, trial_started_at, subscription_current_period_end, stripe_customer_id, subscription_cancel_at_period_end").eq("owner_id", user.id).single()
        cid = owned?.id ?? null
        if (owned) applyClinic(owned)
      } else {
        const { data: clinic } = await supabase.from("clinics").select("name, slug, subscription_status, trial_started_at, subscription_current_period_end, stripe_customer_id, subscription_cancel_at_period_end").eq("id", cid).single()
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
      loadedRef.current = true
    }
    load()
  }, [])

  // Flush timers on unmount
  useEffect(() => {
    return () => {
      if (clinicDebounceRef.current) clearTimeout(clinicDebounceRef.current)
      if (clinicSavedRef.current)    clearTimeout(clinicSavedRef.current)
      if (phoneDebounceRef.current)  clearTimeout(phoneDebounceRef.current)
      if (phoneSavedRef.current)     clearTimeout(phoneSavedRef.current)
    }
  }, [])

  const saveClinicName = useCallback(async (value: string) => {
    if (!clinicId) return
    const trimmed = value.trim()
    if (!trimmed) { setClinicStatus("idle"); return }
    const supabase = createClient()
    const { error } = await supabase.from("clinics").update({ name: trimmed }).eq("id", clinicId)
    if (error) { setClinicStatus("idle"); return }
    setClinicStatus("saved")
    if (clinicSavedRef.current) clearTimeout(clinicSavedRef.current)
    clinicSavedRef.current = setTimeout(() => setClinicStatus("idle"), 1800)
  }, [clinicId])

  const savePhone = useCallback(async (value: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPhoneStatus("idle"); return }
    const { error } = await supabase
      .from("profiles")
      .update({ phone: value.trim() || null })
      .eq("id", user.id)
    if (error) { setPhoneStatus("idle"); return }
    setPhoneStatus("saved")
    if (phoneSavedRef.current) clearTimeout(phoneSavedRef.current)
    phoneSavedRef.current = setTimeout(() => setPhoneStatus("idle"), 1800)
  }, [])

  const handleClinicNameChange = useCallback((value: string) => {
    setClinicName(value)
    if (!loadedRef.current) return
    setClinicStatus("saving")
    if (clinicDebounceRef.current) clearTimeout(clinicDebounceRef.current)
    clinicDebounceRef.current = setTimeout(() => { saveClinicName(value) }, 600)
  }, [saveClinicName])

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(value)
    if (!loadedRef.current) return
    setPhoneStatus("saving")
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current)
    phoneDebounceRef.current = setTimeout(() => { savePhone(value) }, 600)
  }, [savePhone])

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

  const isActive = subscriptionStatus === "active"
  const hasCard  = hasCardOnFile
  const isExpired = subscriptionStatus === "expired" || subscriptionStatus === "cancelled"
  // Cancellation scheduled in Stripe but period hasn't ended yet — vet still has access.
  const isPendingCancel = cancelAtPeriodEnd && !isExpired

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header ── */}
      <motion.div variants={stagger.item} className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="icon-lg icon-muted">
            <Settings size={22} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl">Podešavanja</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
              Upravljajte podacima klinike, pretplatom i radnim satima
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Subscription banner — full width ── */}
      <motion.div variants={stagger.item}
        className="rounded-2xl p-6"
        style={{
          background: isPendingCancel
            ? "linear-gradient(135deg, rgba(217,119,6,0.10) 0%, rgba(217,119,6,0.02) 100%)"
            : isActive || hasCard
              ? "linear-gradient(135deg, rgba(22,163,74,0.08) 0%, rgba(22,163,74,0.02) 100%)"
              : isExpired
                ? "linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.02) 100%)"
                : "linear-gradient(135deg, rgba(43,181,160,0.10) 0%, rgba(43,181,160,0.02) 100%)",
          border: `1px solid ${
            isPendingCancel ? "rgba(217,119,6,0.22)"
              : isActive || hasCard ? "rgba(22,163,74,0.18)"
              : isExpired ? "rgba(220,38,38,0.18)"
              : "rgba(43,181,160,0.22)"
          }`,
        }}
      >
        <div className="flex items-center justify-between gap-6 flex-wrap">
          <div className="flex items-start gap-4">
            {isPendingCancel ? (
              <div
                className="icon-lg shrink-0"
                style={{ background: "rgba(217,119,6,0.12)", color: "rgb(217,119,6)" }}
              >
                <AlertTriangle size={22} strokeWidth={1.75} />
              </div>
            ) : (
              <div className={`icon-lg shrink-0 ${isActive || hasCard ? "icon-green" : isExpired ? "icon-red" : "icon-brand"}`}>
                <CreditCard size={22} strokeWidth={1.75} />
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)", fontWeight: 700 }}>
                VetPlatforma Pro · €49/mesec
              </p>
              {isPendingCancel ? (
                <>
                  <span className="text-lg" style={{ fontWeight: 700, color: "rgb(217,119,6)" }}>Pretplata prekinuta</span>
                  {planExpiry && (
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Imate pristup do {planExpiry}.</p>
                  )}
                </>
              ) : subscriptionStatus === "active" ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} strokeWidth={2.5} style={{ color: "var(--green)" }} />
                    <span className="text-lg" style={{ fontWeight: 700, color: "var(--green)" }}>Pretplata aktivna</span>
                  </div>
                  {planExpiry && (
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Sledeće plaćanje: {planExpiry}</p>
                  )}
                </>
              ) : isExpired ? (
                <>
                  <span className="text-lg" style={{ fontWeight: 700, color: "var(--red)" }}>Pretplata istekla</span>
                  {planExpiry && (
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Isteklo: {planExpiry}</p>
                  )}
                </>
              ) : hasCard ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={15} strokeWidth={2.5} style={{ color: "var(--green)" }} />
                    <span className="text-lg" style={{ fontWeight: 700, color: "var(--green)" }}>Probni period · Kartica potvrđena</span>
                  </div>
                  {planExpiry && (
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Prvo plaćanje: {planExpiry}</p>
                  )}
                </>
              ) : (
                <>
                  <span className="text-lg" style={{ fontWeight: 700, color: "var(--brand)" }}>Probni period</span>
                  {planExpiry && (
                    <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Ističe: {planExpiry}</p>
                  )}
                </>
              )}
            </div>
          </div>

          {hasCard || subscriptionStatus === "active" ? (
            <form action={() => startTransition(() => createBillingPortalSession())}>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-xl px-6 py-3 text-sm shrink-0 transition-all"
                style={{
                  background: "var(--surface-raised)",
                  color:      "var(--text-primary)",
                  border:     "1px solid var(--border)",
                  fontWeight: 600,
                  opacity:    isPending ? 0.7 : 1,
                }}
              >
                {isPending ? "Preusmeravanje..." : "Podesi pretplatu"}
              </button>
            </form>
          ) : (
            <form action={() => startTransition(() => createCheckoutSession())}>
              <button
                type="submit"
                disabled={isPending}
                className="btn-primary shrink-0"
                style={{ opacity: isPending ? 0.7 : 1 }}
              >
                {isPending ? "Preusmeravanje..." : "Aktiviraj pretplatu"}
              </button>
            </form>
          )}
        </div>
      </motion.div>

      {/* ── Two-column grid: Clinic Name + Phone ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clinic name */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Naziv klinike</h2>
            <SaveIndicator status={clinicStatus} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clinic-name">Naziv</Label>
            <Input
              id="clinic-name"
              value={clinicName}
              onChange={(e) => handleClinicNameChange(e.target.value)}
              onBlur={() => {
                if (!loadedRef.current || !clinicId || !clinicName.trim()) return
                if (clinicDebounceRef.current) clearTimeout(clinicDebounceRef.current)
                saveClinicName(clinicName)
              }}
              placeholder="npr. Veterinarska ordinacija Đorđić"
            />
          </div>
        </motion.div>

        {/* Phone */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Telefon</h2>
            <SaveIndicator status={phoneStatus} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Broj telefona</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={() => {
                if (!loadedRef.current) return
                if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current)
                savePhone(phone)
              }}
              placeholder="npr. +381 60 123 4567"
            />
          </div>
        </motion.div>
      </div>

      {/* ── Invite link — full width ── */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm mb-1" style={{ fontWeight: 700 }}>Link za poziv vlasnika</h2>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
              Pošaljite ovaj link vlasniku ljubimca da se poveže sa vašom klinikom.
            </p>
            <div className="flex items-center gap-2">
              <div
                className="flex-1 rounded-xl px-4 py-3 text-sm truncate"
                style={{
                  background: "var(--surface-raised)",
                  border:     "1px solid var(--border)",
                  color:      "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
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
          </div>
        </div>
      </motion.div>

      {/* ── Working hours — full width, grid layout ── */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-md icon-blue">
            <Clock size={16} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Radni sati</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Prikazuju se vlasnicima pri zakazivanju</p>
          </div>
        </div>

        <form onSubmit={handleSaveHours}>
          <div
            className="rounded-xl overflow-hidden mb-5"
            style={{ border: "1px solid var(--border)" }}
          >
            {/* Table header */}
            <div
              className="grid items-center px-5 py-3 text-xs uppercase tracking-wider"
              style={{
                gridTemplateColumns: "1fr 120px 1fr",
                background: "var(--surface-raised)",
                color: "var(--text-muted)",
                fontWeight: 700,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span>Dan</span>
              <span className="text-center">Status</span>
              <span>Radno vreme</span>
            </div>

            {WEEKDAYS.map(({ index, label }, i) => {
              const row = hours.find((h) => h.weekday === index)!
              const isLast = i === WEEKDAYS.length - 1
              return (
                <div
                  key={index}
                  className="grid items-center px-5 py-3 transition-colors"
                  style={{
                    gridTemplateColumns: "1fr 120px 1fr",
                    borderBottom: isLast ? "none" : "1px solid var(--border)",
                    background: row.is_closed ? "var(--surface-raised)" : "var(--surface)",
                    opacity: row.is_closed ? 0.7 : 1,
                  }}
                >
                  <span className="text-sm" style={{ fontWeight: 600 }}>{label}</span>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => updateHoursRow(index, { is_closed: !row.is_closed })}
                      className="rounded-lg px-3 py-1.5 text-xs transition-all"
                      style={{
                        background:  row.is_closed ? "var(--surface)" : "var(--brand-tint)",
                        color:       row.is_closed ? "var(--text-muted)" : "var(--brand)",
                        border:      `1px solid ${row.is_closed ? "var(--border)" : "rgba(43,181,160,0.25)"}`,
                        fontWeight:  600,
                        minWidth:    96,
                      }}
                    >
                      {row.is_closed ? "Zatvoreno" : "Otvoreno"}
                    </button>
                  </div>

                  {!row.is_closed ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={row.open_time}
                        onChange={(e) => updateHoursRow(index, { open_time: e.target.value })}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{
                          background:  "var(--surface-raised)",
                          border:      "1px solid var(--border)",
                          color:       "var(--text-primary)",
                          minWidth:    100,
                        }}
                      />
                      <span className="text-sm" style={{ color: "var(--text-muted)", fontWeight: 500 }}>do</span>
                      <input
                        type="time"
                        value={row.close_time}
                        onChange={(e) => updateHoursRow(index, { close_time: e.target.value })}
                        className="rounded-lg px-3 py-2 text-sm"
                        style={{
                          background:  "var(--surface-raised)",
                          border:      "1px solid var(--border)",
                          color:       "var(--text-primary)",
                          minWidth:    100,
                        }}
                      />
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={savingHours}
              className="btn-primary"
              style={{ opacity: savingHours ? 0.6 : 1 }}
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
    </motion.div>
  )
}
