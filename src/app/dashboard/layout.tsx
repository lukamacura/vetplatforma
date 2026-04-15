"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LayoutDashboard, Users, Scissors, LogOut, Stethoscope, Bell, Settings } from "lucide-react"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase/client"

const navItems = [
  { href: "/dashboard",             label: "Pregled dana", icon: LayoutDashboard },
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

  // Bottom nav shows first 4 tabs only (Podešavanja stays sidebar-only on mobile for space)
  const bottomNavItems = navItems.slice(0, 4)

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Sidebar (desktop only) ── */}
      <aside
        className="w-[232px] flex-col hidden md:flex shrink-0"
        style={{
          background:           "var(--surface-glass)",
          backdropFilter:       "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRight:          "1px solid var(--border)",
          boxShadow:            "1px 0 0 var(--border)",
        }}
      >
        {/* Logo */}
        <div
          className="px-5 py-5 flex items-center gap-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="icon-md icon-brand" style={{ borderRadius: 10 }}>
            <Stethoscope size={18} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-sm tracking-tight leading-none" style={{ color: "var(--text-primary)", fontWeight: 700 }}>
              VetPlatforma
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Upravljanje klinikom
            </p>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href))
            return (
              <Link key={href} href={href}>
                <motion.div
                  whileHover={{ x: 3 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium cursor-pointer select-none"
                  style={
                    active
                      ? {
                          background: "var(--brand-tint)",
                          color:      "var(--brand)",
                          boxShadow:  "inset 3px 0 0 var(--brand)",
                        }
                      : { color: "var(--text-secondary)" }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "var(--surface-raised)"
                      e.currentTarget.style.color      = "var(--text-primary)"
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent"
                      e.currentTarget.style.color      = "var(--text-secondary)"
                    }
                  }}
                >
                  <Icon size={17} strokeWidth={active ? 2.25 : 1.75} style={{ flexShrink: 0 }} />
                  {label}
                </motion.div>
              </Link>
            )
          })}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid var(--border)" }}>
          <motion.button
            whileHover={{ x: 3 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium w-full text-left"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--red-tint)"
              e.currentTarget.style.color      = "var(--red)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent"
              e.currentTarget.style.color      = "var(--text-muted)"
            }}
          >
            <LogOut size={17} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            Odjavi se
          </motion.button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto pb-24 md:pb-8">{children}</div>
      </main>

      {/* ── Bottom nav (mobile only) ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden flex"
        style={{
          background:  "var(--surface)",
          borderTop:   "1px solid var(--border)",
          boxShadow:   "0 -2px 12px rgba(0,0,0,0.06)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {bottomNavItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 transition-colors"
              style={{ color: active ? "var(--brand)" : "var(--text-muted)" }}
            >
              <span
                className="flex items-center justify-center rounded-full transition-colors"
                style={{
                  background: active ? "var(--brand-tint)" : "transparent",
                  padding:    active ? "4px 12px" : "4px",
                }}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className="text-xs font-medium" style={{ fontSize: 10 }}>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
