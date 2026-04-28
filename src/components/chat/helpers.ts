import type { Message } from "./types"

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })
}

export function formatDay(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Danas"
  if (d.toDateString() === yesterday.toDateString()) return "Juče"
  return d.toLocaleDateString("sr-RS", { day: "numeric", month: "long" })
}

export function groupByDay(messages: Message[]) {
  const groups: { day: string; items: Message[] }[] = []
  for (const m of messages) {
    const day = formatDay(m.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(m)
    else groups.push({ day, items: [m] })
  }
  return groups
}

export function fmtDuration(s: number | null) {
  if (!s) return "0:00"
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

export function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

export function previewFor(m: Pick<Message, "content" | "message_type"> | undefined | null) {
  if (!m) return null
  if (m.content) return m.content
  if (m.message_type === "image") return "📷 Slika"
  if (m.message_type === "video") return "🎥 Video"
  if (m.message_type === "voice") return "🎤 Glasovna poruka"
  return null
}
