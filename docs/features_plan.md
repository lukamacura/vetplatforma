# Features Plan — VetPlatforma

> **Rule:** Before adding anything new, check this file. New features go here first — not directly into code. Update this file when something ships or the plan changes.

Last updated: April 2026 (post-audit + new features: working hours, future appointments view)

---

## What's Built Today

### Auth — Registration & Login

Both flows are complete and working.

- **Login** (`/login`): Email + password. On success, reads the user's role and redirects to `/dashboard` (vet) or `/klijent` (owner). Also accepts a `?clinic=slug` query param — if present after login, sends the user to `/join/[slug]` to complete the connection.
- **Registration** (`/register`): Role toggle (Veterinar / Vlasnik ljubimca). When registering as a vet, creates a clinic record and links `profiles.clinic_id` automatically. When coming from a `/join/[slug]` invite link, locks the role to "owner" and redirects back to `/join/[slug]` after registration. The `handle_new_user` Postgres trigger creates the `profiles` row on signup.
- **Middleware** (`/middleware.ts`): Enforces role-based routing on every request. Unauthenticated users go to `/login`. Vets trying to access `/klijent` are sent to `/dashboard`, and vice versa.

**Known issue:** The `klinike` page (owner-facing clinic directory) lets owners connect to any clinic by searching and clicking "Poveži se" — no invite link required. This bypasses the intended invite-only handshake. See "What's Missing" below.

---

### Vet Dashboard

The full sidebar layout is in place with four navigation items: Pregled dana, Pacijenti, Podsetnici, Usluge. The sidebar is desktop-only (hidden on mobile — there is no mobile nav for the vet dashboard yet).

#### Pregled dana (`/dashboard`)

Today's schedule view. Shows:
- Two stat cards: confirmed appointments today + total connected clients.
- A chronological list of today's appointments. Each row shows time, pet emoji, pet name + species, owner name, service name, and duration.
- The current appointment (happening right now) is highlighted with a teal background and a "SADA" badge.
- Past/future rows are color-coded (blue = future, muted = past).
- A "Nije došao" (no-show) button appears on past and current appointments. Clicking it sets `status = 'no_show'` and dims the row.
- Good empty state: "Nema zakazivanja za danas."

**What's missing:** No mobile navigation. No "This week" summary. The date header uses English locale formatting instead of Serbian.

#### Pacijenti (`/dashboard/pacijenti`)

Connected clients list. Shows all owners who have connected to this clinic, with their pets displayed as colored health-status chips (red = overdue, amber = due soon, green = ok, muted = no dates set).

- Search by owner name, phone, or pet name.
- "Pozovi klijente" button copies the clinic invite URL to clipboard.
- Stat badges at the top: client count, total pets, overdue count.
- Clicking a pet chip navigates to the pet profile.

#### Pet Profile (`/dashboard/pacijenti/[id]`)

Vet-facing pet editor. Shows:
- Pet identity (name, species, breed, owner contact).
- A color-coded health ring on the avatar (red/amber/green/muted) based on vaccine/control status.
- The "Critical Three" editable fields: next vaccine date, next control date, weight.
- Vet notes textarea (explicitly labeled "vidljivo samo veteru").
- Save button with success/error feedback.

**What's missing:** The "basic info" section shows `birth_date` without formatting it as a human-readable date. No appointment history for the pet. No way to add a new appointment directly from this page (the "Zakaži" button on the reminders page links here, but then there's no forward booking action).

#### Podsetnici (`/dashboard/podsetnici`)

Reminder panel showing pets with vaccine or control dates within the next 30 days (including overdue). Fully built and working.

- Three tabs: Zakasnelo (red), Ova nedelja (amber), Ovaj mesec (blue). Auto-selects the first non-empty tab.
- Each row: pet emoji, pet name, owner name, what's due (vaccine/control badges with dates), days label, phone call link, "Zakaži" button linking to the pet profile.
- Tab counts shown as colored badges. Overdue tab has a pulse dot.
- Empty state: "Svi pacijenti su ažurni ✓" (green).

**Note:** The "Zakaži" button on a reminder row links to `/dashboard/pacijenti/[id]` (pet profile), not to a booking creation form. The vet can see the pet's data but cannot create an appointment on behalf of the owner from this screen.

#### Usluge (`/dashboard/usluge`)

Services management. Fully working.

- Lists all clinic services with name, optional description, duration badge, and active/inactive status.
- "Nova usluga" dialog: name, duration selector (15/30/60 min), optional description.
- Toggle active/inactive per service. Inactive services are hidden from owner booking.
- Empty state with prompt to add first service.

---

### Owner Area

Mobile-first layout with a fixed bottom navigation bar: Početna, Zakaži, Ljubimci, Klinike.

#### Početna (`/klijent`)

Owner home page. Shows:
- A welcome message with the owner's first name.
- Pet cards grid (2-column on tablet+). The `PetCard` component is a well-designed shared component with species-based color tints, health status dots, and vaccine/control/weight info pills.
- Clicking a pet card opens a dialog with the full card + "Zakaži termin" button that pre-fills `petId` in the booking URL.
- Upcoming confirmed appointments (next 5, future only). Each row shows service name, pet name, and date/time.
- "Otkaži" (cancel) button on appointments more than 2 hours away. Triggers a confirmation dialog, then sets `status = 'cancelled'`.

#### Moji ljubimci (`/klijent/ljubimci`)

Full-width list of the owner's pets using `PetCard`. "Dodaj" button in the header. Identical cards to the home page but without click-to-dialog. Redundant with the home page pet section — may be consolidated later.

#### Novi ljubimac (`/klijent/ljubimci/novi`)

Add pet form. Collects: name, species (visual toggle), breed, gender, chip ID, passport number, birth date, color, weight. Saves to `pets` table.

**What's missing:** No way to edit a pet after creation. No delete pet. Owner cannot update any pet fields after the initial add — only the vet can update vaccine/control/weight.

#### Zakazivanje (`/klijent/zakazivanje`)

3-step booking flow: select pet → select service → pick date + time slot.

- Auto-selects clinic if owner is connected to only one.
- Multi-clinic support: shows a clinic picker first.
- Date picker scrolls horizontally, 14 working days ahead (weekends excluded).
- Time slots generated 09:00–17:00 based on service duration, minus already-booked slots.
- Appointment saved immediately as `status = 'confirmed'` (no pending state, correct).
- Step 4 is a success confirmation screen.
- Handles no-clinic state with a link to `/klijent/klinike`.

**Booking conflict gap:** Slot availability is checked by fetching all appointments for that day and filtering out booked start times. However, this does not account for overlapping appointments. For example, a 60-minute appointment starting at 10:00 would only block the 10:00 slot, not prevent a 30-minute appointment at 10:30 from booking into the same window. This is a double-booking risk that needs fixing.

#### Klinike (`/klijent/klinike`)

Clinic directory that lists **all** registered clinics. Owners can search and connect to any clinic without an invite link. This page exists for "self-discovery" but bypasses the invite-only handshake model defined in the architecture.

---

### Join Flow (`/join/[id]`)

Invite link landing page. Works correctly.

- Looks up the clinic by slug.
- If the user is not logged in: shows registration and login links (both pass `?clinic=slug` to preserve context).
- If logged in as an owner: shows a connect confirmation button. Checks for vet role and shows an error if a vet tries to use it.
- If already connected: shows a "Već ste povezani!" success screen.
- On connect: upserts a `connections` row (idempotent via unique constraint).
- Friendly "Klinika nije pronađena" not-found state.

---

### Database Schema

Six tables in place: `clinics`, `profiles`, `pets`, `connections`, `services`, `appointments`.

Migrations applied:
- Base schema with all six tables and RLS policies.
- Additional pet fields: `gender`, `passport_number`, `color` (added after initial schema).
- Multiple RLS fix migrations (`fix_profiles_rls_recursion`, `fix_rls_clinics_and_profiles`, `fix_all_rls_final`) — suggesting the RLS policies had recursion/permission bugs that required several iterations to resolve.

**`appointments.status` constraint:** The schema defines `status` with a default of `'confirmed'` but has no CHECK constraint listing valid values. The code currently writes `confirmed`, `cancelled`, and `no_show`. No migration has been applied to formally add these as an enum or check constraint.

---

## What's Missing / Incomplete

### Critical gaps (affect correctness or safety)

1. **Double-booking risk in the slot system.** The booking page filters out start times that exactly match existing appointments. It does not check whether a new booking overlaps with an ongoing one. A 30-minute slot at 10:30 can still be booked even if a 60-minute appointment started at 10:00.

2. **`klinike` page bypasses the invite model.** The owner clinic directory at `/klijent/klinike` lists all clinics and allows direct connection without an invite. Whether this is intentional product design (self-discovery mode) or a mistake depends on the business decision, but it currently contradicts the "explicit invite opt-in" model documented in the architecture.

3. **No appointment status CHECK constraint in the database.** The `appointments.status` column accepts any text value. The three values used by the app (`confirmed`, `cancelled`, `no_show`) are not enforced at the database level. Should be fixed with a migration.

### Missing product features (not built yet)

4. **No vet-side appointment creation.** Vets cannot book an appointment on behalf of a client. The "Zakaži" button on reminder rows links to the pet profile — which shows medical data, not a booking form. Vets need a way to schedule a visit directly (common in clinics: owner calls, vet enters it).

5. **No owner pet editing.** Once a pet is created, the owner cannot edit any of its fields. There is no `/klijent/ljubimci/[id]/edit` route. The only way to update pet data is through the vet (via the vet dashboard pet profile).

6. **No Stripe / subscription gating.** There is no billing UI, trial tracking, or subscription state anywhere in the codebase. The 30-day free trial and €49/month model described in the plan does not exist in the app yet. Vet write access is not gated by subscription status.

7. **Vet dashboard has no mobile navigation.** The sidebar is `hidden` on mobile. On a phone, there is no way to navigate between dashboard sections. The owner area has a bottom nav but the vet dashboard has nothing equivalent.

8. **No SMS/email reminders.** The reminders page shows which pets are due — but the actual automated reminder sending (via n8n + Infobip/Resend) described in the plan is not wired up. The page is UI-only.

9. **No education / content feed.** The MLP-phase feature (vet curates articles, owners see a species-targeted feed) does not exist anywhere in the codebase.

10. **No appointment history on pet profile.** The vet pet profile shows current medical data but not a history of past appointments for that pet.

11. **No vet profile / clinic settings page.** There is no way for the vet to edit their clinic name, view their invite link from a settings screen, or manage their profile information after registration.

12. **Date formatting inconsistency.** Several date fields use `en-GB` locale (e.g., `"09/04/2026"`) while others use `sr-Latn-RS`. The UI copy is in Serbian but date formatting is mixed.

13. **Booking flow does not handle weekends/holidays gracefully.** The date picker skips weekends but does not know about clinic working hours. If a clinic opens 08:00–18:00, the hardcoded 09:00–17:00 window may be wrong.

---

## Next Features (priority order)

---

### 1. Fix Appointment Overlap / Double-Booking

**Who it affects:** Both (data integrity)
**Schema migration needed:** No
**Complexity:** Small

The slot generator needs to exclude any slot where `[slot_start, slot_start + duration)` would overlap with an existing `[existing_start, existing_start + existing_duration)`. This requires fetching the service durations of existing appointments (not just their start times) and checking for real interval overlap. This is a correctness bug — fix before any demo.

---

### 2. Vet Future Appointments View (Date Navigation on Dashboard)

**Who it affects:** Vet
**Schema migration needed:** No
**Complexity:** Small

Vets can only see today's appointments. There is no way to look at tomorrow's schedule, prep for the week ahead, or review a past day. This is the first thing a vet will ask during any demo.

The right scope for MVP is to add a date navigator to the existing `/dashboard` page — not a new `/dashboard/kalendar` page with a full calendar grid. A horizontal week strip (Mon–Sun of the selected week, with prev/next week arrows and a "Danas" reset button) mirrors the pattern already used in the owner booking flow and is immediately familiar. The underlying data fetch is identical to today's query — only the date window changes. The batch-fetch joins for pets/owners/services are already in place and need no modification.

The "SADA" (now) badge and the current-appointment highlight should only activate when the selected day is today. The stat card label "Zakazivanja danas" can update to "Zakazivanja — [datum]" when a non-today date is selected.

No schema change needed. The entire feature is a state variable (`selectedDate`) replacing the hardcoded `new Date()` window.

---

### 3. Vet Dashboard Mobile Navigation

**Who it affects:** Vet
**Schema migration needed:** No
**Complexity:** Small

The vet sidebar is invisible on mobile screens. Add a bottom navigation bar equivalent to the owner's `OwnerBottomNav` — four tabs matching the four sidebar items (Pregled dana, Pacijenti, Podsetnici, Usluge). This is required for the app to be usable on a phone during demos.

---

### 5. Vet-Side Appointment Creation

**Who it affects:** Vet
**Schema migration needed:** No
**Complexity:** Medium

Vets need to be able to create appointments directly — this is how 90% of clinic scheduling actually works (owner calls, vet books it). This could be a modal or a dedicated page reachable from the reminders page and/or the "Pregled dana" page. Steps: select connected owner → select their pet → select service → select date/time (with the same overlap check as above) → confirm. The appointment goes into the same `appointments` table as owner-created ones.

---

### 6. Owner Pet Editing

**Who it affects:** Owner
**Schema migration needed:** No
**Complexity:** Small

Add a `/klijent/ljubimci/[id]/uredi` page that lets the owner edit their pet's name, breed, gender, chip ID, passport number, birth date, color, and weight. The vet-only fields (vaccine date, control date, vet notes) must not appear here. A link to this page should appear on the `Ljubimci` list and possibly the home page pet cards.

---

### 7. Formal `appointments.status` Constraint

**Who it affects:** Both (data integrity)
**Schema migration needed:** Yes (1-line migration)
**Complexity:** Small

Add a CHECK constraint to `appointments.status`: `check (status in ('confirmed', 'cancelled', 'no_show'))`. This ensures the database enforces what the app already assumes. The migration can run without downtime on the small current dataset.

---

### 8. Vet Appointment Creation from Reminder Row

**Who it affects:** Vet
**Schema migration needed:** No
**Complexity:** Small (depends on feature 5 being built first)

The "Zakaži" button on each reminder row currently links to the pet profile page. Once vet-side appointment creation exists (feature 5 above), this button should open the booking flow pre-filled with that pet selected. This closes the reminder-to-booking loop entirely within the vet dashboard.

---

### 9. Clinic Settings / Invite Link Page

**Who it affects:** Vet
**Schema migration needed:** No
**Complexity:** Small

A `/dashboard/podesavanja` page where the vet can: see and copy their clinic invite link, edit the clinic name, update their phone number. Currently the invite link is only accessible from the "Pacijenti" page (the "Pozovi klijente" button). A dedicated settings page makes this more discoverable and gives vets a place to manage their account.

---

### 10. Vet Working Hours

**Who it affects:** Vet, Owner (booking flow)
**Schema migration needed:** Yes (new `clinic_hours` table)
**Complexity:** Medium

Vets should be able to define their clinic's operating hours per weekday. The booking page currently hardcodes 09:00–17:00 on all weekdays. Working hours control two things: which days appear in the owner's date picker (closed days are excluded), and what time range generates slots on open days.

**Schema.** A new `clinic_hours` table: one row per clinic per weekday (0 = Sunday … 6 = Saturday), with `open_time time`, `close_time time`, and `is_closed boolean`. RLS mirrors the `services` pattern — vets manage their own rows, owners can SELECT hours for their connected clinics.

**Vet settings UI.** A 7-row form on the `/dashboard/podesavanja` page (feature 9 above). Each row: weekday label, an "Otvoreno/Zatvoreno" toggle, and two time pickers (from/to) that appear only when the day is open. Default values on first save: Mon–Fri 09:00–17:00, Sat 09:00–13:00, Sun closed — reflecting the standard Serbian veterinary practice pattern. No calendar-style picker needed; the tabular form is sufficient and faster to build.

**Booking flow changes.** `getNext14Days` must exclude days where `is_closed = true` for that weekday. `generateSlots` must accept the clinic's `open_time` and `close_time` for the selected day instead of the hardcoded 9/17 constants. The slot-loading `useEffect` fetches an additional `clinic_hours` row per day selection — one extra query, negligible cost.

**Dependencies.** Feature 9 (Clinic Settings page) is the natural home for the working hours form. This feature should ship on the same page rather than as a standalone screen.

---

### 11. Subscription Gating (Trial + Stripe)

**Who it affects:** Vet
**Schema migration needed:** Yes (`clinics` needs `trial_started_at` and `subscription_status` columns)
**Complexity:** Large

The 30-day free trial and €49/month subscription model needs to be implemented. This involves:
- Recording trial start on clinic creation.
- Checking trial/subscription status in middleware (server-side, not client-side) before allowing vet write operations.
- Stripe webhook handler (n8n or a Next.js route handler) that updates subscription status on payment events.
- A paywall/upgrade prompt UI when trial expires.

This is the only feature that is required for the business model to work. Everything else can be demoed without it, but it must exist before real paying customers are onboarded.

---

### 12. SMS/Email Reminder Automation

**Who it affects:** Vet, Owner (indirectly)
**Schema migration needed:** Possibly (a `reminders_log` table to prevent duplicates)
**Complexity:** Large

Wire up the n8n cron workflow that scans `pets.next_vaccine_date` and `pets.next_control_date` daily, finds pets due within the next 7–14 days, and sends an SMS (Infobip) or email (Resend) to the owner with a direct booking link. The reminders page in the dashboard already calculates who needs to be notified — the automation just needs to send the actual messages. An idempotent reminders log table should record what was sent and when to avoid duplicate messages.

---

### 13. Education Feed

**Who it affects:** Vet, Owner
**Schema migration needed:** Yes (new `articles` table)
**Complexity:** Large

Vet-curated educational content visible to owners in their app. A simple model:
- Vet side: list of pre-loaded article templates (e.g., "Prolećna vakcinacija pasa"), with a toggle to publish/unpublish to their connected owners.
- Owner side: a scrollable feed of published articles filtered by their pets' species.

This is a retention feature (makes the app feel alive) and was scheduled for Week 3 of the original plan. It should not block the core booking loop from launching.

---

## Implementation Order for Next Sprint

```
1.  Fix double-booking overlap (correctness — do this first)
2.  Vet future appointments view / date nav on dashboard (high demo value, zero schema cost)
3.  Vet mobile navigation (demo-readiness)
4.  Vet-side appointment creation (key vet workflow)
5.  Owner pet editing (basic product completeness)
6.  Clinic settings page (quality of life + prerequisite for working hours UI)
7.  Vet working hours (new clinic_hours table + booking flow update; UI lives on settings page)
8.  appointments.status CHECK constraint (data integrity migration)
9.  Vet appointment creation from reminder row (closes reminder → booking loop; depends on #4)
10. Subscription gating + Stripe (required before first paying customer)
11. SMS/email reminders (automation — the key "wow" demo feature)
12. Education feed (retention — post-launch)
```
