"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { PawPrint, CheckCircle2, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import type { Clinic } from "@/lib/types"

export default function JoinClinicPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.id as string

  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [alreadyConnected, setAlreadyConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [done, setDone] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)
  const [roleError, setRoleError] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data: clinicData } = await supabase
        .from("clinics")
        .select("*")
        .eq("slug", slug)
        .single()

      if (!clinicData) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setClinic(clinicData as Clinic)

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setIsLoggedIn(true)
        const { data: conn } = await supabase
          .from("connections")
          .select("id")
          .eq("owner_id", user.id)
          .eq("clinic_id", clinicData.id)
          .single()
        if (conn) setAlreadyConnected(true)
      }

      setLoading(false)
    }
    load()
  }, [slug])

  async function handleConnect() {
    if (!clinic) return
    setConnecting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/register?clinic=${slug}`)
      return
    }

    // Get or check profile is owner role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "owner") {
      setConnecting(false)
      setRoleError(true)
      return
    }

    await supabase
      .from("connections")
      .upsert({ owner_id: user.id, clinic_id: clinic.id }, { onConflict: "owner_id,clinic_id" })

    setConnecting(false)
    setDone(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Učitavanje...</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full text-center">
          <CardContent className="py-10 space-y-3">
            <p className="font-semibold">Klinika nije pronađena.</p>
            <p className="text-sm text-muted-foreground">Proverite link koji ste dobili od veterinara.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (done || alreadyConnected) {
    return (
      <div className="min-h-screen bg-[#f0fbf9] flex items-center justify-center p-4">
        <Card className="max-w-sm w-full shadow-xl">
          <CardContent className="py-10 text-center space-y-5">
            <div className="mx-auto w-fit bg-emerald-100 p-3 rounded-full">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold">
                {alreadyConnected && !done ? "Već ste povezani!" : "Uspešno povezani!"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Sada ste u sistemu klinike <span className="font-semibold text-foreground">{clinic?.name}</span>.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 text-left border">
              <Heart className="h-6 w-6 text-red-500 fill-red-500 flex-none" />
              <p className="text-xs text-muted-foreground">
                Vaš veterinar će Vas obavestiti o sledećoj vakcinaciji čim unese podatke Vašeg ljubimca.
              </p>
            </div>
            <Button
              onClick={() => router.push("/klijent")}
              className="w-full bg-[#2BB5A0] hover:bg-[#239684] text-white"
            >
              Idi na početnu
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
            Vaš veterinar <span className="font-semibold text-foreground">{clinic?.name}</span> Vas poziva da postanete digitalni klijent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-[#2BB5A0]/5 border border-[#2BB5A0]/20 rounded-lg p-3 text-sm text-[#239684]">
            Vaš veterinar dobija trenutni uvid u vitalne podatke Vašeg ljubimca — vakcinacije, kontrole, težina.
          </div>

          {!isLoggedIn ? (
            <div className="space-y-2">
              <Link href={`/register?clinic=${slug}`}>
                <Button className="w-full h-12 text-base bg-[#2BB5A0] hover:bg-[#239684] text-white">
                  Registrujte se i povežite se
                </Button>
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                Već imate nalog?{" "}
                <Link href={`/login?clinic=${slug}`} className="text-[#2BB5A0] font-medium">Prijavite se</Link>
              </p>
            </div>
          ) : (
            <>
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full h-12 text-base bg-[#2BB5A0] hover:bg-[#239684] text-white"
              >
                {connecting ? "Povezivanje..." : "Poveži se sa klinikom"}
              </Button>
              {roleError && (
                <p className="text-sm text-red-600 text-center">
                  Ovaj link je namenjen vlasnicima ljubimaca, ne veterinarima.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
