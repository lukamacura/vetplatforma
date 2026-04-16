-- Add per-appointment vet notes column
alter table appointments add column if not exists vet_notes text;
