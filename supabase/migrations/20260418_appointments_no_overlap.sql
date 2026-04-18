-- Migration: enforce instant-confirm scheduling invariants at the DB layer.
--
-- What this does:
--   1. Snapshots duration_minutes + buffer_after_minutes onto each appointment
--      row at booking time, so edits to services.duration / services.buffer
--      never retroactively move appointments on the calendar.
--   2. Adds a generated ends_at = scheduled_at + duration + buffer.
--   3. Adds an EXCLUDE constraint that makes it physically impossible to
--      have two confirmed appointments overlap in the same clinic.
--
-- Run in Supabase SQL Editor. See the companion "pre-flight overlap check"
-- query in docs/migration-notes or run it manually before this file.

create extension if not exists btree_gist;

-- 0. Defensive: ensure services.buffer_after_minutes exists, in case the
--    earlier per-service buffer migration wasn't applied on this DB.
alter table services
  add column if not exists buffer_after_minutes int not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_buffer_after_minutes_check'
  ) then
    alter table services
      add constraint services_buffer_after_minutes_check
      check (buffer_after_minutes >= 0 and buffer_after_minutes <= 60);
  end if;
end $$;

-- 1. Snapshot columns on appointments
alter table appointments
  add column if not exists duration_minutes     int,
  add column if not exists buffer_after_minutes int not null default 0;

-- Backfill from services for any existing rows
update appointments a
set    duration_minutes     = s.duration_minutes,
       buffer_after_minutes = coalesce(s.buffer_after_minutes, 0)
from   services s
where  a.service_id = s.id
  and  a.duration_minutes is null;

alter table appointments
  alter column duration_minutes set not null;

-- 2. ends_at — plain column, maintained by trigger below.
--    (Postgres won't accept make_interval / interval arithmetic in a STORED
--    generated column — they're classed as stable, not immutable.)
alter table appointments
  add column if not exists ends_at timestamptz;

-- 3. Trigger: on INSERT/UPDATE, snapshot duration+buffer from services if the
--    client didn't send them, then compute ends_at = scheduled_at + (dur+buf).
create or replace function snapshot_appointment_schedule()
returns trigger language plpgsql as $$
begin
  if new.duration_minutes is null then
    select s.duration_minutes, coalesce(s.buffer_after_minutes, 0)
      into new.duration_minutes, new.buffer_after_minutes
    from   services s
    where  s.id = new.service_id;

    if new.duration_minutes is null then
      raise exception 'service % not found', new.service_id;
    end if;
  end if;

  if new.buffer_after_minutes is null then
    new.buffer_after_minutes := 0;
  end if;

  new.ends_at := new.scheduled_at
               + ((new.duration_minutes + new.buffer_after_minutes) * interval '1 minute');
  return new;
end;
$$;

-- Drop orphans from earlier partial runs of this migration.
drop trigger  if exists appointments_snapshot_duration on appointments;
drop trigger  if exists appointments_snapshot_schedule on appointments;
drop function if exists snapshot_appointment_duration();

create trigger appointments_snapshot_schedule
  before insert or update of scheduled_at, service_id, duration_minutes, buffer_after_minutes
  on appointments
  for each row execute procedure snapshot_appointment_schedule();

-- Backfill ends_at for existing rows (trigger only fires on future writes).
update appointments
set    ends_at = scheduled_at
             + ((duration_minutes + coalesce(buffer_after_minutes, 0)) * interval '1 minute')
where  ends_at is null;

alter table appointments
  alter column ends_at set not null;

-- 4. No-overlap invariant for confirmed appointments per clinic.
--    Cancelled / no_show rows are excluded so a freed slot can be re-booked.
alter table appointments
  drop constraint if exists appointments_no_overlap;

alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    clinic_id                                      with =,
    tstzrange(scheduled_at, ends_at, '[)')         with &&
  ) where (status = 'confirmed');
