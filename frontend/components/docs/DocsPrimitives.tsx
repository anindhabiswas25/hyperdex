'use client';

import { useState } from 'react';

/* ── Code Block with Copy ─────────────────────────────────────── */
export function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative my-5 group">
      <pre className="docs-code-block">
        <code>{children.trim()}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(children.trim()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="absolute top-3.5 right-3.5 text-[11px] font-mono text-white/25 hover:text-white/60 transition-colors bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}

/* ── Callout ───────────────────────────────────────────────────── */
export function Callout({ type = 'info', title, children }: { type?: 'info'|'warn'|'tip'; title?: string; children: React.ReactNode }) {
  const map = {
    info: { bar: 'bg-lavender-deep', bg: 'bg-lavender/30 border-lavender-mid/50', icon: 'ℹ', label: 'Note' },
    warn: { bar: 'bg-amber-400',     bg: 'bg-amber-50 border-amber-200',          icon: '⚠', label: 'Warning' },
    tip:  { bar: 'bg-emerald-400',   bg: 'bg-emerald-50 border-emerald-200',      icon: '✓', label: 'Tip' },
  };
  const s = map[type];
  return (
    <div className={`docs-callout flex gap-0 border rounded-xl overflow-hidden my-5 ${s.bg}`}>
      <div className={`w-1.5 shrink-0 ${s.bar}`} />
      <div className="px-5 py-4 text-sm leading-relaxed text-ink">
        <span className="font-bold">{title ?? s.label}: </span>{children}
      </div>
    </div>
  );
}

/* ── Table ─────────────────────────────────────────────────────── */
export function Table({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto my-5 rounded-2xl border border-black/10">
      <table className="w-full text-sm min-w-[500px]">
        <thead>
          <tr className="bg-cream-dark border-b border-black/10">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 font-semibold text-ink text-[11px] uppercase tracking-widest">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/30'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-ink-muted text-[13px] align-top">
                  {typeof cell === 'string' && cell.length > 30
                    ? <span className="font-mono text-xs break-all">{cell}</span>
                    : <span className="font-mono text-xs">{cell}</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Inline Tags ───────────────────────────────────────────────── */
export function Tag({ children, color = 'lavender' }: { children: React.ReactNode; color?: string }) {
  const c: Record<string, string> = {
    lavender: 'bg-lavender/50 text-lavender-deep',
    green:    'bg-green-100 text-green-700',
    amber:    'bg-amber-100 text-amber-700',
    navy:     'bg-navy/10 text-navy',
  };
  return <span className={`inline-block text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full ${c[color] ?? c.lavender}`}>{children}</span>;
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[13px] bg-lavender/40 px-1.5 py-0.5 rounded-lg text-navy">{children}</code>;
}

/* ── Headings ──────────────────────────────────────────────────── */
export function H1({ tag, children }: { tag?: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 pt-2">
      {tag && <Tag>{tag}</Tag>}
      <h1 className="font-display text-[2.4rem] font-bold text-ink leading-tight mt-3">{children}</h1>
    </div>
  );
}

export function H2({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="docs-h2 font-display text-2xl font-bold text-ink mt-12 mb-3 scroll-mt-24">{children}</h2>;
}

export function H3({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h3 id={id} className="docs-h3 font-display text-lg font-bold text-ink mt-8 mb-2 scroll-mt-24">{children}</h3>;
}

/* ── Body Text ─────────────────────────────────────────────────── */
export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted text-[15px] leading-[1.75] mb-4">{children}</p>;
}

export function Li({ children }: { children: React.ReactNode }) {
  return <li className="text-ink-muted text-[15px] leading-[1.75] mb-1.5 flex gap-2"><span className="text-lavender-deep mt-1 shrink-0">→</span><span>{children}</span></li>;
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="my-4 space-y-0.5">{children}</ul>;
}

/* ── Cards ─────────────────────────────────────────────────────── */
export function StepCard({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-5 border border-black/10 rounded-2xl p-6 bg-white hover:-translate-y-0.5 transition-transform my-3">
      <span className="font-display font-bold text-2xl text-lavender-deep shrink-0 w-8">{n}</span>
      <div>
        <p className="font-display font-bold text-ink text-base mb-1.5">{title}</p>
        <p className="text-ink-muted text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

export function FeatureCard({ title, desc, icon }: { title: string; desc: string; icon?: string }) {
  return (
    <div className="docs-feature-card border border-black/10 rounded-2xl p-5 bg-white hover:-translate-y-1 transition-all duration-200">
      {icon && <span className="text-2xl mb-3 block">{icon}</span>}
      <p className="font-display font-bold text-ink text-sm mb-1.5">{title}</p>
      <p className="text-ink-muted text-xs leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Page Subtitle (Kimia-style description under h1) ──────────── */
export function PageDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-ink-muted text-lg leading-relaxed mb-8 -mt-2">{children}</p>;
}
