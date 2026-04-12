-- ============================================================
-- Migration: fix_rls_clinics_and_profiles
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Fix 1: clinics — allow all authenticated users to SELECT
-- (Required for browse-all-clinics page and /join/[slug])
drop policy if exists "vet manages own clinic" on clinics;

create policy "authenticated users read clinics"
  on clinics for select
  to authenticated
  using (true);

create policy "vet manages own clinic"
  on clinics for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Fix 2: profiles — vet can also read profiles of connected owners
-- (Required for vet dashboard to show owner names in patient list)
drop policy if exists "own profile" on profiles;

create policy "own profile"
  on profiles
  using (
    -- every user reads/writes their own row
    id = auth.uid()
    or
    -- vet reads profiles of owners connected to their clinic
    exists (
      select 1
      from connections c
      join profiles vet on vet.id = auth.uid()
      where c.owner_id = profiles.id
        and c.clinic_id = vet.clinic_id
        and vet.role = 'vet'
    )
  )
  with check (id = auth.uid());
