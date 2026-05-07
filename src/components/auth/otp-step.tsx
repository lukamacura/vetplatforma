"use client"

import { useEffect, useRef, useState } from "react"
import { Mail } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  email: string
  onVerify: (code: string) => Promise<{ error: string | null }>
  onResend: () => Promise<{ error: string | null }>
  onChangeEmail: () => void
  verifyLabel?: string
}

const RESEND_SECONDS = 60

export function OtpStep({ email, onVerify, onResend, onChangeEmail, verifyLabel = "Potvrdi" }: Props) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6 || verifying) return
    setVerifying(true)
    setError(null)
    setInfo(null)
    const { error: verifyError } = await onVerify(code)
    if (verifyError) {
      setError(verifyError)
      setVerifying(false)
      setCode("")
      inputRef.current?.focus()
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return
    setResending(true)
    setError(null)
    setInfo(null)
    const { error: resendError } = await onResend()
    setResending(false)
    if (resendError) {
      setError(resendError)
      return
    }
    setInfo("Nova šifra je poslata.")
    setCooldown(RESEND_SECONDS)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-[#2BB5A0]/20 bg-[#2BB5A0]/5 p-3 text-sm text-[#239684]">
        <Mail className="h-4 w-4 mt-0.5 flex-none" aria-hidden="true" />
        <div className="space-y-1">
          <p>
            Šifra je poslata na <span className="font-semibold">{email}</span>.
          </p>
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-xs text-[#2BB5A0] hover:underline"
          >
            Promeni email
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otp">6-cifrena šifra</Label>
        <Input
          ref={inputRef}
          id="otp"
          name="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6)
            setCode(v)
            setError(null)
          }}
          className="h-12 text-center text-2xl tracking-[0.5em] font-mono"
          required
        />
      </div>

      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {info && !error && <p className="text-sm text-[#239684]">{info}</p>}

      <button
        type="submit"
        className="btn-primary w-full py-3 text-base"
        disabled={code.length !== 6 || verifying}
      >
        {verifying ? "Provera..." : verifyLabel}
      </button>

      <div className="text-center text-sm text-muted-foreground">
        Niste dobili šifru?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="text-[#2BB5A0] font-medium hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {cooldown > 0 ? `Pošalji ponovo (${cooldown}s)` : resending ? "Slanje..." : "Pošalji ponovo"}
        </button>
      </div>
    </form>
  )
}
