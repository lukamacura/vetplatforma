"use server"

import { redirect } from "next/navigation"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" })
}

function getServiceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function createCheckoutSession(): Promise<void> {
  const stripe    = getStripe()
  const supabase  = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Resolve clinic
  const { data: profile } = await supabase
    .from("profiles").select("clinic_id").eq("id", user.id).single()
  let clinicId = profile?.clinic_id
  if (!clinicId) {
    const { data: owned } = await supabase.from("clinics").select("id").eq("owner_id", user.id).single()
    clinicId = owned?.id ?? null
  }
  if (!clinicId) redirect("/dashboard")

  const serviceClient = getServiceClient()

  // Fetch clinic via service role (stripe_customer_id not accessible via RLS-scoped client)
  const { data: clinic } = await serviceClient
    .from("clinics").select("name, stripe_customer_id, trial_started_at").eq("id", clinicId).single()
  if (!clinic) redirect("/dashboard")

  let customerId = clinic.stripe_customer_id as string | null

  // Create Stripe customer if not exists yet
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email ?? undefined,
      name:     clinic.name as string,
      metadata: { clinic_id: clinicId },
    })
    customerId = customer.id
    await serviceClient
      .from("clinics")
      .update({ stripe_customer_id: customerId })
      .eq("id", clinicId)
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // If the clinic still has trial days remaining, tell Stripe to start billing
  // only after the trial ends — so current_period_end = trial_end + 30 days.
  const trialStartedAt = (clinic as { trial_started_at?: string | null }).trial_started_at
  const trialEnd = trialStartedAt ? new Date(trialStartedAt) : null
  if (trialEnd) trialEnd.setDate(trialEnd.getDate() + 30)
  const trialEndUnix = trialEnd && trialEnd > new Date() ? Math.floor(trialEnd.getTime() / 1000) : undefined

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        "subscription",
    line_items:  [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${origin}/dashboard?subscribed=1`,
    cancel_url:  `${origin}/dashboard/upgrade`,
    ...(trialEndUnix ? { subscription_data: { trial_end: trialEndUnix } } : {}),
  })

  redirect(session.url!)
}
