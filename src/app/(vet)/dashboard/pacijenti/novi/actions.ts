"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { buildPetPayload, type PetFormValues } from "@/lib/pet-form"

// Service-role client — bypasses RLS. Used here only AFTER we've verified the
// caller is a vet of the clinic, because creating another person's auth user +
// profile is impossible through the RLS-scoped client (profiles is self-only).
function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export interface CreateManagedClientInput {
  fullName: string
  phone: string
  pets: PetFormValues[]
}

export type CreateManagedClientResult =
  | { ok: true; ownerId: string }
  | { ok: false; error: string }

/**
 * Vet creates a fully managed pet-owner account (name + phone) and their pets,
 * auto-connected to the vet's clinic. The owner gets a hidden placeholder email
 * identity — required because profiles.id → auth.users is NOT NULL — and can't
 * log in themselves; these are vet-managed records.
 */
export async function createManagedClient(
  input: CreateManagedClientInput,
): Promise<CreateManagedClientResult> {
  try {
    const fullName = input.fullName.trim()
    const phone = input.phone.trim()

    if (!fullName) return { ok: false, error: "Unesite ime i prezime klijenta." }
    if (!phone) return { ok: false, error: "Unesite broj telefona klijenta." }

    const pets = input.pets.filter((p) => p.name.trim().length > 0)

    // ── Authorize: caller must be a vet, and we resolve the clinic ourselves
    //    (never trust a clinic id from the client). ────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: "Niste prijavljeni." }

    const { data: profile } = await supabase
      .from("profiles").select("role, clinic_id").eq("id", user.id).single()

    if (profile?.role !== "vet") {
      return { ok: false, error: "Samo veterinar može dodati klijenta." }
    }

    let clinicId = profile.clinic_id as string | null
    if (!clinicId) {
      const { data: owned } = await supabase
        .from("clinics").select("id").eq("owner_id", user.id).single()
      clinicId = owned?.id ?? null
    }
    if (!clinicId) return { ok: false, error: "Klinika nije pronađena." }

    // ── Create the owner account via service role ──────────────────────────
    const service = getServiceClient()

    const email = `klijent-${randomUUID()}@managed.vetplatforma.local`
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { role: "owner", full_name: fullName, phone },
    })
    if (createErr || !created?.user) {
      console.error("[createManagedClient] createUser failed", createErr)
      return { ok: false, error: "Greška pri kreiranju naloga klijenta." }
    }
    const ownerId = created.user.id

    // The on_auth_user_created trigger creates the profile from metadata; upsert
    // defensively so name/phone are guaranteed set.
    const { error: profErr } = await service.from("profiles").upsert({
      id: ownerId,
      role: "owner",
      full_name: fullName,
      phone,
    })
    if (profErr) console.error("[createManagedClient] profile upsert failed", profErr)

    // Vet-initiated connection is auto-confirmed (no approval handshake).
    const { error: connErr } = await service
      .from("connections")
      .insert({ owner_id: ownerId, clinic_id: clinicId, status: "confirmed" })
    if (connErr) {
      console.error("[createManagedClient] connection insert failed", connErr)
      return { ok: false, error: "Greška pri povezivanju klijenta sa klinikom." }
    }

    // Pets. Photo upload is intentionally out of scope here — the vet can add a
    // photo later from the pet profile (owner wizard handles uploads client-side).
    if (pets.length > 0) {
      const rows = pets.map((p) => ({ owner_id: ownerId, ...buildPetPayload(p) }))
      const { error: petsErr } = await service.from("pets").insert(rows)
      if (petsErr) {
        console.error("[createManagedClient] pets insert failed", petsErr)
        return { ok: false, error: "Klijent je kreiran, ali ljubimci nisu sačuvani." }
      }
    }

    // Invalidate the patients list cache so it shows the new client on arrival.
    revalidatePath("/dashboard/pacijenti")

    return { ok: true, ownerId }
  } catch (err) {
    // Never let the action reject — a thrown error would leave the client's
    // submit button stuck on its loading state with no feedback.
    console.error("[createManagedClient] unexpected error", err)
    return { ok: false, error: "Došlo je do greške. Pokušajte ponovo." }
  }
}
