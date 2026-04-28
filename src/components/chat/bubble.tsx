"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, CheckCheck } from "lucide-react"
import type { Message } from "./types"
import { formatTime } from "./helpers"
import { VoicePlayer } from "./voice-player"

export function Bubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const [imgOpen, setImgOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={`flex ${isMine ? "justify-end" : "justify-start"} mb-1`}
    >
      <div style={{ maxWidth: "min(560px, 78%)" }}>
        <div
          className="rounded-2xl px-3 py-2"
          style={{
            background: isMine
              ? "linear-gradient(135deg, var(--brand) 0%, #239684 100%)"
              : "var(--surface)",
            color: isMine ? "#fff" : "var(--text-primary)",
            border: isMine ? "none" : "1px solid var(--border)",
            boxShadow: isMine
              ? "0 2px 12px rgba(43,181,160,0.3)"
              : "0 1px 4px rgba(0,0,0,0.06)",
            borderBottomRightRadius: isMine ? 4 : 16,
            borderBottomLeftRadius: isMine ? 16 : 4,
          }}
        >
          {msg.message_type === "text" && (
            <p style={{ fontSize: 14, lineHeight: 1.55, wordBreak: "break-word", margin: 0 }}>
              {msg.content}
            </p>
          )}

          {msg.message_type === "image" && msg.file_url && (
            <>
              <img
                src={msg.file_url}
                alt={msg.file_name ?? "slika"}
                className="rounded-xl cursor-pointer object-cover"
                style={{ maxWidth: 260, maxHeight: 220, display: "block" }}
                onClick={() => setImgOpen(true)}
              />
              {msg.content && (
                <p style={{ fontSize: 14, marginTop: 6, marginBottom: 0, wordBreak: "break-word" }}>
                  {msg.content}
                </p>
              )}
              <AnimatePresence>
                {imgOpen && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.88)" }}
                    onClick={() => setImgOpen(false)}
                  >
                    <img
                      src={msg.file_url!}
                      alt=""
                      className="max-w-full max-h-full rounded-xl"
                      onClick={e => e.stopPropagation()}
                    />
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
            <video
              src={msg.file_url}
              controls
              className="rounded-xl"
              style={{ maxWidth: 280, maxHeight: 220, display: "block" }}
            />
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
