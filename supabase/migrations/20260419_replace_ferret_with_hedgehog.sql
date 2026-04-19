-- Replace 'ferret' with 'hedgehog' in the pets.species enum-ish check.
-- Ferret was never used in production pets (added alongside the expanded
-- species set in 20260417), but we migrate existing rows just in case.
--
-- Keep in sync with src/lib/species.ts — single source of truth on the app side.

update pets set species = 'hedgehog' where species = 'ferret';

alter table pets
  drop constraint if exists pets_species_check;

alter table pets
  add constraint pets_species_check
  check (species in (
    'dog','cat','rabbit','bird','rodent','reptile','hedgehog','other'
  ));
