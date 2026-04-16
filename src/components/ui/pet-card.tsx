"use client"

import type { Pet } from "@/lib/types"

// ─── Species config ────────────────────────────────────────────────────────────

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐕", cat: "🐈", bird: "🐦", other: "🐾",
}
const SPECIES_LABEL: Record<string, string> = {
  dog: "Pas", cat: "Mačka", bird: "Ptica", other: "Ostalo",
}
const SPECIES_STYLE: Record<string, { bg: string; border: string }> = {
  dog:   { bg: "var(--blue-tint)",  border: "rgba(37,99,235,0.18)"  },
  cat:   { bg: "var(--amber-tint)", border: "rgba(217,119,6,0.18)"  },
  bird:  { bg: "var(--green-tint)", border: "rgba(22,163,74,0.18)"  },
  other: { bg: "var(--brand-tint)", border: "rgba(43,181,160,0.18)" },
}

// ─── Types & helpers ───────────────────────────────────────────────────────────

export interface PetCardProps {
  pet: Pet
  variant: "vet" | "owner"
  ownerName?: string
  ownerPhone?: string
  onClick?: () => void
  className?: string
  lastVisitDate?: string
  nextApptDate?: string
}

type Status = "overdue" | "soon" | "ok" | "none"

function getStatus(dateStr: string | null | undefined): Status {
  if (!dateStr) return "none"
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return "overdue"
  if (days <= 14) return "soon"
  return "ok"
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("sr-Latn-RS", { day: "numeric", month: "short", year: "numeric" })
}

function daysText(dateStr: string): string {
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
  if (days < 0) return `${Math.abs(days)}d kasni`
  if (days === 0) return "Danas"
  if (days === 1) return "Sutra"
  return `Za ${days}d`
}

const STATUS_DOT: Record<Status, string> = {
  overdue: "var(--red)",
  soon:    "var(--amber)",
  ok:      "var(--green)",
  none:    "var(--text-muted)",
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function PetCard({ pet, variant, ownerName, ownerPhone, onClick, className = "", lastVisitDate, nextApptDate }: PetCardProps) {
  const species  = SPECIES_STYLE[pet.species] ?? SPECIES_STYLE.other
  const vaccSt   = getStatus(pet.next_vaccine_date)
  const ctrlSt   = getStatus(pet.next_control_date)
  const clickable = !!onClick

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") onClick?.() } : undefined}
      className={`${className} group`}
      style={{
        background:   species.bg,
        border:       `1px solid ${species.border}`,
        borderRadius: 20,
        padding:      22,
        cursor:       clickable ? "pointer" : "default",
        transition:   "transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow:    "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0 rgba(0,0,0,0)",
        userSelect:   "none",
        position:     "relative",
        overflow:     "hidden",
      }}
      onMouseEnter={clickable ? (e) => {
        e.currentTarget.style.transform = "translateY(-2px)"
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)"
      } : undefined}
      onMouseLeave={clickable ? (e) => {
        e.currentTarget.style.transform = "translateY(0)"
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0 rgba(0,0,0,0)"
      } : undefined}
    >
      {/* ── Identity row ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Emoji circle */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%", flexShrink: 0,
          background: "rgba(255,255,255,0.8)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, lineHeight: 1,
          boxShadow: "0 2px 10px rgba(0,0,0,0.06), inset 0 -1px 3px rgba(0,0,0,0.04)",
        }}>
          {SPECIES_EMOJI[pet.species]}
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Pet name */}
          <div style={{
            fontSize: 22, fontWeight: 800, lineHeight: 1.15,
            color: "var(--text-primary)", letterSpacing: "-0.02em",
          }}>
            {pet.name}
          </div>
          {/* Species · breed */}
          <div style={{
            fontSize: 13, color: "var(--text-secondary)",
            fontWeight: 500, marginTop: 3,
          }}>
            {SPECIES_LABEL[pet.species]}{pet.breed ? ` · ${pet.breed}` : ""}
          </div>
          {/* Vet only: owner info */}
          {variant === "vet" && ownerName && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, fontWeight: 500 }}>
              {ownerName}{ownerPhone ? ` · ${ownerPhone}` : ""}
            </div>
          )}
        </div>
      </div>

      {/* ── Info pills ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8,
        marginTop: 18,
      }}>
        {/* Vaccine */}
        <InfoPill
          dot={STATUS_DOT[vaccSt]}
          label="Vakcinacija"
          value={pet.next_vaccine_date ? daysText(pet.next_vaccine_date) : "—"}
          pulse={vaccSt === "overdue" || vaccSt === "soon"}
          subtitle={pet.vaccine_note ?? undefined}
        />
        {/* Control */}
        <InfoPill
          dot={STATUS_DOT[ctrlSt]}
          label="Kontrola"
          value={pet.next_control_date ? daysText(pet.next_control_date) : "—"}
          pulse={ctrlSt === "overdue" || ctrlSt === "soon"}
        />
        {/* Weight */}
        {pet.weight_kg !== null && (
          <InfoPill
            dot="var(--blue)"
            label="Težina"
            value={`${pet.weight_kg} kg`}
          />
        )}
        {/* Last visit */}
        {lastVisitDate && (
          <InfoPill
            dot="var(--text-muted)"
            label="Poslednja poseta"
            value={fmtDate(lastVisitDate)}
          />
        )}
        {/* Next appointment */}
        {nextApptDate && (
          <InfoPill
            dot="var(--brand)"
            label="Sledeći termin"
            value={fmtDate(nextApptDate)}
          />
        )}
      </div>

      {/* ── Vet-only extras ── */}
      {variant === "vet" && (pet.birth_date || pet.chip_id || pet.vet_notes) && (
        <div style={{
          marginTop: 14, paddingTop: 14,
          borderTop: "1px solid rgba(0,0,0,0.06)",
          display: "flex", flexDirection: "column", gap: 6,
        }}>
          {pet.birth_date && (
            <SmallRow label="Rođen/a" value={fmtDate(pet.birth_date)} />
          )}
          {pet.chip_id && (
            <SmallRow label="Čip" value={pet.chip_id} mono />
          )}
          {pet.vet_notes && (
            <div style={{
              fontSize: 12, fontStyle: "italic",
              color: "var(--text-muted)", lineHeight: 1.5,
              marginTop: 2,
            }}>
              {pet.vet_notes.length > 60 ? `${pet.vet_notes.slice(0, 60)}…` : pet.vet_notes}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoPill({ dot, label, value, pulse = false, subtitle }: {
  dot: string; label: string; value: string; pulse?: boolean; subtitle?: string
}) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      background: "rgba(255,255,255,0.7)",
      borderRadius: 12, padding: "8px 14px",
      minWidth: 0,
    }}>
      {/* Status dot */}
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: dot, flexShrink: 0,
        animation: pulse ? "dot-pulse 1.6s ease-in-out infinite" : "none",
      }} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
          letterSpacing: "0.04em", lineHeight: 1,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: "var(--text-primary)",
          lineHeight: 1.3, marginTop: 2,
        }}>
          {value}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 10, fontWeight: 500, color: "var(--text-muted)",
            lineHeight: 1.2, marginTop: 1,
          }}>
            {subtitle.length > 30 ? `${subtitle.slice(0, 30)}…` : subtitle}
          </div>
        )}
      </div>
    </div>
  )
}

function SmallRow({ label, value, mono = false }: {
  label: string; value: string; mono?: boolean
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        color: "var(--text-muted)", flexShrink: 0,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 12, fontWeight: 500, color: "var(--text-secondary)",
        fontFamily: mono ? "ui-monospace, 'Cascadia Code', monospace" : "inherit",
        letterSpacing: mono ? "0.03em" : "normal",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {value}
      </span>
    </div>
  )
}

export default PetCard
