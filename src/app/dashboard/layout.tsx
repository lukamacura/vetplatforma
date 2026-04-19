import type { Metadata } from "next"
import { DashboardShell } from "./dashboard-shell"

/**
 * Vet-facing authenticated area. Explicitly `noindex` so sensitive
 * patient/clinic data never ends up in search results.
 */
export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · Dashboard · VetPlatforma",
  },
  description:
    "Upravljajte pacijentima, terminima i podsetnicima vaše veterinarske klinike.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
