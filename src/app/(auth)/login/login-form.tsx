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

function LoginFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clinicSlug = searchParams.get("clinic")
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [inviteClinicName, setInviteClinicName] = useState<string | null>(null)

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

    const { data: hasAccount, error: rpcError } = await supabase.rpc("email_has_account", {
      p_email: email,
    })

    if (rpcError) {
      setLoading(false)
      setError("Došlo je do greške. Pokušajte ponovo.")
      return
    }

    if (!hasAccount) {
      setLoading(false)
      setError("Niste kreirali nalog.")
      return
    }

    const { error: otpError } = await requestOtp(supabase, email, { shouldCreateUser: true })
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

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()

    let role = profile?.role as string | undefined

    if (!profile) {
      const metaRole = (user.user_metadata?.role as string | undefined) ?? "owner"
      const fullName = (user.user_metadata?.full_name as string | undefined) ?? ""
      const phone = (user.user_metadata?.phone as string | null | undefined) ?? null
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        role: metaRole,
        full_name: fullName,
        phone,
      })
      if (upsertError) {
        return { error: "Profil nije mogao biti kreiran. Kontaktirajte podršku." }
      }
      role = metaRole
    }

    if (clinicSlug && role === "owner") {
      await connectOwnerToClinicBySlug(supabase, user.id, clinicSlug)
      router.push("/klijent")
    } else if (clinicSlug && role === "vet") {
      router.push(`/join/${clinicSlug}`)
    } else {
      router.push(role === "vet" ? "/dashboard" : "/klijent")
    }
    router.refresh()
    return { error: null }
  }

  async function handleResend() {
    const supabase = createClient()
    return requestOtp(supabase, email, { shouldCreateUser: true })
  }

  return (
    <main className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#2BB5A0]/10">
            <PawPrint className="h-6 w-6 text-[#2BB5A0]" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl leading-snug font-medium">VetPlatforma</h1>
          <CardDescription>
            {step === "email"
              ? "Prijavite se kodom poslatim na email"
              : "Unesite šifru iz email-a"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clinicSlug && step === "email" && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#2BB5A0]/20 bg-[#2BB5A0]/5 p-3 text-sm text-[#239684]">
              <Building2 className="h-4 w-4 mt-0.5 flex-none" aria-hidden="true" />
              <p>
                {inviteClinicName ? (
                  <>
                    Prijavite se da biste se povezali sa klinikom{" "}
                    <span className="font-semibold">{inviteClinicName}</span>. Povezaćemo vas automatski.
                  </>
                ) : (
                  <>Prijavite se radi povezivanja sa klinikom. Povezaćemo vas automatski.</>
                )}
              </p>
            </div>
          )}

          {step === "email" ? (
            <>
              <form onSubmit={handleSendCode} className="space-y-4">
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
                Uđite na mejl i kopirajte kod koji dobijete.
              </p>
              <p className="text-center text-sm text-muted-foreground mt-4">
                Nemate nalog?{" "}
                <Link href="/register" className="text-[#2BB5A0] font-medium hover:underline">
                  Registrujte se
                </Link>
              </p>
            </>
          ) : (
            <OtpStep
              email={email}
              onVerify={handleVerify}
              onResend={handleResend}
              onChangeEmail={() => {
                setStep("email")
                setError(null)
              }}
              verifyLabel="Prijavi se"
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export function LoginForm() {
  return (
    <Suspense>
      <LoginFormInner />
    </Suspense>
  )
}
