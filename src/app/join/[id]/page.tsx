import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { fetchClinicBySlug } from "@/lib/connections"
import { JoinClient } from "./join-client"

type Params = { id: string }

/**
 * Per-clinic invite page. `noindex` because these URLs are personalized
 * invites shared directly with owners — they shouldn't be discoverable
 * through search engines.
 */
export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { id: slug } = await params
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
  const { id: slug } = await params

  let initialClinicName: string | null = null
  try {
    const supabase = await createClient()
    const clinic = await fetchClinicBySlug(supabase, slug)
    initialClinicName = clinic?.name ?? null
  } catch {
    initialClinicName = null
  }

  return <JoinClient slug={slug} initialClinicName={initialClinicName} />
}
