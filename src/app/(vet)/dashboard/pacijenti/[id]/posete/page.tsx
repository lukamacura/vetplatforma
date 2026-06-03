"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { VisitTimeline } from "../visit-timeline"

export default function PetVisitsPage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.id as string
  const [petName, setPetName] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase.from("pets").select("name").eq("id", petId).single()
      setPetName(data?.name ?? null)
    }
    load()
  }, [petId])

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5 w-full"
    >
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/pacijenti/${petId}`)}
          className="back-link flex items-center gap-1.5 text-xs mb-3"
          style={{ fontWeight: 600 }}
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Nazad na profil
        </button>
        <h1 className="text-lg" style={{ fontWeight: 700 }}>
          Sve posete{petName ? ` · ${petName}` : ""}
        </h1>
      </motion.div>

      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5 w-full">
        <VisitTimeline petId={petId} />
      </motion.div>
    </motion.div>
  )
}
