"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { Species, Gender, Pet } from "@/lib/types"

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog",   label: "🐶 Pas"   },
  { value: "cat",   label: "🐱 Mačka" },
  { value: "bird",  label: "🐦 Ptica" },
  { value: "other", label: "🐾 Ostalo" },
]

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male",    label: "Muški"    },
  { value: "female",  label: "Ženski"   },
  { value: "unknown", label: "Nepoznat" },
]

export default function EditPetPage() {
  const router = useRouter()
  const params = useParams()
  const petId  = params.id as string

  const [name,           setName]           = useState("")
  const [species,        setSpecies]        = useState<Species>("dog")
  const [breed,          setBreed]          = useState("")
  const [gender,         setGender]         = useState<Gender>("unknown")
  const [chipId,         setChipId]         = useState("")
  const [passportNumber, setPassportNumber] = useState("")
  const [birthDate,      setBirthDate]      = useState("")
  const [color,          setColor]          = useState("")
  const [weightKg,       setWeightKg]       = useState("")
  const [ownerNotes,     setOwnerNotes]     = useState("")
  const [saving,         setSaving]         = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from("pets")
        .select("id, name, species, breed, gender, chip_id, passport_number, birth_date, color, weight_kg, owner_notes")
        .eq("id", petId)
        .eq("owner_id", user.id)
        .single()

      if (!data) { router.push("/klijent/ljubimci"); return }

      const pet = data as Omit<Pet, "owner_id" | "next_vaccine_date" | "next_control_date" | "vet_notes" | "vaccine_note" | "created_at">
      setName(pet.name)
      setSpecies(pet.species)
      setBreed(pet.breed ?? "")
      setGender((pet.gender as Gender) ?? "unknown")
      setChipId(pet.chip_id ?? "")
      setPassportNumber(pet.passport_number ?? "")
      setBirthDate(pet.birth_date ?? "")
      setColor(pet.color ?? "")
      setWeightKg(pet.weight_kg !== null ? String(pet.weight_kg) : "")
      setOwnerNotes(pet.owner_notes ?? "")
      setLoading(false)
    }
    load()
  }, [petId, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: updateError } = await supabase
      .from("pets")
      .update({
        name:            name.trim(),
        species,
        breed:           breed.trim() || null,
        gender,
        chip_id:         chipId.trim() || null,
        passport_number: passportNumber.trim() || null,
        birth_date:      birthDate || null,
        color:           color.trim() || null,
        weight_kg:       weightKg ? parseFloat(weightKg) : null,
        owner_notes:     ownerNotes.trim() || null,
      })
      .eq("id", petId)
      .eq("owner_id", user.id)

    if (updateError) {
      setError("Greška pri čuvanju podataka.")
      setSaving(false)
      return
    }

    router.push("/klijent/ljubimci")
    router.refresh()
  }

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Uredi ljubimca</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Podaci o ljubimcu</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">

            {/* Ime */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Ime *</Label>
              <Input
                id="name"
                placeholder="npr. Bobi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Vrsta */}
            <div className="space-y-1.5">
              <Label>Vrsta *</Label>
              <div className="grid grid-cols-2 gap-2">
                {SPECIES_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSpecies(opt.value)}
                    className="py-2.5 rounded-lg border text-sm font-medium transition-colors"
                    style={{
                      background:  species === opt.value ? "var(--brand)" : "transparent",
                      color:       species === opt.value ? "#fff" : "var(--text-primary)",
                      borderColor: species === opt.value ? "var(--brand)" : "var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rasa */}
            <div className="space-y-1.5">
              <Label htmlFor="breed">Rasa</Label>
              <Input
                id="breed"
                placeholder="npr. Zlatni Retriver"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
              />
            </div>

            {/* Pol */}
            <div className="space-y-1.5">
              <Label>Pol *</Label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className="py-2.5 rounded-lg border text-sm font-medium transition-colors"
                    style={{
                      background:  gender === opt.value ? "var(--brand)" : "transparent",
                      color:       gender === opt.value ? "#fff" : "var(--text-primary)",
                      borderColor: gender === opt.value ? "var(--brand)" : "var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Broj mikročipa i pasosa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="chip">Broj mikročipa</Label>
                <Input
                  id="chip"
                  placeholder="npr. 688038000000000"
                  value={chipId}
                  onChange={(e) => setChipId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passport">Broj pasoša</Label>
                <Input
                  id="passport"
                  placeholder="npr. RS-123456"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Datum rođenja i boja */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birth">Datum rođenja</Label>
                <Input
                  id="birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color">Boja</Label>
                <Input
                  id="color"
                  placeholder="npr. Zlatna"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>

            {/* Težina */}
            <div className="space-y-1.5">
              <Label htmlFor="weight">Težina (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="npr. 8.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>

            {/* Napomena za veterinara */}
            <div className="space-y-1.5">
              <Label htmlFor="ownerNotes">Napomena za veterinara</Label>
              <textarea
                id="ownerNotes"
                className="w-full min-h-[100px] rounded-xl text-sm resize-y px-3 py-2"
                style={{
                  background: "var(--yellow-tint, #FEF9C3)",
                  color: "var(--text-primary)",
                  border: "1px solid rgba(234,179,8,0.2)",
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                }}
                placeholder="npr. alergije, hronična stanja, navike u ponašanju..."
                value={ownerNotes}
                onChange={(e) => setOwnerNotes(e.target.value)}
              />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Ova napomena je uvek vidljiva Vašem veterinaru.
              </p>
            </div>

            {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}

            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full"
              style={{ background: "var(--brand)", color: "#fff", border: "none" }}
            >
              {saving ? "Čuvanje..." : "Sačuvaj izmene"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
