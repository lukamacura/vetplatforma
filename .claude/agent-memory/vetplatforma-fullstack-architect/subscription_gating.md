---
name: Subscription Gating Logic
description: How trial expiry and subscription status gate vet dashboard access in middleware
type: project
---

**Where:** `src/middleware.ts` — after role check, before returning the response.

**Logic:**
- `/dashboard/upgrade` is always accessible (no gating).
- If `subscription_status` is `expired` or `cancelled` → redirect to `/dashboard/upgrade`.
- If `subscription_status` is `trial` and `trial_started_at` is more than 30 days ago → redirect to `/dashboard/upgrade`.
- If `subscription_status` is `active` → pass through.
- If `clinic_id` is null on the profile, the middleware skips the check (vet hasn't set up their clinic yet — rare edge case during onboarding).

**Columns on clinics table:** `trial_started_at` (timestamptz, default now()), `subscription_status` (text, check constraint), `stripe_customer_id` (text, nullable).

**Why:** Subscription gating must be server-side in middleware — client-side checks are not acceptable security boundaries for write-access gating.
