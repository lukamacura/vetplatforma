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
    .from("clinics")
    .select("name, stripe_customer_id, subscription_status, trial_started_at")
    .eq("id", clinicId)
    .single()
  if (!clinic) redirect("/dashboard")

  const clinicRow = clinic as {
    name:                 string
    stripe_customer_id:   string | null
    subscription_status:  string | null
    trial_started_at:     string | null
  }

  let customerId = clinicRow.stripe_customer_id

  // Create Stripe customer if not exists yet
  if (!customerId) {
    const customer = await stripe.customers.create({
      email:    user.email ?? undefined,
      name:     clinicRow.name,
      metadata: { clinic_id: clinicId },
    })
    customerId = customer.id
    await serviceClient
      .from("clinics")
      .update({ stripe_customer_id: customerId })
      .eq("id", clinicId)
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  // If user is still in their 30-day in-app trial, carry remaining time over to Stripe
  // so Checkout shows "Total due today €0.00 · First payment on <date>".
  const nowSec = Math.floor(Date.now() / 1000)
  let trialEndSec: number | null = null
  if (clinicRow.subscription_status === "trial" && clinicRow.trial_started_at) {
    const endSec = Math.floor(new Date(clinicRow.trial_started_at).getTime() / 1000) + 30 * 86400
    if (endSec > nowSec) trialEndSec = endSec
  }

  const session = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        "subscription",
    line_items:  [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    ...(trialEndSec && {
      subscription_data: {
        trial_end: trialEndSec,
        trial_settings: { end_behavior: { missing_payment_method: "cancel" } },
      },
    }),
    success_url: `${origin}/dashboard?subscribed=1`,
    cancel_url:  `${origin}/dashboard/upgrade`,
  })

  redirect(session.url!)
}

export async function createBillingPortalSession(): Promise<void> {
  const stripe   = getStripe()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("profiles").select("clinic_id").eq("id", user.id).single()
  let clinicId = profile?.clinic_id
  if (!clinicId) {
    const { data: owned } = await supabase.from("clinics").select("id").eq("owner_id", user.id).single()
    clinicId = owned?.id ?? null
  }
  if (!clinicId) redirect("/dashboard")

  const serviceClient = getServiceClient()
  const { data: clinic } = await serviceClient
    .from("clinics").select("stripe_customer_id").eq("id", clinicId).single()

  const customerId = (clinic as { stripe_customer_id: string | null } | null)?.stripe_customer_id
  if (!customerId) redirect("/dashboard/upgrade")

  const origin  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${origin}/dashboard/podesavanja`,
  })

  redirect(session.url)
}
