"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Save,
  Syringe,
  Stethoscope,
  Phone,
  CheckCircle,
  Pencil,
  X,
  MessageSquareText,
  FileText,
  ChevronDown,
  Lock,
} from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { Pet, Profile, AppointmentStatus, Species, Gender } from "@/lib/types"

type ApptHistoryRow = {
  id: string
  scheduled_at: string
  status: AppointmentStatus
  service_name: string
  vet_notes: string | null
}

const SPECIES_LABEL: Record<Species, string> = {
  dog: "Pas",
  cat: "Mačka",
  bird: "Ptica",
  other: "Ostalo",
}
const GENDER_LABEL: Record<Gender, string> = {
  male: "Muški",
  female: "Ženski",
  unknown: "Nepoznat",
}

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "Pas" },
  { value: "cat", label: "Mačka" },
  { value: "bird", label: "Ptica" },
  { value: "other", label: "Ostalo" },
]
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Muški" },
  { value: "female", label: "Ženski" },
  { value: "unknown", label: "Nepoznat" },
]

function dateStatus(dateStr: string | null | undefined): "overdue" | "soon" | "ok" | null {
  if (!dateStr) return null
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "overdue"
  if (days <= 14) return "soon"
  return "ok"
}

const STATUS_BADGE: Record<
  "overdue" | "soon" | "ok",
  { cls: string; dot: boolean; label: (d: string) => string }
> = {
  overdue: {
    cls: "badge badge-red",
    dot: true,
    label: (d) =>
      `Isteklo ${new Date(d).toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })}`,
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
    label: (d) =>
      new Date(d).toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" }),
  },
}

function DateStatusBadge({
  date,
  icon: Icon,
  label,
}: {
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

function ageLabelSr(birthDate: string | null): string | null {
  if (!birthDate) return null
  const b = new Date(birthDate + "T12:00:00")
  const today = new Date()
  let years = today.getFullYear() - b.getFullYear()
  const md = today.getMonth() - b.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < b.getDate())) years--
  if (years < 1) {
    const months = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth())
    const m = Math.max(0, months)
    if (m === 0) return "Manje od mesec dana"
    if (m === 1) return "1 mesec"
    if (m >= 2 && m <= 4) return `${m} meseca`
    return `${m} meseci`
  }
  const n = years
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} godina`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} godine`
  return `${n} godina`
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt
      className="text-[10px] uppercase tracking-wider"
      style={{ color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em" }}
    >
      {children}
    </dt>
  )
}

function FieldValue({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <dd
      className={cn("text-[13px] mt-0.5 leading-snug", mono && "font-mono text-xs tracking-tight")}
      style={{ color: "var(--text-primary)", fontWeight: 500 }}
    >
      {children || <span style={{ color: "var(--text-muted)" }}>—</span>}
    </dd>
  )
}

const inputEdit =
  "h-7 rounded-lg border border-input bg-transparent px-2 text-[13px] font-medium focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 md:text-[13px]"

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d + "T12:00:00").toLocaleDateString("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export default function PetProfilePage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.id as string
  const [pet, setPet] = useState<Pet | null>(null)
  const [owner, setOwner] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apptHistory, setApptHistory] = useState<ApptHistoryRow[]>([])

  const [editingBasics, setEditingBasics] = useState(false)

  const [editName, setEditName] = useState("")
  const [editSpecies, setEditSpecies] = useState<Species>("dog")
  const [editBreed, setEditBreed] = useState("")
  const [editBirthDate, setEditBirthDate] = useState("")
  const [editChipId, setEditChipId] = useState("")
  const [editPassport, setEditPassport] = useState("")
  const [editGender, setEditGender] = useState<Gender>("unknown")
  const [editColor, setEditColor] = useState("")
  const [weightKg, setWeightKg] = useState("")

  const [nextVaccineDate, setNextVaccineDate] = useState("")
  const [nextControlDate, setNextControlDate] = useState("")
  const [vetNotes, setVetNotes] = useState("")
  const [vaccineNote, setVaccineNote] = useState("")
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null)
  const [apptNotesDraft, setApptNotesDraft] = useState<Record<string, string>>({})
  const [savingApptNote, setSavingApptNote] = useState<string | null>(null)
  const [savedApptNote, setSavedApptNote] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: petData, error: petError } = await supabase.from("pets").select("*").eq("id", petId).single()

      if (petError || !petData) {
        setError("Ljubimac nije pronađen.")
        setLoading(false)
        return
      }

      const p = petData as Pet
      setPet(p)
      setEditName(p.name)
      setEditSpecies(p.species)
      setEditBreed(p.breed ?? "")
      setEditBirthDate(p.birth_date ?? "")
      setEditChipId(p.chip_id ?? "")
      setEditPassport(p.passport_number ?? "")
      setEditGender(p.gender ?? "unknown")
      setEditColor(p.color ?? "")
      setWeightKg(p.weight_kg?.toString() ?? "")
      setNextVaccineDate(p.next_vaccine_date ?? "")
      setNextControlDate(p.next_control_date ?? "")
      setVetNotes(p.vet_notes ?? "")
      setVaccineNote(p.vaccine_note ?? "")

      const { data: ownerData } = await supabase.from("profiles").select("*").eq("id", p.owner_id).single()
      setOwner(ownerData as Profile)

      const { data: apptData } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, service_id, vet_notes")
        .eq("pet_id", petId)
        .order("scheduled_at", { ascending: false })
        .limit(25)

      if (apptData && apptData.length > 0) {
        const serviceIds = [...new Set(apptData.map((a: { service_id: string }) => a.service_id))]
        const { data: svcs } = await supabase.from("services").select("id, name").in("id", serviceIds)
        const svcMap: Record<string, string> = Object.fromEntries(
          (svcs ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
        )
        setApptHistory(
          apptData.map(
            (a: { id: string; scheduled_at: string; status: AppointmentStatus; service_id: string; vet_notes: string | null }) => ({
              id: a.id,
              scheduled_at: a.scheduled_at,
              status: a.status,
              service_name: svcMap[a.service_id] ?? "—",
              vet_notes: a.vet_notes ?? null,
            })
          )
        )
      } else {
        setApptHistory([])
      }

      setLoading(false)
    }
    load()
  }, [petId])

  function cancelBasicsEdit() {
    if (!pet) return
    setEditName(pet.name)
    setEditSpecies(pet.species)
    setEditBreed(pet.breed ?? "")
    setEditBirthDate(pet.birth_date ?? "")
    setEditChipId(pet.chip_id ?? "")
    setEditPassport(pet.passport_number ?? "")
    setEditGender(pet.gender ?? "unknown")
    setEditColor(pet.color ?? "")
    setWeightKg(pet.weight_kg?.toString() ?? "")
    setEditingBasics(false)
  }

  async function handleSave() {
    if (!pet) return
    setSaving(true)
    setSaved(false)
    setError(null)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("pets")
      .update({
        name: editName.trim() || pet.name,
        species: editSpecies,
        breed: editBreed.trim() || null,
        birth_date: editBirthDate || null,
        chip_id: editChipId.trim() || null,
        passport_number: editPassport.trim() || null,
        gender: editGender,
        color: editColor.trim() || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        next_vaccine_date: nextVaccineDate || null,
        next_control_date: nextControlDate || null,
        vet_notes: vetNotes || null,
        vaccine_note: vaccineNote.trim() || null,
      })
      .eq("id", pet.id)
    setSaving(false)
    if (updateError) {
      setError("Greška pri čuvanju.")
    } else {
      setSaved(true)
      const updated = {
        ...pet,
        name: editName.trim() || pet.name,
        species: editSpecies,
        breed: editBreed.trim() || null,
        birth_date: editBirthDate || null,
        chip_id: editChipId.trim() || null,
        passport_number: editPassport.trim() || null,
        gender: editGender,
        color: editColor.trim() || null,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        next_vaccine_date: nextVaccineDate || null,
        next_control_date: nextControlDate || null,
        vet_notes: vetNotes || null,
        vaccine_note: vaccineNote.trim() || null,
      }
      setPet(updated)
      setEditingBasics(false)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  async function handleSaveApptNote(apptId: string) {
    const text = apptNotesDraft[apptId] ?? ""
    setSavingApptNote(apptId)
    setSavedApptNote(null)
    const supabase = createClient()
    const { error: updateError } = await supabase
      .from("appointments")
      .update({ vet_notes: text.trim() || null })
      .eq("id", apptId)
    setSavingApptNote(null)
    if (!updateError) {
      setSavedApptNote(apptId)
      setApptHistory((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, vet_notes: text.trim() || null } : a))
      )
      setTimeout(() => setSavedApptNote(null), 3000)
    }
  }

  function toggleApptExpand(apptId: string) {
    if (expandedApptId === apptId) {
      setExpandedApptId(null)
    } else {
      setExpandedApptId(apptId)
      const existing = apptHistory.find((a) => a.id === apptId)
      if (existing && !(apptId in apptNotesDraft)) {
        setApptNotesDraft((prev) => ({ ...prev, [apptId]: existing.vet_notes ?? "" }))
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="grid lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3 h-56 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
          <div className="lg:col-span-5 h-56 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
          <div className="lg:col-span-4 h-56 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        </div>
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
  const healthColor =
    vaccStatus === "overdue" || ctrlStatus === "overdue"
      ? "var(--red)"
      : vaccStatus === "soon" || ctrlStatus === "soon"
        ? "var(--amber)"
        : vaccStatus === "ok" || ctrlStatus === "ok"
          ? "var(--green)"
          : "var(--border-strong)"

  const ageStr = ageLabelSr(editBirthDate || pet.birth_date)
  const subtitleParts = [SPECIES_LABEL[editSpecies]]
  if (editBreed.trim()) subtitleParts.push(editBreed.trim())
  if (ageStr) subtitleParts.push(ageStr)

  const basicsRows: { label: string; value: React.ReactNode; editField: React.ReactNode }[] = [
    {
      label: "Vrsta",
      value: SPECIES_LABEL[editSpecies],
      editField: (
        <select
          value={editSpecies}
          onChange={(e) => setEditSpecies(e.target.value as Species)}
          className={cn(inputEdit, "w-full cursor-pointer")}
        >
          {SPECIES_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ),
    },
    {
      label: "Rasa",
      value: editBreed || null,
      editField: <Input value={editBreed} onChange={(e) => setEditBreed(e.target.value)} className={inputEdit} placeholder="—" />,
    },
    {
      label: "Pol",
      value: GENDER_LABEL[editGender],
      editField: (
        <select
          value={editGender}
          onChange={(e) => setEditGender(e.target.value as Gender)}
          className={cn(inputEdit, "w-full cursor-pointer")}
        >
          {GENDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ),
    },
    {
      label: "Datum rođenja",
      value: formatDate(editBirthDate),
      editField: <Input type="date" value={editBirthDate} onChange={(e) => setEditBirthDate(e.target.value)} className={inputEdit} />,
    },
    {
      label: "Boja",
      value: editColor || null,
      editField: <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} className={inputEdit} placeholder="—" />,
    },
    {
      label: "Težina",
      value: weightKg ? `${weightKg} kg` : null,
      editField: (
        <div className="flex items-center gap-1.5">
          <Input type="number" step="0.1" min="0" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={cn(inputEdit, "w-24")} placeholder="—" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>kg</span>
        </div>
      ),
    },
    {
      label: "ID mikročipa",
      value: editChipId ? <span className="font-mono text-xs tracking-tight">{editChipId}</span> : null,
      editField: <Input value={editChipId} onChange={(e) => setEditChipId(e.target.value)} className={cn(inputEdit, "font-mono text-xs")} placeholder="—" />,
    },
    {
      label: "Broj pasoša",
      value: editPassport || null,
      editField: <Input value={editPassport} onChange={(e) => setEditPassport(e.target.value)} className={inputEdit} placeholder="—" />,
    },
  ]

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5 w-full"
    >
      {/* Hero */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="back-link flex items-center gap-1.5 text-xs mb-4"
          style={{ fontWeight: 600 }}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Nazad na pacijente
        </button>

        <div className="flex items-start gap-4">
          <PetAvatar
            photoUrl={pet.photo_url}
            species={editSpecies}
            size={56}
            rounded="2xl"
            outline={`3px solid ${healthColor}`}
            outlineOffset="2px"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg" style={{ fontWeight: 700 }}>{editName || pet.name}</h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              {subtitleParts.join(" · ")}
            </p>
            {owner && (
              <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                <Phone size={11} strokeWidth={2} className="opacity-60" />
                {owner.full_name}{owner.phone && ` · ${owner.phone}`}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5 items-end shrink-0">
            <DateStatusBadge date={nextVaccineDate || pet.next_vaccine_date} icon={Syringe} label="Vakc." />
            <DateStatusBadge date={nextControlDate || pet.next_control_date} icon={Stethoscope} label="Pregled" />
          </div>
        </div>
      </motion.div>

      {/* Body: 2-column on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left column: Podaci o ljubimcu */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5 lg:col-span-7">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm" style={{ fontWeight: 600 }}>Podaci o ljubimcu</h3>
            <button
              type="button"
              onClick={() => editingBasics ? cancelBasicsEdit() : setEditingBasics(true)}
              className="edit-toggle p-1.5 rounded-lg"
            >
              {editingBasics ? <X size={14} strokeWidth={2} /> : <Pencil size={14} strokeWidth={2} />}
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
            {basicsRows.map((row, i) => (
              <div
                key={row.label}
                className={cn("py-2.5", i < basicsRows.length - 1 && "border-b")}
                style={{ borderColor: "var(--border)" }}
              >
                <FieldLabel>{row.label}</FieldLabel>
                {editingBasics ? (
                  <div className="mt-1">{row.editField}</div>
                ) : (
                  <FieldValue mono={row.label === "ID mikročipa"}>{row.value}</FieldValue>
                )}
              </div>
            ))}
          </dl>

          {pet.owner_notes && (
            <div
              className="rounded-xl px-4 py-3 mt-5"
              style={{
                background: "var(--yellow-tint, #FEF9C3)",
                border: "1px solid rgba(234,179,8,0.2)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <MessageSquareText size={13} strokeWidth={2} style={{ color: "var(--yellow, #EAB308)" }} />
                <span className="text-xs" style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                  Vlasnik kaže:
                </span>
              </div>
              <p className="text-sm" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
                {pet.owner_notes}
              </p>
            </div>
          )}

          <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-[10px] uppercase tracking-wider"
                style={{ color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em" }}
              >
                Beleške
              </span>
              <span className="badge badge-muted" style={{ gap: 4 }}>
                <Lock size={10} strokeWidth={2} />
                Samo vet
              </span>
            </div>
            <textarea
              className="vet-notes-textarea w-full min-h-[80px] rounded-xl text-sm resize-y px-3 py-2 mt-1.5"
              style={{
                background: "var(--surface-raised)",
                color: "var(--text-primary)",
                lineHeight: 1.6,
                fontFamily: "inherit",
              }}
              placeholder="Beleške o ljubimcu…"
              value={vetNotes}
              onChange={(e) => setVetNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2" style={{ fontWeight: 600 }}>
                {saving ? <span className="animate-spin inline-block">↻</span> : <Save size={14} strokeWidth={2} />}
                {saving ? "Čuvanje..." : "Sačuvaj"}
              </button>
            </motion.div>
            {saved && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 text-sm"
                style={{ color: "var(--green)", fontWeight: 600 }}
              >
                <CheckCircle size={15} strokeWidth={2.25} />
                Sačuvano
              </motion.div>
            )}
            {error && (
              <span className="text-sm" style={{ color: "var(--red)", fontWeight: 500 }}>{error}</span>
            )}
          </div>
        </motion.div>

        {/* Right column: Vakcine + Posete stacked */}
        <div className="lg:col-span-5 flex flex-col gap-5">

          {/* Vakcine i pregledi */}
          <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5">
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="icon-sm icon-amber shrink-0">
                    <Syringe size={13} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-sm" style={{ fontWeight: 600 }}>Sledeća vakcinacija</h3>
                </div>
                <Input id="vaccine" type="date" value={nextVaccineDate} onChange={(e) => setNextVaccineDate(e.target.value)} className="w-full" />
                <div className="mt-3">
                  <FieldLabel>Napomena (npr. besnilo, revakcinacija)</FieldLabel>
                  <Input
                    id="vaccineNote"
                    value={vaccineNote}
                    onChange={(e) => setVaccineNote(e.target.value)}
                    className="mt-1.5 w-full"
                    placeholder="Tip vakcine ili napomena..."
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="icon-sm icon-brand shrink-0">
                    <Stethoscope size={13} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-sm" style={{ fontWeight: 600 }}>Sledeći kontrolni pregled</h3>
                </div>
                <Input id="control" type="date" value={nextControlDate} onChange={(e) => setNextControlDate(e.target.value)} className="w-full" />
              </div>
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5 text-sm flex items-center gap-2" style={{ fontWeight: 600 }}>
                  {saving ? <span className="animate-spin inline-block">↻</span> : <Save size={14} strokeWidth={2} />}
                  {saving ? "Čuvanje..." : "Sačuvaj datume"}
                </button>
              </motion.div>
            </div>
          </motion.div>

          {/* Posete */}
          <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5 flex-1">
            <h3 className="text-sm mb-4" style={{ fontWeight: 600 }}>Istorija poseta</h3>
        <div className="relative pl-1">
          <ul className="space-y-0">
            {apptHistory.map((appt, idx) => {
              const d = new Date(appt.scheduled_at)
              const dateStr = d.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "short", year: "numeric" })
              const timeStr = d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })
              const isLast = idx === apptHistory.length - 1
              const isFirst = idx === 0
              const statusBadge =
                appt.status === "confirmed"
                  ? { cls: "badge-brand", label: "Potvrđen" }
                  : appt.status === "cancelled"
                    ? { cls: "badge-muted", label: "Otkazan" }
                    : { cls: "badge-red", label: "Nije došao" }
              const dotMuted = appt.status !== "confirmed"
              const isExpanded = expandedApptId === appt.id
              const hasNotes = !!appt.vet_notes
              return (
                <li key={appt.id} className={`relative pl-7 ${isLast ? "" : "pb-6"}`}>
                  {!isLast && (
                    <span className="absolute left-[4px] top-4 bottom-0 w-px" style={{ background: "var(--border)" }} aria-hidden />
                  )}
                  <span
                    className={cn(
                      "absolute left-0 top-1.5 size-2.5 rounded-full z-1",
                      isFirst && !dotMuted && "timeline-dot-active"
                    )}
                    style={isFirst && !dotMuted ? undefined : {
                      background: dotMuted ? "var(--border-strong)" : "var(--brand)",
                      boxShadow: dotMuted ? "none" : "0 0 0 3px var(--brand-tint)",
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleApptExpand(appt.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm leading-snug" style={{ fontWeight: 600 }}>{appt.service_name}</p>
                            {hasNotes && !isExpanded && (
                              <FileText size={12} strokeWidth={2} className="shrink-0 opacity-40" />
                            )}
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{dateStr} · {timeStr}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
                          <ChevronDown
                            size={14}
                            strokeWidth={2}
                            className="transition-transform duration-200 opacity-40 group-hover:opacity-70"
                            style={{ transform: isExpanded ? "rotate(180deg)" : undefined }}
                          />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        transition={{ duration: 0.2 }}
                        className="mt-3 overflow-hidden"
                      >
                        <FieldLabel>Beleške sa posete</FieldLabel>
                        <textarea
                          className="vet-notes-textarea w-full min-h-[80px] rounded-xl text-sm resize-y px-3 py-2 mt-1.5"
                          style={{
                            background: "var(--surface-raised)",
                            color: "var(--text-primary)",
                            lineHeight: 1.6,
                            fontFamily: "inherit",
                          }}
                          placeholder="Dodaj beleške za ovu posetu…"
                          value={apptNotesDraft[appt.id] ?? appt.vet_notes ?? ""}
                          onChange={(e) => setApptNotesDraft((prev) => ({ ...prev, [appt.id]: e.target.value }))}
                        />
                        <div className="flex items-center gap-3 mt-2">
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                            <button
                              type="button"
                              onClick={() => handleSaveApptNote(appt.id)}
                              disabled={savingApptNote === appt.id}
                              className="btn-primary px-4 py-2 text-xs flex items-center gap-1.5"
                              style={{ fontWeight: 600 }}
                            >
                              {savingApptNote === appt.id
                                ? <span className="animate-spin inline-block">↻</span>
                                : <Save size={12} strokeWidth={2} />}
                              {savingApptNote === appt.id ? "Čuvanje..." : "Sačuvaj"}
                            </button>
                          </motion.div>
                          {savedApptNote === appt.id && (
                            <motion.span
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-center gap-1 text-xs"
                              style={{ color: "var(--green)", fontWeight: 600 }}
                            >
                              <CheckCircle size={13} strokeWidth={2.25} />
                              Sačuvano
                            </motion.span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {apptHistory.length === 0 && (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema termina.</p>
          )}
        </div>
      </motion.div>

        </div>{/* /right column */}
      </div>{/* /grid */}
    </motion.div>
  )
}
