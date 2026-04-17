"use client"

import { useEffect, useState } from "react"
import { Search, Building2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import type { Clinic } from "@/lib/types"

export default function KlinikePage() {
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [busyClinicId, setBusyClinicId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const [{ data: clinicsData }, { data: connsData }] = await Promise.all([
        supabase.from("clinics").select("*").order("name"),
        supabase.from("connections").select("clinic_id").eq("owner_id", user.id),
      ])

      setClinics((clinicsData as Clinic[]) ?? [])
      setConnectedIds(new Set((connsData ?? []).map((c) => c.clinic_id)))
      setLoading(false)
    }
    load()
  }, [])

  async function handleConnect(clinicId: string) {
    if (!userId) return
    setBusyClinicId(clinicId)
    const supabase = createClient()
    const { error } = await supabase
      .from("connections")
      .upsert({ owner_id: userId, clinic_id: clinicId }, { onConflict: "owner_id,clinic_id" })
    if (!error) {
      setConnectedIds((prev) => new Set([...prev, clinicId]))
    }
    setBusyClinicId(null)
  }

  async function handleDisconnect(clinicId: string) {
    if (!userId) return
    setBusyClinicId(clinicId)
    const supabase = createClient()
    const { error } = await supabase
      .from("connections")
      .delete()
      .eq("owner_id", userId)
      .eq("clinic_id", clinicId)
    if (!error) {
      setConnectedIds((prev) => {
        const next = new Set(prev)
        next.delete(clinicId)
        return next
      })
    }
    setBusyClinicId(null)
  }

  const filtered = clinics.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Klinike</h1>
        <p className="text-muted-foreground text-sm">Pronađite svog veterinara i povežite se.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pretraži klinike..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">Učitavanje...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {clinics.length === 0
                ? "Nema registrovanih klinika."
                : "Nema rezultata pretrage."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((clinic) => {
            const isConnected = connectedIds.has(clinic.id)
            return (
              <div
                key={clinic.id}
                className="bg-white rounded-xl border p-4 flex items-center gap-4"
              >
                <div className="flex-none w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-(--brand)" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{clinic.name}</p>
                </div>
                {isConnected ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                    onClick={() => handleDisconnect(clinic.id)}
                    disabled={busyClinicId === clinic.id}
                  >
                    {busyClinicId === clinic.id ? "..." : "Prekini vezu"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleConnect(clinic.id)}
                    disabled={busyClinicId === clinic.id}
                    className="btn-primary"
                  >
                    {busyClinicId === clinic.id ? "..." : "Poveži se"}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
