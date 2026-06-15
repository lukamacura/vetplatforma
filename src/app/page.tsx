import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LandingNav from '@/components/landing/landing-nav'
import Link from 'next/link'
import {
  Calendar,
  Bell,
  FolderOpen,
  ShoppingBag,
  MessageCircle,
  Tag,
  Users,
  Check,
  ArrowRight,
  Shield,
  Clock,
  TrendingUp,
  Heart,
  Globe,
  Phone,
  Mail,
} from 'lucide-react'

const WHATSAPP = 'https://wa.me/381637871117'
const PHONE_DISPLAY = '063 787 1117'
const EMAIL = 'vetplatforma26@gmail.com'

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
        className="relative flex flex-col items-center justify-center text-center px-6 pt-32 pb-24 overflow-hidden"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        {/* ── Background atmosphere — layered glows ── */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 85% 55% at 50% -8%, rgba(43,181,160,0.30) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 45% at 88% 12%, rgba(37,99,235,0.14) 0%, transparent 60%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 50% 40% at 8% 90%, rgba(217,119,6,0.09) 0%, transparent 55%)' }} />
        </div>

        {/* ── Dot grid ── */}
        <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

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
              Svaki vlasnik dobija svoj nalog
            </span>

            <span className="hero-label" style={{
              color: '#16A34A',
              background: 'rgba(22,163,74,0.10)',
              '--glow': 'rgba(22,163,74,0.38)',
              '--glow-border': 'rgba(22,163,74,0.25)',
              animationDelay: '0.7s',
            } as CSSProperties}>
              ✓ 30 dana besplatno · Bez ugovorne obaveze
            </span>

            <span className="hero-label" style={{
              color: '#2563EB',
              background: 'rgba(37,99,235,0.10)',
              '--glow': 'rgba(37,99,235,0.38)',
              '--glow-border': 'rgba(37,99,235,0.22)',
              animationDelay: '1.4s',
            } as CSSProperties}>
              📅 Zakazivanja, kartoni i podsetnici
            </span>

            <span className="hero-label" style={{
              color: '#D97706',
              background: 'rgba(217,119,6,0.10)',
              '--glow': 'rgba(217,119,6,0.42)',
              '--glow-border': 'rgba(217,119,6,0.28)',
              animationDelay: '2.1s',
            } as CSSProperties}>
              🛒 Integrisan webshop
            </span>
          </div>

          {/* Headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl font-bold mb-6 hero-anim-2"
            style={{ color: '#ffffff', lineHeight: 1.08, letterSpacing: '-0.04em' }}
          >
            Budite Veterinar,{' '}
            <br className="hidden sm:block" />
            <span style={{
              background: 'linear-gradient(130deg, #b52b34 0%, #ed62b1 45%, #a00000 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>NE</span>
            {' '}
            <span style={{
              background: 'linear-gradient(130deg, #2BB5A0 0%, #71c6b9 45%, #2BB5A0 100%)',
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
            Studirali ste da lečite životinje, a ne da prepisujete podatke iz sveske u svesku. VetPlatforma vodi zakazivanja, kartone, podsetnike, poruke i webshop — vi se bavite ljubimcima.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center hero-anim-4">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-base px-8 py-3"
            >
              Kontaktirajte nas
              <ArrowRight size={16} />
            </a>
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
            30 dana besplatno · Bez ugovorne obaveze · Bez rizika
          </p>
        </div>

        {/* ── Module bento — what the platform does ── */}
        <div className="relative z-10 mt-20 w-full max-w-4xl mx-auto hero-anim-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {MODULES.map((m) => (
              <div
                key={m.title}
                className="rounded-2xl p-5 text-left flex flex-col gap-3"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${m.border}`,
                  boxShadow: `0 0 28px ${m.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
                  backdropFilter: 'blur(14px)',
                }}
              >
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{ width: 38, height: 38, background: m.iconBg, color: m.color }}
                >
                  {m.icon}
                </div>
                <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>{m.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── OUTCOMES STRIP ─── */}
      <section
        className="py-8 px-6"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {OUTCOMES.map((o) => (
            <div key={o.title} className="flex items-center gap-3 justify-center sm:justify-start">
              <div className={`icon-md ${o.iconClass} shrink-0`}>{o.icon}</div>
              <div>
                <p className="text-sm font-bold">{o.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="funkcije" className="py-24 px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-brand mb-4 inline-flex">Sve na jednom mestu</span>
            <h2 className="text-4xl font-bold mb-4">
              Jedan sistem umesto svesaka, Vibera i Excela
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Nema više „jao kad je ono bilo“ i „šta li je operisao“. Sve je zapisano, pregledno i uvek pri ruci.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* ─── DIFFERENTIATOR: OWNER ACCOUNT ─── */}
      <section className="py-24 px-6" style={{ background: 'var(--surface-raised)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="badge badge-brand mb-4 inline-flex">Po čemu se razlikujemo</span>
            <h2 className="text-4xl font-bold mb-5" style={{ letterSpacing: '-0.03em' }}>
              Svaki vlasnik dobija svoj nalog
            </h2>
            <p className="text-base mb-5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Ovo je ono što vas izdvaja. Postajete jedina digitalizovana klinika u kojoj svaki vlasnik
              ima detaljan uvid u svog ljubimca — direktno, na svom telefonu. To gradi poverenje i čini
              vas ozbiljnijim i verodostojnijim od konkurencije.
            </p>
            <div
              className="flex items-start gap-3 rounded-xl p-4"
              style={{ background: 'var(--brand-tint)', border: '1px solid rgba(43,181,160,0.25)' }}
            >
              <div className="icon-md icon-brand shrink-0"><Globe size={16} /></div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Bonus: vaš profil je vidljiv na <strong>VetPlatforma mreži</strong> — kao da imate sajt
                sa reklamom, bez izrade sajta.
              </p>
            </div>
          </div>

          {/* Owner-account benefit card (not a screenshot) */}
          <div
            className="glass-card-vibrant rounded-2xl p-7"
            style={{ background: 'var(--brand-tint)', border: '1px solid rgba(43,181,160,0.25)' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="icon-lg icon-brand"><Users size={20} /></div>
              <div>
                <p className="text-sm font-bold">Nalog vlasnika</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Šta vaš klijent vidi
                </p>
              </div>
            </div>
            <ul className="space-y-3">
              {OWNER_SEES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-medium">
                  <div className="icon-sm icon-brand shrink-0 mt-0.5">
                    <Check size={13} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs mt-5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Vi i dalje kontrolišete šta je vidljivo — terapijska istorija ostaje kod vas, bez samolečenja.
            </p>
          </div>
        </div>
      </section>

      {/* ─── PROCES ─── */}
      <section id="proces" className="py-24 px-6" style={{ background: 'var(--bg)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-blue mb-4 inline-flex">Kako počinjete</span>
            <h2 className="text-4xl font-bold mb-4">Od prvog poziva do digitalne klinike</h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Mi radimo podešavanje. Vi samo koristite platformu i pustite klijente da se povežu.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PROCESS.map((step, i) => (
              <div key={step.title} className="solid-card rounded-2xl p-7 relative">
                <span
                  className="text-5xl font-bold absolute top-5 right-6"
                  style={{ color: 'var(--brand-tint)', lineHeight: 1 }}
                >
                  {i + 1}
                </span>
                <h3 className="text-base font-bold mb-2 relative z-10 pr-8">{step.title}</h3>
                <p className="text-sm leading-relaxed relative z-10" style={{ color: 'var(--text-secondary)' }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              Pratite rezultate prvih 30 dana. Ako ne osetite olakšanje — niste dužni ništa.
            </p>
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section id="cene" className="py-24 px-6" style={{ background: 'var(--surface-raised)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <span className="badge badge-green mb-4 inline-flex">
              <Check size={13} />
              30 dana besplatno · Bez ugovorne obaveze
            </span>
            <h2 className="text-4xl font-bold mb-4">Dva paketa, jedna odluka</h2>
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Oba paketa testirate 30 dana besplatno. Odlučujete sami da li vam se isplati.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Paket 1 — Standard */}
            <div className="solid-card rounded-2xl p-8">
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>
                Paket 1
              </p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold">€60</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    /mesec
                  </span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Osnovni sistem za vašu kliniku
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                {PAKET_1.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-medium">
                    <div className="icon-sm icon-muted shrink-0 mt-0.5">
                      <Check size={13} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-6 rounded-lg font-semibold text-sm transition-all duration-300 hover:bg-[--surface-raised]"
                style={{ border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
              >
                Kontaktirajte nas
              </a>
            </div>

            {/* Paket 2 — highlighted */}
            <div
              className="glass-card-vibrant rounded-2xl p-8 relative"
              style={{
                background: 'var(--brand-tint)',
                border: '2px solid rgba(43,181,160,0.35)',
              }}
            >
              <div className="absolute -top-3.5 left-6">
                <span className="badge badge-brand">⭐ Najkompletnije</span>
              </div>
              <p className="text-sm font-semibold mb-4 mt-2" style={{ color: 'var(--brand)' }}>
                Paket 2
              </p>
              <div className="mb-6">
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-5xl font-bold">€100</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    /mesec
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--brand)' }}>
                  Sve + integrisan webshop
                </p>
              </div>
              <ul className="space-y-3 mb-8">
                {PAKET_2.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-medium">
                    <div className="icon-sm icon-brand shrink-0 mt-0.5">
                      <Check size={13} />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full justify-center text-sm"
              >
                Kontaktirajte nas
                <ArrowRight size={15} />
              </a>
            </div>
          </div>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
            Oba paketa uključuju besplatno podešavanje naloga, dizajn flajere sa QR kodovima, edukativni sadržaj i vodič kroz platformu.
          </p>
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
            VetPlatforma ih vraća automatski. Pozovite nas i dogovorite kratku demonstraciju uživo — pokazujemo kako sistem izgleda u vašoj ordinaciji.
          </p>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary text-base px-10 py-3"
          >
            Kontaktirajte nas
            <ArrowRight size={16} />
          </a>
          <p className="mt-5 text-sm" style={{ color: 'rgba(148,163,184,0.55)' }}>
            <a href="tel:+381637871117" className="hover:text-white transition-colors duration-200">
              {PHONE_DISPLAY}
            </a>
          </p>
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
                  ['Funkcije', '#funkcije'],
                  ['Kako počinjete', '#proces'],
                  ['Cene', '#cene'],
                  ['Prijava', '/login'],
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
              <ul className="space-y-2.5">
                <li>
                  <a
                    href={WHATSAPP}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm transition-colors duration-200 hover:text-white"
                    style={{ color: 'rgba(148,163,184,0.65)' }}
                  >
                    <Phone size={14} />
                    {PHONE_DISPLAY}
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${EMAIL}`}
                    className="flex items-center gap-2 text-sm transition-colors duration-200 hover:text-white"
                    style={{ color: 'rgba(148,163,184,0.65)' }}
                  >
                    <Mail size={14} />
                    {EMAIL}
                  </a>
                </li>
              </ul>
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
   Static data
───────────────────────────────────────── */

const MODULES = [
  { icon: <Calendar size={19} />, title: 'Online zakazivanje', color: '#2BB5A0', iconBg: 'rgba(43,181,160,0.14)', border: 'rgba(43,181,160,0.28)', glow: 'rgba(43,181,160,0.16)' },
  { icon: <Bell size={19} />, title: 'Podsetnici', color: '#D97706', iconBg: 'rgba(217,119,6,0.14)', border: 'rgba(217,119,6,0.28)', glow: 'rgba(217,119,6,0.16)' },
  { icon: <FolderOpen size={19} />, title: 'Kartoni i istorija', color: '#4B8EF5', iconBg: 'rgba(37,99,235,0.14)', border: 'rgba(37,99,235,0.26)', glow: 'rgba(37,99,235,0.16)' },
  { icon: <MessageCircle size={19} />, title: 'Poruke sa klijentima', color: '#22C55E', iconBg: 'rgba(22,163,74,0.14)', border: 'rgba(22,163,74,0.26)', glow: 'rgba(22,163,74,0.16)' },
  { icon: <Users size={19} />, title: 'Nalog za vlasnike', color: '#EAB308', iconBg: 'rgba(234,179,8,0.14)', border: 'rgba(234,179,8,0.26)', glow: 'rgba(234,179,8,0.16)' },
  { icon: <ShoppingBag size={19} />, title: 'Integrisan webshop', color: '#EA580C', iconBg: 'rgba(234,88,12,0.14)', border: 'rgba(234,88,12,0.26)', glow: 'rgba(234,88,12,0.16)' },
]

const OUTCOMES = [
  {
    icon: <Clock size={18} />,
    iconClass: 'icon-brand',
    title: 'Ušteda vremena',
    desc: 'Manje telefona i papira',
  },
  {
    icon: <TrendingUp size={18} />,
    iconClass: 'icon-green',
    title: 'Veća zarada',
    desc: 'Webshop prodaje 24/7',
  },
  {
    icon: <Heart size={18} />,
    iconClass: 'icon-red',
    title: 'Zadovoljniji klijenti',
    desc: 'Direktna povezanost',
  },
]

const FEATURES = [
  {
    icon: <Calendar size={22} />,
    iconClass: 'icon-brand',
    title: 'Zakazivanje bez telefona',
    desc: 'Vlasnici zakazuju online, a vi sve vidite u preglednom rasporedu po danima i nedeljama.',
    tint: 'var(--brand-tint)',
  },
  {
    icon: <Bell size={22} />,
    iconClass: 'icon-amber',
    title: 'Podsetnici za vakcine i kontrole',
    desc: 'Kad dođe vreme, podsetnik se pojavi u nalogu vlasnika — automatski, bez vašeg poziva.',
    tint: 'var(--amber-tint)',
  },
  {
    icon: <FolderOpen size={22} />,
    iconClass: 'icon-blue',
    title: 'Digitalni kartoni i istorija',
    desc: 'Svaka poseta, vakcina i terapija zapisana je na jednom mestu. Pasoš, beleške, sve pri ruci.',
    tint: 'var(--blue-tint)',
  },
  {
    icon: <MessageCircle size={22} />,
    iconClass: 'icon-green',
    title: 'Poruke umesto Vibera',
    desc: 'Komunikacija sa klijentima na jednom mestu — uključujući glasovne poruke. Bez razbacanih kanala.',
    tint: 'var(--green-tint)',
  },
  {
    icon: <Tag size={22} />,
    iconClass: 'icon-yellow',
    title: 'Usluge sa cenama i trajanjem',
    desc: 'Sve vaše usluge, cene, opisi i logo — uredno postavljeni i jasni klijentima pri zakazivanju.',
    tint: 'var(--yellow-tint)',
  },
  {
    icon: <ShoppingBag size={22} />,
    iconClass: 'icon-orange',
    title: 'Integrisan webshop',
    desc: 'Prodajte lekove, hranu i terapije online. Dodatni prihod bez dodatnog rada (Paket 2).',
    tint: 'var(--orange-tint)',
  },
]

const OWNER_SEES = [
  'Sve termine — prošle i buduće',
  'Podsetnike za vakcine i kontrole',
  'Karton ljubimca i istoriju poseta',
  'Napomenu za veterinara',
  'Direktnu poruku sa vašom klinikom',
]

const PROCESS = [
  {
    title: 'Demonstracija uživo',
    desc: 'Dolazimo kod vas, pokazujemo sistem i analiziramo vaše trenutne procese.',
  },
  {
    title: 'Podešavanje naloga',
    desc: 'Kreiramo nalog i unosimo sve usluge sa cenama, trajanjem, opisom i logom.',
  },
  {
    title: 'Postajete vidljivi',
    desc: 'Vaš profil ide na VetPlatforma mrežu — kao da imate sajt sa reklamom.',
  },
  {
    title: '30 dana bez rizika',
    desc: 'Testirate sve besplatno. Ako se ne isplati, ne plaćate ništa.',
  },
]

const PAKET_1 = [
  'Zakazivanja, beleške i profili ljubimaca',
  'Nalog za svakog vlasnika',
  'Podsetnici za termine i vakcinacije',
  'Poruke sa klijentima',
  'Profil na VetPlatforma mreži',
  'Standardna tehnička podrška',
  '30 dana besplatno, bez ugovorne obaveze',
]

const PAKET_2 = [
  'Sve iz Paketa 1',
  'Integrisan webshop (lekovi, hrana, terapije)',
  'Istaknut profil na VetPlatforma mreži',
  '24/7 hitna podrška',
  '30 dana besplatno, bez ugovorne obaveze',
]
