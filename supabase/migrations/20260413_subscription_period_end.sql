alter table clinics
  add column if not exists subscription_current_period_end timestamptz;
