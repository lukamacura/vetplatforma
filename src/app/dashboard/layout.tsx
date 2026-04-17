"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, Scissors, LogOut,
  Bell, Settings,
} from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/dashboard",             label: "Pregled",      icon: LayoutDashboard },
  { href: "/dashboard/pacijenti",   label: "Pacijenti",    icon: Users           },
  { href: "/dashboard/podsetnici",  label: "Podsetnici",   icon: Bell            },
  { href: "/dashboard/usluge",      label: "Usluge",       icon: Scissors        },
  { href: "/dashboard/podesavanja", label: "Podešavanja",  icon: Settings        },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Sidebar (desktop only) — dark clinical spine ── */}
      <aside
        className="w-[232px] flex-col hidden md:flex shrink-0 fixed top-0 left-0 h-screen z-30"
        style={{
          background:  "var(--sidebar-bg)",
          borderRight: "1px solid var(--sidebar-border)",
        }}
      >
        <div
          className="px-4 py-4 flex flex-col items-center gap-2"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <Image
            src="/logo.png"
            alt="VetPlatforma"
            width={200}
            height={200}
            priority
            className="h-auto w-[160px] select-none"
          />
          <p className="text-xs" style={{ color: "var(--sidebar-text)", opacity: 0.65, fontWeight: 500 }}>
            Upravljanje klinikom
          </p>
        </div>

        <nav aria-label="Glavna navigacija" className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
              >
                <motion.div
                  whileHover={{ x: 3 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="sidebar-nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer select-none"
                  data-active={active}
                >
                  <Icon size={17} strokeWidth={active ? 2.25 : 1.75} style={{ flexShrink: 0 }} aria-hidden="true" />
                  {label}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        <div className="px-3 py-4" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <motion.button
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            onClick={handleSignOut}
            className="sidebar-nav-signout flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full text-left"
          >
            <LogOut size={17} strokeWidth={1.75} style={{ flexShrink: 0 }} aria-hidden="true" />
            Odjavi se
          </motion.button>
        </div>
      </aside>

      {/* ── Mobile header — brand + logout ── */}
      <header className="mobile-header fixed top-0 left-0 right-0 md:hidden z-[9999] flex items-center justify-between px-4"
        style={{
          height: 56,
          background: "var(--sidebar-bg)",
          borderBottom: "1px solid var(--sidebar-border)",
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
          style={{
            color: "var(--sidebar-text)",
            background: "transparent",
            minHeight: 44,
          }}
        >
          <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className="text-xs" style={{ fontWeight: 600 }}>Odjava</span>
        </button>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto content-gradient md:ml-[232px]">
        <div className="relative z-1 p-5 pt-[72px] md:pt-8 md:p-8 max-w-7xl mx-auto pb-28 md:pb-8">
          {children}
        </div>
      </main>

      {/* ── Bottom nav (mobile only) — all 5 destinations ── */}
      <nav
        aria-label="Glavna navigacija"
        className="mobile-bottom-nav fixed bottom-0 left-0 right-0 md:hidden flex z-[9999]"
        style={{
          background:  "var(--sidebar-bg)",
          borderTop:   "1px solid var(--sidebar-border)",
          boxShadow:   "0 -6px 24px rgba(0, 0, 0, 0.25)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="mobile-nav-tab relative flex-1 flex flex-col items-center justify-center gap-1 transition-colors"
              style={{
                color: active ? "var(--brand)" : "var(--sidebar-text)",
                minHeight: 60,
              }}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-b-full"
                  style={{
                    width: 28,
                    height: 3,
                    background: "var(--brand)",
                    boxShadow: "0 0 10px var(--brand-glow)",
                  }}
                />
              )}
              <span
                className="flex items-center justify-center rounded-full transition-all"
                aria-hidden="true"
                style={{
                  background: active ? "var(--brand-subtle)" : "transparent",
                  width:  active ? 48 : 28,
                  height: 28,
                  boxShadow: active
                    ? "inset 0 0 0 1px rgba(43, 181, 160, 0.35), 0 0 16px var(--brand-glow)"
                    : "none",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span
                className="leading-none"
                style={{
                  fontSize: 11,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: "0.01em",
                  opacity: active ? 1 : 0.85,
                }}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
