'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const LogoMark = () => (
  <svg viewBox="0 0 100 108" fill="none" className="h-6 w-6 shrink-0" aria-label="HyperDex">
    <rect x="5"  y="5" width="8" height="98" fill="#111118" />
    <rect x="17" y="5" width="8" height="98" fill="#111118" />
    <rect x="29" y="5" width="8" height="98" fill="#111118" />
    <rect x="63" y="5" width="8" height="98" fill="#111118" />
    <rect x="75" y="5" width="8" height="98" fill="#111118" />
    <rect x="87" y="5" width="8" height="98" fill="#111118" />
    <rect x="5" y="42" width="90" height="8" fill="#111118" />
    <rect x="5" y="54" width="90" height="8" fill="#111118" />
    <rect x="5" y="66" width="90" height="8" fill="#111118" />
  </svg>
);

export default function DocsNavbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /* Determine active tab */
  const isBuild = pathname.startsWith('/docs/rest-api') || pathname.startsWith('/docs/websocket') || pathname.startsWith('/docs/maker-setup');
  const isDocsActive = !isBuild;

  return (
    <nav className="docs-navbar sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/8">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 h-14 flex items-center gap-4">

        {/* Logo */}
        <Link href="/docs" className="flex items-center gap-2 shrink-0 mr-4">
          <LogoMark />
          <span className="font-display text-[14px] font-bold tracking-tight text-ink">HyperDex</span>
        </Link>

        {/* Separator */}
        <div className="hidden md:block w-px h-5 bg-black/10" />

        {/* Tab nav — Docs | Build */}
        <div className="hidden md:flex items-center gap-1 ml-1">
          <Link
            href="/docs"
            className={`docs-tab text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 ${
              isDocsActive
                ? 'text-ink bg-lavender/40'
                : 'text-ink-muted hover:text-ink hover:bg-black/4'
            }`}
          >
            Docs
          </Link>
          <Link
            href="/docs/rest-api"
            className={`docs-tab text-[13px] font-semibold px-3 py-1.5 rounded-lg transition-all duration-150 ${
              isBuild
                ? 'text-ink bg-lavender/40'
                : 'text-ink-muted hover:text-ink hover:bg-black/4'
            }`}
          >
            Build
          </Link>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search bar */}
        <button className="docs-search-trigger hidden md:flex items-center gap-2 bg-cream/80 hover:bg-cream border border-black/8 rounded-xl px-4 py-2 text-sm text-ink-muted transition-colors w-[220px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 opacity-40">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <span className="flex-1 text-left text-xs">Search docs...</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-white/80 border border-black/10 rounded px-1.5 py-0.5 text-ink-muted/60">⌘K</kbd>
        </button>

        {/* Launch App button */}
        <Link
          href="/swap"
          className="hidden md:inline-flex items-center gap-1.5 bg-ink text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-navy-light transition-colors"
        >
          Launch App
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-60">
            <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-ink p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle docs menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? (
              <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
            ) : (
              <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-black/5 px-6 py-4 space-y-3">
          <Link href="/docs" className="block text-sm font-semibold text-ink" onClick={() => setMobileMenuOpen(false)}>Docs</Link>
          <Link href="/docs/rest-api" className="block text-sm font-semibold text-ink-muted" onClick={() => setMobileMenuOpen(false)}>Build</Link>
          <Link href="/swap" className="block text-sm font-semibold text-lavender-deep" onClick={() => setMobileMenuOpen(false)}>Launch App</Link>
        </div>
      )}
    </nav>
  );
}
