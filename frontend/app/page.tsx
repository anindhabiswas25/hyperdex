'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import Navbar from '@/components/Navbar';

function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add('active');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

/* ── Coin SVG — metallic lavender disc ───────────────────────── */
function CoinSvg({ size = 220 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" fill="none">
      <defs>
        <radialGradient id="coinFace" cx="38%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#E8E4FF" />
          <stop offset="40%" stopColor="#C4BCEE" />
          <stop offset="100%" stopColor="#8A7ED4" />
        </radialGradient>
        <radialGradient id="coinEdge" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#A89FDE" />
          <stop offset="100%" stopColor="#5E4FB5" />
        </radialGradient>
        <ellipse id="ellipse" cx="110" cy="110" rx="95" ry="28" />
      </defs>
      {/* Edge/depth */}
      <ellipse cx="110" cy="124" rx="95" ry="28" fill="url(#coinEdge)" opacity="0.9" />
      {/* Face */}
      <ellipse cx="110" cy="106" rx="95" ry="95" fill="url(#coinFace)" />
      {/* Shine */}
      <ellipse cx="82" cy="74" rx="28" ry="18" fill="white" opacity="0.22" transform="rotate(-15 82 74)" />
      {/* H mark */}
      <text x="110" y="120" textAnchor="middle" fontFamily="Georgia, serif" fontSize="62" fontWeight="700" fill="rgba(90,70,180,0.35)" letterSpacing="-2">H</text>
      {/* Rim */}
      <ellipse cx="110" cy="106" rx="95" ry="95" fill="none" stroke="rgba(160,148,220,0.5)" strokeWidth="1.5" />
    </svg>
  );
}

/* ── Ticker data ─────────────────────────────────────────────── */
const tickerData = [
  { pair: 'EURC/USDC', price: '1.09',       change: '+0.4%',  pos: true  },
  { pair: 'USDC/EURC', price: '0.917',      change: '-0.4%',  pos: false },
  { pair: 'XLM/USDC',  price: '0.112',      change: '+2.1%',  pos: true  },
  { pair: 'BTC/USDC',  price: '64,230.50',  change: '+2.4%',  pos: true  },
  { pair: 'ETH/USDC',  price: '3,450.20',   change: '+1.8%',  pos: true  },
  { pair: 'SOL/USDC',  price: '145.80',     change: '-0.5%',  pos: false },
  { pair: 'ARB/USDC',  price: '1.15',       change: '+4.2%',  pos: true  },
];

/* ── Partner logos (text) ────────────────────────────────────── */
const partners = ['Stellar', 'Circle', 'Soroban', 'Freighter', 'CoinGecko'];

/* ── Main page ───────────────────────────────────────────────── */
export default function HomePage() {
  useReveal();

  return (
    <>
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="pt-24 pb-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div
            className="relative w-full rounded-3xl overflow-hidden"
            style={{ minHeight: '520px' }}
          >
            {/* Background image */}
            <img
              src="/hero-bg.avif"
              alt=""
              className="absolute inset-0 w-full h-full object-cover object-center"
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/40" />

            {/* Centered text */}
            <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 min-h-[520px]">
              <h1 className="font-serif text-5xl md:text-7xl font-bold text-white leading-tight mb-8">
                Trade Without<br />Limits
              </h1>

              <Link
                href="/swap"
                className="inline-block bg-white text-navy text-sm font-semibold px-8 py-3.5 rounded-full hover:bg-white/90 transition-colors mb-14"
              >
                Launch App
              </Link>
            </div>

            {/* Ticker — inside the hero card, fades in/out at edges */}
            <div className="absolute bottom-0 left-0 right-0 z-20 py-4 overflow-hidden"
              style={{
                background: 'rgba(0,0,0,0.35)',
                backdropFilter: 'blur(4px)',
                WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              }}
            >
              <div className="ticker-track">
                {[...tickerData, ...tickerData, ...tickerData].map((item, i) => (
                  <div key={i} className="inline-flex items-center gap-3 px-8 border-r border-white/15">
                    <span className="text-white text-sm font-semibold">{item.pair}</span>
                    <span className="text-white/50 text-sm">${item.price}</span>
                    <span className={`text-sm font-semibold ${item.pos ? 'text-green-400' : 'text-red-400'}`}>
                      {item.change}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT IS HYPERDEX ──────────────────────────────────── */}
      <section className="py-24 px-4 md:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          <div className="reveal">
            <h2 className="font-serif text-5xl md:text-6xl font-bold text-ink leading-tight mb-6">
              What is<br />HyperDex?
            </h2>
            <Link
              href="/swap"
              className="inline-block bg-ink text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-navy-light transition-colors"
            >
              Explore now
            </Link>
          </div>

          <div className="reveal delay-1 pt-2">
            <p className="text-ink text-xl md:text-2xl font-medium leading-snug">
              HyperDex is a Request-For-Quote exchange where professional market makers
              compete in sealed-bid auctions to deliver the best price — with zero slippage
              and instant Stellar settlement.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURE CARDS ─────────────────────────────────────── */}
      <section className="pb-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Card 1 — light lavender */}
          <div className="reveal relative rounded-2xl overflow-hidden p-7 flex flex-col justify-between min-h-[320px]"
            style={{ background: 'linear-gradient(145deg, #E2DCF8 0%, #D0CAEF 100%)' }}>
            <div>
              <h3 className="text-navy text-xl font-bold leading-snug mb-auto">Capital that<br />compounds</h3>
            </div>
            {/* Decorative coin */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50">
              <CoinSvg size={140} />
            </div>
            <p className="text-navy/60 text-sm leading-relaxed mt-auto relative z-10">
              Earn on every trade through our maker rewards programme. Provide liquidity
              and collect competitive spreads on each settled auction.
            </p>
          </div>

          {/* Card 2 — dark navy */}
          <div className="reveal delay-1 rounded-2xl bg-navy p-7 flex flex-col justify-between min-h-[320px]">
            <h3 className="text-white text-xl font-bold leading-snug">Always liquid,<br />always settled</h3>
            <p className="text-white/50 text-sm leading-relaxed mt-auto">
              Trades settle directly on Stellar — no pool imbalances, no lockups.
              Funds are yours the moment the ledger closes (~5s).
            </p>
          </div>

          {/* Card 3 — dark navy */}
          <div className="reveal delay-2 rounded-2xl bg-navy p-7 flex flex-col justify-between min-h-[320px]">
            <h3 className="text-white text-xl font-bold leading-snug">100%<br />non-custodial</h3>
            <p className="text-white/50 text-sm leading-relaxed mt-auto">
              Your keys never leave Freighter. Smart contracts enforce every trade
              atomically — no trust required, no withdrawal delays.
            </p>
          </div>
        </div>
      </section>

      {/* ── PARTNERS ──────────────────────────────────────────── */}
      <section className="py-14 px-4 md:px-8 border-t border-black/6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <p className="text-ink-muted text-sm leading-tight max-w-[160px] shrink-0">
            Built on proven<br />infrastructure.
          </p>
          <div className="flex flex-wrap items-center gap-8 md:gap-12">
            {partners.map(p => (
              <span key={p} className="text-ink-muted font-semibold text-sm tracking-wide hover:text-ink transition-colors cursor-default">
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASES ─────────────────────────────────────────── */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="reveal text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">
            HyperDex in Action
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left */}
            <div>
              <h2 className="reveal font-serif text-5xl md:text-6xl font-bold text-ink leading-tight mb-5">
                Use cases
              </h2>
              <p className="reveal delay-1 text-ink-muted text-base leading-relaxed max-w-sm">
                HyperDex serves traders, professional market makers, and institutions
                seeking deep on-chain liquidity with guaranteed execution.
              </p>
            </div>

            {/* Right — large dark card */}
            <div className="reveal delay-2 rounded-2xl bg-navy p-8 md:p-10 min-h-[340px] flex flex-col justify-between relative overflow-hidden">
              {/* Decorative coin behind */}
              <div className="absolute right-6 bottom-6 opacity-20">
                <CoinSvg size={200} />
              </div>

              <div className="relative z-10">
                <h3 className="text-white text-3xl font-bold mb-4">Market Makers</h3>
                <p className="text-white/55 text-sm leading-relaxed max-w-xs">
                  Integrate our Maker SDK to participate in sealed-bid RFQ auctions.
                  Earn spreads on every filled trade with full inventory control and
                  automated quote management.
                </p>
              </div>

              <Link
                href="/maker"
                className="relative z-10 inline-flex items-center gap-2 text-white/60 hover:text-white text-sm font-semibold transition-colors mt-8"
              >
                <span>→</span> Become a Maker
              </Link>
            </div>
          </div>

          {/* Second row of use-case cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Traders card */}
            <div className="reveal delay-1 rounded-2xl border border-black/8 bg-white p-8 min-h-[200px] flex flex-col justify-between">
              <h3 className="text-ink text-2xl font-bold">Traders</h3>
              <p className="text-ink-muted text-sm leading-relaxed mt-4">
                Get the best available price from competing market makers in a 30-second
                sealed-bid auction. Zero slippage, guaranteed execution.
              </p>
              <Link href="/swap" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink text-sm font-semibold transition-colors mt-6">
                <span>→</span> Start trading
              </Link>
            </div>

            {/* Institutions card */}
            <div className="reveal delay-2 rounded-2xl border border-black/8 bg-white p-8 min-h-[200px] flex flex-col justify-between">
              <h3 className="text-ink text-2xl font-bold">Institutions</h3>
              <p className="text-ink-muted text-sm leading-relaxed mt-4">
                Execute large block trades with certainty. Our RFQ protocol delivers
                institutional-grade fills with cryptographic settlement on Stellar.
              </p>
              <Link href="/swap" className="inline-flex items-center gap-2 text-ink-muted hover:text-ink text-sm font-semibold transition-colors mt-6">
                <span>→</span> Learn more
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────── */}
      <section className="py-20 px-4 md:px-8 bg-cream-dark border-y border-black/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="reveal">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted mb-3">Protocol</p>
            <h2 className="font-serif text-5xl font-bold text-ink leading-tight mb-5">
              How HyperDex<br />works
            </h2>
            <p className="text-ink-muted leading-relaxed max-w-sm">
              The efficiency of a centralised exchange with the self-custody and
              security of DeFi — three steps to optimal execution.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-5 top-6 bottom-6 w-px bg-black/8" />
            {[
              {
                n: '1',
                title: 'Connect Wallet',
                desc: 'Link your Freighter wallet. HyperDex reads your public key only — your private keys never leave your device.',
              },
              {
                n: '2',
                title: 'Start an Auction',
                desc: 'Enter amount and token pair. Market makers compete in a sealed 30-second bid round to give you the best rate.',
              },
              {
                n: '3',
                title: 'Execute Instantly',
                desc: 'Sign once in Freighter. The Soroban contract atomically settles at the guaranteed price — no slippage ever.',
              },
            ].map((step, i) => (
              <div key={step.n} className={`reveal delay-${i + 1} flex gap-6 mb-12 last:mb-0`}>
                <div className="w-10 h-10 shrink-0 bg-navy text-white text-sm font-bold rounded-full flex items-center justify-center relative z-10">
                  {step.n}
                </div>
                <div className="pt-1.5">
                  <h3 className="text-lg font-bold text-ink mb-1.5">{step.title}</h3>
                  <p className="text-ink-muted text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ────────────────────────────────────────── */}
      <section className="py-28 px-4 md:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="reveal font-serif text-5xl md:text-6xl font-bold text-ink mb-5 leading-tight">
            Ready to trade<br />on-chain?
          </h2>
          <p className="reveal delay-1 text-ink-muted text-lg mb-10">
            Join traders already using HyperDex on Stellar testnet.
          </p>
          <Link
            href="/swap"
            className="reveal delay-2 inline-block bg-navy text-white text-sm font-semibold px-10 py-4 rounded-full hover:bg-navy-light transition-colors"
          >
            Launch App
          </Link>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="bg-navy py-16 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <svg viewBox="0 0 100 108" fill="none" className="h-8 w-8 shrink-0 opacity-70">
                  <rect x="5"  y="5" width="8" height="98" fill="white" />
                  <rect x="17" y="5" width="8" height="98" fill="white" />
                  <rect x="29" y="5" width="8" height="98" fill="white" />
                  <rect x="63" y="5" width="8" height="98" fill="white" />
                  <rect x="75" y="5" width="8" height="98" fill="white" />
                  <rect x="87" y="5" width="8" height="98" fill="white" />
                  <rect x="5" y="42" width="90" height="8" fill="white" />
                  <rect x="5" y="54" width="90" height="8" fill="white" />
                  <rect x="5" y="66" width="90" height="8" fill="white" />
                </svg>
                <span className="text-white font-bold text-sm">HyperDex</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                Institutional-grade RFQ liquidity and zero-slippage execution
                for the decentralised web.
              </p>
            </div>

            {/* Links */}
            {[
              { title: 'Product',     links: ['Swap', 'Maker Dashboard', 'Admin', 'Fees'] },
              { title: 'Protocol',    links: ['Documentation', 'Smart Contracts', 'RFQ Spec', 'Bug Bounty'] },
              { title: 'Company',     links: ['About', 'Careers', 'Blog', 'Contact'] },
            ].map(col => (
              <div key={col.title}>
                <h4 className="text-white/80 text-xs font-bold uppercase tracking-wider mb-5">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map(link => (
                    <li key={link}>
                      <a href="#" className="text-white/40 text-sm hover:text-white/70 transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/8 gap-4">
            <p className="text-white/30 text-sm">&copy; 2025 HyperDex. All rights reserved.</p>
            <div className="flex gap-6">
              {['Twitter', 'Discord', 'GitHub'].map(s => (
                <a key={s} href="#" className="text-white/30 text-sm hover:text-white/60 transition-colors">{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
