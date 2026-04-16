"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Bell, Phone, CalendarPlus, CheckCircle2, Syringe, Stethoscope } from "lucide-react"
import { motion } from "framer-motion"
import { PetAvatar } from "@/components/ui/pet-avatar"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import type { Pet, Profile } from "@/lib/types"

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}

type ReminderItem = {
  pet: Pet
  ownerName: string
  ownerPhone: string | null
  vaccDays: number | null
  ctrlDays: number | null
  urgencyDays: number   // most urgent (lowest value)
  urgencyLabel: string  // "Vakcinacija" | "Kontrola"
}

function daysFromToday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + "T00:00:00")
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} ${Math.abs(days) === 1 ? "dan kasni" : "dana kasni"}`
  if (days === 0) return "danas"
  if (days === 1) return "sutra"
  return `za ${days} dana`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })
}

type TabKey = "overdue" | "week" | "month"

const TABS: { key: TabKey; label: string; badgeClass: string }[] = [
  { key: "overdue", label: "Zakasnelo",  badgeClass: "badge-red"   },
  { key: "week",    label: "Ova nedelja", badgeClass: "badge-amber" },
  { key: "month",   label: "Ovaj mesec", badgeClass: "badge-blue"  },
]

function classify(item: ReminderItem): TabKey {
  if (item.urgencyDays < 0) return "overdue"
  if (item.urgencyDays <= 7) return "week"
  return "month"
}

/* ── Reminder row ── */
function ReminderRow({ item, index }: { item: ReminderItem; index: number }) {
  const tab = classify(item)
  const accentColor = tab === "overdue" ? "var(--red)" : tab === "week" ? "var(--amber)" : "var(--blue)"
  const iconClass   = tab === "overdue" ? "icon-red"   : tab === "week" ? "icon-amber"   : "icon-blue"
  const badgeClass  = tab === "overdue" ? "badge-red"  : tab === "week" ? "badge-amber"  : "badge-blue"

  return (
    <motion.div
      variants={stagger.row}
      className="reminder-row flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${accentColor}`,
      }}
    >
      {/* Pet identity */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <PetAvatar photoUrl={item.pet.photo_url} species={item.pet.species} size={28} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-700 truncate" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
              {item.pet.name}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              · {item.ownerName}
            </span>
          </div>
          {/* What's due */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.vaccDays !== null && item.vaccDays <= 30 && (
              <span className={`badge ${item.vaccDays < 0 ? "badge-red" : item.vaccDays <= 7 ? "badge-amber" : "badge-blue"}`}>
                <Syringe size={10} strokeWidth={2} />
                Vakcina: {formatDate(item.pet.next_vaccine_date!)}
              </span>
            )}
            {item.ctrlDays !== null && item.ctrlDays <= 30 && (
              <span className={`badge ${item.ctrlDays < 0 ? "badge-red" : item.ctrlDays <= 7 ? "badge-amber" : "badge-blue"}`}>
                <Stethoscope size={10} strokeWidth={2} />
                Kontrola: {formatDate(item.pet.next_control_date!)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Urgency + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span className={`badge ${badgeClass} hidden sm:inline-flex`}>
          {formatDaysLabel(item.urgencyDays)}
        </span>
        {item.ownerPhone && (
          <a
            href={`tel:${item.ownerPhone}`}
            className="icon-sm icon-muted"
            title={item.ownerPhone}
            onClick={(e) => e.stopPropagation()}
          >
            <Phone size={13} strokeWidth={2} />
          </a>
        )}
        <Link
          href={`/dashboard/zakazivanje?petId=${item.pet.id}&ownerId=${item.pet.owner_id}`}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-700 text-white"
          style={{ background: "var(--brand)", fontWeight: 700 }}
        >
          <CalendarPlus size={12} strokeWidth={2} />
          Zakaži
        </Link>
      </div>
    </motion.div>
  )
}

/* ── Page ── */
export default function PodsetnicePage() {
  const [items, setItems]     = useState<ReminderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("overdue")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      /* 1. Get vet's clinic_id */
      const { data: profile } = await supabase
        .from("profiles").select("clinic_id").eq("id", user.id).single()
      let clinicId = profile?.clinic_id
      if (!clinicId) {
        const { data: ownedClinic } = await supabase
          .from("clinics").select("id").eq("owner_id", user.id).single()
        clinicId = ownedClinic?.id ?? null
      }
      if (!clinicId) { setLoading(false); return }

      /* 2. Get connected owner IDs */
      const { data: connections } = await supabase
        .from("connections").select("owner_id").eq("clinic_id", clinicId)
      if (!connections?.length) { setLoading(false); return }
      const ownerIds = connections.map((c) => c.owner_id)

      /* 3. Fetch pets with upcoming or overdue dates (within 30 days) */
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() + 30)
      const cutoffStr = cutoff.toISOString().slice(0, 10)

      const { data: pets } = await supabase
        .from("pets")
        .select("*")
        .in("owner_id", ownerIds)
        .or(`next_vaccine_date.lte.${cutoffStr},next_control_date.lte.${cutoffStr}`)

      if (!pets?.length) { setLoading(false); return }

      /* 4. Fetch owner profiles */
      const { data: profiles } = await supabase
        .from("profiles").select("id, full_name, phone").in("id", ownerIds)
      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p: Pick<Profile, "id" | "full_name" | "phone">) => [p.id, p])
      )

      /* 5. Build reminder items */
      const result: ReminderItem[] = []
      for (const pet of pets) {
        const vaccDays = daysFromToday(pet.next_vaccine_date)
        const ctrlDays = daysFromToday(pet.next_control_date)

        // Only include if at least one date is within 30 days (filter out nulls that got through)
        const vaccInRange = vaccDays !== null && vaccDays <= 30
        const ctrlInRange = ctrlDays !== null && ctrlDays <= 30
        if (!vaccInRange && !ctrlInRange) continue

        // Determine urgency
        let urgencyDays = Infinity
        let urgencyLabel = ""
        if (vaccInRange && (vaccDays! < (ctrlInRange ? ctrlDays! : Infinity))) {
          urgencyDays = vaccDays!
          urgencyLabel = "Vakcinacija"
        } else if (ctrlInRange) {
          urgencyDays = ctrlDays!
          urgencyLabel = "Kontrola"
        } else if (vaccInRange) {
          urgencyDays = vaccDays!
          urgencyLabel = "Vakcinacija"
        }

        const owner = profileMap[pet.owner_id]
        result.push({
          pet,
          ownerName:  owner?.full_name  ?? "—",
          ownerPhone: owner?.phone      ?? null,
          vaccDays:   vaccInRange ? vaccDays! : null,
          ctrlDays:   ctrlInRange ? ctrlDays! : null,
          urgencyDays,
          urgencyLabel,
        })
      }

      // Sort by urgency (most overdue first)
      result.sort((a, b) => a.urgencyDays - b.urgencyDays)
      setItems(result)
      setLoading(false)
    }
    load()
  }, [])

  const tabCounts: Record<TabKey, number> = { overdue: 0, week: 0, month: 0 }
  for (const item of items) tabCounts[classify(item)]++

  // Auto-select first non-empty tab
  const firstNonEmpty = TABS.find((t) => tabCounts[t.key] > 0)?.key ?? "overdue"
  const currentTab = tabCounts[activeTab] > 0 ? activeTab : firstNonEmpty
  const filtered = items.filter((item) => classify(item) === currentTab)

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-7"
    >
      {/* Header */}
      <motion.div variants={stagger.item}>
        <div className="flex items-center gap-3 mb-1">
          <div className="icon-md icon-amber">
            <Bell size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="text-2xl">Podsetnici</h1>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Pacijenti kojima uskoro ili kasne vakcine i kontrole
            </p>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <motion.div variants={stagger.item} className="flex gap-2 flex-wrap">

        {TABS.map(({ key, label, badgeClass }) => {
          const isActive = currentTab === key
          const count = tabCounts[key]
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-600 transition-all"
              style={{
                fontWeight: 600,
                background: isActive ? "var(--surface)" : "transparent",
                color:      isActive ? "var(--text-primary)" : "var(--text-muted)",
                border:     `1px solid ${isActive ? "var(--border-strong)" : "transparent"}`,
                boxShadow:  isActive ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              }}
            >
              {label}
              {count > 0 && (
                <span className={`badge ${badgeClass}`} style={{ padding: "1px 7px", fontSize: 10 }}>
                  {key === "overdue" && <span className="pulse-dot" />}
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </motion.div>

      {/* List */}
      <motion.div
        key={currentTab}
        variants={stagger.item}
        className="solid-card rounded-2xl overflow-hidden"
      >
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-sm font-700" style={{ fontWeight: 700 }}>
            {TABS.find((t) => t.key === currentTab)?.label}
          </h3>
          {!loading && filtered.length > 0 && (
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {filtered.length} {filtered.length === 1 ? "pacijent" : filtered.length < 5 ? "pacijenta" : "pacijenata"}
            </p>
          )}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-2.5 py-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
              ))}
            </div>
          ) : filtered.length === 0 && tabCounts.overdue === 0 && tabCounts.week === 0 && tabCounts.month === 0 ? (
            <div className="py-16 text-center">
              <div className="icon-lg icon-green mx-auto mb-4">
                <CheckCircle2 size={22} strokeWidth={1.75} />
              </div>
              <p className="font-600 text-sm mb-1" style={{ fontWeight: 600 }}>
                Svi pacijenti su ažurni ✓
              </p>
              <p className="text-xs max-w-xs mx-auto" style={{ color: "var(--text-muted)" }}>
                Nema zakazanih vakcina niti kontrola u narednih 30 dana.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Nema pacijenata u ovoj kategoriji.
              </p>
            </div>
          ) : (
            <motion.div variants={stagger.container} initial="hidden" animate="visible" className="space-y-2">
              {filtered.map((item, i) => (
                <ReminderRow key={item.pet.id} item={item} index={i} />
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
