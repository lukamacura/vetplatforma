-- clinic_hours: per-weekday open/close times per clinic
create table if not exists clinic_hours (
  id          uuid primary key default gen_random_uuid(),
  clinic_id   uuid references clinics not null,
  weekday     int not null check (weekday between 0 and 6), -- 0=Sunday, 1=Monday, ..., 6=Saturday
  open_time   time,
  close_time  time,
  is_closed   boolean not null default false,
  unique(clinic_id, weekday)
);

alter table clinic_hours enable row level security;

create policy "vet manages clinic hours" on clinic_hours
  using (
    exists (select 1 from profiles where id = auth.uid() and clinic_id = clinic_hours.clinic_id and role = 'vet')
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and clinic_id = clinic_hours.clinic_id and role = 'vet')
  );

create policy "owner reads clinic hours" on clinic_hours
  for select using (
    exists (select 1 from connections c where c.owner_id = auth.uid() and c.clinic_id = clinic_hours.clinic_id)
  );

-- Add status CHECK constraint to appointments
alter table appointments
  add constraint appointments_status_check
  check (status in ('confirmed', 'cancelled', 'no_show'));
