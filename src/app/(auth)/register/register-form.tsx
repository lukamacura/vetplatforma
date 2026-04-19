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

function RegisterFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clinicSlug = searchParams.get("clinic")

  const [role, setRole] = useState<"vet" | "owner">(clinicSlug ? "owner" : "vet")
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [inviteClinicName, setInviteClinicName] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!clinicSlug) return
    const supabase = createClient()
    fetchClinicBySlug(supabase, clinicSlug).then((clinic) => {
      if (clinic) setInviteClinicName(clinic.name)
    })
  }, [clinicSlug])

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, full_name: fullName, phone: phone || null },
      },
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Greška pri registraciji.")
      setLoading(false)
      return
    }

    const userId = data.user.id

    if (role === "vet") {
      const slug = clinicName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        + "-" + Math.random().toString(36).slice(2, 6)

      const { data: clinic, error: clinicError } = await supabase
        .from("clinics")
        .insert({ name: clinicName, slug, owner_id: userId })
        .select()
        .single()

      if (clinicError || !clinic) {
        setError("Klinika nije mogla biti kreirana.")
        setLoading(false)
        return
      }

      await supabase
        .from("profiles")
        .upsert({
          id: userId,
          role: "vet",
          full_name: fullName,
          phone: phone || null,
          clinic_id: clinic.id,
        })

      router.push("/dashboard")
    } else {
      await supabase
        .from("profiles")
        .upsert({
          id: userId,
          role: "owner",
          full_name: fullName,
          phone: phone || null,
        })

      if (clinicSlug) {
        await connectOwnerToClinicBySlug(supabase, userId, clinicSlug)
      }

      router.push("/klijent")
    }

    router.refresh()
  }

  return (
    <main className="min-h-screen bg-[#F7F9FB] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-[#2BB5A0]/10">
            <PawPrint className="h-6 w-6 text-[#2BB5A0]" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-2xl leading-snug font-medium">Kreirajte nalog</h1>
          <CardDescription>Brza registracija — bez kartice</CardDescription>
        </CardHeader>
        <CardContent>
          {clinicSlug && (
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
          <form onSubmit={handleRegister} className="space-y-4">
            {!clinicSlug && (
              <div className="flex rounded-lg border p-1 gap-1" role="radiogroup" aria-label="Tip naloga">
                <button
                  type="button"
                  onClick={() => setRole("vet")}
                  role="radio"
                  aria-checked={role === "vet"}
                  className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                    role === "vet"
                      ? "bg-teal-200 text-teal-600 font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Veterinar
                </button>
                <button
                  type="button"
                  onClick={() => setRole("owner")}
                  role="radio"
                  aria-checked={role === "owner"}
                  className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                    role === "owner"
                      ? "bg-teal-200 text-teal-600 font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Vlasnik ljubimca
                </button>
              </div>
            )}

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

            {role === "vet" && (
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
            )}

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

            <div className="space-y-2">
              <Label htmlFor="password">Lozinka</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 karaktera"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            <button
              type="submit"
              className="btn-primary w-full py-3 text-base"
              disabled={loading}
            >
              {loading ? "Kreiranje..." : "Kreiraj nalog"}
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

export function RegisterForm() {
  return (
    <Suspense>
      <RegisterFormInner />
    </Suspense>
  )
}
