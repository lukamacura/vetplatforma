import type { SupabaseClient } from "@supabase/supabase-js"

export type OtpSignupData = {
  role: "vet" | "owner"
  full_name: string
  phone?: string | null
}

export async function requestOtp(
  supabase: SupabaseClient,
  email: string,
  opts: { shouldCreateUser: boolean; data?: OtpSignupData }
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: opts.shouldCreateUser,
      data: opts.data,
    },
  })
  if (error) return { error: mapOtpError(error.message, opts.shouldCreateUser) }
  return { error: null }
}

export async function verifyEmailOtp(
  supabase: SupabaseClient,
  email: string,
  token: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  })
  if (error) return { error: mapOtpError(error.message, false) }
  return { error: null }
}

function mapOtpError(message: string, isSignup: boolean): string {
  const m = message.toLowerCase()
  if (m.includes("expired")) return "Šifra je istekla. Pošaljite novu."
  if (m.includes("invalid") && m.includes("token")) return "Pogrešna šifra. Pokušajte ponovo."
  if (m.includes("invalid") && m.includes("otp")) return "Pogrešna šifra. Pokušajte ponovo."
  if (m.includes("rate") || m.includes("too many")) return "Previše pokušaja. Pokušajte za par minuta."
  if (m.includes("user not found") || m.includes("signups not allowed")) {
    return isSignup
      ? "Registracija nije moguća. Kontaktirajte podršku."
      : "Nalog sa ovim email-om ne postoji. Registrujte se."
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return "Ovaj email je već registrovan. Prijavite se."
  }
  return "Došlo je do greške. Pokušajte ponovo."
}
