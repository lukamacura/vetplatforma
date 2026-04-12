"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { Species, Gender } from "@/lib/types"

const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: "dog", label: "🐶 Pas" },
  { value: "cat", label: "🐱 Mačka" },
  { value: "bird", label: "🐦 Ptica" },
  { value: "other", label: "🐾 Ostalo" },
]

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Muški" },
  { value: "female", label: "Ženski" },
  { value: "unknown", label: "Nepoznat" },
]

export default function NewPetPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [species, setSpecies] = useState<Species>("dog")
  const [breed, setBreed] = useState("")
  const [gender, setGender] = useState<Gender>("unknown")
  const [chipId, setChipId] = useState("")
  const [passportNumber, setPassportNumber] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [color, setColor] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: insertError } = await supabase.from("pets").insert({
      owner_id: user.id,
      name: name.trim(),
      species,
      breed: breed.trim() || null,
      gender,
      chip_id: chipId.trim() || null,
      passport_number: passportNumber.trim() || null,
      birth_date: birthDate || null,
      color: color.trim() || null,
      weight_kg: weightKg ? parseFloat(weightKg) : null,
    })

    if (insertError) {
      setError("Greška pri dodavanju ljubimca.")
      setSaving(false)
      return
    }

    router.push("/klijent/ljubimci")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Novi ljubimac</h1>
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
                    className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      species === opt.value
                        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                        : "border-input hover:bg-muted"
                    }`}
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
                    className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                      gender === opt.value
                        ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                        : "border-input hover:bg-muted"
                    }`}
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

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white"
            >
              {saving ? "Dodavanje..." : "Dodaj ljubimca"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
