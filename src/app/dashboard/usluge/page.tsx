"use client"

import { useEffect, useState } from "react"
import { Plus, CheckCircle2, Circle, Scissors, Clock, Banknote, Timer } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { suggestBuffer } from "@/lib/scheduling"
import type { Service } from "@/lib/types"

function formatPrice(price: number): string {
  return price.toLocaleString("sr-Latn-RS") + " RSD"
}

function ServiceRow({ service, onToggle, onClick }: {
  service: Service
  onToggle: (e: React.MouseEvent) => void
  onClick: () => void
}) {
  return (
    <motion.div
      variants={stagger.row}
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl px-4 py-3.5 cursor-pointer transition-all"
      style={{
        background: "var(--surface-raised)",
        border:     "1px solid var(--border)",
        opacity:    service.is_active ? 1 : 0.55,
      }}
      whileHover={{ y: -1, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
    >
      <div className={`icon-sm ${service.is_active ? "icon-brand" : "icon-muted"} shrink-0`}>
        <Scissors size={13} strokeWidth={2.25} />
      </div>

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

      <span className="badge badge-blue shrink-0" style={{ gap: 4 }}>
        <Clock size={10} strokeWidth={2.5} />
        {service.duration_minutes} min
      </span>

      <span className="badge badge-green shrink-0" style={{ gap: 4 }}>
        <Banknote size={10} strokeWidth={2.5} />
        {formatPrice(service.price_rsd)}
      </span>

      {service.buffer_after_minutes > 0 && (
        <span className="badge badge-amber shrink-0" style={{ gap: 4 }}>
          <Timer size={10} strokeWidth={2.5} />
          +{service.buffer_after_minutes}m
        </span>
      )}

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
  const [editingService, setEditingService] = useState<Service | null>(null)

  const [formName,        setFormName]        = useState("")
  const [formDuration,    setFormDuration]    = useState(30)
  const [formDescription, setFormDescription] = useState("")
  const [formPrice,       setFormPrice]       = useState("")
  const [formBuffer,      setFormBuffer]      = useState(5)

  function resetForm() {
    setFormName("")
    setFormDuration(30)
    setFormDescription("")
    setFormPrice("")
    setFormBuffer(suggestBuffer(30))
    setEditingService(null)
  }

  function openCreate() {
    resetForm()
    setIsDialogOpen(true)
  }

  function openEdit(service: Service) {
    setEditingService(service)
    setFormName(service.name)
    setFormDuration(service.duration_minutes)
    setFormDescription(service.description ?? "")
    setFormPrice(service.price_rsd.toString())
    setFormBuffer(service.buffer_after_minutes)
    setIsDialogOpen(true)
  }

  function handleDialogChange(open: boolean) {
    setIsDialogOpen(open)
    if (!open) resetForm()
  }

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

  const parsedPrice = formPrice.trim() ? parseInt(formPrice, 10) : NaN
  const isFormValid = formName.trim().length > 0
    && formDuration >= 5
    && !isNaN(parsedPrice)
    && parsedPrice >= 0

  async function handleSave() {
    if (!clinicId || !isFormValid) return
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name:                 formName.trim(),
      duration_minutes:     formDuration,
      description:          formDescription.trim() || null,
      price_rsd:            parsedPrice,
      buffer_after_minutes: formBuffer,
    }

    if (editingService) {
      const { data, error } = await supabase
        .from("services")
        .update(payload)
        .eq("id", editingService.id)
        .select().single()

      if (!error && data) {
        setServices((prev) => prev.map((s) => s.id === editingService.id ? (data as Service) : s))
        handleDialogChange(false)
      }
    } else {
      const { data, error } = await supabase
        .from("services")
        .insert({ clinic_id: clinicId, ...payload })
        .select().single()

      if (!error && data) {
        setServices((prev) => [...prev, data as Service])
        handleDialogChange(false)
      }
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

        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Button
            onClick={openCreate}
            className="btn-primary gap-2 font-600 shrink-0"
            style={{ fontWeight: 600 }}
          >
            <Plus size={16} strokeWidth={2.5} />
            Nova usluga
          </Button>
        </motion.div>
      </motion.div>

      {/* Shared create / edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? "Izmeni uslugu" : "Dodaj novu uslugu"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="svc-name">Naziv usluge</Label>
              <Input
                id="svc-name"
                placeholder="npr. Godišnja vakcinacija"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-duration">Trajanje (minuti)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="svc-duration"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  placeholder="30"
                  value={formDuration}
                  onChange={(e) => {
                    const dur = Math.max(5, parseInt(e.target.value, 10) || 5)
                    setFormDuration(dur)
                    if (!editingService) setFormBuffer(suggestBuffer(dur))
                  }}
                  className="flex-1"
                />
                <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>min</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Od 5 do 480 minuta
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-price">Cena u RSD</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={100}
                  placeholder="npr. 3000"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="flex-1"
                  required
                />
                <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>RSD</span>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-buffer">Pauza nakon usluge (minuti)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="svc-buffer"
                  type="number"
                  min={0}
                  max={60}
                  step={5}
                  value={formBuffer}
                  onChange={(e) => setFormBuffer(Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)))}
                  className="flex-1"
                />
                <span className="text-sm shrink-0" style={{ color: "var(--text-muted)" }}>min</span>
              </div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Vreme za čišćenje/pripremu pre sledećeg termina. Preporučeno: {suggestBuffer(formDuration)} min
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="svc-desc">Opis (opcionalno)</Label>
              <Input
                id="svc-desc"
                placeholder="Kratak opis usluge..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>Otkaži</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !isFormValid}
              className="text-white"
              style={{ background: "var(--brand)", border: "none" }}
            >
              {saving ? "Čuvanje..." : "Sačuvaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service list */}
      <motion.div variants={stagger.item} className="solid-card rounded-2xl overflow-hidden">

        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-sm font-600" style={{ fontWeight: 600 }}>Katalog usluga</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Kliknite na uslugu da biste je izmenili.
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
                {services.map((s) => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    onToggle={(e) => { e.stopPropagation(); toggleActive(s) }}
                    onClick={() => openEdit(s)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
