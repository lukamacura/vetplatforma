"use client"

import { useRef, useState } from "react"

export interface VoiceRecording {
  blob: Blob
  duration: number
  mimeType: string
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef   = useRef<Blob[]>([])
  const recordTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null)
  const mimeTypeRef      = useRef<string>("audio/webm")

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
      mimeTypeRef.current = mimeType
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

  async function stop(): Promise<VoiceRecording | null> {
    const mr = mediaRecorderRef.current
    if (!mr) return null
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    const duration = recordSeconds

    await new Promise<void>(resolve => {
      mr.onstop = () => resolve()
      mr.stop()
      mr.stream.getTracks().forEach(t => t.stop())
    })

    const mimeType = mimeTypeRef.current
    const blob = new Blob(audioChunksRef.current, { type: mimeType })
    setRecording(false)
    setRecordSeconds(0)
    if (blob.size === 0) return null
    return { blob, duration, mimeType }
  }

  return { recording, recordSeconds, start, stop }
}
