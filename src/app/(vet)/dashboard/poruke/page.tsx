"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, Search, MessageSquare } from "lucide-react"
import type { Message } from "@/components/chat/types"
import { formatTime, groupByDay, initials, previewFor } from "@/components/chat/helpers"
import { Bubble } from "@/components/chat/bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { useVoiceRecorder } from "@/components/chat/use-voice-recorder"

interface ConvOwner {
  id: string
  full_name: string
  phone: string | null
  lastMessage: string | null
  lastAt: string | null
  unread: number
}

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

  const voice = useVoiceRecorder()

  const bottomRef    = useRef<HTMLDivElement>(null)
  const channelRef   = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const selectedRef  = useRef<ConvOwner | null>(null)
  const myIdRef      = useRef<string | null>(null)
  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => { myIdRef.current = myId }, [myId])

  const loadOwners = useCallback(async (cid: string, vetId: string) => {
    const { data: conns } = await supabase
      .from("connections").select("owner_id").eq("clinic_id", cid)
    if (!conns?.length) { setOwners([]); return }

    const ownerIds = conns.map(c => c.owner_id)
    const { data: profiles } = await supabase
      .from("profiles").select("id, full_name, phone").in("id", ownerIds)

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

        return {
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          lastMessage: previewFor(last),
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
  }, [supabase])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setMyId(user.id)

      const { data: clinic } = await supabase
        .from("clinics").select("id").eq("owner_id", user.id).single()
      if (!clinic) return
      setClinicId(clinic.id)

      await loadOwners(clinic.id, user.id)
      setLoading(false)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMessages = useCallback(async (owner: ConvOwner) => {
    if (!myId || !clinicId) return
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("clinic_id", clinicId)
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${owner.id}),and(sender_id.eq.${owner.id},receiver_id.eq.${myId})`)
      .order("created_at", { ascending: true })
    setMessages((data as Message[]) ?? [])

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("clinic_id", clinicId)
      .eq("sender_id", owner.id)
      .eq("receiver_id", myId)
      .eq("is_read", false)

    setOwners(prev => prev.map(o => o.id === owner.id ? { ...o, unread: 0 } : o))
  }, [myId, clinicId, supabase])

  async function selectOwner(owner: ConvOwner) {
    setSelected(owner)
    selectedRef.current = owner
    setMobileView("chat")
    await loadMessages(owner)
  }

  useEffect(() => {
    if (!myId || !clinicId) return
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const ch = supabase.channel(`chat-vet-${clinicId}-${Date.now()}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages",
        filter: `clinic_id=eq.${clinicId}`,
      }, (payload) => {
        const m = payload.new as Message
        const me = myIdRef.current
        if (!me) return
        if (m.sender_id !== me && m.receiver_id !== me) return
        const otherId = m.sender_id === me ? m.receiver_id : m.sender_id
        const sel = selectedRef.current
        const isOpen = sel?.id === otherId

        if (isOpen) {
          setMessages(prev => prev.find(x => x.id === m.id) ? prev : [...prev, m])
          if (m.sender_id === otherId) {
            supabase.from("messages").update({ is_read: true }).eq("id", m.id)
          }
        }

        setOwners(prev => prev.map(o => {
          if (o.id !== otherId) return o
          const incoming = m.sender_id === otherId
          return {
            ...o,
            lastMessage: previewFor(m),
            lastAt: m.created_at,
            unread: incoming && !isOpen ? o.unread + 1 : o.unread,
          }
        }))
      })
      .subscribe()
    channelRef.current = ch

    return () => { if (ch) supabase.removeChannel(ch) }
  }, [myId, clinicId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function sendText() {
    if (!text.trim() || !selected || !myId || !clinicId || sending) return
    setSending(true)
    const content = text.trim()
    setText("")
    const { data } = await supabase.from("messages").insert({
      clinic_id: clinicId, sender_id: myId, receiver_id: selected.id,
      content, message_type: "text",
    }).select().single()
    if (data) setMessages(prev => prev.find(x => x.id === (data as Message).id) ? prev : [...prev, data as Message])
    await loadOwners(clinicId, myId)
    setSending(false)
  }

  async function handleFile(file: File) {
    if (!selected || !myId || !clinicId) return
    const ext = file.name.split(".").pop()
    const path = `${clinicId}/${myId}/${Date.now()}.${ext}`
    const { data: uploaded } = await supabase.storage.from("chat-media").upload(path, file, { upsert: true })
    if (!uploaded) return
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
    const type = file.type.startsWith("image") ? "image" : "video"

    const { data } = await supabase.from("messages").insert({
      clinic_id: clinicId, sender_id: myId, receiver_id: selected.id,
      message_type: type, file_url: publicUrl, file_name: file.name,
    }).select().single()
    if (data) setMessages(prev => prev.find(x => x.id === (data as Message).id) ? prev : [...prev, data as Message])
    await loadOwners(clinicId, myId)
  }

  async function handleStopRecording() {
    const rec = await voice.stop()
    if (!rec || !selected || !myId || !clinicId) return
    const path = `${clinicId}/${myId}/voice_${Date.now()}.webm`
    const { data: uploaded } = await supabase.storage
      .from("chat-media").upload(path, rec.blob, { upsert: true, contentType: rec.mimeType })
    if (!uploaded) return
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
    const { data } = await supabase.from("messages").insert({
      clinic_id: clinicId, sender_id: myId, receiver_id: selected.id,
      message_type: "voice", file_url: publicUrl, duration_seconds: rec.duration,
    }).select().single()
    if (data) setMessages(prev => prev.find(x => x.id === (data as Message).id) ? prev : [...prev, data as Message])
    await loadOwners(clinicId, myId)
  }

  const filteredOwners = owners.filter(o =>
    o.full_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex w-full h-full overflow-hidden">

        {/* Conversation list */}
        <div
          className={`flex flex-col border-r shrink-0 w-full md:w-[320px] ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}
          style={{ background: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>Poruke</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>Razgovori sa vlasnicima</p>
          </div>

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

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div
                  className="animate-spin rounded-full border-2"
                  style={{ width: 24, height: 24, borderColor: "var(--brand)", borderTopColor: "transparent" }}
                />
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
                <div
                  className="rounded-full flex items-center justify-center shrink-0 font-bold"
                  style={{
                    width: 42, height: 42,
                    background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
                    color: "#fff", fontSize: 14,
                  }}
                >
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
                      <span
                        className="rounded-full flex items-center justify-center font-bold shrink-0"
                        style={{
                          minWidth: 18, height: 18, padding: "0 4px",
                          background: "var(--brand)", color: "#fff", fontSize: 11,
                        }}
                      >
                        {owner.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat thread */}
        <div
          className={`flex-1 flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}
          style={{ background: "var(--bg)", minWidth: 0 }}
        >
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
              <div
                className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
                style={{
                  background: "var(--surface)",
                  borderColor: "var(--border)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}
              >
                <button
                  className="md:hidden flex items-center justify-center rounded-full transition-all"
                  style={{ width: 36, height: 36, background: "var(--surface-raised)" }}
                  onClick={() => { setMobileView("list"); setSelected(null) }}
                >
                  <ArrowLeft size={16} style={{ color: "var(--text-primary)" }} />
                </button>
                <div
                  className="rounded-full flex items-center justify-center font-bold shrink-0"
                  style={{
                    width: 38, height: 38,
                    background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
                    color: "#fff", fontSize: 14,
                  }}
                >
                  {initials(selected.full_name)}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{selected.full_name}</p>
                  {selected.phone && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{selected.phone}</p>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-3 md:px-6 py-3 md:py-5" style={{ background: "var(--bg)" }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                    <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Nema poruka. Pozdravite vlasnika!</p>
                  </div>
                ) : (
                  groupByDay(messages).map(group => (
                    <div key={group.day}>
                      <div className="flex items-center justify-center mb-4 mt-2">
                        <span
                          className="px-3 py-1 rounded-full"
                          style={{
                            background: "var(--surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text-muted)",
                            fontSize: 11,
                          }}
                        >
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

              <ChatInput
                text={text}
                setText={setText}
                onSendText={sendText}
                onPickFile={handleFile}
                sending={sending}
                recording={voice.recording}
                recordSeconds={voice.recordSeconds}
                onStartRecording={voice.start}
                onStopRecording={handleStopRecording}
              />
            </>
          )}
        </div>
    </div>
  )
}
