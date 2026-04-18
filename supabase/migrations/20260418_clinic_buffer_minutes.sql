-- Migration: align reservation system with docs/reservation_system.md
--
-- What this does:
--   1. Adds clinics.buffer_minutes — ONE global value per clinic
--      (0 / 5 / 10 / 15, default 10). This is the only buffer knob
--      the vet configures, and it applies after every appointment.
--   2. Rewrites the appointment ends_at trigger so ends_at is computed
--      at insert time as scheduled_at + service.duration_minutes
--      + clinic.buffer_minutes. Already-booked rows keep their
--      original stored (scheduled_at, ends_at) — the buffer knob only
--      affects future bookings.
--   3. Drops the V2-scope columns we no longer need:
--        - services.buffer_after_minutes (per-service buffers → V2)
--        - appointments.duration_minutes + appointments.buffer_after_minutes
--          (booking-time snapshot of duration/buffer per row → V2)
--      The no-overlap EXCLUDE constraint still works because it only
--      reads clinic_id + tstzrange(scheduled_at, ends_at).
--
-- Note on dollar-quoting: we use labeled tags ($chk$, $fn$) instead of
-- plain $$ because some SQL clients (e.g. Supabase Studio's SQL editor)
-- can misparse nested $$ blocks and try to execute the function body as
-- top-level SQL, producing "relation svc_duration does not exist".
-- Apply via the Supabase MCP or a proper psql client.

-- 1. clinics.buffer_minutes
alter table clinics
  add column if not exists buffer_minutes int not null default 10;

do $chk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clinics_buffer_minutes_check'
  ) then
    alter table clinics
      add constraint clinics_buffer_minutes_check
      check (buffer_minutes in (0, 5, 10, 15));
  end if;
end $chk$;

-- 2. Replace ends_at trigger — now reads buffer from the clinic, not the service.
drop trigger  if exists appointments_snapshot_schedule on appointments;
drop trigger  if exists appointments_snapshot_duration on appointments;

create or replace function snapshot_appointment_schedule()
returns trigger language plpgsql as $fn$
declare
  svc_duration  int;
  clinic_buffer int;
begin
  select s.duration_minutes
    into svc_duration
    from services s
   where s.id = new.service_id;

  if svc_duration is null then
    raise exception 'service % not found', new.service_id;
  end if;

  select c.buffer_minutes
    into clinic_buffer
    from clinics c
   where c.id = new.clinic_id;

  if clinic_buffer is null then
    clinic_buffer := 10;
  end if;

  new.ends_at := new.scheduled_at
               + ((svc_duration + clinic_buffer) * interval '1 minute');
  return new;
end;
$fn$;

create trigger appointments_snapshot_schedule
  before insert or update of scheduled_at, service_id, clinic_id
  on appointments
  for each row execute procedure snapshot_appointment_schedule();

-- 3. Drop V2-scope columns.
alter table services      drop constraint if exists services_buffer_after_minutes_check;
alter table services      drop column     if exists buffer_after_minutes;

alter table appointments  drop column     if exists duration_minutes;
alter table appointments  drop column     if exists buffer_after_minutes;
