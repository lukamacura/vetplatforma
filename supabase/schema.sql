-- ============================================================
-- VetPlatforma MVP Schema
-- Run in Supabase SQL Editor (in order — respects FK deps)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Clinics
-- ------------------------------------------------------------
create table if not exists clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,   -- used in /join/[slug]
  owner_id   uuid references auth.users not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. Profiles (one per auth user)
-- Role comes from raw_user_meta_data.role at registration
-- ------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  role       text not null check (role in ('vet', 'owner')),
  full_name  text not null,
  phone      text,
  clinic_id  uuid references clinics,  -- null for owners
  created_at timestamptz default now()
);

-- Trigger: auto-create profile row on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'owner'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ------------------------------------------------------------
-- 3. Pets (owned by owners; vet edits Critical Three)
-- ------------------------------------------------------------
create table if not exists pets (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references profiles not null,
  name              text not null,
  species           text not null check (species in (
    'dog','cat','rabbit','bird','rodent','reptile','ferret','other'
  )),
  breed             text,
  birth_date        date,
  weight_kg         numeric(5,2),       -- Critical Three #1
  next_vaccine_date date,               -- Critical Three #2
  next_control_date date,               -- Critical Three #3
  chip_id           text,
  vet_notes         text,               -- shared general note (owner + vet, same UI field)
  created_at        timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. Connections (owner ↔ clinic — the RLS join table)
-- ------------------------------------------------------------
create table if not exists connections (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references profiles not null,
  clinic_id    uuid references clinics not null,
  connected_at timestamptz default now(),
  unique(owner_id, clinic_id)
);

-- ------------------------------------------------------------
-- 5. Services (defined by vet; used in booking)
-- ------------------------------------------------------------
create table if not exists services (
  id               uuid primary key default gen_random_uuid(),
  clinic_id        uuid references clinics not null,
  name             text not null,
  duration_minutes int not null check (duration_minutes in (15, 30, 60)),
  description      text,
  is_active        bool default true,
  created_at       timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. Appointments (no pending status — always confirmed)
-- ------------------------------------------------------------
create table if not exists appointments (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid references clinics not null,
  pet_id       uuid references pets not null,
  service_id   uuid references services not null,
  owner_id     uuid references profiles not null,
  scheduled_at timestamptz not null,
  status       text default 'confirmed',
  vet_notes    text,               -- vet-only per-appointment notes; NEVER exposed to owner
  created_at   timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table clinics     enable row level security;
alter table profiles    enable row level security;
alter table pets        enable row level security;
alter table connections enable row level security;
alter table services    enable row level security;
alter table appointments enable row level security;

-- clinics: vet reads/updates own clinic
create policy "vet manages own clinic" on clinics
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- profiles: user reads/writes own row
create policy "own profile" on profiles
  using (id = auth.uid())
  with check (id = auth.uid());

-- pets: owner manages own; vet manages pets of connected owners
create policy "owner manages own pets" on pets
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "vet manages connected pets" on pets
  using (
    exists (
      select 1 from connections c
      join profiles p on p.id = auth.uid()
      where c.owner_id = pets.owner_id
        and c.clinic_id = p.clinic_id
        and p.role = 'vet'
    )
  );

-- connections: owner inserts own; vet reads their clinic's
create policy "owner connects" on connections
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "vet reads connections" on connections
  for select using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.clinic_id = connections.clinic_id
        and p.role = 'vet'
    )
  );

-- services: vet manages own clinic's; owner reads active services of connected clinics
create policy "vet manages services" on services
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and clinic_id = services.clinic_id
        and role = 'vet'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and clinic_id = services.clinic_id
        and role = 'vet'
    )
  );

create policy "owner reads active services" on services
  for select using (
    is_active = true
    and exists (
      select 1 from connections c
      where c.owner_id = auth.uid()
        and c.clinic_id = services.clinic_id
    )
  );

-- appointments: owner inserts/reads own; vet reads all for clinic
create policy "owner manages own appointments" on appointments
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "vet reads clinic appointments" on appointments
  for select using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and clinic_id = appointments.clinic_id
        and role = 'vet'
    )
  );

-- ------------------------------------------------------------
-- 7. Owner day notes (private per-day diary; vet NEVER sees)
-- ------------------------------------------------------------
create table if not exists owner_day_notes (
  owner_id   uuid not null references profiles(id) on delete cascade,
  day        date not null,
  note       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner_id, day)
);

alter table owner_day_notes enable row level security;

-- Owner reads/writes own rows only. No vet policy on purpose.
create policy "owner manages own day notes" on owner_day_notes
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
