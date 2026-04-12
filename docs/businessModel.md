# VetPlatforma - Business Model

## What We're Building

A SaaS platform for veterinary clinics in Serbia (and eventually the Balkans).

The problem is simple: 80% of vet clinics in Serbia still run on paper, Excel, and phone calls.
EU alternatives cost hundreds of euros per month and aren't built for local needs.

We build the Serbian solution. We build it *with* clinics, not for them.

---

## Revenue Model

Subscription (monthly recurring). No setup fees. No per-seat pricing.

| Tier | Price | Who It's For |
|---|---|---|
| Founding Partner (Tier 1) | **0€ first month → 49€/mo locked** | MIN 3 clinics. Early adopters who help shape the product. |
| Standard (Tier 2) | **49€/mo locked** | All clinics after founding period closes. |

---

## Tier 1 - Founding Partner

**3-10 spots. That's it.**

This isn't a discount. It's a co-creation deal.

**What the clinic gets:**
- Full platform access for 1 month, completely free
- Locked price of 49€/month forever if they continue (vs. 49€ standard)
- Direct line to founders - their feedback shapes what gets built next
- Active clinic profile from day one

**What we get:**
- One 45-minute structured interview (problems, workflows, daily pain points)
- Written confirmation of interest (a WhatsApp message is enough)
- Short written review after 30 days (3–5 sentences)
- Optional: one referral to another clinic if they're satisfied

**Why this works:**
We trade cash for something more valuable at this stage - real usage data, real feedback, and real testimonials from real vets. This is market research with a functioning product attached.

The 49€ locked price is the retention hook. Once a clinic is on the platform and happy, churning to 0 means losing everything they've built inside it (patient records, appointment history, client profiles). The switching cost grows every month.

---

## Tier 2 - Standard Plan

**49€/month. Full access. No special terms.**

This launches after the founding period closes - either when all Tier 1 is fulfilled, or after the platform is publicly validated.

**What's included:**
- Online appointment booking (24/7, no phone calls)
- Digital patient records (full medical history, photos, diagnoses)
- Automated reminders (SMS + email for vaccines, checkups)
- Clinic profile on the platform (visible to pet owners)
- Owner portal (clients manage their own pets, see history, receive reminders)

**Why 49€:**
- Competitors in the EU charge 200–400€/month
- A single recovered hour per week at average Serbian consult rates covers the subscription
- The ROI pitch writes itself: ~25,600 RSD/month lost to admin waste vs. ~11,000 RSD/month for the platform

---

## Ascension Path (Future)

| Stage | Offering | Price |
|---|---|---|
| Entry | Standard Plan | 49€/mo |
| Growth | Multi-vet clinic management + analytics dashboard | 149€/mo |
| Scale | White-label for vet clinic chains / franchise groups | Custom |
| Expansion | Balkan market (Croatia, BiH, North Macedonia) | Repackaged per market |

---

## Unit Economics (Target)

- **Churn target:** < 5%/month (sticky due to patient data lock-in)
- **CAC target:** Low - outbound to clinic owners + word-of-mouth from Tier 1 partners
- **LTV:** At 49€/mo with 5% monthly churn → LTV ≈ ~1,980€ per clinic
- **Break-even:** ~15 paying clinics covers initial infrastructure + ops costs

---

## Current Stage

- Platform: not built, design prototypes created
- Founding Partners: 0/10 signed
- Timeline to live: ~30 days from first partner onboarding
- Go-to-market: Direct outreach to vet clinics in Vojvodina + Novi Sad region first

---

## Notes for Development

- Payment processing: Stripe (EU-compliant)
- Legal entity: Macura Solutions LLC (Wyoming, USA)
- Primary market: Serbia
- Languages: Serbian (sr), English (en) for admin/docs
- Auth: Per-clinic accounts with role-based access (vet, receptionist, owner)
- Data: Patient records must be treated as sensitive - GDPR-adjacent handling even though Serbia uses its own data protection law (ZZPL)