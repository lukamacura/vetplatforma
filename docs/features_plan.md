# Features Plan — VetPlatforma

> **Rule:** Before adding anything new, check this file. New features go here first — not directly into code. Update this file when something ships or the plan changes.

Last updated: April 2026

---

## What's Built Today

### Auth

- **Login** (`/login`): Email + password. Redirects to `/dashboard` (vet) or `/klijent` (owner). Accepts `?clinic=slug` — if present, redirects to `/join/[slug]` after login.
- **Registration** (`/register`): Role toggle (Veterinar / Vlasnik ljubimca). Vet registration creates a clinic record and links `profiles.clinic_id`. Coming from a `/join/[slug]` link locks role to "owner" and redirects back after registration. The `handle_new_user` Postgres trigger creates the `profiles` row.
- **Middleware** (`/middleware.ts`): Enforces role-based routing. Unauthenticated → `/login`. Role mismatch → correct area.

---

### Vet Dashboard

Sidebar layout with four nav items: Pregled dana, Pacijenti, Podsetnici, Usluge. Sidebar is desktop-only (no mobile nav yet).

#### Pregled dana (`/dashboard`)

- Stat cards: confirmed appointments today + total connected clients.
- Chronological appointment list: time, pet emoji, pet name + species, owner name, service, duration.
- Current appointment highlighted with teal background + "SADA" badge.
- Past/future rows color-coded (blue = future, muted = past).
- "Nije došao" button on past/current appointments — sets `status = 'no_show'`, dims the row.
- Empty state: "Nema zakazivanja za danas."

Missing: no mobile navigation, no date navigation (today only), date header uses English locale.

#### Pacijenti (`/dashboard/pacijenti`)

- All connected owners with pets as health-status chips (red/amber/green/muted).
- Search by owner name, phone, or pet name.
- "Pozovi klijente" button copies clinic invite URL.
- Stat badges: client count, total pets, overdue count.
- Clicking a pet chip → pet profile.

#### Pet Profile (`/dashboard/pacijenti/[id]`)

- Pet identity, color-coded health ring, the "Critical Three" (next vaccine, next control, weight), vet notes (labeled "vidljivo samo veteru").
- Save with success/error feedback.

Missing: `birth_date` not formatted as human-readable. No appointment history. No forward booking action from this page.

#### Podsetnici (`/dashboard/podsetnici`)

- Three tabs: Zakasnelo (red), Ova nedelja (amber), Ovaj mesec (blue). Auto-selects first non-empty tab.
- Each row: pet/owner info, what's due with dates, phone link, "Zakaži" button (links to pet profile — not a booking form).
- Tab counts as colored badges. Overdue tab has pulse dot.
- Empty state: "Svi pacijenti su ažurni ✓"

#### Usluge (`/dashboard/usluge`)

- Lists services with name, description, duration badge, active/inactive status.
- "Nova usluga" dialog: name, duration (15/30/60 min), description.
- Each service has an active/inactive toggle. **UX fix needed:** the current toggle reads like a "disable" button. It should display an "Aktivno" label with a green checkmark, ON by default — a checkbox/switch pattern, not a destructive action button. Inactive services are hidden from owner booking.
- Empty state with prompt to add first service.

---

### Owner Area

Mobile-first layout with fixed bottom nav: Početna, Zakaži, Ljubimci, Klinike.

#### Početna (`/klijent`)

- Welcome message + pet cards grid (2-col on tablet+). Health status dots, vaccine/control/weight pills.
- Clicking a pet card opens a dialog with "Zakaži termin" pre-filling `petId`.
- Upcoming confirmed appointments (next 5). "Otkaži" button on appointments more than 2 hours away — triggers confirmation dialog, sets `status = 'cancelled'`.

#### Moji ljubimci (`/klijent/ljubimci`)

Full-width pet list using the same `PetCard` component. "Dodaj" button in header. May be consolidated with home page pet section later.

#### Novi ljubimac (`/klijent/ljubimci/novi`)

Add pet form: name, species, breed, gender, chip ID, passport number, birth date, color, weight.

Missing: no pet editing or deletion after creation.

#### Zakazivanje (`/klijent/zakazivanje`)

3-step booking: select pet → select service → pick date + time slot.

- Auto-selects clinic if owner is connected to only one. Multi-clinic shows a picker first.
- Date picker: 14 working days ahead, weekends excluded.
- Slots: 09:00–17:00 based on service duration, minus booked start times.
- Saves immediately as `status = 'confirmed'`.
- Handles no-clinic state with link to `/klijent/klinike`.

**Booking conflict gap:** Slot filtering only excludes exact start-time matches. A 30-min slot at 10:30 can still be booked even if a 60-min appointment started at 10:00. Overlap detection must check `[slot_start, slot_start + duration)` against existing `[existing_start, existing_start + existing_duration)`.

#### Klinike (`/klijent/klinike`)

Public clinic directory. Owners can search and connect to any clinic with one click — no invite link required. This is intentional self-discovery behavior. The invite link (`/join/[slug]`) still exists for direct sharing, but the directory + one-click connect is also a valid and supported flow.

---

### Join Flow (`/join/[id]`)

- Looks up clinic by slug.
- Not logged in → shows registration/login links (both preserve `?clinic=slug`).
- Logged in as owner → connect confirmation button. Vet role → error.
- Already connected → "Već ste povezani!" screen.
- On connect: upserts a `connections` row (idempotent).
- Not found → "Klinika nije pronađena."

---

### Database

Six tables: `clinics`, `profiles`, `pets`, `connections`, `services`, `appointments`.

`appointments.status` has no CHECK constraint — the app writes `confirmed`, `cancelled`, and `no_show` but the database does not enforce this.

---

## What's Missing

### Critical (fix before demo)

1. **Double-booking overlap.** Slot filtering only blocks exact start times. Overlapping intervals are not detected. See booking conflict gap above.
2. **Subscription gating.** No trial tracking, no paywall, no Stripe integration. Vet write access is ungated. This must exist before any paying customer is onboarded.
3. **No `appointments.status` CHECK constraint.** Any text value is accepted. A 1-line migration fixes this.

### Missing product features

4. **No vet-side appointment creation.** Vets cannot book on behalf of a client (the primary real-world workflow — owner calls, vet books). "Zakaži" on reminders links to pet profile, not a booking form.
5. **No owner pet editing.** Owners cannot edit any pet field after creation. Only the vet can update pet data.
6. **No vet dashboard mobile navigation.** Sidebar is `hidden` on mobile. No way to navigate on a phone.
7. **No SMS/email reminders.** The reminders page is UI-only. The n8n + Infobip automation is not wired up.
8. **No education feed.** Vet-curated articles visible to owners does not exist yet.
9. **No appointment history on pet profile.**
10. **No clinic settings page.** No way to edit clinic name, view invite link, or manage profile after registration.
11. **Date formatting inconsistency.** Some fields use `en-GB`, others use `sr-Latn-RS`. All should be Serbian locale.
12. **Hardcoded working hours.** Booking page uses 09:00–17:00 always. No per-clinic hours config.

---

## Implementation Order

| # | Feature | Who | Complexity | Status |
|---|---|---|---|---|
| 1 | **Subscription gating + Stripe** (30-day trial → paywall) | Vet | Large | PLANNED |
| 2 | Fix double-booking overlap | Both | Small | IN PROGRESS |
| 3 | Vet future appointments / date nav on dashboard | Vet | Small | IN PROGRESS |
| 4 | Vet dashboard mobile navigation | Vet | Small | IN PROGRESS |
| 5 | Vet-side appointment creation | Vet | Medium | PLANNED |
| 6 | Owner pet editing | Owner | Small | PLANNED |
| 7 | Clinic settings page | Vet | Small | PLANNED |
| 8 | Vet working hours (`clinic_hours` table) | Vet + Owner | Medium | PLANNED |
| 9 | `appointments.status` CHECK constraint (migration) | Both | Small | PLANNED |
| 10 | "Zakaži" on reminder row → pre-filled booking (depends on #5) | Vet | Small | PLANNED |
| 11 | SMS/email reminders (n8n + Infobip) | Vet + Owner | Large | PLANNED |
| 12 | Education feed (retention — post-launch) | Vet + Owner | Large | PLANNED |

---

## Stripe / Subscription Architecture

### Model

- **30-day free trial.** No card required at sign-up.
- After 30 days: €49/month.
- Trial start recorded when the clinic row is created.
- Trial expired AND no active subscription → all vet write operations blocked, redirect to `/dashboard/upgrade`.

### Required Schema Migration

```sql
alter table clinics
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_started_at        timestamptz default now(),
  add column if not exists subscription_status     text default 'trial'
    check (subscription_status in ('trial', 'active', 'expired', 'cancelled'));

create index if not exists clinics_subscription_status_idx
  on clinics (owner_id, subscription_status, trial_started_at);
```

### Trial Expiry Logic (server-side only)

Middleware runs on every vet request:

```
1. Fetch clinics row for auth.uid()
2. subscription_status = 'active'  → allow all
3. subscription_status = 'trial'   → check trial_started_at + 30 days
     a. Within 30 days             → allow all
     b. 30 days passed             → set status = 'expired', redirect to /dashboard/upgrade
4. subscription_status = 'expired' or 'cancelled'
     → GET routes allowed (vet can still view data)
     → POST/PATCH/DELETE to appointments, pets, services → redirect to /dashboard/upgrade
```

### Stripe Webhook Events

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `subscription_status = 'active'`, save `stripe_customer_id` + `stripe_subscription_id` |
| `invoice.payment_succeeded` | No action needed — Stripe manages active subscription lifecycle |
| `invoice.payment_failed` | Send warning (via n8n), do NOT immediately expire |
| `customer.subscription.deleted` | Set `subscription_status = 'cancelled'` |

Webhook handler rules: must be idempotent; verify `stripe-signature` before processing; use raw request body with `stripe.webhooks.constructEvent()`.

### No-Card-Upfront Flow

```
Vet registers
  → clinic row created: trial_started_at = now(), status = 'trial'
  → 30 days full access, zero friction

Day 30 passes
  → next request hits middleware
  → trial expired detected → status = 'expired' in DB
  → vet redirected to /dashboard/upgrade

/dashboard/upgrade
  → "Vaš probni period je istekao"
  → CTA: "Nastavi za €49/mesec" → Stripe Checkout Session
  → success_url: /dashboard?subscribed=true
  → cancel_url: /dashboard/upgrade

Stripe fires checkout.session.completed
  → webhook sets status = 'active'
  → vet regains full write access
```

### Upgrade Page (`/dashboard/upgrade`)

- Server Component — read subscription state from DB, never client-side.
- Show days remaining (if still in trial) or expired message.
- Show what is lost when expired.
- CTA: "Nastavi za €49/mesec" → Stripe-hosted Checkout (never inline card form — PCI compliance).

### RLS Impact

No RLS changes needed. Subscription gating is enforced in middleware and route handlers, not at the database level.
