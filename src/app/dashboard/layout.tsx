"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard, Users, Scissors, LogOut,
  Stethoscope, Bell, Settings,
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
          className="px-5 py-5 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div
            className="icon-md shrink-0"
            style={{
              borderRadius: 10,
              background: "var(--sidebar-accent-glow)",
              color: "var(--brand)",
            }}
          >
            <Stethoscope size={18} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm tracking-tight leading-none" style={{ color: "var(--sidebar-text-active)", fontWeight: 700 }}>
              VetPlatforma
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--sidebar-text)", opacity: 0.6 }}>
              Upravljanje klinikom
            </p>
          </div>
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
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="icon-sm shrink-0"
            style={{
              borderRadius: 8,
              background: "var(--brand-tint)",
              color: "var(--brand)",
            }}
          >
            <Stethoscope size={15} strokeWidth={2} aria-hidden="true" />
          </div>
          <span className="text-sm tracking-tight" style={{ fontWeight: 700, color: "var(--text-primary)" }}>
            VetPlatforma
          </span>
        </div>

        <button
          onClick={handleSignOut}
          aria-label="Odjavi se"
          className="mobile-signout-btn flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all"
          style={{
            color: "var(--text-muted)",
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
          background:  "var(--surface)",
          borderTop:   "1px solid var(--border)",
          boxShadow:   "0 -2px 12px rgba(0,0,0,0.06)",
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
              className="mobile-nav-tab flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              style={{
                color: active ? "var(--brand)" : "var(--text-muted)",
                minHeight: 56,
              }}
            >
              <span
                className="flex items-center justify-center rounded-full transition-all"
                aria-hidden="true"
                style={{
                  background: active ? "var(--brand-tint)" : "transparent",
                  width:  active ? 48 : 28,
                  height: 28,
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span
                className="font-semibold leading-none"
                style={{ fontSize: 11 }}
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
