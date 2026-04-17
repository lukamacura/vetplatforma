-- ============================================================
-- Owner private day notes
-- One textarea per (owner, calendar-day). Vet NEVER sees this.
-- ============================================================

create table if not exists owner_day_notes (
  owner_id   uuid not null references profiles(id) on delete cascade,
  day        date not null,
  note       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (owner_id, day)
);

alter table owner_day_notes enable row level security;

-- Owner reads/writes own rows only. No vet policy on purpose.
drop policy if exists "owner manages own day notes" on owner_day_notes;
create policy "owner manages own day notes" on owner_day_notes
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
