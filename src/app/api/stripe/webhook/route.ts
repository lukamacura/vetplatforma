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
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub        = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      const periodEnd  = new Date(sub.items.data[0].current_period_end * 1000).toISOString()
      const isActive   = sub.status === "active" || sub.status === "trialing"
      await supabase
        .from("clinics")
        .update({
          subscription_status:              isActive ? "active" : "expired",
          subscription_current_period_end:  periodEnd,
        })
        .eq("stripe_customer_id", customerId)
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
