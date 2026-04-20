import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingNav from '@/components/landing/LandingNav'
import Link from 'next/link'
import {
  Calendar,
  Bell,
  FolderOpen,
  Check,
  ArrowRight,
  Shield,
  Star,
} from 'lucide-react'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const role = profile?.role ?? (user.user_metadata?.role as string | undefined)
    redirect(role === 'vet' ? '/dashboard' : '/klijent')
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <LandingNav />

      {/* ─── HERO ─── */}
      <section
        className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-24 pb-28 overflow-hidden"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        {/* ── Background atmosphere — 3 layered glows ── */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {/* Primary brand glow — top center */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 55% at 50% -8%, rgba(43,181,160,0.30) 0%, transparent 65%)' }} />
          {/* Blue accent — top right */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 45% at 88% 12%, rgba(37,99,235,0.14) 0%, transparent 60%)' }} />
          {/* Amber warmth — bottom left */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 8% 90%, rgba(217,119,6,0.09) 0%, transparent 55%)' }} />
        </div>

        {/* ── Dot grid ── */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* ── Floating stat cards — xl only ── */}
        <div
          className="absolute left-6 top-1/3 z-10 hidden xl:flex flex-col gap-3"
          style={{ animation: 'float-y 4.5s ease-in-out infinite' }}
        >
          <div style={{
            padding: '12px 16px',
            borderRadius: 14,
            border: '1px solid rgba(217,119,6,0.28)',
            boxShadow: '0 0 24px rgba(217,119,6,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
            background: 'rgba(217,119,6,0.09)',
            backdropFilter: 'blur(14px)',
            textAlign: 'left',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(217,119,6,0.72)', marginBottom: 2 }}>Danas poslato</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#D97706', letterSpacing: '-0.04em', lineHeight: 1 }}>47</p>
            <p style={{ fontSize: 11, color: 'rgba(217,119,6,0.60)', marginTop: 2 }}>SMS podsetnika</p>
          </div>
          <div style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(37,99,235,0.22)',
            boxShadow: '0 0 20px rgba(37,99,235,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
            background: 'rgba(37,99,235,0.08)',
            backdropFilter: 'blur(14px)',
            textAlign: 'left',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(99,149,235,0.80)', marginBottom: 2 }}>Zakazivanje</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#4B8EF5', letterSpacing: '-0.04em', lineHeight: 1 }}>58<span style={{ fontSize: 12 }}>s</span></p>
            <p style={{ fontSize: 11, color: 'rgba(99,149,235,0.65)', marginTop: 2 }}>prosečno</p>
          </div>
        </div>

        <div
          className="absolute right-6 top-[38%] z-10 hidden xl:flex flex-col gap-3"
          style={{ animation: 'float-y 5.2s ease-in-out 1.1s infinite' }}
        >
          <div style={{
            padding: '12px 16px',
            borderRadius: 14,
            border: '1px solid rgba(22,163,74,0.26)',
            boxShadow: '0 0 24px rgba(22,163,74,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
            background: 'rgba(22,163,74,0.08)',
            backdropFilter: 'blur(14px)',
            textAlign: 'right',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(22,163,74,0.72)', marginBottom: 2 }}>Stopa dolaska</p>
            <p style={{ fontSize: 26, fontWeight: 700, color: '#16A34A', letterSpacing: '-0.04em', lineHeight: 1 }}>94%</p>
            <p style={{ fontSize: 11, color: 'rgba(22,163,74,0.60)', marginTop: 2 }}>pacijenata</p>
          </div>
          <div style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: '1px solid rgba(43,181,160,0.25)',
            boxShadow: '0 0 20px rgba(43,181,160,0.20), inset 0 1px 0 rgba(255,255,255,0.06)',
            background: 'rgba(43,181,160,0.08)',
            backdropFilter: 'blur(14px)',
            textAlign: 'right',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(43,181,160,0.75)', marginBottom: 2 }}>Vakcinacije</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand)', letterSpacing: '-0.04em', lineHeight: 1 }}>0</p>
            <p style={{ fontSize: 11, color: 'rgba(43,181,160,0.62)', marginTop: 2 }}>propuštenih</p>
          </div>
        </div>

        {/* ── Main content ── */}
        <div className="relative z-10 max-w-4xl mx-auto">

          {/* Glowing labels strip */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 hero-anim-1">
            <span className="hero-label" style={{
              color: 'var(--brand)',
              background: 'rgba(43,181,160,0.10)',
              '--glow': 'rgba(43,181,160,0.40)',
              '--glow-border': 'rgba(43,181,160,0.30)',
            } as CSSProperties}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand)', display: 'inline-block', flexShrink: 0 }} />
              SMS podsetnici automatski
            </span>

            <span className="hero-label" style={{
              color: '#D97706',
              background: 'rgba(217,119,6,0.10)',
              '--glow': 'rgba(217,119,6,0.42)',
              '--glow-border': 'rgba(217,119,6,0.28)',
              animationDelay: '0.7s',
            } as CSSProperties}>
              ⚡ Osnivački partner — samo 7 mesta
            </span>

            <span className="hero-label" style={{
              color: '#16A34A',
              background: 'rgba(22,163,74,0.10)',
              '--glow': 'rgba(22,163,74,0.38)',
              '--glow-border': 'rgba(22,163,74,0.25)',
              animationDelay: '1.4s',
            } as CSSProperties}>
              ✓ 30 dana besplatno · Bez kartice
            </span>

            <span className="hero-label" style={{
              color: '#2563EB',
              background: 'rgba(37,99,235,0.10)',
              '--glow': 'rgba(37,99,235,0.38)',
              '--glow-border': 'rgba(37,99,235,0.22)',
              animationDelay: '2.1s',
            } as CSSProperties}>
              📅 Zakazivanje za 60 sekundi
            </span>

            <span className="hero-label" style={{
              color: '#DC2626',
              background: 'rgba(220,38,38,0.09)',
              '--glow': 'rgba(220,38,38,0.38)',
              '--glow-border': 'rgba(220,38,38,0.22)',
              animationDelay: '2.8s',
            } as CSSProperties}>
              <span className="pulse-dot" style={{ background: '#DC2626' }} />
              12 klinika koristi danas
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 hero-anim-2"
            style={{ color: '#ffffff', lineHeight: 1.08, letterSpacing: '-0.04em' }}
          >
            Budite Veterinar,{' '}
            <br className="hidden sm:block" />
            NE{' '}
            <span style={{
              background: 'linear-gradient(130deg, #2BB5A0 0%, #62EDD8 45%, #2BB5A0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Administrator
            </span>
          </h1>

          {/* Subhead */}
          <p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed hero-anim-3"
            style={{ color: 'rgba(203,213,225,0.78)' }}
          >
            Studirali ste da lečite životinje, a ne da prepisujete podatke iz sveske u svesku. Ako vaš softver ne radi za vas — vi radite za njega.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center hero-anim-4">
            <Link href="/register" className="btn-primary text-base px-8 py-3">
              Počni besplatno
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-lg font-semibold text-base transition-all duration-300"
              style={{
                color: 'rgba(203,213,225,0.88)',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              Prijavi se
            </Link>
          </div>

          <p className="mt-5 text-sm hero-anim-4" style={{ color: 'rgba(148,163,184,0.50)' }}>
            30 dana besplatno · Bez kartice · Otkaži kad god
          </p>
        </div>

        {/* ── Hero mockup ── */}
        <div className="relative z-10 mt-20 w-full max-w-5xl mx-auto hero-anim-6">
          <div
            className="w-full rounded-2xl overflow-hidden"
            style={{
              border: '1px solid rgba(43,181,160,0.22)',
              background: 'rgba(255,255,255,0.02)',
              boxShadow:
                '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(43,181,160,0.08)',
            }}
          >
            {/* Browser chrome */}
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(220,38,38,0.45)' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(234,179,8,0.45)' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'rgba(43,181,160,0.45)' }} />
              <div
                className="h-4 rounded-md flex items-center justify-center px-3 ml-2"
                style={{ background: 'rgba(255,255,255,0.04)', minWidth: 180 }}
              >
                <span className="text-xs" style={{ color: 'rgba(148,163,184,0.45)', fontSize: 10 }}>
                  vetplatforma.com/dashboard
                </span>
              </div>
            </div>
            <video
              src="/video_hero.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full block"
            />
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF BAR ─── */}
      <section
        className="py-8 px-6"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-6 flex-wrap">
          <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
            Koriste veterinari iz
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {['Beograd', 'Novi Sad', 'Niš', 'Kragujevac'].map((city) => (
              <span key={city} className="badge badge-muted">
                📍 {city}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} size={13} fill="currentColor" style={{ color: 'var(--amber)' }} />
            ))}
            <span className="text-sm font-bold ml-2" style={{ color: 'var(--text-secondary)' }}>
              4.9
            </span>
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="funkcije" className="py-24 px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-brand mb-4 inline-flex">Zašto VetPlatforma</span>
            <h2 className="text-4xl font-bold mb-4">
              Manje propuštenih termina. Manje telefona. Više posla.
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Tri funkcije koje rešavaju probleme koje svaka veterinarska klinika ima svaki dan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feat) => (
              <div
                key={feat.title}
                className="glass-card-vibrant rounded-2xl p-7"
                style={{ background: feat.tint }}
              >
                <div className={`icon-lg ${feat.iconClass} mb-5`}>{feat.icon}</div>
                <h3 className="text-lg font-bold mb-2">{feat.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRODUCT SHOWCASE ─── */}
      <section className="py-24 px-6" style={{ background: 'var(--surface-raised)' }}>
        <div className="max-w-5xl mx-auto space-y-28">
          <ShowcaseRow
            eyebrow="Za veterinare"
            title="Pregled celog dana na jednom ekranu"
            bullets={[
              'Svi zakazani termini u preglednom kalendaru',
              'Status svakog pacijenta jednim pogledom',
              'Brzo dodavanje napomena tokom pregleda',
            ]}
            mockupLabel="Vet dashboard - dnevni pregled"
            mockupAspect="16/10"
            reversed={false}
          />
          <ShowcaseRow
            eyebrow="Za vlasnike ljubimaca"
            title="Zakazivanje za manje od 60 sekundi"
            bullets={[
              'Online zakazivanje bez čekanja na telefon',
              'Pregled svih prošlih i budućih termina',
              'Kartoni ljubimca uvek dostupni',
            ]}
            mockupLabel="Owner mobile - zakazivanje"
            mockupAspect="9/16"
            reversed={true}
          />
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="cene" className="py-24 px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-amber mb-4 inline-flex">
              <span className="pulse-dot" style={{ background: 'var(--amber)' }} />
              Samo 50 mesta
            </span>
            <h2 className="text-4xl font-bold mb-4">Jednostavne cene</h2>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Počnite besplatno. Nadogradite kad budete spremni.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Founding Partner - highlighted */}
            <div
              className="glass-card-vibrant rounded-2xl p-8 relative"
              style={{
                background: 'var(--brand-tint)',
                border: '2px solid rgba(43,181,160,0.35)',
              }}
            >
              <div className="absolute -top-3.5 left-6">
                <span className="badge badge-brand">⭐ Osnivački partner</span>
              </div>
              <div className="mt-2 mb-6">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold">€49</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    /mesec
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                  Zaključana cena zauvek
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                {FOUNDING_FEATURES.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium">
                    <div className="icon-sm icon-brand shrink-0">
                      <Check size={13} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="btn-primary w-full justify-center text-sm">
                Rezerviši mesto
                <ArrowRight size={15} />
              </Link>
            </div>

            {/* Standard */}
            <div className="solid-card rounded-2xl p-8">
              <div className="mb-6">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold">€79</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    /mesec
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Standardna cena
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                {STANDARD_FEATURES.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium">
                    <div className="icon-sm icon-muted shrink-0">
                      <Check size={13} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-[--surface-raised]"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
              >
                Počni besplatno
              </Link>
              <p className="text-xs text-center mt-3" style={{ color: 'var(--text-muted)' }}>
                30 dana probno, bez  kartice
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA STRIP ─── */}
      <section
        className="relative py-28 px-6 text-center overflow-hidden"
        style={{ background: 'var(--sidebar-bg)' }}
      >
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 90% at 50% 110%, rgba(43,181,160,0.15) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2
            className="text-4xl md:text-5xl font-bold mb-5"
            style={{ color: '#ffffff', letterSpacing: '-0.04em' }}
          >
            Koliko vakcinacija propuštate svaki mesec?
          </h2>
          <p className="mb-8 text-lg" style={{ color: 'rgba(203,213,225,0.78)' }}>
            VetPlatforma ih vraća automatski. Zakaži 20-minutni demo i vidite kako to izgleda u vašoj ordinaciji.
          </p>
          <Link href="/register" className="btn-primary text-base px-10 py-3">
            Zakaži demo - besplatno
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer
        className="py-12 px-6"
        style={{
          background: 'var(--sidebar-bg)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="icon-sm icon-brand">
                  <Shield size={14} />
                </div>
                <span className="font-bold" style={{ color: '#ffffff' }}>
                  VetPlatforma
                </span>
              </div>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
                Digitalna platforma za veterinarske klinike u Srbiji.
              </p>
            </div>

            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'rgba(148,163,184,0.45)' }}
              >
                Platforma
              </p>
              <ul className="space-y-2">
                {[
                  ['Prijava', '/login'],
                  ['Registracija', '/register'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="text-sm transition-colors duration-200 hover:text-white"
                      style={{ color: 'rgba(148,163,184,0.65)' }}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: 'rgba(148,163,184,0.45)' }}
              >
                Kontakt
              </p>
              <p className="text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>
                info@vetplatforma.rs
              </p>
            </div>
          </div>

          <div
            className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs"
            style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              color: 'rgba(148,163,184,0.4)',
            }}
          >
            <p>© 2026 VetPlatforma. Sva prava zadržana.</p>
            <p>Napravljeno za veterinare u Srbiji</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─────────────────────────────────────────
   Sub-components (server-only, no client JS)
───────────────────────────────────────── */


function ShowcaseRow({
  eyebrow,
  title,
  bullets,
  mockupLabel,
  mockupAspect,
  reversed,
}: {
  eyebrow: string
  title: string
  bullets: string[]
  mockupLabel: string
  mockupAspect: string
  reversed: boolean
}) {
  const textCol = (
    <div className="flex flex-col justify-center">
      <span className="badge badge-brand mb-4 self-start">{eyebrow}</span>
      <h3 className="text-3xl font-bold mb-5" style={{ letterSpacing: '-0.03em' }}>
        {title}
      </h3>
      <ul className="space-y-3">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="icon-sm icon-brand shrink-0 mt-0.5">
              <Check size={13} />
            </div>
            {b}
          </li>
        ))}
      </ul>
    </div>
  )

  const mockupCol = (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl"
      style={{
        aspectRatio: mockupAspect,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.10)',
      }}
    >
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="icon-lg icon-muted mx-auto mb-2">
            <FolderOpen size={20} />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {mockupLabel}
          </p>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-12 items-center ${
        reversed ? 'md:[&>*:first-child]:order-2' : ''
      }`}
    >
      {reversed ? (
        <>
          {mockupCol}
          {textCol}
        </>
      ) : (
        <>
          {textCol}
          {mockupCol}
        </>
      )}
    </div>
  )
}

/* ─── Static data ─── */

const FEATURES = [
  {
    icon: <Bell size={22} />,
    iconClass: 'icon-amber',
    title: 'Vakcinacije koje se ne zaboravljaju',
    desc: 'SMS podsetnik ide vlasniku automatski kad dođe vreme za vakcinu ili kontrolu. Bez vašeg poziva - bez propuštenog termina.',
    tint: 'var(--amber-tint)',
  },
  {
    icon: <Calendar size={22} />,
    iconClass: 'icon-brand',
    title: 'Zakazivanje jednim klikom',
    desc: 'Iz SMS podsetnika vlasnik zakazuje termin direktno - bez čekanja na telefon, bez ping-ponga poruka.',
    tint: 'var(--brand-tint)',
  },
  {
    icon: <FolderOpen size={22} />,
    iconClass: 'icon-blue',
    title: 'Karton koji štiti kliniku',
    desc: 'Vi kontrolišete šta vlasnik vidi. Terapijska istorija ostaje samo kod vas - nema samolečenja.',
    tint: 'var(--blue-tint)',
  },
]

const FOUNDING_FEATURES = [
  'Neograničeni termini',
  'Neograničeni pacijenti',
  'Automatski podsetnici',
  'Digitalni kartoni',
  'Prioritetna podrška',
  'Sve buduće funkcije',
]

const STANDARD_FEATURES = [
  'Neograničeni termini',
  'Neograničeni pacijenti',
  'Automatski podsetnici',
  'Digitalni kartoni',
  'Email podrška',
]
