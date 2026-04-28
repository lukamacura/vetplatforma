"use client"

import { useEffect, useRef, useState } from "react"
import { Play, Pause } from "lucide-react"
import { fmtDuration } from "./helpers"

export function VoicePlayer({
  url,
  duration,
  mine = false,
}: {
  url: string
  duration: number | null
  mine?: boolean
}) {
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
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("ended", onEnd)
    }
  }, [])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  const trackBg   = mine ? "rgba(255,255,255,0.25)" : "rgba(43,181,160,0.2)"
  const trackFill = mine ? "rgba(255,255,255,0.9)"  : "var(--brand)"
  const btnBg     = mine ? "rgba(255,255,255,0.2)"  : "rgba(43,181,160,0.15)"
  const btnBorder = mine ? "rgba(255,255,255,0.3)"  : "rgba(43,181,160,0.4)"
  const iconColor = mine ? "#fff" : "var(--brand)"
  const timeColor = mine ? "rgba(255,255,255,0.75)" : "var(--text-muted)"

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 180 }}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <button
        onClick={toggle}
        className="flex items-center justify-center rounded-full flex-shrink-0"
        style={{ width: 32, height: 32, background: btnBg, border: `1px solid ${btnBorder}` }}
      >
        {playing ? <Pause size={13} color={iconColor} /> : <Play size={13} color={iconColor} />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="rounded-full overflow-hidden cursor-pointer"
          style={{ height: 4, background: trackBg }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect()
            if (audioRef.current) {
              audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * (audioRef.current.duration || 0)
            }
          }}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: trackFill }} />
        </div>
        <span style={{ fontSize: 11, color: timeColor }}>
          {playing ? fmtDuration(currentTime) : fmtDuration(duration)}
        </span>
      </div>
    </div>
  )
}
