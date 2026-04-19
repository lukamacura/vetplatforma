-- Allow any authenticated user to read clinic hours (needed for clinic browse page)
create policy "authenticated reads clinic hours" on clinic_hours
  for select using (auth.uid() is not null);
