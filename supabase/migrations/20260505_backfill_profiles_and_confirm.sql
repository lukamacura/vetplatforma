-- One-off cleanup for legacy accounts blocking OTP login.
-- Safe to run multiple times.

-- 1. Confirm any auth.users that never had email_confirmed_at set
--    (legacy password users, dev signups). Without this, verifyOtp can fail.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;

-- 2. Backfill missing profiles rows from auth.users metadata.
insert into public.profiles (id, role, full_name, phone)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'role', 'owner'),
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.raw_user_meta_data->>'phone'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
