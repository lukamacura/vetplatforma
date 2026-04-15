"use client"

import { useEffect, useState } from "react"
import { Plus, CheckCircle2, Circle, Scissors, Clock } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import type { Service } from "@/lib/types"

const DURATIONS: (15 | 30 | 60)[] = [15, 30, 60]

function ServiceRow({ service, onToggle, index }: {
  service: Service
  onToggle: () => void
  index: number
}) {
  return (
    <motion.div
      variants={stagger.row}
      className="flex items-center gap-3 rounded-xl px-4 py-3.5"
      style={{
        background: "var(--surface-raised)",
        border:     "1px solid var(--border)",
        opacity:    service.is_active ? 1 : 0.55,
      }}
    >
      {/* Icon */}
      <div className={`icon-sm ${service.is_active ? "icon-brand" : "icon-muted"} shrink-0`}>
        <Scissors size={13} strokeWidth={2.25} />
      </div>

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-600 truncate" style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {service.name}
        </p>
        {service.description && (
          <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {service.description}
          </p>
        )}
      </div>

      {/* Duration — blue (time/data) */}
      <span className="badge badge-blue shrink-0" style={{ gap: 4 }}>
        <Clock size={10} strokeWidth={2.5} />
        {service.duration_minutes} min
      </span>

      {/* Active toggle — switch style */}
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={onToggle}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs shrink-0 transition-all"
        style={{
          background:  service.is_active ? "var(--green-tint)" : "var(--surface-raised)",
          color:       service.is_active ? "var(--green)"      : "var(--text-muted)",
          border:      `1px solid ${service.is_active ? "rgba(22,163,74,0.25)" : "var(--border)"}`,
          fontWeight:  600,
          minWidth:    100,
        }}
        title={service.is_active ? "Klikni da deaktiviraš" : "Klikni da aktiviraš"}
      >
        {service.is_active
          ? <><CheckCircle2 size={13} strokeWidth={2.25} /> Aktivno</>
          : <><Circle       size={13} strokeWidth={1.75} /> Neaktivno</>
        }
      </motion.button>
    </motion.div>
  )
}

export default function ServicesPage() {
  const [services,      setServices]      = useState<Service[]>([])
  const [clinicId,      setClinicId]      = useState<string | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [isDialogOpen,  setIsDialogOpen]  = useState(false)
  const [saving,        setSaving]        = useState(false)

  const [newName,        setNewName]        = useState("")
  const [newDuration,    setNewDuration]    = useState<15 | 30 | 60>(30)
  const [newDescription, setNewDescription] = useState("")

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles").select("clinic_id").eq("id", user.id).single()
      const cid = profile?.clinic_id
      if (!cid) { setLoading(false); return }
      setClinicId(cid)

      const { data } = await supabase
        .from("services").select("*").eq("clinic_id", cid).order("created_at")
      setServices((data as Service[]) ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAdd() {
    if (!clinicId || !newName.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("services")
      .insert({
        clinic_id:        clinicId,
        name:             newName.trim(),
        duration_minutes: newDuration,
        description:      newDescription.trim() || null,
      })
      .select().single()

    if (!error && data) {
      setServices((prev) => [...prev, data as Service])
      setNewName("")
      setNewDuration(30)
      setNewDescription("")
      setIsDialogOpen(false)
    }
    setSaving(false)
  }

  async function toggleActive(service: Service) {
    const supabase = createClient()
    const { data } = await supabase
      .from("services")
      .update({ is_active: !service.is_active })
      .eq("id", service.id)
      .select().single()
    if (data) setServices((prev) => prev.map((s) => (s.id === service.id ? (data as Service) : s)))
  }

  const activeCount   = services.filter((s) =>  s.is_active).length
  const inactiveCount = services.filter((s) => !s.is_active).length

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="max-w-4xl mx-auto space-y-6"
    >

      {/* Header */}
      <motion.div variants={stagger.item} className="flex justify-between items-start gap-4">

        <div>
          <h1 className="text-2xl">Upravljanje uslugama</h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {!loading && (
              <>
                {activeCount > 0 && (
                  <span className="badge badge-green">
                    {activeCount} {activeCount === 1 ? "aktivna" : "aktivnih"}
                  </span>
                )}
                {inactiveCount > 0 && (
                  <span className="badge badge-muted">
                    {inactiveCount} neaktivnih
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Button
                className="btn-primary gap-2 font-600 shrink-0"
                style={{ fontWeight: 600 }}
              >
                <Plus size={16} strokeWidth={2.5} />
                Nova usluga
              </Button>
            </motion.div>
          </DialogTrigger>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj novu uslugu</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Naziv usluge</Label>
                <Input
                  id="name"
                  placeholder="npr. Godišnja vakcinacija"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Trajanje</Label>
                <div className="flex gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewDuration(d)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-600 transition-all"
                      style={{
                        fontWeight: 600,
                        ...(newDuration === d
                          ? { background: "var(--brand)", color: "white",              border: "1.5px solid var(--brand)" }
                          : { background: "var(--surface-raised)", color: "var(--text-secondary)", border: "1.5px solid var(--border)" }
                        ),
                      }}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="desc">Opis (opcionalno)</Label>
                <Input
                  id="desc"
                  placeholder="Kratak opis usluge..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Otkaži</Button>
              <Button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="text-white"
                style={{ background: "var(--brand)", border: "none" }}
              >
                {saving ? "Čuvanje..." : "Sačuvaj"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Service list */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl overflow-hidden">

        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-sm font-600" style={{ fontWeight: 600 }}>Katalog usluga</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Aktivne usluge su vidljive vlasnicima pri zakazivanju.
            </p>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="space-y-2.5">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="py-14 text-center">
              <div className="icon-lg icon-brand mx-auto mb-4">
                <Scissors size={20} strokeWidth={1.75} />
              </div>
              <p className="font-600 text-sm mb-1" style={{ fontWeight: 600 }}>Još nema usluga</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Dodajte prvu uslugu da biste omogućili zakazivanje.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <motion.div variants={stagger.container} initial="hidden" animate="visible" className="space-y-2">
                {services.map((s, i) => (
                  <ServiceRow key={s.id} service={s} onToggle={() => toggleActive(s)} index={i} />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
