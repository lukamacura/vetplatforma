import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/seo"

/**
 * Public sitemap. Authenticated routes (`/dashboard/*`, `/klijent/*`)
 * and per-clinic invites (`/join/*`) are intentionally excluded —
 * they are either private or personalized.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const base = siteConfig.url

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${base}/register`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ]
}
