'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(12, 18, 34, 0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <Image
            src="/logo.png"
            alt="VetPlatforma"
            width={120}
            height={80}
            className="transition-transform duration-300 group-hover:scale-105 p-6"
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            ['Funkcije', '#funkcije'],
            ['Cene', '#cene'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium transition-colors duration-200"
              style={{ color: 'rgba(203,213,225,0.75)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(203,213,225,0.75)')}
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200"
            style={{ color: 'rgba(203,213,225,0.85)' }}
          >
            Prijavi se
          </Link>
          <a href="https://wa.me/381631012474" target="_blank" rel="noopener noreferrer" className="btn-primary text-sm px-5 py-2">
            Kontaktirajte nas
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg transition-all duration-200"
          style={{ color: 'rgba(203,213,225,0.85)' }}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden px-6 pb-6 flex flex-col gap-4"
          style={{
            background: 'rgba(12,18,34,0.98)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {[
            ['Funkcije', '#funkcije'],
            ['Cene', '#cene'],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium py-1"
              style={{ color: 'rgba(203,213,225,0.75)' }}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <Link
              href="/login"
              className="text-sm font-semibold py-2 text-center rounded-lg"
              style={{ color: 'rgba(203,213,225,0.85)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Prijavi se
            </Link>
            <a href="https://wa.me/381631012474" target="_blank" rel="noopener noreferrer" className="btn-primary text-sm justify-center">
              Počni besplatno
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
