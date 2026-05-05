"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { MessageSquare } from "lucide-react"
import type { Message } from "@/components/chat/types"
import { groupByDay, initials } from "@/components/chat/helpers"
import { Bubble } from "@/components/chat/bubble"
import { ChatInput } from "@/components/chat/chat-input"
import { useVoiceRecorder } from "@/components/chat/use-voice-recorder"

interface ClinicInfo {
  id: string
  name: string
  logo_url: string | null
  vetId: string
}

export default function OwnerPorukePage() {
  const supabase = createClient()

  const [myId, setMyId]         = useState<string | null>(null)
  const [clinic, setClinic]     = useState<ClinicInfo | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText]         = useState("")
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)

  const voice = useVoiceRecorder()

  const bottomRef = useRef<HTMLDivElement>(null)

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
      ch = supabase.channel(`chat-owner-${user.id}-${Date.now()}`)
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
    const { data } = await supabase.from("messages").insert({
      clinic_id: clinic.id, sender_id: myId, receiver_id: clinic.vetId,
      content, message_type: "text",
    }).select().single()
    if (data) setMessages(prev => prev.find(x => x.id === (data as Message).id) ? prev : [...prev, data as Message])
    setSending(false)
  }

  async function handleFile(file: File) {
    if (!clinic || !myId) return
    const ext = file.name.split(".").pop()
    const path = `${clinic.id}/${myId}/${Date.now()}.${ext}`
    const { data: uploaded } = await supabase.storage.from("chat-media").upload(path, file, { upsert: true })
    if (!uploaded) return
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
    const { data } = await supabase.from("messages").insert({
      clinic_id: clinic.id, sender_id: myId, receiver_id: clinic.vetId,
      message_type: file.type.startsWith("image") ? "image" : "video",
      file_url: publicUrl, file_name: file.name,
    }).select().single()
    if (data) setMessages(prev => prev.find(x => x.id === (data as Message).id) ? prev : [...prev, data as Message])
  }

  async function handleStopRecording() {
    const rec = await voice.stop()
    if (!rec || !clinic || !myId) return
    const path = `${clinic.id}/${myId}/voice_${Date.now()}.webm`
    const { data: uploaded } = await supabase.storage
      .from("chat-media").upload(path, rec.blob, { upsert: true, contentType: rec.mimeType })
    if (!uploaded) return
    const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(path)
    const { data } = await supabase.from("messages").insert({
      clinic_id: clinic.id, sender_id: myId, receiver_id: clinic.vetId,
      message_type: "voice", file_url: publicUrl, duration_seconds: rec.duration,
    }).select().single()
    if (data) setMessages(prev => prev.find(x => x.id === (data as Message).id) ? prev : [...prev, data as Message])
  }

  return (
    <div className="flex flex-col w-full flex-1 min-h-0 overflow-hidden" style={{ background: "var(--bg)" }}>
      {/* Conversation header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}
      >
        {clinic ? (
          <>
            {clinic.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clinic.logo_url}
                alt={clinic.name}
                className="rounded-xl object-cover shrink-0"
                style={{ width: 38, height: 38 }}
              />
            ) : (
              <div
                className="rounded-xl flex items-center justify-center font-bold shrink-0"
                style={{
                  width: 38, height: 38,
                  background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
                  color: "#fff", fontSize: 14,
                }}
              >
                {initials(clinic.name)}
              </div>
            )}
            <div className="min-w-0">
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.2 }}>
                {clinic.name}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.2 }}>
                Veterinarska klinika
              </p>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Poruke</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-0 md:px-6 py-0 md:py-4" style={{ overscrollBehavior: "contain" }}>
        <div className="w-full">
          {loading ? (
            <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
              <div
                className="animate-spin rounded-full border-2"
                style={{ width: 26, height: 26, borderColor: "var(--brand)", borderTopColor: "transparent" }}
              />
            </div>
          ) : !clinic ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center px-6" style={{ minHeight: 300 }}>
              <div className="rounded-full flex items-center justify-center" style={{ width: 56, height: 56, background: "var(--brand-tint)" }}>
                <MessageSquare size={24} style={{ color: "var(--brand)" }} />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Niste povezani sa klinikom</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Povežite se sa klinikom da biste mogli da pišete veterinaru.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 text-center px-6" style={{ minHeight: 300 }}>
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
                {group.items.map(m => <Bubble key={m.id} msg={m} isMine={m.sender_id === myId} />)}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {clinic && (
        <ChatInput
          text={text}
          setText={setText}
          onSendText={sendText}
          onPickFile={handleFile}
          sending={sending}
          placeholder="Poruka veterinaru..."
          recording={voice.recording}
          recordSeconds={voice.recordSeconds}
          onStartRecording={voice.start}
          onStopRecording={handleStopRecording}
        />
      )}
    </div>
  )
}
