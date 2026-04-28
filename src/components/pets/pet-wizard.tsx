"use client"

/**
 * Owner-side "add a pet" wizard.
 *
 * Why a wizard here and not on the edit page:
 *  - Adding a pet is a once-per-pet onboarding moment; friction on a long
 *    flat form is highest exactly here, and optional fields (chip, pasoš…)
 *    get skipped more honestly when they're presented in a "you can add
 *    this later" context.
 *  - Editing is a targeted change — users want to see the whole pet at once.
 *    That flow stays a single scrollable form (`[id]/uredi/page.tsx`).
 *
 * Steps (grouped by the user's mental bucket, NOT one-field-per-screen):
 *   1. Identitet  — ime + vrsta (required)
 *   2. Fotografija — optional; big emotional payoff
 *   3. Osnovno    — pol, datum rođenja, rasa
 *   4. Dokumenti  — chip, pasoš, težina, boja (all optional)
 *   5. Napomena   — free-text context for the vet (optional)
 */

import { useState, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, ArrowRight, Camera, X as XIcon, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { SPECIES_OPTIONS, SPECIES_IMAGE } from "@/lib/species"
import {
  BREED_PLACEHOLDER,
  COLOR_PLACEHOLDER,
  EMPTY_PET_FORM,
  GENDER_OPTIONS,
  buildPetPayload,
  type PetFormValues,
} from "@/lib/pet-form"

const TOTAL_STEPS = 5

const STEP_TITLES: Record<number, { headline: string; sub: (name: string) => string }> = {
  1: { headline: "Ko je tvoj ljubimac?",   sub: () => "Napiši ime i izaberi vrstu." },
  2: { headline: "Dodaj fotografiju",      sub: (n) => n ? `Pomaže veterinaru da prepozna ${n} na prvi pogled.` : "Pomaže veterinaru da ga prepozna na prvi pogled." },
  3: { headline: "Osnovni podaci",         sub: (n) => n ? `Par detalja o ${n}.` : "Par osnovnih detalja." },
  4: { headline: "Zdravstveni dokumenti",  sub: () => "Možeš dodati kasnije — veterinar će ovo videti na pregledu." },
  5: { headline: "Napomena za veterinara", sub: () => "Alergije, hronična stanja, ponašanje — sve što je bitno pre pregleda." },
}

const slideVariants = {
  enter:  (dir: 1 | -1) => ({ opacity: 0, x: dir === 1 ?  36 : -36, filter: "blur(4px)" }),
  center:                   { opacity: 1, x:  0,                    filter: "blur(0px)"  },
  exit:   (dir: 1 | -1) => ({ opacity: 0, x: dir === 1 ? -36 :  36, filter: "blur(4px)" }),
}

export function PetWizard() {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step,         setStep]         = useState<1 | 2 | 3 | 4 | 5>(1)
  const [direction,    setDirection]    = useState<1 | -1>(1)
  const [values,       setValues]       = useState<PetFormValues>(EMPTY_PET_FORM)
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  function update<K extends keyof PetFormValues>(key: K, v: PetFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: v }))
  }

  // ─── Navigation ──────────────────────────────────────────────────────────
  function goNext() {
    if (step >= TOTAL_STEPS) return
    setDirection(1)
    setStep((s) => (s + 1) as typeof step)
  }

  function goBack() {
    if (step === 1) { router.back(); return }
    setDirection(-1)
    setStep((s) => (s - 1) as typeof step)
  }

  // Step 1 requires a name; vrsta always has a default so it's implicit.
  const canAdvance = step === 1 ? values.name.trim().length > 0 : true

  // ─── Photo handlers ──────────────────────────────────────────────────────
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError("Slika je prevelika (max 5MB)."); return }
    setError(null)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function clearPhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ─── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Morate biti prijavljeni."); setSaving(false); return }

    const { data: inserted, error: insertError } = await supabase
      .from("pets")
      .insert({ owner_id: user.id, ...buildPetPayload(values) })
      .select("id")
      .single()

    if (insertError || !inserted) {
      setError("Greška pri dodavanju ljubimca.")
      setSaving(false)
      return
    }

    // Photo upload is best-effort: a failed upload shouldn't lose the pet.
    if (photoFile) {
      const ext  = photoFile.name.split(".").pop() ?? "jpg"
      const path = `${inserted.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from("pet-photos")
        .upload(path, photoFile, { cacheControl: "3600", upsert: true })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from("pet-photos").getPublicUrl(path)
        await supabase.from("pets").update({ photo_url: publicUrl }).eq("id", inserted.id)
      }
    }

    // Land on the pet profile, not the list — more rewarding, and naturally
    // the next thing the owner wants to do (add details / connect to clinic).
    router.push(`/klijent/ljubimci/${inserted.id}/uredi`)
    router.refresh()
  }

  const speciesImage  = SPECIES_IMAGE[values.species] ?? SPECIES_IMAGE.other
  const displayPhoto  = photoPreview
  const headline      = STEP_TITLES[step].headline
  const subline       = STEP_TITLES[step].sub(values.name.trim())
  const primaryLabel  = useMemo(() => {
    if (step === TOTAL_STEPS) return saving ? "Dodavanje..." : "Dodaj ljubimca"
    return "Dalje"
  }, [step, saving])

  return (
    <div className="space-y-5">
      {/* ─── Top bar: back + segmented progress ──────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          className="back-link flex items-center justify-center shrink-0"
          style={{ fontWeight: 600, width: 32, height: 32 }}
          aria-label="Nazad"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>

        <div className="flex-1 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
            const done    = n < step
            const current = n === step
            return (
              <div
                key={n}
                className="flex-1 rounded-full"
                style={{
                  height: 4,
                  background:
                    done || current ? "var(--brand)" : "var(--border)",
                  opacity: current ? 1 : done ? 0.9 : 1,
                  transition: "background 0.3s ease, opacity 0.3s ease",
                }}
              />
            )
          })}
        </div>

        <span className="text-xs shrink-0" style={{ color: "var(--text-muted)", fontWeight: 600 }}>
          {step}/{TOTAL_STEPS}
        </span>
      </div>

      {/* ─── Step headline ───────────────────────────────────────────── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`title-${step}`}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="space-y-1"
        >
          <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>
            {headline}
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {subline}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* ─── Step content ───────────────────────────────────────────── */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={`step-${step}`}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {step === 1 && (
            <StepIdentity
              values={values}
              update={update}
            />
          )}
          {step === 2 && (
            <StepPhoto
              name={values.name}
              speciesImage={speciesImage}
              displayPhoto={displayPhoto}
              onPick={() => fileInputRef.current?.click()}
              onClear={clearPhoto}
            />
          )}
          {step === 3 && (
            <StepBasics
              values={values}
              update={update}
            />
          )}
          {step === 4 && (
            <StepDocs
              values={values}
              update={update}
            />
          )}
          {step === 5 && (
            <StepNotes
              values={values}
              update={update}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Hidden file input (shared across renders). */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      {error && (
        <p className="text-sm px-1" style={{ color: "var(--red)", fontWeight: 500 }}>
          {error}
        </p>
      )}

      {/* ─── CTA row ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-1">
        {step > 1 && step < TOTAL_STEPS && (
          <button
            type="button"
            onClick={goNext}
            className="text-sm px-3 py-2 rounded-xl shrink-0"
            style={{
              color: "var(--text-muted)",
              fontWeight: 600,
              background: "transparent",
            }}
          >
            Preskoči
          </button>
        )}

        <motion.div whileHover={{ scale: canAdvance ? 1.02 : 1 }} whileTap={{ scale: canAdvance ? 0.97 : 1 }} className="flex-1">
          <button
            type="button"
            onClick={step === TOTAL_STEPS ? handleSave : goNext}
            disabled={!canAdvance || saving}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
            style={{ fontWeight: 600 }}
          >
            {step === TOTAL_STEPS
              ? <Check size={16} strokeWidth={2.5} />
              : null
            }
            {primaryLabel}
            {step !== TOTAL_STEPS && <ArrowRight size={16} strokeWidth={2.25} />}
          </button>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Step components ────────────────────────────────────────────────────────

function StepIdentity({
  values, update,
}: {
  values: PetFormValues
  update: <K extends keyof PetFormValues>(key: K, v: PetFormValues[K]) => void
}) {
  return (
    <div className="solid-card rounded-2xl p-5 space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-xs" style={{ fontWeight: 600 }}>Ime *</Label>
        <Input
          id="name"
          autoFocus
          placeholder="npr. Bobi"
          value={values.name}
          onChange={(e) => update("name", e.target.value)}
          className="h-11 text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" style={{ fontWeight: 600 }}>Vrsta *</Label>
        <div className="grid grid-cols-4 gap-2">
          {SPECIES_OPTIONS.map((opt) => {
            const selected = values.species === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("species", opt.value)}
                className="py-3 rounded-xl text-sm transition-all flex flex-col items-center gap-1.5"
                style={{
                  fontWeight: 600,
                  background: selected ? "var(--brand-tint)"       : "var(--surface-raised)",
                  color:      selected ? "var(--brand)"            : "var(--text-secondary)",
                  border:     selected ? "1px solid rgba(43,181,160,0.35)" : "1px solid var(--border)",
                  transform:  selected ? "scale(1.03)"             : "scale(1)",
                  boxShadow:  selected ? "0 4px 14px rgba(43,181,160,0.18)" : "none",
                }}
              >
                <Image
                  src={opt.image}
                  alt=""
                  width={44}
                  height={44}
                  className="object-contain"
                  style={{ height: 44, width: 44 }}
                />
                <span className="text-[11px]">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StepPhoto({
  name, speciesImage, displayPhoto, onPick, onClear,
}: {
  name: string
  speciesImage: string
  displayPhoto: string | null
  onPick: () => void
  onClear: () => void
}) {
  return (
    <div className="solid-card rounded-2xl p-6 flex flex-col items-center gap-4">
      <div className="relative">
        {displayPhoto ? (
          <div
            className="relative overflow-hidden"
            style={{
              width: 140, height: 140, borderRadius: "50%",
              border: "3px solid var(--brand)",
              boxShadow: "0 8px 28px rgba(43,181,160,0.22)",
            }}
          >
            <Image src={displayPhoto} alt={name || "Ljubimac"} fill className="object-cover" />
            <button
              type="button"
              onClick={onClear}
              className="absolute top-1 right-1 p-1.5 rounded-full"
              style={{
                background: "var(--red)", color: "#fff",
                boxShadow: "0 2px 8px rgba(220,38,38,0.35)",
              }}
              aria-label="Ukloni fotografiju"
            >
              <XIcon size={13} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="relative flex items-center justify-center select-none overflow-hidden"
            style={{
              width: 140, height: 140, borderRadius: "50%",
              background: "var(--surface-raised)",
              border: "3px dashed var(--border-strong)",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
          >
            <Image
              src={speciesImage}
              alt=""
              fill
              sizes="140px"
              className="object-contain"
              style={{ padding: 18, opacity: 0.85 }}
            />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onPick}
        className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-2"
        style={{
          fontWeight: 600, color: "var(--brand)",
          background: "var(--brand-tint)",
          border: "1px solid rgba(43,181,160,0.2)",
          transition: "all 0.2s ease",
        }}
      >
        <Camera size={14} strokeWidth={2} />
        {displayPhoto ? "Promeni fotografiju" : "Izaberi sa uređaja"}
      </button>

      <p className="text-xs text-center" style={{ color: "var(--text-muted)", maxWidth: 280 }}>
        JPG, PNG ili WebP, do 5MB. Fotografiju uvek možeš promeniti kasnije.
      </p>
    </div>
  )
}

function StepBasics({
  values, update,
}: {
  values: PetFormValues
  update: <K extends keyof PetFormValues>(key: K, v: PetFormValues[K]) => void
}) {
  return (
    <div className="solid-card rounded-2xl p-5 space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs" style={{ fontWeight: 600 }}>Pol</Label>
        <div className="grid grid-cols-3 gap-2">
          {GENDER_OPTIONS.map((opt) => {
            const selected = values.gender === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("gender", opt.value)}
                className="py-2.5 rounded-xl text-sm transition-all"
                style={{
                  fontWeight: 600,
                  background: selected ? "var(--brand-tint)"       : "var(--surface-raised)",
                  color:      selected ? "var(--brand)"            : "var(--text-secondary)",
                  border:     selected ? "1px solid rgba(43,181,160,0.3)" : "1px solid var(--border)",
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="birth" className="text-xs" style={{ fontWeight: 600 }}>
          Datum rođenja <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opciono)</span>
        </Label>
        <Input
          id="birth"
          type="date"
          value={values.birthDate}
          onChange={(e) => update("birthDate", e.target.value)}
          className="h-11 text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="breed" className="text-xs" style={{ fontWeight: 600 }}>
          Rasa <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opciono)</span>
        </Label>
        <Input
          id="breed"
          placeholder={BREED_PLACEHOLDER[values.species]}
          value={values.breed}
          onChange={(e) => update("breed", e.target.value)}
          className="h-11 text-base"
        />
      </div>
    </div>
  )
}

function StepDocs({
  values, update,
}: {
  values: PetFormValues
  update: <K extends keyof PetFormValues>(key: K, v: PetFormValues[K]) => void
}) {
  return (
    <div className="solid-card rounded-2xl p-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="weight" className="text-xs" style={{ fontWeight: 600 }}>Težina (kg)</Label>
          <Input
            id="weight"
            type="number"
            step="0.1"
            min="0"
            placeholder="npr. 8.5"
            value={values.weightKg}
            onChange={(e) => update("weightKg", e.target.value)}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="color" className="text-xs" style={{ fontWeight: 600 }}>Boja</Label>
          <Input
            id="color"
            placeholder={COLOR_PLACEHOLDER[values.species]}
            value={values.color}
            onChange={(e) => update("color", e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="chip" className="text-xs" style={{ fontWeight: 600 }}>Broj mikročipa</Label>
          <Input
            id="chip"
            placeholder="688038..."
            value={values.chipId}
            onChange={(e) => update("chipId", e.target.value)}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="passport" className="text-xs" style={{ fontWeight: 600 }}>Broj pasoša</Label>
          <Input
            id="passport"
            placeholder="RS-123456"
            value={values.passportNumber}
            onChange={(e) => update("passportNumber", e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>
    </div>
  )
}

function StepNotes({
  values, update,
}: {
  values: PetFormValues
  update: <K extends keyof PetFormValues>(key: K, v: PetFormValues[K]) => void
}) {
  return (
    <div className="solid-card rounded-2xl p-5 space-y-3">
      <textarea
        className="w-full min-h-[140px] rounded-xl text-sm resize-y px-3 py-2.5"
        style={{
          background: "var(--surface-raised)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          lineHeight: 1.6,
          fontFamily: "inherit",
        }}
        placeholder="npr. Alergija na piletinu. Boji se grmljavine. Ima hronični artritis zadnjih nogu..."
        value={values.petNotes}
        onChange={(e) => update("petNotes", e.target.value)}
      />
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Veterinar vidi ovu napomenu na profilu ljubimca pri svakom pregledu.
      </p>
    </div>
  )
}
