import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { connectOwnerToClinicBySlug, fetchClinicBySlug } from "@/lib/connections"

type Params = { slug: string }

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  let clinicName: string | null = null
  try {
    const supabase = await createClient()
    const clinic = await fetchClinicBySlug(supabase, slug)
    clinicName = clinic?.name ?? null
  } catch {
    clinicName = null
  }

  const title = clinicName
    ? `Povežite se sa klinikom ${clinicName}`
    : "Povežite se sa klinikom"
  const description = clinicName
    ? `Pozvani ste da postanete digitalni klijent klinike ${clinicName} putem VetPlatforme.`
    : "Pozvani ste da postanete digitalni klijent veterinarske klinike putem VetPlatforme."

  return {
    title,
    description,
    alternates: { canonical: `/join/${slug}` },
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false },
    },
    openGraph: {
      title: `${title} · VetPlatforma`,
      description,
      url: `/join/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${title} · VetPlatforma`,
      description,
    },
  }
}

export default async function JoinClinicPage(
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params
  const supabase = await createClient()

  const clinic = await fetchClinicBySlug(supabase, slug)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(clinic ? `/register?clinic=${slug}` : "/register")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profile?.role ?? user.user_metadata?.role) as string | undefined

  if (role === "vet") {
    redirect("/dashboard")
  }

  if (clinic) {
    await connectOwnerToClinicBySlug(supabase, user.id, slug)
  }
  redirect("/klijent")
}
