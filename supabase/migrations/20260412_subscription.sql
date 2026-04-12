-- Subscription state on clinics
alter table clinics
  add column if not exists trial_started_at timestamptz default now(),
  add column if not exists subscription_status text not null default 'trial'
    check (subscription_status in ('trial', 'active', 'expired', 'cancelled')),
  add column if not exists stripe_customer_id text;
