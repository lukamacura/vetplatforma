"use client"

import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Home, CalendarDays, PawPrint, Building2, LogOut, MessageSquare, UserCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const tabs = [
  { href: "/klijent",               label: "Početna",  icon: Home,          exact: true  },
  { href: "/klijent/zakazivanje",   label: "Zakaži",   icon: CalendarDays,  exact: false },
  { href: "/klijent/ljubimci",      label: "Ljubimci", icon: PawPrint,      exact: false },
  { href: "/klijent/poruke",        label: "Poruke",   icon: MessageSquare, exact: false },
  { href: "/klijent/klinike",       label: "Klinike",  icon: Building2,     exact: false },
  { href: "/klijent/podesavanja",   label: "Nalog",    icon: UserCircle,    exact: false },
]

const FULL_PAGE_ROUTES = ["/klijent/poruke"]

export function OwnerShell({
  children,
  fullPage: fullPageProp,
}: {
  children: React.ReactNode
  fullPage?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const fullPage = fullPageProp ?? FULL_PAGE_ROUTES.some(r => pathname.startsWith(r))

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const Header = (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
      style={{
        height: 56,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex items-center">
        <Image
          src="/logo.png"
          alt="VetPlatforma"
          width={160}
          height={160}
          priority
          className="h-10 w-auto select-none"
        />
      </div>

      <button
        onClick={handleSignOut}
        aria-label="Odjavi se"
        className="mobile-signout-btn flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all"
        style={{ color: "var(--text-muted)", background: "transparent", minHeight: 44 }}
      >
        <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
        <span className="text-xs" style={{ fontWeight: 600 }}>Odjava</span>
      </button>
    </header>
  )

  const BottomNav = (
    <nav
      aria-label="Navigacija"
      className="fixed bottom-0 left-0 right-0 flex z-50"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(href, exact)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="mobile-nav-tab flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
            style={{ color: active ? "var(--brand)" : "var(--text-muted)", minHeight: 56 }}
          >
            <span
              className="flex items-center justify-center rounded-full transition-all"
              aria-hidden="true"
              style={{
                background: active ? "var(--brand-tint)" : "transparent",
                width: active ? 48 : 28,
                height: 28,
              }}
            >
              <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
            </span>
            <span className="leading-none" style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )

  if (fullPage) {
    return (
      <div className="flex flex-col" style={{ height: "100dvh", overflow: "hidden", background: "var(--bg)" }}>
        {Header}
        <div className="shrink-0" style={{ height: 56, paddingTop: "env(safe-area-inset-top, 0px)" }} />
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {children}
        </main>
        <div className="shrink-0" style={{ height: 56, paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
        {BottomNav}
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {Header}
      <main className="content-gradient">
        <div className="relative z-1 max-w-lg mx-auto px-4 pt-18 pb-28">
          {children}
        </div>
      </main>
      {BottomNav}
    </div>
  )
}
