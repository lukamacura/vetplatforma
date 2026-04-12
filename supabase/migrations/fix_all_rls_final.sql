-- ============================================================
-- Migration: fix_all_rls_final
-- Problem: profiles RLS policy had a self-referential join
--          (join profiles vet ...) causing infinite recursion.
--          All other table policies also queried profiles directly.
-- Fix: use security definer helper functions throughout — they
--      bypass RLS and read profiles as superuser, breaking recursion.
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Security definer helpers (safe to re-create)
create or replace function my_clinic_id()
returns uuid language sql security definer stable as $$
  select clinic_id from public.profiles where id = auth.uid() limit 1
$$;

create or replace function my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid() limit 1
$$;

-- Drop all stale policies
drop policy if exists "own profile"                    on public.profiles;
drop policy if exists "authenticated users read clinics" on public.clinics;
drop policy if exists "vet manages own clinic"         on public.clinics;
drop policy if exists "owner manages own pets"         on public.pets;
drop policy if exists "vet manages connected pets"     on public.pets;
drop policy if exists "owner connects"                 on public.connections;
drop policy if exists "vet reads connections"          on public.connections;
drop policy if exists "vet manages services"           on public.services;
drop policy if exists "owner reads active services"    on public.services;
drop policy if exists "owner manages own appointments" on public.appointments;
drop policy if exists "vet reads clinic appointments"  on public.appointments;

-- clinics: all authenticated can read; vet can insert/update/delete own clinic
create policy "clinics_select" on public.clinics
  for select to authenticated using (true);

create policy "clinics_vet_all" on public.clinics
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- profiles: own row, or vet reading profiles of their connected owners
-- Uses my_role() / my_clinic_id() — no direct profiles join → no recursion
create policy "profiles_rw" on public.profiles
  using (
    id = auth.uid()
    or (
      my_role() = 'vet'
      and exists (
        select 1 from public.connections c
        where c.owner_id = profiles.id
          and c.clinic_id = my_clinic_id()
      )
    )
  )
  with check (id = auth.uid());

-- pets: owner manages own; vet can read+write pets of connected owners
create policy "pets_owner" on public.pets
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "pets_vet" on public.pets
  using (
    my_role() = 'vet'
    and exists (
      select 1 from public.connections c
      where c.owner_id = pets.owner_id
        and c.clinic_id = my_clinic_id()
    )
  )
  with check (
    my_role() = 'vet'
    and exists (
      select 1 from public.connections c
      where c.owner_id = pets.owner_id
        and c.clinic_id = my_clinic_id()
    )
  );

-- connections: owner inserts/reads own rows; vet reads their clinic's connections
create policy "connections_owner" on public.connections
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "connections_vet_select" on public.connections
  for select using (
    my_role() = 'vet'
    and clinic_id = my_clinic_id()
  );

-- services: vet manages own clinic's services; owner reads active ones for connected clinics
create policy "services_vet" on public.services
  using (my_role() = 'vet' and clinic_id = my_clinic_id())
  with check (my_role() = 'vet' and clinic_id = my_clinic_id());

create policy "services_owner_select" on public.services
  for select using (
    is_active = true
    and exists (
      select 1 from public.connections c
      where c.owner_id = auth.uid()
        and c.clinic_id = services.clinic_id
    )
  );

-- appointments: owner manages own; vet reads all for their clinic
create policy "appointments_owner" on public.appointments
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "appointments_vet_select" on public.appointments
  for select using (
    my_role() = 'vet'
    and clinic_id = my_clinic_id()
  );
