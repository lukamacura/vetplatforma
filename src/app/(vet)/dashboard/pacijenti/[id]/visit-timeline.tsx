"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, ChevronDown, Loader2, Check, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { AppointmentStatus } from "@/lib/types"

type ApptHistoryRow = {
  id: string
  scheduled_at: string
  status: AppointmentStatus
  service_name: string
  vet_notes: string | null
}

type SaveStatus = "idle" | "saving" | "saved"

function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <div className="flex items-center gap-1 text-[11px]" style={{ minHeight: 16 }}>
      {status === "saving" && (
        <>
          <Loader2 size={11} strokeWidth={2.25} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Čuvanje…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check size={12} strokeWidth={2.5} style={{ color: "var(--green)" }} />
          <span style={{ color: "var(--green)", fontWeight: 600 }}>Sačuvano</span>
        </>
      )}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt
      className="text-[10px] uppercase tracking-wider"
      style={{ color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.08em" }}
    >
      {children}
    </dt>
  )
}

/**
 * Renders the pet's visit history as an editable timeline.
 * Loads its own appointment data and auto-saves per-visit notes.
 * When `limit` is set and there are more visits, shows a "view all" link
 * to the standalone history page instead of rendering everything.
 */
export function VisitTimeline({
  petId,
  limit,
  viewAllHref,
}: {
  petId: string
  limit?: number
  viewAllHref?: string
}) {
  const router = useRouter()
  const [apptHistory, setApptHistory] = useState<ApptHistoryRow[]>([])
  const [loading, setLoading] = useState(true)

  const [expandedApptId, setExpandedApptId] = useState<string | null>(null)
  const [apptNotesDraft, setApptNotesDraft] = useState<Record<string, string>>({})
  const [apptNoteStatus, setApptNoteStatus] = useState<Record<string, SaveStatus>>({})

  const apptNotesDraftRef = useRef<Record<string, string>>({})
  const apptDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const apptSavedRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: apptData } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, service_id, vet_notes")
        .eq("pet_id", petId)
        .order("scheduled_at", { ascending: false })
        .limit(100)

      if (apptData && apptData.length > 0) {
        const serviceIds = [...new Set(apptData.map((a: { service_id: string }) => a.service_id))]
        const { data: svcs } = await supabase.from("services").select("id, name").in("id", serviceIds)
        const svcMap: Record<string, string> = Object.fromEntries(
          (svcs ?? []).map((s: { id: string; name: string }) => [s.id, s.name])
        )
        setApptHistory(
          apptData.map(
            (a: { id: string; scheduled_at: string; status: AppointmentStatus; service_id: string; vet_notes: string | null }) => ({
              id: a.id,
              scheduled_at: a.scheduled_at,
              status: a.status,
              service_name: svcMap[a.service_id] ?? "—",
              vet_notes: a.vet_notes ?? null,
            })
          )
        )
      } else {
        setApptHistory([])
      }
      setLoading(false)
    }
    load()
  }, [petId])

  // Flush timers on unmount
  useEffect(() => {
    const apptDebounce = apptDebounceRef.current
    const apptSaved = apptSavedRef.current
    return () => {
      Object.values(apptDebounce).forEach(clearTimeout)
      Object.values(apptSaved).forEach(clearTimeout)
    }
  }, [])

  const saveApptNote = useCallback(async (apptId: string) => {
    const text = apptNotesDraftRef.current[apptId] ?? ""
    const supabase = createClient()
    const { error } = await supabase
      .from("appointments")
      .update({ vet_notes: text.trim() || null })
      .eq("id", apptId)
    if (!error) {
      setApptHistory((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, vet_notes: text.trim() || null } : a))
      )
      setApptNoteStatus((prev) => ({ ...prev, [apptId]: "saved" }))
      if (apptSavedRef.current[apptId]) clearTimeout(apptSavedRef.current[apptId])
      apptSavedRef.current[apptId] = setTimeout(
        () => setApptNoteStatus((prev) => ({ ...prev, [apptId]: "idle" })),
        1800
      )
    } else {
      setApptNoteStatus((prev) => ({ ...prev, [apptId]: "idle" }))
    }
  }, [])

  const triggerApptNoteSave = useCallback((apptId: string) => {
    setApptNoteStatus((prev) => ({ ...prev, [apptId]: "saving" }))
    if (apptDebounceRef.current[apptId]) clearTimeout(apptDebounceRef.current[apptId])
    apptDebounceRef.current[apptId] = setTimeout(() => saveApptNote(apptId), 600)
  }, [saveApptNote])

  function toggleApptExpand(apptId: string) {
    if (expandedApptId === apptId) {
      setExpandedApptId(null)
    } else {
      setExpandedApptId(apptId)
      const existing = apptHistory.find((a) => a.id === apptId)
      if (existing && !(apptId in apptNotesDraft)) {
        setApptNotesDraft((prev) => ({ ...prev, [apptId]: existing.vet_notes ?? "" }))
        apptNotesDraftRef.current[apptId] = existing.vet_notes ?? ""
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }

  if (apptHistory.length === 0) {
    return <p className="text-sm" style={{ color: "var(--text-muted)" }}>Nema termina.</p>
  }

  const visible = limit ? apptHistory.slice(0, limit) : apptHistory
  const hiddenCount = apptHistory.length - visible.length

  return (
    <>
      <div className="relative pl-1">
        <ul className="space-y-0">
          {visible.map((appt, idx) => {
            const d = new Date(appt.scheduled_at)
            const dateStr = d.toLocaleDateString("sr-Latn-RS", { day: "2-digit", month: "short", year: "numeric" })
            const timeStr = d.toLocaleTimeString("sr-Latn-RS", { hour: "2-digit", minute: "2-digit" })
            const isLast = idx === visible.length - 1
            const isFirst = idx === 0
            const statusBadge =
              appt.status === "confirmed"
                ? { cls: "badge-brand", label: "Potvrđen" }
                : appt.status === "cancelled"
                  ? { cls: "badge-muted", label: "Otkazan" }
                  : { cls: "badge-red", label: "Nije došao" }
            const dotMuted = appt.status !== "confirmed"
            const isExpanded = expandedApptId === appt.id
            const hasNotes = !!appt.vet_notes
            return (
              <li key={appt.id} className={`relative pl-7 ${isLast ? "" : "pb-6"}`}>
                {!isLast && (
                  <span className="absolute left-[4px] top-4 bottom-0 w-px" style={{ background: "var(--border)" }} aria-hidden />
                )}
                <span
                  className={cn(
                    "absolute left-0 top-1.5 size-2.5 rounded-full z-1",
                    isFirst && !dotMuted && "timeline-dot-active"
                  )}
                  style={isFirst && !dotMuted ? undefined : {
                    background: dotMuted ? "var(--border-strong)" : "var(--brand)",
                    boxShadow: dotMuted ? "none" : "0 0 0 3px var(--brand-tint)",
                  }}
                />
                <div>
                  <button
                    type="button"
                    onClick={() => toggleApptExpand(appt.id)}
                    className="w-full text-left group"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm leading-snug" style={{ fontWeight: 600 }}>{appt.service_name}</p>
                          {hasNotes && !isExpanded && (
                            <FileText size={12} strokeWidth={2} className="shrink-0 opacity-40" />
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{dateStr} · {timeStr}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`badge ${statusBadge.cls}`}>{statusBadge.label}</span>
                        <ChevronDown
                          size={14}
                          strokeWidth={2}
                          className="transition-transform duration-200 opacity-40 group-hover:opacity-70"
                          style={{ transform: isExpanded ? "rotate(180deg)" : undefined }}
                        />
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <FieldLabel>Beleške sa posete</FieldLabel>
                        <SaveIndicator status={apptNoteStatus[appt.id] ?? "idle"} />
                      </div>
                      <textarea
                        className="vet-notes-textarea w-full min-h-[80px] rounded-xl text-sm resize-y px-3 py-2 mt-1.5"
                        style={{
                          background: "var(--surface-raised)",
                          color: "var(--text-primary)",
                          lineHeight: 1.6,
                          fontFamily: "inherit",
                        }}
                        placeholder="Dodaj beleške za ovu posetu…"
                        value={apptNotesDraft[appt.id] ?? appt.vet_notes ?? ""}
                        onChange={(e) => {
                          const val = e.target.value
                          setApptNotesDraft((prev) => ({ ...prev, [appt.id]: val }))
                          apptNotesDraftRef.current[appt.id] = val
                          triggerApptNoteSave(appt.id)
                        }}
                      />
                    </motion.div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {hiddenCount > 0 && viewAllHref && (
        <button
          type="button"
          onClick={() => router.push(viewAllHref)}
          className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs transition-all"
          style={{
            fontWeight: 600,
            background: "var(--brand-tint)",
            color: "var(--brand)",
            border: "1px solid color-mix(in srgb, var(--brand) 25%, transparent)",
          }}
        >
          Prikaži sve posete ({apptHistory.length})
          <ArrowRight size={13} strokeWidth={2.25} />
        </button>
      )}
    </>
  )
}
