import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google"
import { absoluteUrl, siteConfig } from "@/lib/seo"
import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Digitalna platforma za veterinarske klinike`,
    template: `%s · ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  referrer: "origin-when-cross-origin",
  alternates: {
    canonical: "/",
  },
  // OG/Twitter images and icons are auto-wired from the file-based
  // metadata convention: `src/app/opengraph-image.png`,
  // `src/app/twitter-image.png`, `src/app/icon.png`, `src/app/apple-icon.png`,
  // and `src/app/favicon.ico` (legacy fallback).
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Digitalna platforma za veterinarske klinike`,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — Digitalna platforma za veterinarske klinike`,
    description: siteConfig.shortDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  category: "health",
  formatDetection: {
    telephone: true,
    email: true,
    address: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#2BB5A0",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

// Structured data — describes the business/product to search engines and AI.
// Rendered once in the root <body> so it applies site-wide.
// `<` escaped per Next.js JSON-LD guidance to mitigate XSS from dynamic strings.
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: siteConfig.name,
  url: siteConfig.url,
  logo: absoluteUrl(siteConfig.logo),
  description: siteConfig.description,
  sameAs: [] as string[],
}

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteConfig.name,
  url: siteConfig.url,
  inLanguage: "sr-RS",
  description: siteConfig.description,
  publisher: {
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
  },
}

const softwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteConfig.name,
  applicationCategory: "HealthApplication",
  operatingSystem: "Web",
  url: siteConfig.url,
  description: siteConfig.description,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "EUR",
    availability: "https://schema.org/InStock",
    description: "Besplatna probna verzija 30 dana",
  },
  inLanguage: "sr-RS",
}

function toJsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c")
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="sr" className={`${jakarta.variable} ${spaceGrotesk.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdString(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdString(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLdString(softwareJsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
