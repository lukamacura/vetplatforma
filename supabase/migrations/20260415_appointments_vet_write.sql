-- Migration: allow vets to INSERT and UPDATE appointments for their clinic
-- Problem: only appointments_vet_select existed — vets could read but not
--          create or update appointments, so the booking wizard and
--          no-show button silently failed.

create policy "appointments_vet_insert" on public.appointments
  for insert to authenticated
  with check (
    my_role() = 'vet'
    and clinic_id = my_clinic_id()
  );

create policy "appointments_vet_update" on public.appointments
  for update to authenticated
  using (
    my_role() = 'vet'
    and clinic_id = my_clinic_id()
  )
  with check (
    my_role() = 'vet'
    and clinic_id = my_clinic_id()
  );
