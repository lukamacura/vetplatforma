"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PawPrint, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

const VET_ACCESS_KEY = "VET2026"

export function VetRegisterForm() {
  const [step, setStep] = useState<"key" | "register">("key")
  const [accessKey, setAccessKey] = useState("")
  const [keyError, setKeyError] = useState<string | null>(null)

  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [clinicName, setClinicName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role: "vet", full_name: fullName, phone: phone || null },
      },
    })

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "Greška pri registraciji.")
      setLoading(false)
      return
    }

    const userId = data.user.id

    const slug =
      clinicName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") +
      "-" +
      Math.random().toString(36).slice(2, 6)

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

    await supabase.from("profiles").upsert({
      id: userId,
      role: "vet",
      full_name: fullName,
      phone: phone || null,
      clinic_id: clinic.id,
    })

    router.push("/dashboard")
    router.refresh()
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
          <h1 className="font-heading text-2xl leading-snug font-medium">Registracija veterinara</h1>
          <CardDescription>Kreirajte kliniku i nalog — 30 dana besplatno</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
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
