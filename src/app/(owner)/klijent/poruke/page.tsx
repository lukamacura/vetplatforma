"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import {
  Paperclip, Mic, MicOff, X, Play, Pause,
  Check, CheckCheck, MessageSquare,
  Home, CalendarDays, CalendarCheck, PawPrint, Building2,
} from "lucide-react"

/* ─── Bottom nav tabs (mirrors owner-shell) ─────────────── */
const NAV_TABS = [
  { href: "/klijent",             label: "Početna",  icon: Home,          exact: true  },
  { href: "/klijent/zakazivanje", label: "Zakaži",   icon: CalendarDays,  exact: false },
  { href: "/klijent/kalendar",    label: "Kalendar", icon: CalendarCheck, exact: false },
  { href: "/klijent/ljubimci",    label: "Ljubimci", icon: PawPrint,      exact: false },
  { href: "/klijent/poruke",      label: "Poruke",   icon: MessageSquare, exact: false },
  { href: "/klijent/klinike",     label: "Klinike",  icon: Building2,     exact: false },
]

function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="flex flex-shrink-0"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {NAV_TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: active ? "var(--brand)" : "var(--text-muted)", minHeight: 56 }}
          >
            <span
              className="flex items-center justify-center rounded-full transition-all"
              style={{ background: active ? "var(--brand-tint)" : "transparent", width: active ? 48 : 28, height: 28 }}
            >
              <Icon size={18} strokeWidth={active ? 2.25 : 1.75} />
            </span>
            <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

/* ─── Types ─────────────────────────────────────────────── */
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

interface ClinicInfo {
  id: string
  name: string
  logo_url: string | null
  vetId: string
}

/* ─── Helpers ─────────────────────────────────────────────── */
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("sr-RS", { hour: "2-digit", minute: "2-digit" })
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
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

/* ─── Voice Player ─────────────────────────────────────── */
function VoicePlayer({ url, duration, mine }: { url: string; duration: number | null; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      setCurrentTime(Math.floor(audio.currentTime))
      setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0)
    }
    const onEnd = () => { setPlaying(false); setProgress(0); setCurrentTime(0) }
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("ended", onEnd)
    return () => { audio.removeEventListener("timeupdate", onTime); audio.removeEventListener("ended", onEnd) }
  }, [])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const trackBg = mine ? "rgba(255,255,255,0.25)" : "rgba(43,181,160,0.2)"
  const trackFill = mine ? "rgba(255,255,255,0.9)" : "var(--brand)"
  const btnBg = mine ? "rgba(255,255,255,0.2)" : "rgba(43,181,160,0.15)"
  const iconColor = mine ? "#fff" : "var(--brand)"

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 180 }}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 32, height: 32, background: btnBg, border: `1px solid ${mine ? "rgba(255,255,255,0.3)" : "rgba(43,181,160,0.4)"}` }}
      >
        {playing ? <Pause size={13} color={iconColor} /> : <Play size={13} color={iconColor} />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="rounded-full overflow-hidden cursor-pointer"
          style={{ height: 4, background: trackBg }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            if (audioRef.current) audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * (audioRef.current.duration || 0)
          }}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: trackFill }} />
        </div>
        <span style={{ fontSize: 11, color: mine ? "rgba(255,255,255,0.75)" : "var(--text-muted)" }}>
          {playing ? fmtDuration(currentTime) : fmtDuration(duration)}
        </span>
      </div>
    </div>
  )
}

/* ─── Bubble ─────────────────────────────────────────────── */
function Bubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const [imgOpen, setImgOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}
    >
      <div style={{ maxWidth: "78%" }}>
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            background: isMine ? "linear-gradient(135deg, var(--brand) 0%, #239684 100%)" : "var(--surface)",
            color: isMine ? "#fff" : "var(--text-primary)",
            border: isMine ? "none" : "1px solid var(--border)",
            boxShadow: isMine ? "0 2px 12px rgba(43,181,160,0.3)" : "0 1px 4px rgba(0,0,0,0.06)",
            borderBottomRightRadius: isMine ? 4 : 16,
            borderBottomLeftRadius: isMine ? 16 : 4,
          }}
        >
          {msg.message_type === "text" && (
            <p style={{ fontSize: 14, lineHeight: 1.55, wordBreak: "break-word", margin: 0 }}>{msg.content}</p>
          )}

          {msg.message_type === "image" && msg.file_url && (
            <>
              <img
                src={msg.file_url}
                alt={msg.file_name ?? "slika"}
                className="rounded-xl cursor-pointer object-cover"
                style={{ maxWidth: 220, maxHeight: 180, display: "block" }}
                onClick={() => setImgOpen(true)}
              />
              {msg.content && <p style={{ fontSize: 14, marginTop: 6, marginBottom: 0, wordBreak: "break-word" }}>{msg.content}</p>}
              <AnimatePresence>
                {imgOpen && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.88)" }}
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

          {msg.message_type === "video" && msg.file_url && (
            <video src={msg.file_url} controls className="rounded-xl" style={{ maxWidth: 240, maxHeight: 180, display: "block" }} />
          )}

          {msg.message_type === "voice" && msg.file_url && (
            <VoicePlayer url={msg.file_url} duration={msg.duration_seconds} mine={isMine} />
          )}
        </div>

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

/* ─── Page ─────────────────────────────────────────────── */
export default function OwnerPorukePage() {
  const supabase = createClient()

  const [myId, setMyId]       = useState<string | null>(null)
  const [clinic, setClinic]   = useState<ClinicInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText]       = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  const [recording, setRecording]         = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /* Resize textarea to content */
  function resizeTextarea() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 100) + "px"
  }

  async function loadMessages(ownerId: string, info: ClinicInfo) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("clinic_id", info.id)
      .or(`and(sender_id.eq.${ownerId},receiver_id.eq.${info.vetId}),and(sender_id.eq.${info.vetId},receiver_id.eq.${ownerId})`)
      .order("created_at", { ascending: true })
    setMessages((data as Message[]) ?? [])

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("clinic_id", info.id)
      .eq("sender_id", info.vetId)
      .eq("receiver_id", ownerId)
      .eq("is_read", false)
  }

  useEffect(() => {
    // eslint-disable-next-line prefer-const
    let ch: ReturnType<typeof supabase.channel> | null = null

    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: conn } = await supabase
        .from("connections").select("clinic_id").eq("owner_id", user.id).limit(1).single()
      if (!conn) { setLoading(false); return }

      const { data: clinicData } = await supabase
        .from("clinics").select("id, name, logo_url, owner_id").eq("id", conn.clinic_id).single()
      if (!clinicData) { setLoading(false); return }

      const info: ClinicInfo = {
        id: clinicData.id,
        name: clinicData.name,
        logo_url: clinicData.logo_url,
        vetId: clinicData.owner_id,
      }
      setClinic(info)
      await loadMessages(user.id, info)
      setLoading(false)

      const vetId = clinicData.owner_id
      const channelName = `chat-owner-${user.id}`
      await supabase.removeChannel(supabase.channel(channelName))
      ch = supabase.channel(channelName)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "messages",
          filter: `clinic_id=eq.${clinicData.id}`,
        }, (payload) => {
          const m = payload.new as Message
          const involved =
            (m.sender_id === user.id && m.receiver_id === vetId) ||
            (m.sender_id === vetId    && m.receiver_id === user.id)
          if (!involved) return
          setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
          if (m.sender_id === vetId) {
            supabase.from("messages").update({ is_read: true }).eq("id", m.id)
          }
        })
        .subscribe()
    })()

    return () => { if (ch) supabase.removeChannel(ch) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendText() {
    if (!text.trim() || !clinic || !myId || sending) return
    setSending(true)
    const content = text.trim()
    setText("")
    if (textareaRef.current) { textareaRef.current.style.height = "auto" }
    await supabase.from("messages").insert({
      clinic_id: clinic.id, sender_id: myId, receiver_id: clinic.vetId,
      content, message_type: "text",
    })
    setSending(false)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !clinic || !myId) return
    e.target.value = ""
    const ext = file.name.split(".").pop()
    const path = `${clinic.id}/${myId}/${Date.now()}.${ext}`
    const { data: uploaded } = await supabase.storage.from("chat-media").upload(path, file, { upsert: true })
    if (!uploaded) return
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
    await supabase.from("messages").insert({
      clinic_id: clinic.id, sender_id: myId, receiver_id: clinic.vetId,
      message_type: file.type.startsWith("image") ? "image" : "video",
      file_url: publicUrl, file_name: file.name,
    })
  }

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
    } catch { alert("Mikrofon nije dostupan.") }
  }

  async function stopRecording() {
    if (!mediaRecorderRef.current || !clinic || !myId) return
    clearInterval(recordTimerRef.current!)
    const duration = recordSeconds
    await new Promise<void>(resolve => {
      mediaRecorderRef.current!.onstop = () => resolve()
      mediaRecorderRef.current!.stop()
      mediaRecorderRef.current!.stream.getTracks().forEach(t => t.stop())
    })
    const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
    const path = `${clinic.id}/${myId}/voice_${Date.now()}.webm`
    const { data: uploaded } = await supabase.storage.from("chat-media").upload(path, blob, { upsert: true, contentType: "audio/webm" })
    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
      await supabase.from("messages").insert({
        clinic_id: clinic.id, sender_id: myId, receiver_id: clinic.vetId,
        message_type: "voice", file_url: publicUrl, duration_seconds: duration,
      })
    }
    setRecording(false)
    setRecordSeconds(0)
  }

  /* ── Layout: full-screen flex column, no scroll on outer div ── */
  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh", overflow: "hidden", background: "var(--bg)" }}
    >
      {/* Header */}
      <header
        className="flex items-center gap-3 px-4 flex-shrink-0"
        style={{
          height: 56,
          background: "var(--sidebar-bg)",
          borderBottom: "1px solid var(--sidebar-border)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {clinic ? (
          <>
            {clinic.logo_url ? (
              <img src={clinic.logo_url} alt={clinic.name} className="rounded-xl object-cover flex-shrink-0" style={{ width: 34, height: 34 }} />
            ) : (
              <div
                className="rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                style={{ width: 34, height: 34, background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)", color: "#fff", fontSize: 13 }}
              >
                {initials(clinic.name)}
              </div>
            )}
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--sidebar-text)", lineHeight: 1.2 }}>{clinic.name}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.2 }}>Veterinarska klinika</p>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--sidebar-text)" }}>Poruke</p>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ overscrollBehavior: "contain" }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full border-2" style={{ width: 26, height: 26, borderColor: "var(--brand)", borderTopColor: "transparent" }} />
          </div>
        ) : !clinic ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, background: "var(--brand-tint)" }}>
              <MessageSquare size={24} style={{ color: "var(--brand)" }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Niste povezani sa klinikom</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Povežite se sa klinikom da biste mogli da pišete veterinaru.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
            <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, background: "var(--brand-tint)" }}>
              <MessageSquare size={24} style={{ color: "var(--brand)" }} />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Počni razgovor</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Pošaljite prvu poruku svom veterinaru</p>
          </div>
        ) : (
          groupByDay(messages).map(group => (
            <div key={group.day}>
              <div className="flex justify-center my-3">
                <span className="px-3 py-1 rounded-full" style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  color: "var(--text-muted)", fontSize: 11,
                }}>
                  {group.day}
                </span>
              </div>
              {group.items.map(m => <Bubble key={m.id} msg={m} isMine={m.sender_id === myId} />)}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Recording banner */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{ background: "rgba(220,38,38,0.08)", borderTop: "1px solid rgba(220,38,38,0.2)" }}
          >
            <span className="pulse-dot" style={{ background: "var(--red)" }} />
            <span style={{ fontSize: 13, color: "var(--red)", fontWeight: 600 }}>Snimanje... {fmtDuration(recordSeconds)}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>Otpusti za slanje</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      {clinic && (
        <div
          className="flex items-end gap-2 px-3 py-2 flex-shrink-0"
          style={{ background: "var(--surface)", borderTop: "1px solid var(--border)" }}
        >
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
            style={{ width: 40, height: 40, background: "var(--surface-raised)", border: "1px solid var(--border)" }}
          >
            <Paperclip size={17} style={{ color: "var(--text-secondary)" }} />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => { setText(e.target.value); resizeTextarea() }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText() } }}
            placeholder="Poruka veterinaru..."
            rows={1}
            className="flex-1 rounded-xl px-3 py-2 resize-none outline-none text-sm"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
              lineHeight: 1.5,
              maxHeight: 100,
              minHeight: 40,
            }}
          />

          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={e => { e.preventDefault(); startRecording() }}
            onTouchEnd={e => { e.preventDefault(); stopRecording() }}
            className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
            style={{
              width: 40, height: 40,
              background: recording ? "var(--red)" : "var(--surface-raised)",
              border: `1px solid ${recording ? "var(--red)" : "var(--border)"}`,
            }}
          >
            {recording ? <MicOff size={17} color="#fff" /> : <Mic size={17} style={{ color: "var(--text-secondary)" }} />}
          </button>

          <button
            onClick={sendText}
            disabled={!text.trim() || sending}
            className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all active:scale-95"
            style={{
              width: 40, height: 40, padding: 0,
              background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
              boxShadow: "0 2px 8px rgba(43,181,160,0.4)",
              border: "none",
              opacity: !text.trim() || sending ? 0.45 : 1,
            }}
          >
            <Check size={18} color="#fff" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  )
}
