-- Add photo_url column to pets
alter table pets add column if not exists photo_url text;

-- Create a public storage bucket for pet photos
insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

-- RLS: owners can upload photos for their own pets
create policy "owner uploads pet photo"
  on storage.objects for insert
  with check (
    bucket_id = 'pet-photos'
    and auth.uid() is not null
  );

-- RLS: anyone can read pet photos (public bucket)
create policy "public reads pet photos"
  on storage.objects for select
  using (bucket_id = 'pet-photos');

-- RLS: owners can delete their own pet photos
create policy "owner deletes pet photo"
  on storage.objects for delete
  using (
    bucket_id = 'pet-photos'
    and auth.uid() is not null
  );
