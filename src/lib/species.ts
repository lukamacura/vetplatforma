/**
 * Single source of truth for pet species across the app.
 *
 * Also the ONLY place to change when adding/removing a species. The DB check
 * constraint on `pets.species` must be kept in sync — see
 * `supabase/migrations/20260417_expand_species.sql`.
 */

export const SPECIES_VALUES = [
  "dog",
  "cat",
  "rabbit",
  "bird",
  "rodent",
  "reptile",
  "hedgehog",
  "other",
] as const

export type Species = (typeof SPECIES_VALUES)[number]

export const SPECIES_LABEL: Record<Species, string> = {
  dog:      "Pas",
  cat:      "Mačka",
  rabbit:   "Zec",
  bird:     "Ptica",
  rodent:   "Glodar",
  reptile:  "Reptil",
  hedgehog: "Jež",
  other:    "Ostalo",
}

/**
 * Stylized PNG illustrations served from `public/animals/`.
 * Used in avatars, picker buttons and photo placeholders.
 */
export const SPECIES_IMAGE: Record<Species, string> = {
  dog:      "/animals/dog.png",
  cat:      "/animals/cat.png",
  rabbit:   "/animals/rabbit.png",
  bird:     "/animals/bird.png",
  rodent:   "/animals/rodent.png",
  reptile:  "/animals/reptile.png",
  hedgehog: "/animals/hedgehog.png",
  other:    "/animals/other.png",
}

/**
 * Emoji fallbacks (text-only contexts, SMS copy, etc).
 * Kept around because avatars/pickers use the PNG illustrations now.
 */
export const SPECIES_EMOJI: Record<Species, string> = {
  dog:      "🐕",
  cat:      "🐈",
  rabbit:   "🐰",
  bird:     "🐦",
  rodent:   "🐹",
  reptile:  "🐢",
  hedgehog: "🦔",
  other:    "🐾",
}

/**
 * Background + border for species-tinted cards (pet card, dashboard tiles).
 * Each species is pinned to an existing palette token so the set stays
 * on-brand without introducing new colors.
 */
export const SPECIES_STYLE: Record<Species, { bg: string; border: string }> = {
  dog:      { bg: "var(--blue-tint)",   border: "rgba(37,99,235,0.18)"  },
  cat:      { bg: "var(--amber-tint)",  border: "rgba(217,119,6,0.18)"  },
  rabbit:   { bg: "var(--brand-tint)",  border: "rgba(43,181,160,0.18)" },
  bird:     { bg: "var(--green-tint)",  border: "rgba(22,163,74,0.18)"  },
  rodent:   { bg: "var(--yellow-tint)", border: "rgba(234,179,8,0.20)"  },
  reptile:  { bg: "var(--green-tint)",  border: "rgba(22,163,74,0.18)"  },
  hedgehog: { bg: "var(--orange-tint)", border: "rgba(234,88,12,0.18)"  },
  other:    { bg: "var(--brand-tint)",  border: "rgba(43,181,160,0.18)" },
}

/** Ordered list for pickers. Order matters — most common first. */
export const SPECIES_OPTIONS: {
  value: Species
  label: string
  emoji: string
  image: string
}[] = SPECIES_VALUES.map((v) => ({
  value: v,
  label: SPECIES_LABEL[v],
  emoji: SPECIES_EMOJI[v],
  image: SPECIES_IMAGE[v],
}))
