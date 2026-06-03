"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  Syringe,
  Stethoscope,
  Phone,
  Loader2,
  Check,
  Pencil,
} from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { SPECIES_LABEL, SPECIES_OPTIONS } from "@/lib/species"
import type { Pet, Profile, Species, Gender } from "@/lib/types"
import { VisitTimeline } from "./visit-timeline"

const GENDER_LABEL: Record<Gender, string> = {
  male: "Muški",
  female: "Ženski",
  unknown: "Nepoznat",
}

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

type SaveStatus = "idle" | "saving" | "saved"

function SaveIndicator({ status }: { status: SaveStatus }) {
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
  const [loadError, setLoadError] = useState<string | null>(null)

  const [editName, setEditName] = useState("")
  const [editSpecies, setEditSpecies] = useState<Species>("dog")
  const [editBreed, setEditBreed] = useState("")
  const [editBirthDate, setEditBirthDate] = useState("")
  const [editChipId, setEditChipId] = useState("")
  const [editPassport, setEditPassport] = useState("")
  const [editGender, setEditGender] = useState<Gender>("unknown")
  const [editColor, setEditColor] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [vetNotes, setVetNotes] = useState("")

  const [nextVaccineDate, setNextVaccineDate] = useState("")
  const [nextControlDate, setNextControlDate] = useState("")
  const [vaccineNote, setVaccineNote] = useState("")

  // Auto-save state
  const [basicsStatus, setBasicsStatus] = useState<SaveStatus>("idle")
  const [datesStatus, setDatesStatus] = useState<SaveStatus>("idle")

  // Profile edit mode — basics + name + notes are read-only until vet clicks "Izmeni profil"
  const [isEditing, setIsEditing] = useState(false)

  // Prevent saves during initial data load
  const loadedRef = useRef(false)

  // Refs holding latest field values to avoid stale closures in debounced callbacks
  const basicsRef = useRef({
    name: "", species: "dog" as Species, breed: "", birthDate: "",
    chipId: "", passport: "", gender: "unknown" as Gender, color: "", weightKg: "", vetNotes: "",
  })
  const datesRef = useRef({ nextVaccineDate: "", nextControlDate: "", vaccineNote: "" })

  // Debounce + saved-indicator timers
  const basicsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const basicsSavedRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const datesDebounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const datesSavedRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: petData, error: petError } = await supabase.from("pets").select("*").eq("id", petId).single()

      if (petError || !petData) {
        setLoadError("Ljubimac nije pronađen.")
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
      const notes = (p.vet_notes ?? p.owner_notes) ?? ""
      setVetNotes(notes)
      setNextVaccineDate(p.next_vaccine_date ?? "")
      setNextControlDate(p.next_control_date ?? "")
      setVaccineNote(p.vaccine_note ?? "")

      basicsRef.current = {
        name: p.name,
        species: p.species,
        breed: p.breed ?? "",
        birthDate: p.birth_date ?? "",
        chipId: p.chip_id ?? "",
        passport: p.passport_number ?? "",
        gender: p.gender ?? "unknown",
        color: p.color ?? "",
        weightKg: p.weight_kg?.toString() ?? "",
        vetNotes: notes,
      }
      datesRef.current = {
        nextVaccineDate: p.next_vaccine_date ?? "",
        nextControlDate: p.next_control_date ?? "",
        vaccineNote: p.vaccine_note ?? "",
      }

      const { data: ownerData } = await supabase.from("profiles").select("*").eq("id", p.owner_id).single()
      setOwner(ownerData as Profile)

      setLoading(false)
      loadedRef.current = true
    }
    load()
  }, [petId])

  // Flush timers on unmount
  useEffect(() => {
    return () => {
      if (basicsDebounceRef.current) clearTimeout(basicsDebounceRef.current)
      if (basicsSavedRef.current)    clearTimeout(basicsSavedRef.current)
      if (datesDebounceRef.current)  clearTimeout(datesDebounceRef.current)
      if (datesSavedRef.current)     clearTimeout(datesSavedRef.current)
    }
  }, [])

  const saveBasics = useCallback(async () => {
    if (!pet) return
    const v = basicsRef.current
    const supabase = createClient()
    const { error } = await supabase.from("pets").update({
      name: v.name.trim() || pet.name,
      species: v.species,
      breed: v.breed.trim() || null,
      birth_date: v.birthDate || null,
      chip_id: v.chipId.trim() || null,
      passport_number: v.passport.trim() || null,
      gender: v.gender,
      color: v.color.trim() || null,
      weight_kg: v.weightKg ? parseFloat(v.weightKg) : null,
      vet_notes: v.vetNotes || null,
      owner_notes: null,
    }).eq("id", pet.id)
    if (!error) {
      setBasicsStatus("saved")
      if (basicsSavedRef.current) clearTimeout(basicsSavedRef.current)
      basicsSavedRef.current = setTimeout(() => setBasicsStatus("idle"), 1800)
    } else {
      setBasicsStatus("idle")
    }
  }, [pet])

  const saveDates = useCallback(async () => {
    if (!pet) return
    const v = datesRef.current
    const supabase = createClient()
    const { error } = await supabase.from("pets").update({
      next_vaccine_date: v.nextVaccineDate || null,
      next_control_date: v.nextControlDate || null,
      vaccine_note: v.vaccineNote.trim() || null,
    }).eq("id", pet.id)
    if (!error) {
      setDatesStatus("saved")
      if (datesSavedRef.current) clearTimeout(datesSavedRef.current)
      datesSavedRef.current = setTimeout(() => setDatesStatus("idle"), 1800)
    } else {
      setDatesStatus("idle")
    }
  }, [pet])

  const triggerBasicsSave = useCallback(() => {
    if (!loadedRef.current) return
    setBasicsStatus("saving")
    if (basicsDebounceRef.current) clearTimeout(basicsDebounceRef.current)
    basicsDebounceRef.current = setTimeout(() => saveBasics(), 600)
  }, [saveBasics])

  const triggerDatesSave = useCallback(() => {
    if (!loadedRef.current) return
    setDatesStatus("saving")
    if (datesDebounceRef.current) clearTimeout(datesDebounceRef.current)
    datesDebounceRef.current = setTimeout(() => saveDates(), 600)
  }, [saveDates])

  function toggleEdit() {
    if (isEditing) {
      // Leaving edit mode — flush any pending debounced basics save immediately
      if (basicsDebounceRef.current) {
        clearTimeout(basicsDebounceRef.current)
        basicsDebounceRef.current = null
        saveBasics()
      }
    }
    setIsEditing((v) => !v)
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
  if (loadError || !pet) {
    return (
      <div className="flex items-center justify-center h-48 text-sm font-500" style={{ color: "var(--red)" }}>
        {loadError ?? "Greška."}
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

  const basicsRows: { label: string; display: React.ReactNode; mono?: boolean; editField: React.ReactNode }[] = [
    {
      label: "Vrsta",
      display: SPECIES_LABEL[editSpecies],
      editField: (
        <select
          value={editSpecies}
          onChange={(e) => {
            const v = e.target.value as Species
            setEditSpecies(v)
            basicsRef.current.species = v
            triggerBasicsSave()
          }}
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
      display: editBreed.trim() || null,
      editField: (
        <Input
          value={editBreed}
          onChange={(e) => {
            setEditBreed(e.target.value)
            basicsRef.current.breed = e.target.value
            triggerBasicsSave()
          }}
          className={inputEdit}
          placeholder="—"
        />
      ),
    },
    {
      label: "Pol",
      display: GENDER_LABEL[editGender],
      editField: (
        <select
          value={editGender}
          onChange={(e) => {
            const v = e.target.value as Gender
            setEditGender(v)
            basicsRef.current.gender = v
            triggerBasicsSave()
          }}
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
      display: formatDate(editBirthDate),
      editField: (
        <Input
          type="date"
          value={editBirthDate}
          onChange={(e) => {
            setEditBirthDate(e.target.value)
            basicsRef.current.birthDate = e.target.value
            triggerBasicsSave()
          }}
          className={inputEdit}
        />
      ),
    },
    {
      label: "Boja",
      display: editColor.trim() || null,
      editField: (
        <Input
          value={editColor}
          onChange={(e) => {
            setEditColor(e.target.value)
            basicsRef.current.color = e.target.value
            triggerBasicsSave()
          }}
          className={inputEdit}
          placeholder="—"
        />
      ),
    },
    {
      label: "Težina",
      display: weightKg ? `${weightKg} kg` : null,
      editField: (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={weightKg}
            onChange={(e) => {
              setWeightKg(e.target.value)
              basicsRef.current.weightKg = e.target.value
              triggerBasicsSave()
            }}
            className={cn(inputEdit, "w-24")}
            placeholder="—"
          />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>kg</span>
        </div>
      ),
    },
    {
      label: "ID mikročipa",
      display: editChipId.trim() || null,
      mono: true,
      editField: (
        <Input
          value={editChipId}
          onChange={(e) => {
            setEditChipId(e.target.value)
            basicsRef.current.chipId = e.target.value
            triggerBasicsSave()
          }}
          className={cn(inputEdit, "font-mono text-xs")}
          placeholder="—"
        />
      ),
    },
    {
      label: "Broj pasoša",
      display: editPassport.trim() || null,
      editField: (
        <Input
          value={editPassport}
          onChange={(e) => {
            setEditPassport(e.target.value)
            basicsRef.current.passport = e.target.value
            triggerBasicsSave()
          }}
          className={inputEdit}
          placeholder="—"
        />
      ),
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
            <div className="flex items-center gap-2 flex-wrap">
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value)
                    basicsRef.current.name = e.target.value
                    triggerBasicsSave()
                  }}
                  className="h-8 text-lg font-bold max-w-[260px]"
                  style={{ fontWeight: 700 }}
                  placeholder="Ime ljubimca"
                />
              ) : (
                <h1 className="text-lg" style={{ fontWeight: 700 }}>{editName || pet.name}</h1>
              )}
              <button
                type="button"
                onClick={toggleEdit}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all"
                style={{
                  fontWeight: 600,
                  background: isEditing ? "var(--brand)" : "var(--brand-tint)",
                  color: isEditing ? "#fff" : "var(--brand)",
                  border: isEditing ? "1px solid var(--brand)" : "1px solid color-mix(in srgb, var(--brand) 25%, transparent)",
                }}
              >
                {isEditing ? (
                  <><Check size={13} strokeWidth={2.5} /> Gotovo</>
                ) : (
                  <><Pencil size={12} strokeWidth={2} /> Izmeni profil</>
                )}
              </button>
            </div>
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

        {/* Pet notes in hero so vet sees them immediately */}
        <div className="mt-4 pt-4 rounded-xl px-3 py-3" style={{ borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--red) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--red) 25%, transparent)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-[10px] uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: "var(--red)", fontWeight: 700, letterSpacing: "0.08em" }}
            >
              <span className="pulse-dot" style={{ background: "var(--red)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--red) 20%, transparent)" }} />
              Beleške o ljubimcu
            </span>
            {isEditing && <SaveIndicator status={basicsStatus} />}
          </div>
          {isEditing ? (
            <textarea
              className="vet-notes-textarea w-full min-h-[64px] rounded-xl text-sm resize-y px-3 py-2"
              style={{
                background: "color-mix(in srgb, var(--red) 4%, var(--surface-raised))",
                color: "var(--text-primary)",
                lineHeight: 1.6,
                fontFamily: "inherit",
                border: "1px solid color-mix(in srgb, var(--red) 30%, transparent)",
              }}
              placeholder="Beleške o ljubimcu…"
              value={vetNotes}
              onChange={(e) => {
                setVetNotes(e.target.value)
                basicsRef.current.vetNotes = e.target.value
                triggerBasicsSave()
              }}
            />
          ) : (
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: vetNotes ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1.6 }}
            >
              {vetNotes || "Nema beleški."}
            </p>
          )}
        </div>
      </motion.div>

      {/* Body: 3-column on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left column: Podaci o ljubimcu */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5 lg:col-span-7">
          <div className="flex items-center mb-4">
            <h3 className="text-sm" style={{ fontWeight: 600 }}>Podaci o ljubimcu</h3>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
            {basicsRows.map((row, i) => (
              <div
                key={row.label}
                className={cn("py-2.5", i < basicsRows.length - 1 && "border-b")}
                style={{ borderColor: "var(--border)" }}
              >
                <FieldLabel>{row.label}</FieldLabel>
                {isEditing ? (
                  <div className="mt-1">{row.editField}</div>
                ) : (
                  <FieldValue mono={row.mono}>{row.display}</FieldValue>
                )}
              </div>
            ))}
          </dl>

        </motion.div>

        {/* Middle column: Podsetnici */}
        <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5 lg:col-span-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm" style={{ fontWeight: 600 }}>Termini i vakcinacija</h3>
              <SaveIndicator status={datesStatus} />
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="icon-sm icon-amber shrink-0">
                    <Syringe size={13} strokeWidth={2.25} />
                  </div>
                  <h3 className="text-sm" style={{ fontWeight: 600 }}>Sledeća vakcinacija</h3>
                </div>
                <Input
                  id="vaccine"
                  type="date"
                  value={nextVaccineDate}
                  onChange={(e) => {
                    setNextVaccineDate(e.target.value)
                    datesRef.current.nextVaccineDate = e.target.value
                    triggerDatesSave()
                  }}
                  className="w-full"
                />
                <div className="mt-3">
                  <FieldLabel>Napomena (npr. besnilo, revakcinacija)</FieldLabel>
                  <Input
                    id="vaccineNote"
                    value={vaccineNote}
                    onChange={(e) => {
                      setVaccineNote(e.target.value)
                      datesRef.current.vaccineNote = e.target.value
                      triggerDatesSave()
                    }}
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
                <Input
                  id="control"
                  type="date"
                  value={nextControlDate}
                  onChange={(e) => {
                    setNextControlDate(e.target.value)
                    datesRef.current.nextControlDate = e.target.value
                    triggerDatesSave()
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </motion.div>

      </div>{/* /grid */}

      {/* Posete — full width, below everything. Shows the most recent few;
          the rest live on the standalone /posete history page. */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5 w-full">
        <h3 className="text-sm mb-4" style={{ fontWeight: 600 }}>Poslednje posete</h3>
        <VisitTimeline
          petId={pet.id}
          limit={4}
          viewAllHref={`/dashboard/pacijenti/${pet.id}/posete`}
        />
      </motion.div>
    </motion.div>
  )
}
