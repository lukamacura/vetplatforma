-- Add gender, passport_number, and color columns to pets
alter table pets
  add column if not exists gender text check (gender in ('male', 'female', 'unknown')),
  add column if not exists passport_number text,
  add column if not exists color text;
