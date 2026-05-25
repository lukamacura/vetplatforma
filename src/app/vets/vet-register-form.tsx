"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PawPrint, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { OtpStep } from "@/components/auth/otp-step"
import { requestOtp, verifyEmailOtp } from "@/lib/auth/otp"

const VET_ACCESS_KEY = "VET2026"

export function VetRegisterForm() {
  const [step, setStep] = useState<"key" | "register" | "code">("key")
  const [accessKey, setAccessKey] = useState("")
  const [keyError, setKeyError] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const router = useRouter()

  function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (accessKey.trim() === VET_ACCESS_KEY) {
      setStep("register")
    } else {
      setKeyError("Pogrešan ključ. Obratite se timu VetPlatforme.")
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: otpError } = await requestOtp(supabase, email, {
      shouldCreateUser: true,
      data: { role: "vet", full_name: fullName, phone: phone || null },
    })
    setLoading(false)

    if (otpError) {
      setError(otpError)
      return
    }
    setStep("code")
  }

  async function handleVerify(code: string) {
    const supabase = createClient()
    const { error: verifyError } = await verifyEmailOtp(supabase, email, code)
    if (verifyError) return { error: verifyError }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Sesija nije uspostavljena. Pokušajte ponovo." }

    const slug =
      clinicName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6)

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({ name: clinicName, slug, owner_id: user.id })
      .select()
      .single()

    if (clinicError || !clinic) {
      return { error: "Klinika nije mogla biti kreirana." }
    }

    await supabase.from("profiles").upsert({
      id: user.id,
      role: "vet",
      full_name: fullName,
      phone: phone || null,
      clinic_id: clinic.id,
    })

    router.push("/dashboard")
    router.refresh()
    return { error: null }
  }

  async function handleResend() {
    const supabase = createClient()
    return requestOtp(supabase, email, {
      shouldCreateUser: true,
      data: { role: "vet", full_name: fullName, phone: phone || null },
    })
  }

  if (step === "key") {
    return (
      <main className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm shadow-lg">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#2BB5A0]/10">
              <Lock className="h-6 w-6 text-[#2BB5A0]" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl leading-snug font-medium">Pristup za veterinare</h1>
            <CardDescription>Unesite pristupni ključ koji ste dobili od tima VetPlatforme</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleKeySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessKey">Pristupni ključ</Label>
                <Input
                  id="accessKey"
                  type="password"
                  placeholder="••••••••"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value)
                    setKeyError(null)
                  }}
                  required
                />
              </div>
              {keyError && <p className="text-sm text-red-600" role="alert">{keyError}</p>}
              <button type="submit" className="btn-primary w-full py-3 text-base">
                Potvrdi
              </button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-4">
              Već imate nalog?{" "}
              <Link href="/login" className="text-[#2BB5A0] font-medium hover:underline">
                Prijavite se
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#2BB5A0]/10">
            <PawPrint className="h-6 w-6 text-[#2BB5A0]" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl leading-snug font-medium">
            {step === "register" ? "Registracija veterinara" : "Potvrdite email"}
          </h1>
          <CardDescription>
            {step === "register"
              ? "Kreirajte kliniku i nalog — 30 dana besplatno"
              : "Unesite šifru iz email-a"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "register" ? (
            <>
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Ime i prezime</Label>
                  <Input
                    id="fullName"
                    placeholder="Marko Marković"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clinicName">Naziv klinike / ambulante</Label>
                  <Input
                    id="clinicName"
                    placeholder="Vet Ambulanta Novi Sad"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon (opcionalno)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="06x xxx xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="vas@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

                <button
                  type="submit"
                  className="btn-primary w-full py-3 text-base"
                  disabled={loading}
                >
                  {loading ? "Slanje..." : "Pošalji kod"}
                </button>
              </form>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Bez lozinke — potvrdićemo email kodom.
              </p>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Već imate nalog?{" "}
                <Link href="/login" className="text-[#2BB5A0] font-medium hover:underline">
                  Prijavite se
                </Link>
              </p>
            </>
          ) : (
            <OtpStep
              email={email}
              onVerify={handleVerify}
              onResend={handleResend}
              onChangeEmail={() => {
                setStep("register")
                setError(null)
              }}
              verifyLabel="Kreiraj nalog"
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
