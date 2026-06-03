"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { User, Check, Loader2, Mail, ShieldCheck } from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" }) {
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

type SaveStatus = "idle" | "saving" | "saved"

export default function OwnerPodesavanjaPage() {
  const [fullName, setFullName]   = useState("")
  const [phone,    setPhone]      = useState("")
  const [email,    setEmail]      = useState("")
  const [loading,  setLoading]    = useState(true)
  const [memberSince, setMemberSince] = useState<string | null>(null)

  const [nameStatus,  setNameStatus]  = useState<SaveStatus>("idle")
  const [phoneStatus, setPhoneStatus] = useState<SaveStatus>("idle")

  // Email change
  const [newEmail,      setNewEmail]      = useState("")
  const [emailLoading,  setEmailLoading]  = useState(false)
  const [emailMsg,      setEmailMsg]      = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const loadedRef       = useRef(false)
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nameSavedRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phoneSavedRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      setEmail(user.email ?? "")
      if (user.created_at) {
        setMemberSince(
          new Date(user.created_at).toLocaleDateString("sr-Latn-RS", {
            day: "2-digit", month: "long", year: "numeric",
          })
        )
      }

      const { data: profile } = await supabase
        .from("profiles").select("full_name, phone").eq("id", user.id).single()

      if (profile) {
        setFullName(profile.full_name ?? "")
        setPhone(profile.phone ?? "")
      }

      setLoading(false)
      loadedRef.current = true
    }
    load()
  }, [])

  useEffect(() => {
    return () => {
      if (nameDebounceRef.current)  clearTimeout(nameDebounceRef.current)
      if (nameSavedRef.current)     clearTimeout(nameSavedRef.current)
      if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current)
      if (phoneSavedRef.current)    clearTimeout(phoneSavedRef.current)
    }
  }, [])

  const saveName = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) { setNameStatus("idle"); return }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNameStatus("idle"); return }
    const { error } = await supabase
      .from("profiles").update({ full_name: trimmed }).eq("id", user.id)
    if (error) { setNameStatus("idle"); return }
    setNameStatus("saved")
    if (nameSavedRef.current) clearTimeout(nameSavedRef.current)
    nameSavedRef.current = setTimeout(() => setNameStatus("idle"), 1800)
  }, [])

  const savePhone = useCallback(async (value: string) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPhoneStatus("idle"); return }
    const { error } = await supabase
      .from("profiles").update({ phone: value.trim() || null }).eq("id", user.id)
    if (error) { setPhoneStatus("idle"); return }
    setPhoneStatus("saved")
    if (phoneSavedRef.current) clearTimeout(phoneSavedRef.current)
    phoneSavedRef.current = setTimeout(() => setPhoneStatus("idle"), 1800)
  }, [])

  const handleNameChange = useCallback((value: string) => {
    setFullName(value)
    if (!loadedRef.current) return
    setNameStatus("saving")
    if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
    nameDebounceRef.current = setTimeout(() => saveName(value), 600)
  }, [saveName])

  const handlePhoneChange = useCallback((value: string) => {
    setPhone(value)
    if (!loadedRef.current) return
    setPhoneStatus("saving")
    if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current)
    phoneDebounceRef.current = setTimeout(() => savePhone(value), 600)
  }, [savePhone])

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed || trimmed === email) {
      setEmailMsg({ type: "err", text: "Unesite novu e-mail adresu." })
      return
    }
    setEmailLoading(true)
    setEmailMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: trimmed })
    setEmailLoading(false)
    if (error) {
      setEmailMsg({ type: "err", text: error.message })
    } else {
      setEmailMsg({ type: "ok", text: "Potvrda je poslata na novu adresu. Kliknite na link u e-mailu." })
      setNewEmail("")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 pt-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5 pb-4"
    >
      {/* ── Header ── */}
      <motion.div variants={stagger.item} className="flex items-center gap-3">
        <div className="icon-lg icon-brand">
          <User size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>Moj nalog</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Upravljajte ličnim podacima i bezbednošću
          </p>
        </div>
      </motion.div>

      {/* ── Member since ── */}
      {memberSince && (
        <motion.div variants={stagger.item}>
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              background: "linear-gradient(135deg, var(--brand-tint) 0%, #F0FDF9 100%)",
              border: "1px solid rgba(43,181,160,0.18)",
            }}
          >
            <div className="icon-sm icon-brand shrink-0">
              <ShieldCheck size={14} strokeWidth={2.25} />
            </div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Član od <span style={{ fontWeight: 700, color: "var(--brand)" }}>{memberSince}</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Personal info ── */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm" style={{ fontWeight: 700 }}>Lični podaci</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Ime i kontakt broj telefona
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Full name */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="owner-name">Ime i prezime</Label>
              <SaveIndicator status={nameStatus} />
            </div>
            <Input
              id="owner-name"
              value={fullName}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={() => {
                if (!loadedRef.current || !fullName.trim()) return
                if (nameDebounceRef.current) clearTimeout(nameDebounceRef.current)
                saveName(fullName)
              }}
              placeholder="npr. Marija Petrović"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="owner-phone">Broj telefona</Label>
              <SaveIndicator status={phoneStatus} />
            </div>
            <Input
              id="owner-phone"
              type="tel"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              onBlur={() => {
                if (!loadedRef.current) return
                if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current)
                savePhone(phone)
              }}
              placeholder="npr. +381 60 123 4567"
            />
          </div>
        </div>
      </motion.div>

      {/* ── Email change ── */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="icon-md icon-blue shrink-0">
            <Mail size={16} strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm" style={{ fontWeight: 700 }}>E-mail adresa</h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Trenutna: <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{email}</span>
            </p>
          </div>
        </div>

        <form onSubmit={handleEmailChange} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Nova e-mail adresa</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => { setNewEmail(e.target.value); setEmailMsg(null) }}
              placeholder="nova@adresa.com"
              autoComplete="email"
            />
          </div>

          {emailMsg && (
            <p
              className="text-xs"
              style={{ color: emailMsg.type === "ok" ? "var(--green)" : "var(--red)" }}
            >
              {emailMsg.text}
            </p>
          )}

          <button
            type="submit"
            disabled={emailLoading || !newEmail.trim()}
            className="w-full rounded-xl py-2.5 text-sm transition-all"
            style={{
              background: emailLoading || !newEmail.trim() ? "var(--surface-raised)" : "var(--brand-tint)",
              color: emailLoading || !newEmail.trim() ? "var(--text-muted)" : "var(--brand)",
              border: `1px solid ${emailLoading || !newEmail.trim() ? "var(--border)" : "rgba(43,181,160,0.3)"}`,
              fontWeight: 600,
              cursor: emailLoading || !newEmail.trim() ? "not-allowed" : "pointer",
              opacity: emailLoading ? 0.7 : 1,
            }}
          >
            {emailLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={13} strokeWidth={2.25} className="animate-spin" />
                Slanje…
              </span>
            ) : (
              "Promeni e-mail"
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  )
}
