"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { PawPrint, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { connectOwnerToClinicBySlug, fetchClinicBySlug } from "@/lib/connections"

type View = "loading" | "notFound" | "loggedOut" | "connecting" | "wrongRole" | "error"

type Props = {
  slug: string
  initialClinicName: string | null
}

export function JoinClient({ slug, initialClinicName }: Props) {
  const router = useRouter()

  const [view, setView] = useState<View>("loading")
  const [clinicName, setClinicName] = useState<string>(initialClinicName ?? "")

  useEffect(() => {
    let cancelled = false

    async function run() {
      const supabase = createClient()

      const clinic = await fetchClinicBySlug(supabase, slug)
      if (cancelled) return

      if (!clinic) {
        setView("notFound")
        return
      }
      setClinicName(clinic.name)

      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return

      if (!user) {
        setView("loggedOut")
        return
      }

      setView("connecting")
      const result = await connectOwnerToClinicBySlug(supabase, user.id, slug)
      if (cancelled) return

      if (result.success) {
        router.replace("/klijent")
        return
      }

      if (result.error === "wrong-role") {
        setView("wrongRole")
        return
      }

      setView("error")
    }

    run()
    return () => {
      cancelled = true
    }
  }, [slug, router])

  if (view === "loading" || view === "connecting") {
    return (
      <main className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-[#2BB5A0] animate-spin mx-auto" aria-hidden="true" />
            <p className="text-sm text-muted-foreground" role="status">
              {view === "connecting" && clinicName
                ? `Povezujemo vas sa klinikom ${clinicName}...`
                : "Učitavanje..."}
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (view === "notFound") {
    return (
      <main className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="py-10 space-y-3">
            <h1 className="font-semibold">Klinika nije pronađena.</h1>
            <p className="text-sm text-muted-foreground">
              Proverite link koji ste dobili od veterinara.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (view === "wrongRole") {
    return (
      <main className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl">
          <CardContent className="py-10 text-center space-y-4">
            <div className="mx-auto w-fit bg-amber-100 p-3 rounded-full">
              <AlertCircle className="h-8 w-8 text-amber-600" aria-hidden="true" />
            </div>
            <h1 className="font-semibold">Ovaj link je za vlasnike ljubimaca.</h1>
            <p className="text-sm text-muted-foreground">
              Prijavljeni ste kao veterinar. Odjavite se i prijavite kao vlasnik da biste se povezali.
            </p>
            <Button
              onClick={() => router.push("/dashboard")}
              variant="outline"
              className="w-full"
            >
              Nazad na dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (view === "error") {
    return (
      <main className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="py-10 space-y-3">
            <h1 className="font-semibold">Došlo je do greške.</h1>
            <p className="text-sm text-muted-foreground">
              Pokušajte ponovo za par trenutaka.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full bg-[#2BB5A0] hover:bg-[#239684] text-white"
            >
              Pokušaj ponovo
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
      <Card className="max-w-sm w-full shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto bg-[#2BB5A0]/10 p-3 rounded-full w-fit">
            <PawPrint className="h-8 w-8 text-[#2BB5A0]" aria-hidden="true" />
          </div>
          <h1 className="font-heading text-xl leading-snug font-medium">Povežite se sa klinikom</h1>
          <CardDescription>
            Vaš veterinar <span className="font-semibold text-foreground">{clinicName}</span> Vas poziva da postanete digitalni klijent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-[#2BB5A0]/5 border border-[#2BB5A0]/20 rounded-lg p-3 text-sm text-[#239684]">
            Nakon registracije, automatski ćete biti povezani sa klinikom.
          </div>

          <div className="space-y-2">
            <Link href={`/register?clinic=${slug}`} className="block">
              <Button className="w-full h-12 text-base bg-[#2BB5A0] hover:bg-[#239684] text-white">
                Registrujte se i povežite se
              </Button>
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              Već imate nalog?{" "}
              <Link href={`/login?clinic=${slug}`} className="text-[#2BB5A0] font-medium">
                Prijavite se
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
