"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PawPrint, Building2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { connectOwnerToClinicBySlug, fetchClinicBySlug } from "@/lib/connections"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clinicSlug = searchParams.get("clinic")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError("Pogrešan email ili lozinka.")
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    const role = profile?.role ?? (user.user_metadata?.role as string | undefined)

    if (clinicSlug && role === "owner") {
      await connectOwnerToClinicBySlug(supabase, user.id, clinicSlug)
      router.push("/klijent")
    } else if (clinicSlug && role === "vet") {
      router.push(`/join/${clinicSlug}`)
    } else {
      router.push(role === "vet" ? "/dashboard" : "/klijent")
    }
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#2BB5A0]/10">
            <PawPrint className="h-6 w-6 text-[#2BB5A0]" />
          </div>
          <CardTitle className="text-2xl">VetPlatforma</CardTitle>
          <CardDescription>Prijavite se na Vaš nalog</CardDescription>
        </CardHeader>
        <CardContent>
          {clinicSlug && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#2BB5A0]/20 bg-[#2BB5A0]/5 p-3 text-sm text-[#239684]">
              <Building2 className="h-4 w-4 mt-0.5 flex-none" />
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
          <form onSubmit={handleLogin} className="space-y-4">
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
            <div className="space-y-2">
              <Label htmlFor="password">Lozinka</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading}
            >
              {loading ? "Prijavljivanje..." : "Prijavi se"}
            </button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Nemate nalog?{" "}
            <Link href="/register" className="text-[#2BB5A0] font-medium hover:underline">
              Registrujte se
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
