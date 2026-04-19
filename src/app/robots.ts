import type { MetadataRoute } from "next"
import { siteConfig } from "@/lib/seo"

/**
 * Allow public marketing + auth pages, block everything behind login
 * and personalized join-invite URLs from being crawled/indexed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register"],
        disallow: ["/dashboard/", "/klijent/", "/join/", "/api/"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  }
}
