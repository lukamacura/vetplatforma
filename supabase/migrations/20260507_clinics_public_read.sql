-- Allow anonymous (logged-out) visitors to read clinics.
-- Required so /join/<slug> and /register?clinic=<slug> resolve the clinic
-- before the visitor has signed up.
-- NOTE: This exposes all clinic columns to anon (incl. Stripe IDs, trial dates,
-- subscription_status). If that's not acceptable, replace this with a public
-- view that selects only id, name, slug, logo_url, description, address and
-- keep clinics_select restricted to authenticated.
drop policy if exists "clinics_select" on public.clinics;

create policy "clinics_select" on public.clinics
  for select to anon, authenticated using (true);
