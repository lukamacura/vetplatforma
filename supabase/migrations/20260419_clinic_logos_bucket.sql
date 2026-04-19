insert into storage.buckets (id, name, public)
values ('clinic-logos', 'clinic-logos', true)
on conflict (id) do nothing;

create policy "Public read clinic logos"
  on storage.objects for select
  using (bucket_id = 'clinic-logos');

create policy "Authenticated manage clinic logos"
  on storage.objects for all to authenticated
  using (bucket_id = 'clinic-logos')
  with check (bucket_id = 'clinic-logos');
