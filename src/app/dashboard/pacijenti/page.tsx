"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  UserPlus,
  Phone,
  PawPrint,
  Copy,
  Check,
  Syringe,
  Stethoscope,
  ChevronRight,
  AlertCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import type { Pet, Profile, Species, Gender } from "@/lib/types"

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}
const SPECIES_LABEL: Record<Species, string> = {
  dog: "Pas", cat: "Mačka", bird: "Ptica", other: "Ostalo",
}
const GENDER_LABEL: Record<Gender, string> = {
  male: "M", female: "Ž", unknown: "",
}

interface PetRow {
  pet: Pet
  owner: Profile & { connected_at: string }
}

function ageLabelShort(birthDate: string | null): string | null {
  if (!birthDate) return null
  const b = new Date(birthDate + "T12:00:00")
  const today = new Date()
  let years = today.getFullYear() - b.getFullYear()
  const md = today.getMonth() - b.getMonth()
  if (md < 0 || (md === 0 && today.getDate() < b.getDate())) years--
  if (years < 1) {
    const months = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth())
    const m = Math.max(0, months)
    if (m === 0) return "<1m"
    return `${m}m`
  }
  return `${years}g`
}

function dateStatus(d: string | null): "overdue" | "soon" | "ok" | null {
  if (!d) return null
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "overdue"
  if (days <= 14) return "soon"
  return "ok"
}

function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString("sr-Latn-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  })
}

function StatusDot({ date, icon: Icon }: { date: string | null; icon: React.ElementType }) {
  const status = dateStatus(date)
  if (!status || !date) return null

  const cfg = {
    overdue: { cls: "badge badge-red", pulse: true },
    soon:    { cls: "badge badge-amber", pulse: false },
    ok:      { cls: "badge badge-green", pulse: false },
  }[status]

  return (
    <span className={cfg.cls} style={{ gap: 4, fontSize: 10 }}>
      {cfg.pulse && <span className="pulse-dot" />}
      <Icon size={10} strokeWidth={2.5} />
      {formatDateShort(date)}
    </span>
  )
}

type FilterMode = "all" | "overdue" | "upcoming" | "ok"

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
      <Button
        size="sm"
        onClick={handleCopy}
        className="gap-2 text-white font-600"
        style={{
          background: copied ? "var(--green)" : "var(--brand)",
          border: "none",
          fontWeight: 600,
          transition: "background .2s",
        }}
      >
        {copied ? (
          <><Check size={14} strokeWidth={2.5} /> Kopirano!</>
        ) : (
          <><Copy size={14} strokeWidth={1.75} /><UserPlus size={14} strokeWidth={1.75} /> Pozovi klijente</>
        )}
      </Button>
    </motion.div>
  )
}

function PetRowCard({ row, index, onClick }: { row: PetRow; index: number; onClick: () => void }) {
  const { pet, owner } = row
  const isOverdue =
    (pet.next_vaccine_date && new Date(pet.next_vaccine_date) < new Date()) ||
    (pet.next_control_date && new Date(pet.next_control_date) < new Date())

  const age = ageLabelShort(pet.birth_date)
  const genderStr = pet.gender ? GENDER_LABEL[pet.gender] : ""
  const subtitleParts = [SPECIES_LABEL[pet.species]]
  if (pet.breed) subtitleParts.push(pet.breed)
  if (genderStr) subtitleParts.push(genderStr)
  if (age) subtitleParts.push(age)
  if (pet.weight_kg) subtitleParts.push(`${pet.weight_kg}kg`)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      variants={stagger.row}
      whileHover={{ y: -1, boxShadow: "0 4px 18px rgba(0,0,0,0.07)" }}
      className="solid-card rounded-xl w-full text-left cursor-pointer"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Pet avatar */}
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg select-none"
          style={{
            background: isOverdue ? "var(--red-tint)" : "var(--surface-raised)",
            outline: isOverdue ? "2px solid var(--red)" : "none",
            outlineOffset: 1,
          }}
        >
          {SPECIES_EMOJI[pet.species]}
        </div>

        {/* Pet info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm truncate" style={{ fontWeight: 650, color: "var(--text-primary)" }}>
              {pet.name}
            </span>
            {isOverdue && (
              <AlertCircle size={13} strokeWidth={2.5} style={{ color: "var(--red)", flexShrink: 0 }} />
            )}
          </div>
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {subtitleParts.join(" · ")}
          </p>
        </div>

        {/* Health dates — hidden on mobile, visible on sm+ */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <StatusDot date={pet.next_vaccine_date} icon={Syringe} />
          <StatusDot date={pet.next_control_date} icon={Stethoscope} />
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 shrink-0" style={{ background: "var(--border)" }} />

        {/* Owner info */}
        <div className="hidden sm:block min-w-0 shrink-0" style={{ width: 180 }}>
          <p className="text-xs truncate" style={{ color: "var(--text-secondary)", fontWeight: 550 }}>
            {owner.full_name || "—"}
          </p>
          {owner.phone && (
            <p className="text-[11px] mt-0.5 flex items-center gap-1 truncate" style={{ color: "var(--text-muted)" }}>
              <Phone size={9} strokeWidth={2} className="shrink-0" />
              {owner.phone}
            </p>
          )}
        </div>

        <ChevronRight size={16} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--text-muted)" }} />
      </div>

      {/* Mobile-only: health + owner row */}
      <div className="sm:hidden px-4 pb-3 flex items-center gap-2 flex-wrap">
        <StatusDot date={pet.next_vaccine_date} icon={Syringe} />
        <StatusDot date={pet.next_control_date} icon={Stethoscope} />
        <span className="ml-auto text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
          {owner.full_name}
          {owner.phone && ` · ${owner.phone}`}
        </span>
      </div>
    </motion.button>
  )
}

export default function PatientsPage() {
  const router = useRouter()
  const [rows, setRows] = useState<PetRow[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [clinicSlug, setClinicSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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

      const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]))
      const connMap = Object.fromEntries(connections.map((c) => [c.owner_id, c.connected_at]))

      const petRows: PetRow[] = (petsData ?? []).map((pet) => ({
        pet: pet as Pet,
        owner: {
          id: pet.owner_id,
          role: "owner" as const,
          full_name: profileMap[pet.owner_id]?.full_name ?? "—",
          phone: profileMap[pet.owner_id]?.phone ?? null,
          clinic_id: null,
          created_at: profileMap[pet.owner_id]?.created_at ?? connMap[pet.owner_id],
          connected_at: connMap[pet.owner_id],
        },
      }))

      setRows(petRows)
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => {
    let overdue = 0
    let upcoming = 0
    const ownerSet = new Set<string>()
    for (const { pet, owner } of rows) {
      ownerSet.add(owner.id)
      const vs = dateStatus(pet.next_vaccine_date)
      const cs = dateStatus(pet.next_control_date)
      if (vs === "overdue" || cs === "overdue") overdue++
      else if (vs === "soon" || cs === "soon") upcoming++
    }
    return { total: rows.length, owners: ownerSet.size, overdue, upcoming }
  }, [rows])

  const filtered = useMemo(() => {
    let result = rows

    if (filterMode !== "all") {
      result = result.filter(({ pet }) => {
        const vs = dateStatus(pet.next_vaccine_date)
        const cs = dateStatus(pet.next_control_date)
        if (filterMode === "overdue") return vs === "overdue" || cs === "overdue"
        if (filterMode === "upcoming") return vs === "soon" || cs === "soon"
        if (filterMode === "ok") return (vs === "ok" || vs === null) && (cs === "ok" || cs === null)
        return true
      })
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      result = result.filter(({ pet, owner }) =>
        pet.name.toLowerCase().includes(q) ||
        (pet.breed ?? "").toLowerCase().includes(q) ||
        (pet.chip_id ?? "").toLowerCase().includes(q) ||
        owner.full_name?.toLowerCase().includes(q) ||
        (owner.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      )
    }

    return result
  }, [rows, searchTerm, filterMode])

  const joinUrl = clinicSlug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${clinicSlug}`
    : null

  const filterButtons: { key: FilterMode; label: string; count?: number; color?: string }[] = [
    { key: "all", label: "Svi", count: stats.total },
    { key: "overdue", label: "Zakasneli", count: stats.overdue, color: "var(--red)" },
    { key: "upcoming", label: "Uskoro", count: stats.upcoming, color: "var(--amber)" },
    { key: "ok", label: "U redu", color: "var(--green)" },
  ]

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="w-full space-y-5"
    >

      {/* Header */}
      <motion.div
        variants={stagger.item}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <h1 className="text-2xl">Pacijenti</h1>
          {!loading && rows.length > 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {stats.total} {stats.total === 1 ? "ljubimac" : stats.total < 5 ? "ljubimca" : "ljubimaca"} · {stats.owners} {stats.owners === 1 ? "vlasnik" : stats.owners < 5 ? "vlasnika" : "vlasnika"}
            </p>
          )}
        </div>
        {joinUrl && <CopyLinkButton url={joinUrl} />}
      </motion.div>

      {/* Search + Filters */}
      <motion.div
        variants={stagger.item}
        className="flex flex-col sm:flex-row gap-3"
      >
        <div className="relative flex-1 max-w-md">
          <Search
            size={14}
            strokeWidth={2}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "var(--text-muted)" }}
          />
          <Input
            placeholder="Ime ljubimca, vlasnik, telefon, čip..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {filterButtons.map((fb) => {
            const active = filterMode === fb.key
            return (
              <button
                key={fb.key}
                type="button"
                onClick={() => setFilterMode(fb.key)}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{
                  fontWeight: active ? 650 : 500,
                  background: active ? (fb.color ? `color-mix(in srgb, ${fb.color} 12%, transparent)` : "var(--brand-tint)") : "transparent",
                  color: active ? (fb.color ?? "var(--brand)") : "var(--text-muted)",
                  border: active ? `1px solid color-mix(in srgb, ${fb.color ?? "var(--brand)"} 25%, transparent)` : "1px solid transparent",
                }}
              >
                {fb.label}
                {fb.count !== undefined && fb.count > 0 && (
                  <span
                    className="ml-1.5 inline-flex items-center justify-center rounded-full text-[10px] min-w-[18px] h-[18px] px-1"
                    style={{
                      fontWeight: 700,
                      background: active ? (fb.color ?? "var(--brand)") : "var(--surface-raised)",
                      color: active ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {fb.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Column header hint — desktop only */}
      {!loading && filtered.length > 0 && (
        <div className="hidden sm:flex items-center gap-3 px-4 text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em" }}>
          <div className="w-10 shrink-0" />
          <div className="flex-1">Pacijent</div>
          <div className="shrink-0" style={{ width: "auto" }}>Status</div>
          <div className="w-px h-3 shrink-0" />
          <div className="shrink-0" style={{ width: 180 }}>Vlasnik</div>
          <div className="w-4 shrink-0" />
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl animate-pulse"
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
            {rows.length === 0 ? "Još nema pacijenata" : "Nema rezultata pretrage"}
          </p>
          {rows.length === 0 && joinUrl && (
            <p className="text-xs max-w-xs mx-auto mt-1" style={{ color: "var(--text-muted)" }}>
              Podelite link sa vlasnicima — oni sami povežu profil i dodaju ljubimce.
            </p>
          )}
          {rows.length > 0 && searchTerm && (
            <p className="text-xs max-w-xs mx-auto mt-1" style={{ color: "var(--text-muted)" }}>
              Pokušajte drugi termin pretrage.
            </p>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <motion.div variants={stagger.container} initial="hidden" animate="visible" className="space-y-1.5">
            {filtered.map((row, i) => (
              <PetRowCard
                key={row.pet.id}
                row={row}
                index={i}
                onClick={() => router.push(`/dashboard/pacijenti/${row.pet.id}`)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  )
}
