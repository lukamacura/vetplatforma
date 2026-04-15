"use client"

import { useEffect, useState, useTransition } from "react"
import { Stethoscope, CheckCircle2 } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { createCheckoutSession } from "./actions"

export default function UpgradePage() {
  const [clinicName,   setClinicName]   = useState("")
  const [trialExpiry,  setTrialExpiry]  = useState<string | null>(null)
  const [trialActive,  setTrialActive]  = useState(false)
  const [loading,      setLoading]      = useState(true)
  const [isPending,    startTransition] = useTransition()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase.from("profiles").select("clinic_id").eq("id", user.id).single()
      const clinicId = profile?.clinic_id

      function applyClinic(c: { name: string; subscription_status: string | null; trial_started_at: string | null }) {
        setClinicName(c.name)
        if (c.trial_started_at) {
          const exp = new Date(c.trial_started_at)
          exp.setDate(exp.getDate() + 30)
          setTrialExpiry(exp.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "long", year: "numeric" }))
          setTrialActive(c.subscription_status === "trial" && exp.getTime() > Date.now())
        }
      }

      if (!clinicId) {
        const { data: owned } = await supabase.from("clinics").select("id, name, subscription_status, trial_started_at").eq("owner_id", user.id).single()
        if (owned) applyClinic(owned)
      } else {
        const { data: clinic } = await supabase.from("clinics").select("name, subscription_status, trial_started_at").eq("id", clinicId).single()
        if (clinic) applyClinic(clinic)
      }
      setLoading(false)
    }
    load()
  }, [])

  const features = [
    "Automatski podsetnici za vakcinacije i kontrole",
    "Zakazivanje termina za vlasnike",
    "Upravljanje pacijentima i kartonima",
    "Povežite neograničen broj vlasnika",
    "Prioritetna korisnička podrška",
  ]

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full animate-pulse" style={{ background: "var(--surface-raised)" }} />
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.32 }}
        className="solid-card rounded-3xl p-8 max-w-md w-full text-center space-y-6"
      >
        {/* Icon */}
        <div className="icon-lg icon-brand mx-auto" style={{ width: 64, height: 64, borderRadius: 18 }}>
          <Stethoscope size={30} strokeWidth={1.75} />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl">
            {trialActive ? "Aktivirajte pretplatu" : "Probni period istekao"}
          </h1>
          {clinicName && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{clinicName}</p>
          )}
          {trialExpiry && (
            <p className="text-xs" style={{ color: trialActive ? "var(--brand)" : "var(--red)" }}>
              {trialActive
                ? `Besplatno do ${trialExpiry} — prvo plaćanje tek tada`
                : `Probni period istekao: ${trialExpiry}`}
            </p>
          )}
        </div>

        {/* Price */}
        <div
          className="rounded-2xl p-5"
          style={{ background: "var(--brand-tint)", border: "1px solid rgba(43,181,160,0.25)" }}
        >
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--brand)", fontWeight: 700 }}>
            VetPlatforma Pro
          </p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl" style={{ fontWeight: 800, color: "var(--text-primary)" }}>€49</span>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>/mesec</span>
          </div>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Otkazati možete u bilo kom trenutku</p>
        </div>

        {/* Features */}
        <ul className="text-left space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--text-secondary)" }}>
              <CheckCircle2 size={16} strokeWidth={2} style={{ color: "var(--green)", flexShrink: 0, marginTop: 1 }} />
              {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <form
          action={() => startTransition(() => createCheckoutSession())}
        >
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl py-3.5 text-sm text-white transition-opacity"
            style={{
              background: "var(--brand)",
              fontWeight: 700,
              opacity:    isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Preusmeravanje..." : "Aktiviraj pretplatu"}
          </button>
        </form>

        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          Bezbedan plaćanje putem Stripe. Nema skrivenih troškova.
        </p>
      </motion.div>
    </div>
  )
}
