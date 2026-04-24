"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, CalendarDays, PawPrint, Building2, MessageSquare } from "lucide-react"

const tabs = [
  { href: "/klijent",           label: "Početna",  icon: Home,          exact: true  },
  { href: "/klijent/zakazivanje", label: "Zakaži", icon: CalendarDays,  exact: false },
  { href: "/klijent/ljubimci",  label: "Ljubimci", icon: PawPrint,      exact: false },
  { href: "/klijent/poruke",    label: "Poruke",   icon: MessageSquare, exact: false },
  { href: "/klijent/klinike",   label: "Klinike",  icon: Building2,     exact: false },
]

export function OwnerBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors relative ${
              active ? "text-[var(--brand)]" : "text-muted-foreground hover:text-[var(--brand)]"
            }`}
          >
            <span
              className={`flex items-center justify-center rounded-full transition-colors ${
                active ? "bg-[var(--brand-tint)] px-3 py-1" : ""
              }`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={`text-xs font-medium ${active ? "text-[var(--brand)]" : ""}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
