"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, PawPrint } from "lucide-react"
import { motion } from "framer-motion"
import { PetCard } from "@/components/ui/pet-card"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
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
        .select("id, owner_id, name, species, breed, birth_date, weight_kg, next_vaccine_date, next_control_date, chip_id, passport_number, gender, color, photo_url, owner_notes, vaccine_note, created_at")
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
            className="h-40 rounded-2xl animate-pulse"
            style={{ background: "var(--surface-raised)" }}
          />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      <motion.div variants={stagger.item} className="flex items-center justify-between">
        <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>
          Moji ljubimci
        </h1>
        <Link href="/klijent/ljubimci/novi">
          <button className="btn-primary px-4 py-2 text-sm">
            <Plus size={15} strokeWidth={2} />
            Dodaj
          </button>
        </Link>
      </motion.div>

      {pets.length === 0 ? (
        <motion.div variants={stagger.item}>
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              background: "linear-gradient(135deg, var(--blue-tint) 0%, #EFF6FF 100%)",
              border: "1px solid rgba(37,99,235,0.12)",
            }}
          >
            <div className="icon-lg icon-blue mx-auto mb-4">
              <PawPrint size={24} strokeWidth={1.75} />
            </div>
            <p className="text-sm" style={{ fontWeight: 600 }}>Još nema dodanih ljubimaca</p>
            <p className="text-xs mt-1 mb-5" style={{ color: "var(--text-muted)" }}>
              Dodajte prvog ljubimca da pratite vakcinacije i preglede.
            </p>
            <Link href="/klijent/ljubimci/novi">
              <button className="btn-primary px-6 py-2.5 text-sm">
                Dodaj prvog ljubimca
              </button>
            </Link>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pets.map((pet) => (
            <motion.div key={pet.id} variants={stagger.item}>
              <PetCard
                pet={pet}
                variant="owner"
                onClick={() => router.push(`/klijent/ljubimci/${pet.id}/uredi`)}
              />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
