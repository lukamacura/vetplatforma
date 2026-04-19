# Vet Clinic Profile — Implementation Plan

## Verdict
Build now. Logo + description + address only. No Maps embed in MVP.

## What We're Adding
Three nullable columns on the existing `clinics` table:
- `description text` — "O klinici", max 500 chars
- `logo_url text` — URL to clinic logo (no file upload in MVP)
- `address text` — plain text, rendered as a Google Maps link

## What We're NOT Building (MVP scope cuts)
- No Google Maps embed (half-day setup, zero demo value)
- No Supabase Storage file upload (3–4 hours; URL field is identical in demo)
- No admin approval flow (vet edits their own row)
- No cover photo, gallery, or structured hours-of-operation fields
- No rich text for description

## Schema Migration
File: `supabase/migrations/20260419_clinic_profile_fields.sql`

```sql
alter table clinics
  add column if not exists description text check (char_length(description) <= 500),
  add column if not exists logo_url text,
  add column if not exists address text;
```

No new tables, no new buckets. Existing RLS on `clinics` already covers:
- Vets: update their own clinic row
- Owners: read via `connections` join

## Vet Dashboard — Edit Form (`/dashboard/podesavanja`)
Add to `src/app/dashboard/podesavanja/page.tsx`:
- `logo_url` — text input, label "Logo klinike (URL slike)"
- `description` — textarea, label "O klinici", maxLength 500, character counter
- `address` — text input, label "Adresa klinike"
- Save via `supabase.from('clinics').update({ logo_url, description, address }).eq('id', clinicId)`

## Owner View — Clinic Card (`/klijent`)
Update `src/app/(owner)/klijent/page.tsx` to render:
1. **Logo** — circular `<img>` 64px; fallback to paw icon in `--brand` color if `logo_url` is null
2. **Clinic name** — already rendered
3. **"O klinici"** — plain text block, show all (no truncation for MVP)
4. **Address** — teal anchor `"Prikaži na mapi"` → `https://maps.google.com/?q=${encodeURIComponent(address)}`, `target="_blank"`

Ensure the existing `clinics` query in `klijent/page.tsx` selects the new columns (add `description, logo_url, address` to the `.select()` call).

## Steps (in order)

1. [ ] Create and run migration `supabase/migrations/20260419_clinic_profile_fields.sql`
2. [ ] Update `src/app/dashboard/podesavanja/page.tsx` — add three form fields + save logic
3. [ ] Update `src/app/(owner)/klijent/page.tsx` — render logo, description, address link
4. [ ] Pre-populate demo clinic with real logo URL and address for sales demo

## Post-MVP (V2)
- Replace `logo_url` text field with Supabase Storage upload (no schema change needed — column stays `logo_url`)
- Add inline Google Maps embed
- Add structured opening hours
