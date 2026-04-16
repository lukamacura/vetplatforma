-- Migration: Add price to services + allow custom duration
-- 1. Drop the fixed-duration CHECK so vets can enter any value (min 5 minutes)
-- 2. Add price_rsd as required field (defaults existing rows to 0)

alter table services drop constraint if exists services_duration_minutes_check;
alter table services
  add constraint services_duration_minutes_check
  check (duration_minutes >= 5 AND duration_minutes <= 480);

alter table services
  add column if not exists price_rsd int not null default 0
  check (price_rsd >= 0);
