-- Anon-callable check: does an account exist for this email?
-- Used by login form to pre-check before requesting OTP, so we can
-- show a clean "Niste kreirali nalog." error without ever sending mail.
create or replace function public.email_has_account(p_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from auth.users where lower(email) = lower(p_email)
  );
$$;

grant execute on function public.email_has_account(text) to anon, authenticated;
