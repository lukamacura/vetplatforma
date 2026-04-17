"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Camera, X as XIcon, CheckCircle } from "lucide-react"
import { motion } from "framer-motion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { stagger } from "@/lib/motion"
import { SPECIES_OPTIONS, SPECIES_IMAGE } from "@/lib/species"
import { GENDER_OPTIONS, BREED_PLACEHOLDER, COLOR_PLACEHOLDER, buildPetPayload } from "@/lib/pet-form"
import type { Species, Gender, Pet } from "@/lib/types"

export default function EditPetPage() {
  const router = useRouter()
  const params = useParams()
  const petId  = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name,           setName]           = useState("")
  const [species,        setSpecies]        = useState<Species>("dog")
  const [breed,          setBreed]          = useState("")
  const [gender,         setGender]         = useState<Gender>("unknown")
  const [chipId,         setChipId]         = useState("")
  const [passportNumber, setPassportNumber] = useState("")
  const [birthDate,      setBirthDate]      = useState("")
  const [color,          setColor]          = useState("")
  const [weightKg,       setWeightKg]       = useState("")
  /** Shared with vet dashboard (`pets.vet_notes`); legacy `owner_notes` is merged on load only. */
  const [petNotes,       setPetNotes]       = useState("")
  const [photoUrl,       setPhotoUrl]       = useState<string | null>(null)
  const [photoFile,      setPhotoFile]      = useState<File | null>(null)
  const [photoPreview,   setPhotoPreview]   = useState<string | null>(null)
  const [saving,         setSaving]         = useState(false)
  const [saved,          setSaved]          = useState(false)
  const [error,          setError]          = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from("pets")
        .select("id, name, species, breed, gender, chip_id, passport_number, birth_date, color, weight_kg, photo_url, vet_notes, owner_notes")
        .eq("id", petId)
        .eq("owner_id", user.id)
        .single()

      if (!data) { router.push("/klijent/ljubimci"); return }

      const pet = data as Pick<Pet, "id" | "name" | "species" | "breed" | "gender" | "chip_id" | "passport_number" | "birth_date" | "color" | "weight_kg" | "photo_url" | "vet_notes" | "owner_notes">
      setName(pet.name)
      setSpecies(pet.species)
      setBreed(pet.breed ?? "")
      setGender((pet.gender as Gender) ?? "unknown")
      setChipId(pet.chip_id ?? "")
      setPassportNumber(pet.passport_number ?? "")
      setBirthDate(pet.birth_date ?? "")
      setColor(pet.color ?? "")
      setWeightKg(pet.weight_kg !== null ? String(pet.weight_kg) : "")
      setPetNotes((pet.vet_notes ?? pet.owner_notes) ?? "")
      setPhotoUrl(pet.photo_url ?? null)
      setLoading(false)
    }
    load()
  }, [petId, router])

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError("Slika je prevelika (max 5MB)")
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function removePhoto() {
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile) return photoUrl
    setUploadingPhoto(true)
    const supabase = createClient()
    const ext = photoFile.name.split(".").pop() ?? "jpg"
    const path = `${petId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from("pet-photos")
      .upload(path, photoFile, { cacheControl: "3600", upsert: true })
    setUploadingPhoto(false)
    if (uploadError) {
      setError("Greška pri slanju slike.")
      return photoUrl
    }
    const { data: { publicUrl } } = supabase.storage.from("pet-photos").getPublicUrl(path)
    return publicUrl
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const finalPhotoUrl = await uploadPhoto()

    const { error: updateError } = await supabase
      .from("pets")
      .update({
        ...buildPetPayload({
          name, species, breed, gender,
          chipId, passportNumber, birthDate, color, weightKg,
          petNotes,
        }),
        owner_notes: null,
        photo_url:   finalPhotoUrl,
      })
      .eq("id", petId)
      .eq("owner_id", user.id)

    if (updateError) {
      setError("Greška pri čuvanju podataka.")
      setSaving(false)
      return
    }

    setSaving(false)
    setSaved(true)
    setPhotoUrl(finalPhotoUrl)
    setPhotoFile(null)
    setTimeout(() => setSaved(false), 3000)
  }

  const currentSpeciesImage = SPECIES_IMAGE[species] ?? SPECIES_IMAGE.other
  const displayPhoto = photoPreview ?? photoUrl

  if (loading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-10 w-48 rounded-xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: "var(--surface-raised)" }} />
      </div>
    )
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="back-link flex items-center gap-1.5 text-xs"
          style={{ fontWeight: 600 }}
        >
          <ArrowLeft size={16} strokeWidth={2} />
        </button>
        <h1 className="text-xl" style={{ fontWeight: 700, letterSpacing: "-0.03em" }}>
          Uredi ljubimca
        </h1>
      </motion.div>

      {/* Photo section */}
      <motion.div variants={stagger.item} className="flex flex-col items-center gap-3">
        <div className="relative">
          {displayPhoto ? (
            <div
              className="relative overflow-hidden"
              style={{
                width: 100, height: 100, borderRadius: "50%",
                border: "3px solid var(--brand)",
                boxShadow: "0 4px 20px rgba(43,181,160,0.2)",
              }}
            >
              <Image
                src={displayPhoto}
                alt={name || "Ljubimac"}
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-0 right-0 p-1 rounded-full"
                style={{
                  background: "var(--red)", color: "#fff",
                  boxShadow: "0 2px 6px rgba(220,38,38,0.3)",
                }}
              >
                <XIcon size={12} strokeWidth={2.5} />
              </button>
            </div>
          ) : (
            <div
              className="relative flex items-center justify-center select-none overflow-hidden"
              style={{
                width: 100, height: 100, borderRadius: "50%",
                background: "var(--surface-raised)",
                border: "3px dashed var(--border-strong)",
              }}
            >
              <Image
                src={currentSpeciesImage}
                alt=""
                fill
                sizes="100px"
                className="object-contain"
                style={{ padding: 10 }}
              />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5"
          style={{
            fontWeight: 600, color: "var(--brand)",
            background: "var(--brand-tint)",
            border: "1px solid rgba(43,181,160,0.2)",
            transition: "all 0.2s ease",
          }}
        >
          <Camera size={13} strokeWidth={2} />
          {displayPhoto ? "Promeni sliku" : "Dodaj sliku"}
        </button>
      </motion.div>

      {/* Form */}
      <motion.div variants={stagger.item}>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="solid-card rounded-2xl p-5 space-y-4">
            {/* Ime */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs" style={{ fontWeight: 600 }}>Ime *</Label>
              <Input
                id="name"
                placeholder="npr. Bobi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Vrsta */}
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ fontWeight: 600 }}>Vrsta *</Label>
              <div className="grid grid-cols-4 gap-2">
                {SPECIES_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSpecies(opt.value)}
                    className="py-2.5 rounded-xl text-sm transition-all flex flex-col items-center gap-1"
                    style={{
                      fontWeight: 600,
                      background:  species === opt.value ? "var(--brand-tint)" : "var(--surface-raised)",
                      color:       species === opt.value ? "var(--brand)" : "var(--text-secondary)",
                      border:      species === opt.value ? "1px solid rgba(43,181,160,0.3)" : "1px solid var(--border)",
                      transform:   species === opt.value ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    <Image
                      src={opt.image}
                      alt=""
                      width={36}
                      height={36}
                      className="object-contain"
                      style={{ height: 36, width: 36 }}
                    />
                    <span className="text-[11px]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rasa */}
            <div className="space-y-1.5">
              <Label htmlFor="breed" className="text-xs" style={{ fontWeight: 600 }}>Rasa</Label>
              <Input
                id="breed"
                placeholder={BREED_PLACEHOLDER[species]}
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
              />
            </div>

            {/* Pol */}
            <div className="space-y-1.5">
              <Label className="text-xs" style={{ fontWeight: 600 }}>Pol *</Label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGender(opt.value)}
                    className="py-2.5 rounded-xl text-sm transition-all"
                    style={{
                      fontWeight: 600,
                      background:  gender === opt.value ? "var(--brand-tint)" : "var(--surface-raised)",
                      color:       gender === opt.value ? "var(--brand)" : "var(--text-secondary)",
                      border:      gender === opt.value ? "1px solid rgba(43,181,160,0.3)" : "1px solid var(--border)",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="solid-card rounded-2xl p-5 space-y-4">
            {/* Datum rođenja i boja */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="birth" className="text-xs" style={{ fontWeight: 600 }}>Datum rođenja</Label>
                <Input
                  id="birth"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="color" className="text-xs" style={{ fontWeight: 600 }}>Boja</Label>
                <Input
                  id="color"
                  placeholder={COLOR_PLACEHOLDER[species]}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
            </div>

            {/* Težina */}
            <div className="space-y-1.5">
              <Label htmlFor="weight" className="text-xs" style={{ fontWeight: 600 }}>Težina (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0"
                placeholder="npr. 8.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>

            {/* Broj mikročipa i pasosa */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="chip" className="text-xs" style={{ fontWeight: 600 }}>Broj mikročipa</Label>
                <Input
                  id="chip"
                  placeholder="688038..."
                  value={chipId}
                  onChange={(e) => setChipId(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="passport" className="text-xs" style={{ fontWeight: 600 }}>Broj pasoša</Label>
                <Input
                  id="passport"
                  placeholder="RS-123456"
                  value={passportNumber}
                  onChange={(e) => setPassportNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Ista beleška kao na kartici pacijenta u dashboardu (pets.vet_notes) */}
            <div className="space-y-1.5">
              <Label htmlFor="petNotes">Napomena za veterinara</Label>
              <textarea
                id="petNotes"
                className="w-full min-h-[100px] rounded-xl text-sm resize-y px-3 py-2"
                style={{
                  background: "var(--surface-raised)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                }}
                placeholder="npr. alergije, hronična stanja, navike u ponašanju..."
                value={petNotes}
                onChange={(e) => setPetNotes(e.target.value)}
              />
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Ista napomena koju vidi i menja veterinar na profilu ljubimca.
              </p>
            </div>
          </div>

          {error && (
            <p className="text-sm px-1" style={{ color: "var(--red)", fontWeight: 500 }}>{error}</p>
          )}

          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="flex-1">
              <button
                type="submit"
                disabled={saving || uploadingPhoto || !name.trim()}
                className="btn-primary w-full py-3 text-sm"
                style={{ fontWeight: 600 }}
              >
                {saving || uploadingPhoto ? "Čuvanje..." : "Sačuvaj izmene"}
              </button>
            </motion.div>
            {saved && (
              <motion.div
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1.5 text-sm shrink-0"
                style={{ color: "var(--green)", fontWeight: 600 }}
              >
                <CheckCircle size={15} strokeWidth={2.25} />
                Sačuvano
              </motion.div>
            )}
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
