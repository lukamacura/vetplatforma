/**
 * Single source of truth for SEO / site-level metadata.
 * All values are in Serbian — app language.
 *
 * Override the production URL by setting `NEXT_PUBLIC_APP_URL`
 * in the deployment environment (e.g. https://vetplatforma.rs).
 */

const rawBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "https://vetplatforma.rs"

export const siteConfig = {
  name: "VetPlatforma",
  shortName: "VetPlatforma",
  url: rawBase,
  locale: "sr_RS",
  description:
    "VetPlatforma je digitalna platforma za veterinarske klinike i vlasnike ljubimaca — online zakazivanje termina, kartoni ljubimaca, podsetnici i komunikacija sa klinikom na jednom mestu.",
  shortDescription:
    "Digitalno zakazivanje termina i upravljanje klinikom za veterinare i vlasnike ljubimaca.",
  keywords: [
    "veterinar",
    "veterinarska klinika",
    "zakazivanje kod veterinara",
    "online termin veterinar",
    "karton ljubimca",
    "vakcinacija pas",
    "vakcinacija mačka",
    "podsetnik vakcinacija",
    "VetPlatforma",
  ],
  // `logo.png` (1024×1024, in `public/`) is the brand mark used in JSON-LD.
  // OG/Twitter preview images are provided via Next.js file-based metadata
  // at `src/app/opengraph-image.png` and `src/app/twitter-image.png`.
  logo: "/logo.png",
  twitterHandle: "@vetplatforma",
} as const

export const siteUrl = siteConfig.url

export function absoluteUrl(path: string = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`
  return `${siteConfig.url}${normalized}`
}
