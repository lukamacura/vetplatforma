-- Add vet_notes column to appointments (per-visit notes, visible only to vets)
alter table appointments add column if not exists vet_notes text;
