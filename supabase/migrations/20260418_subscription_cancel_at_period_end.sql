-- Track Stripe's cancel_at_period_end flag so UI can show
-- "Pretplata prekinuta · Imate pristup do <date>" between the moment
-- the vet cancels in the billing portal and the actual period end.
alter table clinics
  add column if not exists subscription_cancel_at_period_end boolean not null default false;
