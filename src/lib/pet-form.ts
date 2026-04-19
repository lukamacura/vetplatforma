/**
 * Shared form shape + helpers for the add-pet wizard and the edit-pet form.
 *
 * Keeping the DB payload shape in one place prevents the two flows from
 * drifting (e.g. which fields get `|| null`, how `vet_notes` / `owner_notes`
 * are reconciled, etc.).
 */

import type { Species, Gender } from "./types"

export interface PetFormValues {
  name:           string
  species:        Species
  breed:          string
  gender:         Gender
  chipId:         string
  passportNumber: string
  birthDate:      string
  color:          string
  weightKg:       string
  petNotes:       string
}

export const EMPTY_PET_FORM: PetFormValues = {
  name:           "",
  species:        "dog",
  breed:          "",
  gender:         "unknown",
  chipId:         "",
  passportNumber: "",
  birthDate:      "",
  color:          "",
  weightKg:       "",
  petNotes:       "",
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male",    label: "Muški"    },
  { value: "female",  label: "Ženski"   },
  { value: "unknown", label: "Nepoznat" },
]

/** Species-aware placeholder text — small detail that makes the form feel "smart". */
export const BREED_PLACEHOLDER: Record<Species, string> = {
  dog:      "npr. Zlatni Retriver",
  cat:      "npr. Britanska kratkodlaka",
  rabbit:   "npr. Holland Lop",
  bird:     "npr. Nimfa papagaj",
  rodent:   "npr. Sirijski hrčak",
  reptile:  "npr. Brada agama",
  hedgehog: "npr. Afrički patuljasti jež",
  other:    "Upiši vrstu",
}

export const COLOR_PLACEHOLDER: Record<Species, string> = {
  dog:      "npr. Zlatna",
  cat:      "npr. Crno-bela",
  rabbit:   "npr. Braon",
  bird:     "npr. Žuta",
  rodent:   "npr. Bela",
  reptile:  "npr. Zelena",
  hedgehog: "npr. Cinamon",
  other:    "npr. Braon",
}

/**
 * Convert form state to the shape `pets` INSERT / UPDATE expects.
 * Note: `owner_id` and `photo_url` are NOT included — callers handle those
 * separately (photo upload happens after insert to get the pet id).
 */
export function buildPetPayload(values: PetFormValues) {
  return {
    name:            values.name.trim(),
    species:         values.species,
    breed:           values.breed.trim() || null,
    gender:          values.gender,
    chip_id:         values.chipId.trim() || null,
    passport_number: values.passportNumber.trim() || null,
    birth_date:      values.birthDate || null,
    color:           values.color.trim() || null,
    weight_kg:       values.weightKg ? parseFloat(values.weightKg) : null,
    vet_notes:       values.petNotes.trim() || null,
  }
}
