-- Migration: buffer changes re-stretch future appointments.
--
-- Why this exists:
--   The previous design stamped ends_at at insert time and never moved
--   it. That was clean from a "history is sacred" angle but terrible
--   UX: a vet who lowers the pauza from 10 → 0 expected their schedule
--   to pack tighter immediately, and instead kept seeing the 10-min
--   ghost tail on every already-booked appointment.
--
-- New rule:
--   - PAST appointments: frozen. ends_at stays put.
--   - FUTURE confirmed appointments: recomputed whenever the clinic's
--     buffer_minutes changes, so the on-screen schedule matches what
--     the vet just configured.
--
-- If raising the buffer would make two future appointments overlap,
-- the EXCLUDE constraint (appointments_no_overlap) aborts the whole
-- clinics.buffer_minutes UPDATE atomically. The vet must move or
-- cancel the offending appointment first.

create or replace function clinics_recompute_future_appointments()
returns trigger language plpgsql as $fn$
begin
  if new.buffer_minutes is distinct from old.buffer_minutes then
    update appointments a
       set ends_at = a.scheduled_at
                   + ((s.duration_minutes + new.buffer_minutes) * interval '1 minute')
      from services s
     where a.service_id   = s.id
       and a.clinic_id    = new.id
       and a.status       = 'confirmed'
       and a.scheduled_at >= now();
  end if;
  return new;
end;
$fn$;

drop trigger if exists clinics_recompute_appointments on clinics;

create trigger clinics_recompute_appointments
  after update of buffer_minutes on clinics
  for each row execute procedure clinics_recompute_future_appointments();

-- One-off backfill: align existing future appointments with the clinic's
-- current buffer. This also fixes the ghost-window from the previous
-- snapshot-never-moves design.
update appointments a
   set ends_at = a.scheduled_at
               + ((s.duration_minutes + c.buffer_minutes) * interval '1 minute')
  from services s, clinics c
 where a.service_id   = s.id
   and a.clinic_id    = c.id
   and a.status       = 'confirmed'
   and a.scheduled_at >= now();
