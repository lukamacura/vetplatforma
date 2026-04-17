-- Expand pets.species to support rabbit, rodent, reptile, ferret
-- alongside the original dog/cat/bird/other set.
--
-- Keep in sync with src/lib/species.ts — that file is the single source
-- of truth on the app side.

alter table pets
  drop constraint if exists pets_species_check;

alter table pets
  add constraint pets_species_check
  check (species in (
    'dog','cat','rabbit','bird','rodent','reptile','ferret','other'
  ));
