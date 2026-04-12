# VetPlatforma — High-Velocity Build Plan (30 Days)

**Goal:** 10 Founding Clients @ $49/mo ($490 MRR) -> Scale to $10k MRR by end of 2026.
**Constraint:** No confirmations/gatekeeping. Instant connection. Instant value.

---

## 1. Product Evolution Path

### MVP: The Data Bridge & Service Catalog (Days 1–10)
**Goal:** Establish the clinic's digital presence and pet database.
- **Core Value:** Vet enters data; Owner sees it + Clinic defines what they offer.
- **No-Friction Rule:** Owner taps "Connect" -> Instant access to pet records and the clinic's service menu.

### MMP: The Revenue Generator & Self-Service Booking (Days 11–20)
**Goal:** The product pays for itself by automating the most expensive task: scheduling.
- **Core Value:** Automated reminders + **Instant Booking** (No phone calls).
- **Booking Rule:** Owner picks Service -> Picks Time -> Appointment is created. No "Pending" status.

### MLP: The Retention Engine (Days 21–30)
**Goal:** Bring churn down to <5% by making the app indispensable for the pet owner.
- **Core Value:** Education Feed + Professional UI (Shadcn/UX Pilot).
- **Sticky Factor:** Owners get high-quality content; Vets look like modern, tech-forward clinics.

---

## 2. Weekly Build Sprint (30-Day Hard Deadline)

### Week 1: Foundation & Service Catalog (MVP)
*Focus: NextJS + Supabase + Shadcn/ui*
- **Vet: Service Manager:** CRUD for services (e.g., "Godišnja Vakcinacija", "Pregled", "Ultrazvuk") with **fixed durations** (15, 30, 60 mins).
- **Vet Dashboard:** Simple table of "Connected Pets."
- **Pet Profile (Internal):** CRUD for Pet Name, Species, and the "Critical Three" (Vaccine Date, Control Date, Weight).
- **Direct Connect:** Owner URL `vetplatforma.rs/join/[clinic-id]`.

### Week 2: The Booking & Reminder Loop (MMP)
*Focus: n8n + Resend + Scheduling Logic*
- **Owner: Self-Service Booking:** 3-step flow: 1. Select Pet -> 2. Select Service (fetches duration) -> 3. Select Time Slot. **Result:** Appointment appears on Vet's "Today Overview" immediately.
- **n8n Workflow:** Daily 09:00 scan of `next_vaccine_date`.
- **Resend Integration:** Automated reminder email/SMS with a direct link to the **Self-Service Booking** flow.

### Week 3: Content & Professionalism (MLP)
*Focus: UX Pilot + Education Feed*
- **Education Engine:** Vet selects from 10 pre-loaded templates.
- **Targeted Feed:** Owners of "Dogs" see dog articles; "Cats" see cat articles.
- **UI Polish:** Use UX PILOT to refine the "Owner Experience" so it feels like a premium app.
- **Landing Page:** "Founding Partner" page with Stripe payment link.

### Week 4: Deployment & The "10-Partner" Push
- **Vercel Deployment:** Production-ready environment.
- **Onboarding Tool:** CSV Import for Vets (allow them to bulk-upload their current client list).
- **The Close:** Finalize 10-minute demo script focusing on "Zero-Call Scheduling."

---

## 3. Required Functions & Screen Map

| Level | Screen | Key Functionality |
| --- | --- | --- |
| **MVP** | **Vet: Service Settings** | Define Services (Name, Duration, Description). |
| **MVP** | Vet: Pet List | View all pets who clicked "Connect." |
| **MVP** | Vet: Pet Editor | Set vaccine/control dates (The source of truth). |
| **MMP** | **Owner: Booking Flow** | Select Service -> Select Time -> Success. |
| **MMP** | Vet: Today's Overview | Live list of upcoming appointments from the booking engine. |
| **MMP** | Admin: n8n Dashboard | Monitor daily reminder success rates. |
| **MLP** | Vet: Content Library | Toggle "Publish" on educational articles. |
| **MLP** | Owner: Info Feed | Scrollable list of Vet-approved health tips. |

---

## 4. Tech Stack Execution

- **Frontend:** NextJS (App Router).
- **Styling:** Tailwind + Shadcn/ui.
- **Icons:** LucideReact.
- **Automations:** n8n (Scheduling cron + Reminder triggers).
- **Email:** Resend (Reminders & Booking Confirmations).
- **Design:** UX PILOT (Owner Dashboard & Booking UI).

---

## 5. Economic & Growth Model

- **The Math:** 10 clients @ $49 = $490 MRR. 
- **The Pitch:** "Save 2 hours of phone calls per day with Self-Service Booking."
- **Churn Mitigation:** Once a Vet sets up their Service Catalog and starts receiving bookings, they are 10x less likely to leave.
- **Scalability:** To hit $10k MRR, the booking engine must be "Self-Healing" (Vet defines hours once, system handles the rest).

---

## 6. What we are NOT building (Waste)
- No "Accept/Decline" buttons for appointments (Instant booking only).
- No complex "Staff Schedule" management (Assume 1 calendar per clinic for now).
- No online payments for appointments (V2).
- No manual password resets (Magic Links).
