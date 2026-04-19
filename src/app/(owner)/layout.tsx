import type { Metadata } from "next"
import { OwnerShell } from "./owner-shell"

/**
 * Owner-facing authenticated area (/klijent/*). Explicitly `noindex`
 * so private pet/owner data never ends up in search results.
 */
export const metadata: Metadata = {
  title: {
    default: "Moj nalog",
    template: "%s · VetPlatforma",
  },
  description:
    "Upravljajte Vašim ljubimcima, terminima i povezanim klinikama.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <OwnerShell>{children}</OwnerShell>
}
