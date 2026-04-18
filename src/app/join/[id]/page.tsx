"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { PawPrint, Loader2, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { connectOwnerToClinicBySlug, fetchClinicBySlug } from "@/lib/connections"

type View = "loading" | "notFound" | "loggedOut" | "connecting" | "wrongRole" | "error"

export default function JoinClinicPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.id as string

  const [view, setView] = useState<View>("loading")
  const [clinicName, setClinicName] = useState<string>("")

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
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl">
          <CardContent className="py-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 text-[#2BB5A0] animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">
              {view === "connecting" && clinicName
                ? `Povezujemo vas sa klinikom ${clinicName}...`
                : "Učitavanje..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (view === "notFound") {
    return (
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="py-10 space-y-3">
            <p className="font-semibold">Klinika nije pronađena.</p>
            <p className="text-sm text-muted-foreground">
              Proverite link koji ste dobili od veterinara.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (view === "wrongRole") {
    return (
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl">
          <CardContent className="py-10 text-center space-y-4">
            <div className="mx-auto w-fit bg-amber-100 p-3 rounded-full">
              <AlertCircle className="h-8 w-8 text-amber-600" />
            </div>
            <p className="font-semibold">Ovaj link je za vlasnike ljubimaca.</p>
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
      </div>
    )
  }

  if (view === "error") {
    return (
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="py-10 space-y-3">
            <p className="font-semibold">Došlo je do greške.</p>
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
      <Card className="max-w-sm w-full shadow-xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto bg-[#2BB5A0]/10 p-3 rounded-full w-fit">
            <PawPrint className="h-8 w-8 text-[#2BB5A0]" />
          </div>
          <CardTitle className="text-xl">Povežite se sa klinikom</CardTitle>
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
    </div>
  )
}
