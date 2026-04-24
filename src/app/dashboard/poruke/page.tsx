"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { DashboardShell } from "@/app/dashboard/dashboard-shell"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import {
  Paperclip, Mic, MicOff,
  ArrowLeft, Search, MessageSquare, Play, Pause, X, Check, CheckCheck,
} from "lucide-react"

/* ─── Types ─────────────────────────────────────────────── */
interface ConvOwner {
  id: string
  full_name: string
  phone: string | null
  lastMessage: string | null
  lastAt: string | null
  unread: number
}

type MsgType = "text" | "image" | "video" | "voice"

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  content: string | null
  message_type: MsgType
  file_url: string | null
  file_name: string | null
  duration_seconds: number | null
  is_read: boolean
  created_at: string
}

/* ─── Helpers ─────────────────────────────────────────────── */
function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })
}

function formatDay(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Danas"
  if (d.toDateString() === yesterday.toDateString()) return "Juče"
  return d.toLocaleDateString("sr-RS", { day: "numeric", month: "long" })
}

function groupByDay(messages: Message[]) {
  const groups: { day: string; items: Message[] }[] = []
  for (const m of messages) {
    const day = formatDay(m.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(m)
    else groups.push({ day, items: [m] })
  }
  return groups
}

function fmtDuration(s: number | null) {
  if (!s) return "0:00"
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, "0")}`
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

/* ─── Voice Message Player ─────────────────────────────────── */
function VoicePlayer({ url, duration }: { url: string; duration: number | null }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime))
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
    }
    const onEnded = () => { setPlaying(false); setProgress(0); setCurrentTime(0) }
    audio.addEventListener("timeupdate", onTimeUpdate)
    audio.addEventListener("ended", onEnded)
    return () => { audio.removeEventListener("timeupdate", onTimeUpdate); audio.removeEventListener("ended", onEnded) }
  }, [])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className="flex items-center justify-center rounded-full flex-shrink-0 transition-all"
        style={{
          width: 32, height: 32,
          background: "rgba(43,181,160,0.2)",
          border: "1px solid rgba(43,181,160,0.4)",
        }}
      >
        {playing
          ? <Pause size={14} style={{ color: "var(--brand)" }} />
          : <Play size={14} style={{ color: "var(--brand)" }} />
        }
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="rounded-full overflow-hidden cursor-pointer"
          style={{ height: 4, background: "rgba(43,181,160,0.2)" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            const pct = (e.clientX - rect.left) / rect.width
            if (audioRef.current) audioRef.current.currentTime = pct * (audioRef.current.duration || 0)
          }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, background: "var(--brand)" }}
          />
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {playing ? fmtDuration(currentTime) : fmtDuration(duration)}
        </span>
      </div>
    </div>
  )
}

/* ─── Message Bubble ─────────────────────────────────────── */
function Bubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const [imgOpen, setImgOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}
    >
      <div style={{ maxWidth: "72%" }}>
        <div
          className="rounded-2xl px-3 py-2 relative"
          style={{
            background: isMine
              ? "linear-gradient(135deg, var(--brand) 0%, #239684 100%)"
              : "var(--surface)",
            color: isMine ? "#fff" : "var(--text-primary)",
            border: isMine ? "none" : "1px solid var(--border)",
            boxShadow: isMine
              ? "0 2px 12px rgba(43,181,160,0.3)"
              : "0 1px 4px rgba(0,0,0,0.06)",
            borderBottomRightRadius: isMine ? 4 : undefined,
            borderBottomLeftRadius: isMine ? undefined : 4,
          }}
        >
          {/* Text */}
          {msg.message_type === "text" && (
            <p style={{ fontSize: 14, lineHeight: 1.5, wordBreak: "break-word" }}>{msg.content}</p>
          )}

          {/* Image */}
          {msg.message_type === "image" && msg.file_url && (
            <>
              <img
                src={msg.file_url}
                alt={msg.file_name ?? "slika"}
                className="rounded-xl cursor-pointer object-cover"
                style={{ maxWidth: 240, maxHeight: 200, display: "block" }}
                onClick={() => setImgOpen(true)}
              />
              {msg.content && (
                <p style={{ fontSize: 14, marginTop: 6, wordBreak: "break-word" }}>{msg.content}</p>
              )}
              {/* Lightbox */}
              <AnimatePresence>
                {imgOpen && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.85)" }}
                    onClick={() => setImgOpen(false)}
                  >
                    <img src={msg.file_url!} alt="" className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
                    <button
                      className="absolute top-4 right-4 rounded-full flex items-center justify-center"
                      style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)" }}
                      onClick={() => setImgOpen(false)}
                    >
                      <X size={18} color="#fff" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Video */}
          {msg.message_type === "video" && msg.file_url && (
            <video
              src={msg.file_url}
              controls
              className="rounded-xl"
              style={{ maxWidth: 280, maxHeight: 200, display: "block" }}
            />
          )}

          {/* Voice */}
          {msg.message_type === "voice" && msg.file_url && (
            <VoicePlayer url={msg.file_url} duration={msg.duration_seconds} />
          )}
        </div>

        {/* Timestamp + read receipt */}
        <div className={`flex items-center gap-1 mt-0.5 ${isMine ? "justify-end" : "justify-start"}`}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatTime(msg.created_at)}</span>
          {isMine && (
            msg.is_read
              ? <CheckCheck size={12} style={{ color: "var(--brand)" }} />
              : <Check size={12} style={{ color: "var(--text-muted)" }} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function PorukePage() {
  const supabase = createClient()

  const [myId, setMyId]         = useState<string | null>(null)
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [owners, setOwners]     = useState<ConvOwner[]>([])
  const [selected, setSelected] = useState<ConvOwner | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText]         = useState("")
  const [search, setSearch]     = useState("")
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "chat">("list")

  // Voice recording
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  async function loadOwners(cid: string, vetId: string) {
    // Get connected owner IDs
    const { data: conns } = await supabase
      .from("connections").select("owner_id").eq("clinic_id", cid)
    if (!conns?.length) { setOwners([]); return }

    const ownerIds = conns.map(c => c.owner_id)

    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, phone").in("id", ownerIds)

    // For each owner get last message + unread count
    const convOwners: ConvOwner[] = await Promise.all(
      (profiles ?? []).map(async p => {
        const { data: lastMsgs } = await supabase
          .from("messages")
          .select("content, created_at, message_type, is_read, receiver_id")
          .eq("clinic_id", cid)
          .or(`and(sender_id.eq.${vetId},receiver_id.eq.${p.id}),and(sender_id.eq.${p.id},receiver_id.eq.${vetId})`)
          .order("created_at", { ascending: false })
          .limit(1)

        const last = lastMsgs?.[0]
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("clinic_id", cid)
          .eq("sender_id", p.id)
          .eq("receiver_id", vetId)
          .eq("is_read", false)

        let preview = last?.content ?? null
        if (!preview && last?.message_type === "image") preview = "📷 Slika"
        if (!preview && last?.message_type === "video") preview = "🎥 Video"
        if (!preview && last?.message_type === "voice") preview = "🎤 Glasovna poruka"

        return {
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          lastMessage: preview,
          lastAt: last?.created_at ?? null,
          unread: count ?? 0,
        }
      })
    )

    convOwners.sort((a, b) => {
      if (!a.lastAt && !b.lastAt) return 0
      if (!a.lastAt) return 1
      if (!b.lastAt) return -1
      return b.lastAt.localeCompare(a.lastAt)
    })

    setOwners(convOwners)
  }

  /* ── Bootstrap ── */
  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: profile } = await supabase
        .from("profiles").select("clinic_id").eq("id", user.id).single()
      if (!profile?.clinic_id) return

      const { data: clinic } = await supabase
        .from("clinics").select("id").eq("owner_id", user.id).single()
      if (!clinic) return
      setClinicId(clinic.id)

      await loadOwners(clinic.id, user.id)
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── Load messages for selected conversation ── */
  const loadMessages = useCallback(async (owner: ConvOwner) => {
    if (!myId || !clinicId) return
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("clinic_id", clinicId)
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${owner.id}),and(sender_id.eq.${owner.id},receiver_id.eq.${myId})`)
      .order("created_at", { ascending: true })
    setMessages((data as Message[]) ?? [])

    // Mark unread as read
    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("clinic_id", clinicId!)
      .eq("sender_id", owner.id)
      .eq("receiver_id", myId)
      .eq("is_read", false)

    setOwners(prev => prev.map(o => o.id === owner.id ? { ...o, unread: 0 } : o))
  }, [myId, clinicId])

  const selectOwner = async (owner: ConvOwner) => {
    setSelected(owner)
    setMobileView("chat")
    await loadMessages(owner)

    // Unsubscribe old channel
    if (channelRef.current) await supabase.removeChannel(channelRef.current)

    // Subscribe realtime — unique name prevents Supabase reusing a stale subscribed channel
    const ch = supabase.channel(`chat-vet-${owner.id}-${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `clinic_id=eq.${clinicId}`,
      }, (payload) => {
        const m = payload.new as Message
        const involved = (m.sender_id === myId && m.receiver_id === owner.id) ||
                         (m.sender_id === owner.id && m.receiver_id === myId)
        if (!involved) return
        setMessages(prev => {
          if (prev.find(x => x.id === m.id)) return prev
          return [...prev, m]
        })
        // Mark read if incoming
        if (m.sender_id === owner.id) {
          supabase.from("messages").update({ is_read: true }).eq("id", m.id)
        }
        // Update conversation list
        setOwners(prev => prev.map(o =>
          o.id === owner.id ? { ...o, lastMessage: m.content, lastAt: m.created_at } : o
        ))
      })
      .subscribe()
    channelRef.current = ch
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  /* ── Send text ── */
  async function sendText() {
    if (!text.trim() || !selected || !myId || !clinicId || sending) return
    setSending(true)
    const content = text.trim()
    setText("")
    await supabase.from("messages").insert({
      clinic_id: clinicId, sender_id: myId, receiver_id: selected.id,
      content, message_type: "text",
    })
    await loadOwners(clinicId, myId)
    setSending(false)
  }

  /* ── Send file (image / video) ── */
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !selected || !myId || !clinicId) return
    e.target.value = ""

    const ext = file.name.split(".").pop()
    const path = `${clinicId}/${myId}/${Date.now()}.${ext}`
    const { data: uploaded } = await supabase.storage
      .from("chat-media").upload(path, file, { upsert: true })
    if (!uploaded) return

    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
    const type: MsgType = file.type.startsWith("image") ? "image" : "video"

    await supabase.from("messages").insert({
      clinic_id: clinicId, sender_id: myId, receiver_id: selected.id,
      message_type: type, file_url: publicUrl, file_name: file.name,
    })
    await loadOwners(clinicId, myId)
  }

  /* ── Voice recording ── */
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.start(100)
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      alert("Mikrofon nije dostupan.")
    }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current || !selected || !myId || !clinicId) return
    clearInterval(recordTimerRef.current!)
    const duration = recordSeconds

    await new Promise<void>(resolve => {
      mediaRecorderRef.current!.onstop = () => resolve()
      mediaRecorderRef.current!.stop()
      mediaRecorderRef.current!.stream.getTracks().forEach(t => t.stop())
    })

    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
    const path = `${clinicId}/${myId}/voice_${Date.now()}.webm`
    const { data: uploaded } = await supabase.storage
      .from("chat-media").upload(path, blob, { upsert: true, contentType: "audio/webm" })
    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
      await supabase.from("messages").insert({
        clinic_id: clinicId, sender_id: myId, receiver_id: selected.id,
        message_type: "voice", file_url: publicUrl, duration_seconds: duration,
      })
      await loadOwners(clinicId, myId)
    }
    setRecording(false)
    setRecordSeconds(0)
  }

  const filteredOwners = owners.filter(o =>
    o.full_name.toLowerCase().includes(search.toLowerCase())
  )

  /* ── Render ── */
  return (
    <DashboardShell>
      <div className="flex gap-0 rounded-2xl overflow-hidden" style={{
        height: "calc(100svh - 220px)",
        minHeight: 480,
        border: "1px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
      }}>

        {/* ── Conversation list ── */}
        <div
          className={`flex flex-col border-r shrink-0 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}
          style={{ width: 300, background: "var(--surface)", borderColor: "var(--border)" }}
        >
          {/* Header */}
          <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Poruke</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Razgovori sa vlasnicima</p>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--surface-raised)" }}>
              <Search size={14} style={{ color: "var(--text-muted)" }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Pretraži razgovore..."
                className="bg-transparent flex-1 text-sm outline-none"
                style={{ color: "var(--text-primary)" }}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full border-2 border-t-transparent" style={{ width: 24, height: 24, borderColor: "var(--brand)", borderTopColor: "transparent" }} />
              </div>
            ) : filteredOwners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <MessageSquare size={32} style={{ color: "var(--text-muted)", marginBottom: 8 }} />
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Nema razgovora</p>
              </div>
            ) : filteredOwners.map(owner => (
              <button
                key={owner.id}
                onClick={() => selectOwner(owner)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-all"
                style={{
                  background: selected?.id === owner.id ? "var(--brand-tint)" : "transparent",
                  borderLeft: selected?.id === owner.id ? "3px solid var(--brand)" : "3px solid transparent",
                }}
              >
                {/* Avatar */}
                <div className="rounded-full flex items-center justify-center flex-shrink-0 font-bold" style={{
                  width: 42, height: 42,
                  background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
                  color: "#fff", fontSize: 14,
                }}>
                  {initials(owner.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {owner.full_name}
                    </span>
                    {owner.lastAt && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                        {formatTime(owner.lastAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {owner.lastMessage ?? "Počni razgovor"}
                    </span>
                    {owner.unread > 0 && (
                      <span className="rounded-full flex items-center justify-center font-bold flex-shrink-0" style={{
                        minWidth: 18, height: 18, padding: "0 4px",
                        background: "var(--brand)", color: "#fff", fontSize: 11,
                      }}>
                        {owner.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat window ── */}
        <div className={`flex-1 flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`} style={{ background: "var(--bg)", minWidth: 0 }}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="rounded-full flex items-center justify-center" style={{ width: 64, height: 64, background: "var(--brand-tint)" }}>
                <MessageSquare size={28} style={{ color: "var(--brand)" }} />
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Izaberi razgovor</p>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Klikni na vlasnika levo da otvoriš razgovor</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b" style={{
                background: "var(--surface)", borderColor: "var(--border)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                <button
                  className="md:hidden flex items-center justify-center rounded-full transition-all"
                  style={{ width: 36, height: 36, background: "var(--surface-raised)" }}
                  onClick={() => { setMobileView("list"); setSelected(null) }}
                >
                  <ArrowLeft size={16} style={{ color: "var(--text-primary)" }} />
                </button>
                <div className="rounded-full flex items-center justify-center font-bold" style={{
                  width: 38, height: 38,
                  background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
                  color: "#fff", fontSize: 14, flexShrink: 0,
                }}>
                  {initials(selected.full_name)}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{selected.full_name}</p>
                  {selected.phone && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{selected.phone}</p>}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: "var(--bg)" }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Nema poruka. Pozdravite vlasnika!</p>
                  </div>
                ) : (
                  groupByDay(messages).map(group => (
                    <div key={group.day}>
                      <div className="flex items-center justify-center mb-4 mt-2">
                        <span className="px-3 py-1 rounded-full text-xs" style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          color: "var(--text-muted)",
                          fontSize: 11,
                        }}>
                          {group.day}
                        </span>
                      </div>
                      {group.items.map(m => (
                        <Bubble key={m.id} msg={m} isMine={m.sender_id === myId} />
                      ))}
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Voice recording banner */}
              <AnimatePresence>
                {recording && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ background: "rgba(220,38,38,0.08)", borderTop: "1px solid rgba(220,38,38,0.2)" }}
                  >
                    <span className="pulse-dot" style={{ background: "var(--red)" }} />
                    <span style={{ fontSize: 14, color: "var(--red)", fontWeight: 600 }}>
                      Snimanje... {fmtDuration(recordSeconds)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>Otpusti dugme za slanje</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input area */}
              <div className="border-t px-3 py-3 flex items-end gap-2" style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}>
                {/* Attach file */}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleFile}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center rounded-xl transition-all hover:scale-105 flex-shrink-0"
                  style={{ width: 40, height: 40, background: "var(--surface-raised)", border: "1px solid var(--border)" }}
                  title="Pošalji sliku ili video"
                >
                  <Paperclip size={18} style={{ color: "var(--text-secondary)" }} />
                </button>

                {/* Text area */}
                <div className="flex-1 relative">
                  <textarea
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText() } }}
                    placeholder="Napiši poruku..."
                    rows={1}
                    className="w-full rounded-xl px-4 py-2.5 resize-none outline-none text-sm transition-all"
                    style={{
                      background: "var(--surface-raised)",
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                      maxHeight: 120,
                      lineHeight: 1.5,
                    }}
                    onInput={e => {
                      const t = e.currentTarget
                      t.style.height = "auto"
                      t.style.height = Math.min(t.scrollHeight, 120) + "px"
                    }}
                  />
                </div>

                {/* Voice button */}
                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onTouchStart={e => { e.preventDefault(); startRecording() }}
                  onTouchEnd={e => { e.preventDefault(); stopRecording() }}
                  className="flex items-center justify-center rounded-xl transition-all hover:scale-105 flex-shrink-0"
                  style={{
                    width: 40, height: 40,
                    background: recording ? "var(--red)" : "var(--surface-raised)",
                    border: `1px solid ${recording ? "var(--red)" : "var(--border)"}`,
                  }}
                  title="Drži za glasovnu poruku"
                >
                  {recording
                    ? <MicOff size={18} color="#fff" />
                    : <Mic size={18} style={{ color: "var(--text-secondary)" }} />
                  }
                </button>

                {/* Send */}
                <button
                  onClick={sendText}
                  disabled={!text.trim() || sending}
                  className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all hover:scale-105 active:scale-95"
                  style={{
                    width: 40, height: 40, padding: 0,
                    background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
                    boxShadow: "0 2px 8px rgba(43,181,160,0.4)",
                    border: "none",
                    opacity: !text.trim() || sending ? 0.5 : 1,
                  }}
                >
                  <Check size={18} color="#fff" strokeWidth={2.5} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}
