-- Migration: Owner-facing MVP upgrades
-- Adds: booked_by on appointments, owner_notes + vaccine_note on pets

-- 1. Track who booked each appointment (owner self-booking vs vet-initiated)
alter table appointments
  add column if not exists booked_by text
  not null default 'owner'
  check (booked_by in ('owner', 'vet'));

-- 2. Owner-to-vet scratchpad per pet (persistent note visible to both sides)
alter table pets add column if not exists owner_notes text;

-- 3. Vet-set context for the next vaccine date (e.g. "Besnilo, revakcinacija")
alter table pets add column if not exists vaccine_note text;
