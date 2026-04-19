alter table clinics
  add column if not exists description text check (char_length(description) <= 500),
  add column if not exists logo_url text,
  add column if not exists address text;
