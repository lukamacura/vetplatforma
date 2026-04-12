"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, UserPlus, Phone, PawPrint, Copy, Check, Users } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import type { Pet, Profile } from "@/lib/types"

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}

interface ClientWithPets {
  owner: Profile & { connected_at: string }
  pets: Pet[]
}

/* ── Pet chip — color encodes health status ── */
function PetChip({ pet, onClick }: { pet: Pet; onClick: () => void }) {
  const isOverdue =
    (pet.next_vaccine_date && new Date(pet.next_vaccine_date) < new Date()) ||
    (pet.next_control_date && new Date(pet.next_control_date) < new Date())

  const hasUpcoming =
    !isOverdue &&
    (pet.next_vaccine_date || pet.next_control_date)

  // red = overdue, amber = upcoming, green = scheduled & ok, muted = no dates set
  const cls = isOverdue
    ? "badge badge-red"
    : hasUpcoming
    ? "badge badge-amber"
    : pet.next_vaccine_date || pet.next_control_date
    ? "badge badge-green"
    : "badge badge-muted"

  return (
    <motion.button
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 22 }}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cls}
    >
      {isOverdue && <span className="pulse-dot" />}
      <span>{SPECIES_EMOJI[pet.species]}</span>
      {pet.name}
    </motion.button>
  )
}

/* ── Copy-link button ── */
function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
        <Button
          size="sm"
          onClick={handleCopy}
          className="gap-2 text-white font-600"
          style={{
            background:   copied ? "var(--green)"  : "var(--brand)",
            border:       "none",
            fontWeight:   600,
            transition:   "background .2s",
          }}
        >
          {copied ? (
            <><Check size={14} strokeWidth={2.5} /> Kopirano!</>
          ) : (
            <><Copy size={14} strokeWidth={1.75} /><UserPlus size={14} strokeWidth={1.75} /> Pozovi klijente</>
          )}
        </Button>
      </motion.div>
      <span className="text-xs font-mono truncate max-w-64" style={{ color: "var(--text-muted)" }}>
        {url}
      </span>
    </div>
  )
}

/* ── Client card ── */
function ClientCard({ owner, pets, index }: {
  owner: ClientWithPets["owner"]
  pets: Pet[]
  index: number
}) {
  const router = useRouter()
  const hasOverdue = pets.some(
    (p) =>
      (p.next_vaccine_date && new Date(p.next_vaccine_date) < new Date()) ||
      (p.next_control_date && new Date(p.next_control_date) < new Date())
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.24 }}
      whileHover={{ y: -2, boxShadow: "0 6px 22px rgba(0,0,0,0.08)" }}
      className="solid-card rounded-2xl p-4"
      style={{ transition: "box-shadow .2s, transform .2s" }}
    >
      <div className="flex items-start gap-3.5">
        {/* Avatar — red ring if any pet is overdue */}
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-700"
          style={{
            background: hasOverdue ? "var(--red-tint)"   : "var(--brand-tint)",
            color:      hasOverdue ? "var(--red)"        : "var(--brand)",
            fontWeight: 700,
            outline: hasOverdue ? "2px solid var(--red)" : "none",
            outlineOffset: 2,
          }}
        >
          {owner.full_name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-600" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
              {owner.full_name || "—"}
            </span>
            {owner.phone && (
              <span className="badge badge-muted" style={{ gap: 4 }}>
                <Phone size={10} strokeWidth={2} />
                {owner.phone}
              </span>
            )}
            <span className="text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
              od{" "}
              {new Date(owner.connected_at).toLocaleDateString("en-GB")}
            </span>
          </div>

          {pets.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {pets.map((pet) => (
                <PetChip
                  key={pet.id}
                  pet={pet}
                  onClick={() => router.push(`/dashboard/pacijenti/${pet.id}`)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
              Nema dodanih ljubimaca
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ── Page ── */
export default function PatientsPage() {
  const [clients,    setClients]    = useState<ClientWithPets[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [clinicSlug, setClinicSlug] = useState<string | null>(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles").select("clinic_id").eq("id", user.id).single()

      let clinicId = profile?.clinic_id
      if (!clinicId) {
        const { data: ownedClinic } = await supabase
          .from("clinics").select("id, slug").eq("owner_id", user.id).single()
        if (!ownedClinic) { setLoading(false); return }
        clinicId = ownedClinic.id
        setClinicSlug(ownedClinic.slug)
        await supabase.from("profiles").update({ clinic_id: clinicId }).eq("id", user.id)
      } else {
        const { data: clinic } = await supabase
          .from("clinics").select("slug").eq("id", clinicId).single()
        setClinicSlug(clinic?.slug ?? null)
      }

      const { data: connections } = await supabase
        .from("connections")
        .select("owner_id, connected_at")
        .eq("clinic_id", clinicId)
        .order("connected_at", { ascending: false })

      if (!connections?.length) { setLoading(false); return }

      const ownerIds = connections.map((c) => c.owner_id)
      const [{ data: profiles }, { data: petsData }] = await Promise.all([
        supabase.from("profiles").select("*").in("id", ownerIds),
        supabase.from("pets").select("*").in("owner_id", ownerIds).order("name"),
      ])

      const profileMap   = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
      const petsByOwner: Record<string, Pet[]> = {}
      for (const pet of petsData ?? []) {
        if (!petsByOwner[pet.owner_id]) petsByOwner[pet.owner_id] = []
        petsByOwner[pet.owner_id].push(pet)
      }

      setClients(connections.map((c) => ({
        owner: {
          id:          c.owner_id,
          role:        "owner" as const,
          full_name:   profileMap[c.owner_id]?.full_name ?? "—",
          phone:       profileMap[c.owner_id]?.phone     ?? null,
          clinic_id:   null,
          created_at:  profileMap[c.owner_id]?.created_at ?? c.connected_at,
          connected_at: c.connected_at,
        },
        pets: petsByOwner[c.owner_id] ?? [],
      })))
      setLoading(false)
    }
    load()
  }, [])

  const filtered = clients.filter((c) => {
    const q = searchTerm.toLowerCase()
    return (
      c.owner.full_name?.toLowerCase().includes(q) ||
      c.owner.phone?.toLowerCase().includes(q) ||
      c.pets.some((p) => p.name.toLowerCase().includes(q))
    )
  })

  const joinUrl = clinicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${clinicSlug}`
    : null

  const totalPets  = clients.reduce((n, c) => n + c.pets.length, 0)
  const overdueCount = clients.reduce((n, c) => n + c.pets.filter(
    (p) =>
      (p.next_vaccine_date && new Date(p.next_vaccine_date) < new Date()) ||
      (p.next_control_date && new Date(p.next_control_date) < new Date())
  ).length, 0)

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl">Povezani klijenti</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {!loading && clients.length > 0 && (
              <>
                <span className="badge badge-brand">
                  <Users size={10} strokeWidth={2} />
                  {clients.length} {clients.length === 1 ? "klijent" : clients.length < 5 ? "klijenta" : "klijenata"}
                </span>
                <span className="badge badge-muted">
                  <PawPrint size={10} strokeWidth={2} />
                  {totalPets} ljubimaca
                </span>
                {overdueCount > 0 && (
                  <span className="badge badge-red">
                    <span className="pulse-dot" />
                    {overdueCount} {overdueCount === 1 ? "zakasneli" : "zakasnelih"}
                  </span>
                )}
              </>
            )}
            {loading && (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>Učitavanje...</span>
            )}
          </div>
        </div>
        {joinUrl && <CopyLinkButton url={joinUrl} />}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative max-w-sm"
      >
        <Search
          size={14}
          strokeWidth={2}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <Input
          placeholder="Pretraži po imenu, telefonu ili ljubimcu..."
          className="pl-9"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </motion.div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-2xl animate-pulse"
              style={{ background: "var(--surface-raised)" }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="solid-card rounded-2xl py-20 text-center"
        >
          <div className="icon-lg icon-brand mx-auto mb-4">
            <PawPrint size={24} strokeWidth={1.75} />
          </div>
          <p className="font-600 text-sm mb-1" style={{ fontWeight: 600 }}>
            {clients.length === 0 ? "Još nema povezanih klijenata" : "Nema rezultata pretrage"}
          </p>
          {clients.length === 0 && joinUrl && (
            <p className="text-xs max-w-xs mx-auto mt-1" style={{ color: "var(--text-muted)" }}>
              Podelite link sa vlasnicima — oni sami povežu profil i dodaju ljubimce.
            </p>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-2.5">
            {filtered.map(({ owner, pets }, i) => (
              <ClientCard key={owner.id} owner={owner} pets={pets} index={i} />
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
