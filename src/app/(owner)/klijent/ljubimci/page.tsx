"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus, PawPrint } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PetCard } from "@/components/ui/pet-card"
import { createClient } from "@/lib/supabase/client"
import type { Pet } from "@/lib/types"

export default function MyPetsPage() {
  const router = useRouter()
  const [pets, setPets] = useState<Pet[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from("pets")
        .select("id, owner_id, name, species, breed, birth_date, weight_kg, next_vaccine_date, next_control_date, chip_id, passport_number, gender, color, owner_notes, vaccine_note, created_at")
        .eq("owner_id", user.id)
        .order("name")
      setPets((data as Pet[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3 pt-2">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl animate-pulse"
            style={{ background: "var(--surface-raised)" }}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Moji ljubimci</h1>
        <Link href="/klijent/ljubimci/novi">
          <Button size="sm" style={{ background: "var(--brand)", color: "#fff", border: "none" }}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj
          </Button>
        </Link>
      </div>

      {pets.length === 0 ? (
        <div
          className="solid-card rounded-2xl py-16 text-center"
        >
          <div className="icon-lg icon-brand mx-auto mb-4">
            <PawPrint size={24} strokeWidth={1.75} />
          </div>
          <p className="text-sm font-semibold mb-1">Još nema dodanih ljubimaca</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
            Dodajte prvog ljubimca da biste pratili vakcinacije i preglede.
          </p>
          <Link href="/klijent/ljubimci/novi">
            <Button style={{ background: "var(--brand)", color: "#fff", border: "none" }}>
              Dodaj prvog ljubimca
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pets.map((pet) => (
            <PetCard
              key={pet.id}
              pet={pet}
              variant="owner"
              onClick={() => router.push(`/klijent/ljubimci/${pet.id}/uredi`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
