---
name: Stripe Integration
description: Stripe SDK version, lazy init pattern required, webhook route location
type: reference
---

Installed Stripe SDK version uses API version `"2026-03-25.dahlia"` (verified via `node -e "const Stripe = require('stripe'); const s = new Stripe('sk_test_x'); console.log(s.getApiField('version'))"`).

**Lazy initialization required:** Stripe must NOT be instantiated at module level (`const stripe = new Stripe(...)`) — Next.js build fails at page data collection because `STRIPE_SECRET_KEY` is not set at build time. Always use a `getStripe()` factory function called inside the handler/action.

**Webhook route:** `src/app/api/stripe/webhook/route.ts` — uses raw body via `req.text()`, `stripe.webhooks.constructEvent()`.

**Server action:** `src/app/dashboard/upgrade/actions.ts` — `createCheckoutSession()`, uses service role client to bypass RLS for reading `stripe_customer_id`.

**Required env vars:**
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID` (€49/month recurring)
- `NEXT_PUBLIC_APP_URL` (for success/cancel redirect URLs)
