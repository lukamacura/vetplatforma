"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PawPrint, Building2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { connectOwnerToClinicBySlug, fetchClinicBySlug } from "@/lib/connections"
import { OtpStep } from "@/components/auth/otp-step"
import { requestOtp, verifyEmailOtp } from "@/lib/auth/otp"

function RegisterFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clinicSlug = searchParams.get("clinic")

  const [step, setStep] = useState<"form" | "code">("form")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [inviteClinicName, setInviteClinicName] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clinicSlug) return
    const supabase = createClient()
    fetchClinicBySlug(supabase, clinicSlug).then((clinic) => {
      if (clinic) setInviteClinicName(clinic.name)
    })
  }, [clinicSlug])

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: otpError } = await requestOtp(supabase, email, {
      shouldCreateUser: true,
      data: { role: "owner", full_name: fullName, phone },
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

    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        role: "owner",
        full_name: fullName,
        phone,
      })

    if (clinicSlug) {
      await connectOwnerToClinicBySlug(supabase, user.id, clinicSlug)
    }

    router.push("/klijent")
    router.refresh()
    return { error: null }
  }

  async function handleResend() {
    const supabase = createClient()
    return requestOtp(supabase, email, {
      shouldCreateUser: true,
      data: { role: "owner", full_name: fullName, phone },
    })
  }

  return (
    <main className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#2BB5A0]/10">
            <PawPrint className="h-6 w-6 text-[#2BB5A0]" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl leading-snug font-medium">
            {step === "form" ? "Kreirajte nalog" : "Potvrdite email"}
          </h1>
          <CardDescription>
            {step === "form" ? "Registracija za vlasnike ljubimaca" : "Unesite šifru iz email-a"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clinicSlug && step === "form" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#2BB5A0]/20 bg-[#2BB5A0]/5 p-3 text-sm text-[#239684]">
              <Building2 className="h-4 w-4 mt-0.5 flex-none" aria-hidden="true" />
              <p>
                {inviteClinicName ? (
                  <>
                    Registrujete se da biste postali digitalni klijent klinike{" "}
                    <span className="font-semibold">{inviteClinicName}</span>. Povezaćemo vas automatski.
                  </>
                ) : (
                  <>Registrujete se radi povezivanja sa klinikom. Povezaćemo vas automatski.</>
                )}
              </p>
            </div>
          )}

          {step === "form" ? (
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
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="06x xxx xxxx"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
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
                Bez lozinke — kreiramo nalog kodom poslatim na email.
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
                setStep("form")
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

export function RegisterForm() {
  return (
    <Suspense>
      <RegisterFormInner />
    </Suspense>
  )
}
