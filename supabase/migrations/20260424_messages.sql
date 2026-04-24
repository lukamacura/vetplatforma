-- Chat messages table
create table if not exists public.messages (
  id               uuid        primary key default gen_random_uuid(),
  clinic_id        uuid        not null references public.clinics(id) on delete cascade,
  sender_id        uuid        not null references public.profiles(id) on delete cascade,
  receiver_id      uuid        not null references public.profiles(id) on delete cascade,
  content          text,
  message_type     text        not null default 'text'
                               check (message_type in ('text', 'image', 'video', 'voice')),
  file_url         text,
  file_name        text,
  duration_seconds integer,
  is_read          boolean     not null default false,
  created_at       timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Sender or receiver can read their own messages
create policy "messages_select" on public.messages
  for select using (
    sender_id = auth.uid() or receiver_id = auth.uid()
  );

-- Only send as yourself
create policy "messages_insert" on public.messages
  for insert with check (sender_id = auth.uid());

-- Only receiver can mark read
create policy "messages_update_read" on public.messages
  for update using (receiver_id = auth.uid())
  with check (is_read = true);

-- Index for fast conversation queries
create index if not exists messages_clinic_participants_idx
  on public.messages (clinic_id, sender_id, receiver_id, created_at desc);

-- Enable realtime
alter publication supabase_realtime add table public.messages;

-- Storage bucket for chat media (images, video, voice)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  52428800, -- 50 MB
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/ogg','audio/mpeg']
)
on conflict (id) do nothing;

-- Storage RLS: anyone authenticated can upload
create policy "chat_media_insert" on storage.objects
  for insert with check (
    bucket_id = 'chat-media' and auth.role() = 'authenticated'
  );

create policy "chat_media_select" on storage.objects
  for select using (bucket_id = 'chat-media');
