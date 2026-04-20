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
        {/* Brand radial glow */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 80% 55% at 50% -5%, rgba(43,181,160,0.22) 0%, transparent 70%)',
          }}
        />
        {/* Subtle dot grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.10) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Eyebrow */}
          <div className="flex justify-center mb-8">
            <span className="badge badge-brand">
              <span className="pulse-dot" style={{ background: 'var(--brand)' }} />
              Novo · Veterinarska platforma
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6"
            style={{ color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.04em' }}
          >
            Ordinacija koja radi
            <br />
            <span style={{ color: 'var(--brand)' }}>dok vi radite.</span>
          </h1>

          {/* Subhead */}
          <p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: 'rgba(203,213,225,0.82)' }}
          >
            Zakazivanje, podsetnici i kartoni pacijenata — sve na jednom mestu.
            Bez papira, bez propuštenih termina.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
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

          <p className="mt-5 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
            30 dana besplatno · Bez kreditne kartice · Otkaži kad god
          </p>
        </div>

        {/* Hero mockup */}
        <div className="relative z-10 mt-20 w-full max-w-5xl mx-auto">
          <MockupFrame
            label="Rotato mockup — dashboard pregled"
            aspect="16/9"
            url="vetplatforma.com/dashboard"
          />
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
              Sve što vam treba, ništa što ne treba
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Dizajnirana uz veterinare, za veterinare. Nema nepotrebne složenosti.
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
            mockupLabel="Vet dashboard — dnevni pregled"
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
            mockupLabel="Owner mobile — zakazivanje"
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
            {/* Founding Partner — highlighted */}
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
                    <div className="icon-sm icon-brand flex-shrink-0">
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
                    <div className="icon-sm icon-muted flex-shrink-0">
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
                30 dana probno, bez kreditne kartice
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
            Spreman za moderniju ordinaciju?
          </h2>
          <p className="mb-8 text-lg" style={{ color: 'rgba(203,213,225,0.78)' }}>
            Kreiraj nalog za 2 minute i počni da zakazuješ online već danas.
          </p>
          <Link href="/register" className="btn-primary text-base px-10 py-3">
            Počni besplatno — 30 dana gratis
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

function MockupFrame({
  label,
  aspect,
  url,
}: {
  label: string
  aspect: string
  url: string
}) {
  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: aspect,
        border: '1px solid rgba(43,181,160,0.20)',
        background: 'rgba(255,255,255,0.02)',
        boxShadow:
          '0 40px 100px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04), 0 0 60px rgba(43,181,160,0.06)',
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
            {url}
          </span>
        </div>
      </div>
      {/* Placeholder content */}
      <div className="flex items-center justify-center h-full">
        <div className="text-center py-8">
          <div
            className="icon-lg icon-brand mx-auto mb-3"
            style={{ width: 52, height: 52, borderRadius: 14 }}
          >
            <FolderOpen size={22} />
          </div>
          <p
            className="text-xs font-medium"
            style={{ color: 'rgba(148,163,184,0.45)' }}
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  )
}

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
            <div className="icon-sm icon-brand flex-shrink-0 mt-0.5">
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
    icon: <Calendar size={22} />,
    iconClass: 'icon-brand',
    title: 'Zakazivanje bez telefona',
    desc: 'Vlasnici zakazuju termine online za nekoliko sekundi. Vi vidite sve u realnom vremenu.',
    tint: 'var(--brand-tint)',
  },
  {
    icon: <Bell size={22} />,
    iconClass: 'icon-amber',
    title: 'Automatski podsetnici',
    desc: 'Sistem šalje podsetnik 24h pre termina. Manje no-showova, više posla obavljenog.',
    tint: 'var(--amber-tint)',
  },
  {
    icon: <FolderOpen size={22} />,
    iconClass: 'icon-blue',
    title: 'Digitalni kartoni',
    desc: 'Sve istorije, napomene i dijagnoze na jednom mestu. Dostupno sa svakog uređaja.',
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
