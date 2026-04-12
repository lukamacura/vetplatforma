"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Save, Syringe, Stethoscope, Weight,
  Phone, CalendarDays, FileText, CheckCircle,
} from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import type { Pet, Profile } from "@/lib/types"

const SPECIES_LABEL: Record<string, string> = {
  dog: "Pas", cat: "Mačka", bird: "Ptica", other: "Ostalo",
}
const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}

/* ── Derive status from a date string ── */
function dateStatus(dateStr: string | null | undefined): "overdue" | "soon" | "ok" | null {
  if (!dateStr) return null
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (days < 0)   return "overdue"
  if (days <= 14) return "soon"
  return "ok"
}

/*
  Color semantics:
    red    → overdue / expired
    amber  → due within 14 days / attention needed
    green  → scheduled, on track
    blue   → neutral info / timing
    teal   → brand / confirmed
*/
const STATUS_BADGE: Record<
  "overdue" | "soon" | "ok",
  { cls: string; dot: boolean; label: (d: string) => string }
> = {
  overdue: {
    cls: "badge badge-red",
    dot: true,
    label: (d) => `Isteklo ${new Date(d).toLocaleDateString("en-GB")}`,
  },
  soon: {
    cls: "badge badge-amber",
    dot: true,
    label: (d) => {
      const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
      return `Za ${days}d`
    },
  },
  ok: {
    cls: "badge badge-green",
    dot: false,
    label: (d) => new Date(d).toLocaleDateString("en-GB"),
  },
}

function DateStatusBadge({ date, icon: Icon, label }: {
  date: string | null | undefined
  icon: React.ElementType
  label: string
}) {
  if (!date) return null
  const status = dateStatus(date)
  if (!status) return null
  const cfg = STATUS_BADGE[status]
  return (
    <span className={cfg.cls} style={{ gap: 5 }}>
      {cfg.dot && <span className="pulse-dot" />}
      <Icon size={10} strokeWidth={2.5} />
      {label}: {cfg.label(date)}
    </span>
  )
}

/* ── Section card ── */
function SectionCard({
  title, icon: Icon, iconClass = "icon-brand", children, delay = 0,
}: {
  title: string
  icon: React.ElementType
  iconClass?: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.26 }}
      className="solid-card rounded-2xl overflow-hidden"
    >
      <div
        className="flex items-center gap-2.5 px-5 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className={`icon-sm ${iconClass}`}>
          <Icon size={13} strokeWidth={2.25} />
        </div>
        <h3 className="text-sm font-600" style={{ fontWeight: 600 }}>{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </motion.div>
  )
}

/* ── Page ── */
export default function PetProfilePage() {
  const params = useParams()
  const router = useRouter()
  const petId  = params.id as string

  const [pet,    setPet]    = useState<Pet | null>(null)
  const [owner,  setOwner]  = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [weightKg,        setWeightKg]        = useState("")
  const [nextVaccineDate, setNextVaccineDate] = useState("")
  const [nextControlDate, setNextControlDate] = useState("")
  const [vetNotes,        setVetNotes]        = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: petData, error: petError } = await supabase
        .from("pets").select("*").eq("id", petId).single()

      if (petError || !petData) {
        setError("Ljubimac nije pronađen.")
        setLoading(false)
        return
      }

      setPet(petData as Pet)
      setWeightKg(petData.weight_kg?.toString() ?? "")
      setNextVaccineDate(petData.next_vaccine_date ?? "")
      setNextControlDate(petData.next_control_date ?? "")
      setVetNotes(petData.vet_notes ?? "")

      const { data: ownerData } = await supabase
        .from("profiles").select("*").eq("id", petData.owner_id).single()
      setOwner(ownerData as Profile)
      setLoading(false)
    }
    load()
  }, [petId])

  async function handleSave() {
    if (!pet) return
    setSaving(true)
    setSaved(false)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("pets")
      .update({
        weight_kg:          weightKg ? parseFloat(weightKg) : null,
        next_vaccine_date:  nextVaccineDate || null,
        next_control_date:  nextControlDate || null,
        vet_notes:          vetNotes || null,
      })
      .eq("id", pet.id)
    setSaving(false)
    if (updateError) {
      setError("Greška pri čuvanju.")
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }
  if (error || !pet) {
    return (
      <div className="flex items-center justify-center h-48 text-sm font-500" style={{ color: "var(--red)" }}>
        {error ?? "Greška."}
      </div>
    )
  }

  const vaccStatus = dateStatus(nextVaccineDate || pet.next_vaccine_date)
  const ctrlStatus = dateStatus(nextControlDate || pet.next_control_date)

  // Overall health color for avatar ring
  const healthColor =
    vaccStatus === "overdue" || ctrlStatus === "overdue"
      ? "var(--red)"
      : vaccStatus === "soon" || ctrlStatus === "soon"
      ? "var(--amber)"
      : vaccStatus === "ok" || ctrlStatus === "ok"
      ? "var(--green)"
      : "var(--border-strong)"

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── Pet hero card ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="solid-card rounded-2xl p-5"
      >
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-xs font-600 mb-5 transition-colors"
          style={{ color: "var(--text-muted)", fontWeight: 600 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Nazad na pacijente
        </button>

        <div className="flex items-start gap-4">
          {/* Avatar - ring color encodes health */}
          <div
            className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl select-none"
            style={{
              background:   "var(--surface-raised)",
              outline:      `3px solid ${healthColor}`,
              outlineOffset: "2px",
            }}
          >
            {SPECIES_EMOJI[pet.species]}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl">{pet.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {SPECIES_LABEL[pet.species]}{pet.breed ? ` · ${pet.breed}` : ""}
            </p>
            {owner && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="badge badge-muted" style={{ gap: 4 }}>
                  <Phone size={10} strokeWidth={2} />
                  {owner.full_name}
                  {owner.phone && ` · ${owner.phone}`}
                </span>
              </div>
            )}
          </div>

          {/* Health status badges */}
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <DateStatusBadge
              date={nextVaccineDate || pet.next_vaccine_date}
              icon={Syringe}
              label="Vakc."
            />
            <DateStatusBadge
              date={nextControlDate || pet.next_control_date}
              icon={Stethoscope}
              label="Kontrola"
            />
            {pet.weight_kg && (
              <span className="badge badge-blue" style={{ gap: 4 }}>
                <Weight size={10} strokeWidth={2} />
                {pet.weight_kg} kg
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Basic info ── */}
      <SectionCard title="Osnovni podaci" icon={FileText} iconClass="icon-blue" delay={0.08}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          {[
            { label: "Rasa",             value: pet.breed     || "-" },
            { label: "Datum rođenja",    value: pet.birth_date || "-" },
            { label: "Čip ID",           value: pet.chip_id   || "-", mono: true },
            { label: "Telefon vlasnika", value: owner?.phone  || "-" },
          ].map(({ label, value, mono }) => (
            <div key={label}>
              <dt className="text-xs font-600 mb-0.5" style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                {label}
              </dt>
              <dd
                className={`font-500 ${mono ? "font-mono text-xs" : ""}`}
                style={{ color: "var(--text-primary)", fontWeight: 500 }}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      {/* ── Critical three ── */}
      <SectionCard title="Glavni podaci" icon={CalendarDays} iconClass="icon-amber" delay={0.13}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="vaccine" className="flex items-center gap-1.5 text-xs font-600" style={{ fontWeight: 600 }}>
              <Syringe size={12} strokeWidth={2} style={{ color: "var(--amber)" }} />
              Sledeća vakcinacija
            </Label>
            <Input id="vaccine" type="date" value={nextVaccineDate} onChange={(e) => setNextVaccineDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="control" className="flex items-center gap-1.5 text-xs font-600" style={{ fontWeight: 600 }}>
              <Stethoscope size={12} strokeWidth={2} style={{ color: "var(--brand)" }} />
              Sledeća kontrola
            </Label>
            <Input id="control" type="date" value={nextControlDate} onChange={(e) => setNextControlDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="weight" className="flex items-center gap-1.5 text-xs font-600" style={{ fontWeight: 600 }}>
              <Weight size={12} strokeWidth={2} style={{ color: "var(--blue)" }} />
              Težina (kg)
            </Label>
            <Input id="weight" type="number" step="0.1" min="0" placeholder="npr. 8.5" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
          </div>
        </div>
      </SectionCard>

      {/* ── Vet notes ── */}
      <SectionCard title="Beleške (vidljivo samo veteru)" icon={FileText} iconClass="icon-muted" delay={0.18}>
        <textarea
          className="w-full min-h-28 rounded-xl text-sm resize-none px-3 py-2.5 transition-all"
          style={{
            background:  "var(--surface-raised)",
            border:      "1px solid var(--border)",
            color:       "var(--text-primary)",
            lineHeight:  1.6,
            outline:     "none",
            fontFamily:  "inherit",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--brand)"
            e.currentTarget.style.boxShadow   = "0 0 0 3px var(--brand-subtle)"
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)"
            e.currentTarget.style.boxShadow   = "none"
          }}
          placeholder="Alergije, hronična oboljenja, napomene..."
          value={vetNotes}
          onChange={(e) => setVetNotes(e.target.value)}
        />
      </SectionCard>

      {/* ── Save ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.22 }}
        className="flex items-center gap-3 pb-4"
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 text-white font-600"
            style={{ background: "var(--brand)", border: "none", fontWeight: 600 }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = "var(--brand-hover)" }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--brand)" }}
          >
            {saving
              ? <span className="animate-spin inline-block">↻</span>
              : <Save size={14} strokeWidth={2} />
            }
            {saving ? "Čuvanje..." : "Sačuvaj izmene"}
          </Button>
        </motion.div>

        {saved && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-1.5 text-sm font-600"
            style={{ color: "var(--green)", fontWeight: 600 }}
          >
            <CheckCircle size={15} strokeWidth={2.25} />
            Sačuvano
          </motion.div>
        )}
        {error && (
          <span className="text-sm font-500" style={{ color: "var(--red)", fontWeight: 500 }}>
            {error}
          </span>
        )}
      </motion.div>
    </div>
  )
}
