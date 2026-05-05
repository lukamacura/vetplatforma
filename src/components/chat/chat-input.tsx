"use client"

import { useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Paperclip, Mic, MicOff, Check } from "lucide-react"
import { fmtDuration } from "./helpers"

interface ChatInputProps {
  text: string
  setText: (v: string) => void
  onSendText: () => void
  onPickFile: (file: File) => void
  sending: boolean
  disabled?: boolean
  placeholder?: string
  recording: boolean
  recordSeconds: number
  onStartRecording: () => void
  onStopRecording: () => void
}

export function ChatInput({
  text, setText, onSendText, onPickFile, sending, disabled,
  placeholder = "Napiši poruku...",
  recording, recordSeconds, onStartRecording, onStopRecording,
}: ChatInputProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const taRef   = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }

  function handleSend() {
    if (recording) {
      onStopRecording()
      return
    }
    if (!text.trim()) return
    onSendText()
    if (taRef.current) taRef.current.style.height = "auto"
  }

  function handleMicClick() {
    if (recording) onStopRecording()
    else onStartRecording()
  }

  return (
    <>
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
            style={{ background: "rgba(220,38,38,0.08)", borderTop: "1px solid rgba(220,38,38,0.2)" }}
          >
            <span className="pulse-dot" style={{ background: "var(--red)" }} />
            <span style={{ fontSize: 13, color: "var(--red)", fontWeight: 600 }}>
              Snimanje... {fmtDuration(recordSeconds)}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
              Pritisni ✓ za slanje
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex items-end gap-2 px-4 py-3 flex-shrink-0"
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          boxShadow: "0 -1px 8px rgba(0,0,0,0.04)",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0]
            e.target.value = ""
            if (f) onPickFile(f)
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all hover:scale-105 active:scale-95"
          style={{
            width: 40, height: 40,
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            opacity: disabled ? 0.5 : 1,
          }}
          title="Pošalji sliku ili video"
        >
          <Paperclip size={18} style={{ color: "var(--text-secondary)" }} />
        </button>

        <textarea
          ref={taRef}
          value={text}
          onChange={e => { setText(e.target.value); resize() }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="flex-1 rounded-xl px-4 py-2.5 resize-none outline-none text-sm transition-all"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            lineHeight: 1.5,
            maxHeight: 120,
            minHeight: 40,
          }}
        />

        <button
          onClick={handleMicClick}
          disabled={disabled || sending}
          className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all hover:scale-105 active:scale-95"
          style={{
            width: 40, height: 40,
            background: recording ? "var(--red)" : "var(--surface-raised)",
            border: `1px solid ${recording ? "var(--red)" : "var(--border)"}`,
            opacity: disabled ? 0.5 : 1,
          }}
          title={recording ? "Otkaži snimanje" : "Snimi glasovnu poruku"}
        >
          {recording ? <MicOff size={18} color="#fff" /> : <Mic size={18} style={{ color: "var(--text-secondary)" }} />}
        </button>

        <button
          onClick={handleSend}
          disabled={(!text.trim() && !recording) || sending || disabled}
          className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all hover:scale-105 active:scale-95"
          style={{
            width: 40, height: 40, padding: 0,
            background: "linear-gradient(135deg, var(--brand) 0%, #239684 100%)",
            boxShadow: "0 2px 8px rgba(43,181,160,0.4)",
            border: "none",
            opacity: (!text.trim() && !recording) || sending || disabled ? 0.45 : 1,
          }}
        >
          <Check size={18} color="#fff" strokeWidth={2.5} />
        </button>
      </div>
    </>
  )
}
