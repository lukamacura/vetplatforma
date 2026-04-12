-- ============================================================
-- Migration: fix_profiles_rls_recursion
-- Problem: the previous "own profile" policy joins `profiles`
--          inside its own RLS policy → infinite recursion.
-- Fix: use security definer helper functions that bypass RLS
--      to read the caller's own clinic_id and role.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Step 1: helpers that read profiles as superuser (no RLS recursion)
create or replace function my_clinic_id()
returns uuid language sql security definer stable as $$
  select clinic_id from public.profiles where id = auth.uid() limit 1
$$;

create or replace function my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid() limit 1
$$;

-- Step 2: replace the broken policy
drop policy if exists "own profile" on public.profiles;

create policy "own profile"
  on public.profiles
  using (
    -- every user reads/writes their own row
    id = auth.uid()
    or
    -- vet reads profiles of owners connected to their clinic
    (
      my_role() = 'vet'
      and exists (
        select 1 from public.connections c
        where c.owner_id = profiles.id
          and c.clinic_id = my_clinic_id()
      )
    )
  )
  with check (id = auth.uid());
