import type { SupabaseClient } from "@supabase/supabase-js"

export type ConnectErrorCode = "not-found" | "wrong-role" | "db"

export interface ConnectResult {
  success: boolean
  clinicId?: string
  clinicName?: string
  clinicSlug?: string
  error?: ConnectErrorCode
}

export async function fetchClinicBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const { data } = await supabase
    .from("clinics")
    .select("id, name, slug")
    .eq("slug", slug)
    .single()
  return (data as { id: string; name: string; slug: string } | null) ?? null
}

export async function connectOwnerToClinicBySlug(
  supabase: SupabaseClient,
  ownerId: string,
  slug: string
): Promise<ConnectResult> {
  const clinic = await fetchClinicBySlug(supabase, slug)
  if (!clinic) return { success: false, error: "not-found" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", ownerId)
    .single()

  if (profile?.role !== "owner") {
    return {
      success: false,
      error: "wrong-role",
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicSlug: clinic.slug,
    }
  }

  const { error: connErr } = await supabase
    .from("connections")
    .upsert(
      { owner_id: ownerId, clinic_id: clinic.id },
      { onConflict: "owner_id,clinic_id" }
    )
  if (connErr) {
    return {
      success: false,
      error: "db",
      clinicId: clinic.id,
      clinicName: clinic.name,
      clinicSlug: clinic.slug,
    }
  }

  return {
    success: true,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicSlug: clinic.slug,
  }
}
