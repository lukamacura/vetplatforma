"use client"

/**
 * Vet-side "Dodaj klijenta" — create a managed pet-owner (name + phone) and
 * one or more pets in a single submission. A flat form (not the owner-side
 * 5-step wizard): the vet wants speed and to see everything at once.
 *
 * Photo upload is intentionally omitted here — the vet can add a photo later
 * from the pet profile. See actions.ts for the server-side account creation.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Plus, Trash2, Check, UserPlus, PawPrint, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SPECIES_OPTIONS } from "@/lib/species"
import {
  BREED_PLACEHOLDER,
  COLOR_PLACEHOLDER,
  EMPTY_PET_FORM,
  GENDER_OPTIONS,
  type PetFormValues,
} from "@/lib/pet-form"
import { createManagedClient } from "./actions"

export function NewClientForm() {
  const router = useRouter()

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [pets, setPets] = useState<PetFormValues[]>([{ ...EMPTY_PET_FORM }])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updatePet<K extends keyof PetFormValues>(index: number, key: K, value: PetFormValues[K]) {
    setPets((prev) => prev.map((p, i) => (i === index ? { ...p, [key]: value } : p)))
  }

  function addPet() {
    setPets((prev) => [...prev, { ...EMPTY_PET_FORM }])
  }

  function removePet(index: number) {
    setPets((prev) => prev.filter((_, i) => i !== index))
  }

  const canSubmit = fullName.trim().length > 0 && phone.trim().length > 0 && !saving && !done

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError(null)

    try {
      const result = await createManagedClient({ fullName, phone, pets })

      if (!result.ok) {
        setError(result.error)
        setSaving(false)
        return
      }

      // Hold a success state through the navigation so the button doesn't flash
      // back to its idle label. The action already revalidated the list cache.
      setDone(true)
      router.push("/dashboard/pacijenti")
    } catch (err) {
      console.error("createManagedClient failed", err)
      setError("Došlo je do greške. Pokušajte ponovo.")
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto space-y-5">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="back-link flex items-center justify-center shrink-0"
          style={{ fontWeight: 600, width: 32, height: 32 }}
          aria-label="Nazad"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-2xl">Dodaj klijenta</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Kreirajte nalog za vlasnika i njegove ljubimce.
          </p>
        </div>
      </div>

      {/* ── Owner details ──────────────────────────────────────────────── */}
      <div className="solid-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="icon-sm icon-brand">
            <UserPlus size={14} strokeWidth={2} />
          </div>
          <span className="text-sm" style={{ fontWeight: 650 }}>Vlasnik</span>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fullName" className="text-xs" style={{ fontWeight: 600 }}>Ime i prezime *</Label>
          <Input
            id="fullName"
            autoFocus
            placeholder="npr. Marko Marković"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone" className="text-xs" style={{ fontWeight: 600 }}>Telefon *</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="06x xxx xxxx"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      {/* ── Pets ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1">
        <div className="icon-sm icon-brand">
          <PawPrint size={14} strokeWidth={2} />
        </div>
        <span className="text-sm" style={{ fontWeight: 650 }}>Ljubimci</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          (opciono — možete dodati i kasnije)
        </span>
      </div>

      {pets.map((pet, index) => (
        <PetSubCard
          key={index}
          index={index}
          values={pet}
          canRemove={pets.length > 1}
          onUpdate={updatePet}
          onRemove={() => removePet(index)}
        />
      ))}

      <button
        type="button"
        onClick={addPet}
        className="flex items-center gap-1.5 text-sm rounded-xl px-3 py-2.5 w-full justify-center"
        style={{
          fontWeight: 600,
          color: "var(--brand)",
          background: "var(--brand-tint)",
          border: "1px dashed rgba(43,181,160,0.4)",
          transition: "all 0.2s ease",
        }}
      >
        <Plus size={16} strokeWidth={2.25} />
        Dodaj još jednog ljubimca
      </button>

      {error && (
        <p className="text-sm px-1" style={{ color: "var(--red)", fontWeight: 500 }} role="alert">
          {error}
        </p>
      )}

      {/* ── Submit ─────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
        style={{ fontWeight: 600 }}
      >
        {done ? (
          <><Check size={16} strokeWidth={2.5} /> Sačuvano</>
        ) : saving ? (
          <><Loader2 size={16} strokeWidth={2.5} className="animate-spin" /> Čuvanje...</>
        ) : (
          <><Check size={16} strokeWidth={2.5} /> Sačuvaj klijenta</>
        )}
      </button>
    </form>
  )
}

// ─── Pet sub-card ─────────────────────────────────────────────────────────

function PetSubCard({
  index, values, canRemove, onUpdate, onRemove,
}: {
  index: number
  values: PetFormValues
  canRemove: boolean
  onUpdate: <K extends keyof PetFormValues>(index: number, key: K, value: PetFormValues[K]) => void
  onRemove: () => void
}) {
  const set = <K extends keyof PetFormValues>(key: K, value: PetFormValues[K]) => onUpdate(index, key, value)

  return (
    <div className="solid-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em" }}>
          Ljubimac {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex items-center gap-1 text-xs rounded-lg px-2 py-1"
            style={{ color: "var(--red)", fontWeight: 600 }}
            aria-label="Ukloni ljubimca"
          >
            <Trash2 size={13} strokeWidth={2} />
            Ukloni
          </button>
        )}
      </div>

      {/* Name + species */}
      <div className="space-y-1.5">
        <Label className="text-xs" style={{ fontWeight: 600 }}>Ime *</Label>
        <Input
          placeholder="npr. Bobi"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
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
                onClick={() => set("species", opt.value)}
                className="py-3 rounded-xl text-sm transition-all flex flex-col items-center gap-1.5"
                style={{
                  fontWeight: 600,
                  background: selected ? "var(--brand-tint)" : "var(--surface-raised)",
                  color: selected ? "var(--brand)" : "var(--text-secondary)",
                  border: selected ? "1px solid rgba(43,181,160,0.35)" : "1px solid var(--border)",
                  transform: selected ? "scale(1.03)" : "scale(1)",
                  boxShadow: selected ? "0 4px 14px rgba(43,181,160,0.18)" : "none",
                }}
              >
                <Image src={opt.image} alt="" width={40} height={40} className="object-contain" style={{ height: 40, width: 40 }} />
                <span className="text-[11px]">{opt.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-1.5">
        <Label className="text-xs" style={{ fontWeight: 600 }}>Pol</Label>
        <div className="grid grid-cols-3 gap-2">
          {GENDER_OPTIONS.map((opt) => {
            const selected = values.gender === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("gender", opt.value)}
                className="py-2.5 rounded-xl text-sm transition-all"
                style={{
                  fontWeight: 600,
                  background: selected ? "var(--brand-tint)" : "var(--surface-raised)",
                  color: selected ? "var(--brand)" : "var(--text-secondary)",
                  border: selected ? "1px solid rgba(43,181,160,0.3)" : "1px solid var(--border)",
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Breed + birth date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ fontWeight: 600 }}>
            Rasa <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opciono)</span>
          </Label>
          <Input
            placeholder={BREED_PLACEHOLDER[values.species]}
            value={values.breed}
            onChange={(e) => set("breed", e.target.value)}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ fontWeight: 600 }}>
            Datum rođenja <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opciono)</span>
          </Label>
          <Input
            type="date"
            value={values.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      {/* Weight + chip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ fontWeight: 600 }}>Težina (kg)</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            placeholder="npr. 8.5"
            value={values.weightKg}
            onChange={(e) => set("weightKg", e.target.value)}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ fontWeight: 600 }}>Broj mikročipa</Label>
          <Input
            placeholder="688038..."
            value={values.chipId}
            onChange={(e) => set("chipId", e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      {/* Color + passport */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ fontWeight: 600 }}>Boja</Label>
          <Input
            placeholder={COLOR_PLACEHOLDER[values.species]}
            value={values.color}
            onChange={(e) => set("color", e.target.value)}
            className="h-11 text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs" style={{ fontWeight: 600 }}>Broj pasoša</Label>
          <Input
            placeholder="RS-123456"
            value={values.passportNumber}
            onChange={(e) => set("passportNumber", e.target.value)}
            className="h-11 text-base"
          />
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label className="text-xs" style={{ fontWeight: 600 }}>
          Napomena za veterinara <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opciono)</span>
        </Label>
        <textarea
          className="w-full min-h-[90px] rounded-xl text-sm resize-y px-3 py-2.5"
          style={{
            background: "var(--surface-raised)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            lineHeight: 1.6,
            fontFamily: "inherit",
          }}
          placeholder="Alergije, hronična stanja, ponašanje..."
          value={values.petNotes}
          onChange={(e) => set("petNotes", e.target.value)}
        />
      </div>
    </div>
  )
}
