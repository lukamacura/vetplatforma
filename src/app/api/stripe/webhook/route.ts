import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-03-25.dahlia" })
}

// Service-role client — bypasses RLS for webhook writes
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function mapSubStatus(stripeStatus: string): "trial" | "active" | "expired" | "cancelled" {
  if (stripeStatus === "trialing")  return "trial"
  if (stripeStatus === "active")    return "active"
  if (stripeStatus === "canceled")  return "cancelled"
  return "expired"
}

async function syncSubscription(stripe: Stripe, supabase: ReturnType<typeof getServiceClient>, sub: Stripe.Subscription) {
  const customerId = sub.customer as string

  // items.data may be empty in webhook payloads — fetch full subscription if needed
  let periodEndSec: number | undefined
  if (sub.items.data.length > 0) {
    periodEndSec = sub.items.data[0].current_period_end
  } else {
    const full = await stripe.subscriptions.retrieve(sub.id, { expand: ["items"] })
    periodEndSec = full.items.data[0]?.current_period_end
  }

  const periodEnd = periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null
  const status    = mapSubStatus(sub.status)

  await supabase
    .from("clinics")
    .update({
      subscription_status:             status,
      subscription_current_period_end: periodEnd,
    })
    .eq("stripe_customer_id", customerId)
}

export async function POST(req: NextRequest) {
  const stripe  = getStripe()
  const rawBody = await req.text()
  const sig     = req.headers.get("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const supabase = getServiceClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === "subscription" && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id
        const sub   = await stripe.subscriptions.retrieve(subId, { expand: ["items"] })
        await syncSubscription(stripe, supabase, sub)
      }
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription
      await syncSubscription(stripe, supabase, sub)
      break
    }
    case "customer.subscription.deleted": {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      await supabase
        .from("clinics")
        .update({
          subscription_status:             "cancelled",
          subscription_current_period_end: null,
        })
        .eq("stripe_customer_id", customerId)
      break
    }
    case "invoice.payment_failed": {
      const invoice    = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string
      await supabase
        .from("clinics")
        .update({ subscription_status: "expired" })
        .eq("stripe_customer_id", customerId)
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
