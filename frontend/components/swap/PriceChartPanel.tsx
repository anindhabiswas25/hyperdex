'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type Pt = { t: number; p: number };
type Period = 'LIVE' | '1D' | '1W' | '1M' | '1Y' | 'All';
const PERIODS: Period[] = ['LIVE', '1D', '1W', '1M', '1Y', 'All'];

const PERIOD_CFG: Record<Period, { count: number; vol: number; step: number }> = {
  LIVE: { count: 120, vol: 0.00025, step: 2_000   },
  '1D': { count: 288, vol: 0.00045, step: 300_000  },
  '1W': { count: 168, vol: 0.00090, step: 3_600_000},
  '1M': { count: 180, vol: 0.00180, step: 14_400_000},
  '1Y': { count: 365, vol: 0.00280, step: 86_400_000},
  All:  { count: 500, vol: 0.00380, step: 172_800_000},
};

function gen(base: number, count: number, vol: number, step: number): Pt[] {
  const now = Date.now();
  let p = base + (Math.random() - 0.5) * 0.003;
  const pts: Pt[] = [];
  for (let i = count - 1; i >= 0; i--) {
    p += (Math.random() - 0.5) * vol;
    p = Math.max(base * 0.96, Math.min(base * 1.04, p));
    pts.push({ t: now - i * step, p: +p.toFixed(5) });
  }
  return pts;
}

function fmt(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  return '$' + n.toFixed(2);
}

export default function PriceChartPanel() {
  const [period, setPeriod] = useState<Period>('LIVE');
  const [basePrice, setBasePrice] = useState(0.8934);
  const [data, setData] = useState<Pt[]>(() => gen(0.8934, 120, 0.00025, 2_000));
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [stats, setStats] = useState({ vol24h: 142_500_000, mcap: 45_800_000_000, supply: '45.8B USDC' });
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch real EURC/USD from CoinGecko, derive USDC/EURC rate
  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=euro-coin&vs_currencies=usd&include_24hr_vol=true&include_market_cap=true')
      .then(r => r.json())
      .then(d => {
        const eurcUsd: number = d['euro-coin']?.usd ?? 1.12;
        const base = +(1 / eurcUsd).toFixed(5);
        setBasePrice(base);
        setStats({
          vol24h: d['euro-coin']?.usd_24h_vol ?? 142_500_000,
          mcap:   d['euro-coin']?.usd_market_cap ?? 712_000_000,
          supply: '45.8B USDC',
        });
        const { count, vol, step } = PERIOD_CFG['LIVE'];
        setData(gen(base, count, vol, step));
      })
      .catch(() => {});
  }, []);

  // Reset on period change
  useEffect(() => {
    const { count, vol, step } = PERIOD_CFG[period];
    setData(gen(basePrice, count, vol, step));
    setHoverIdx(null);
  }, [period, basePrice]);

  // Live tick
  useEffect(() => {
    if (period !== 'LIVE') return;
    const id = setInterval(() => {
      setData(prev => {
        const last = prev[prev.length - 1].p;
        const next = Math.max(
          basePrice * 0.96,
          Math.min(basePrice * 1.04, last + (Math.random() - 0.5) * 0.00025)
        );
        return [...prev.slice(-239), { t: Date.now(), p: +next.toFixed(5) }];
      });
    }, 1000);
    return () => clearInterval(id);
  }, [period, basePrice]);

  // ── SVG Chart ────────────────────────────────────────────────────
  const W = 1000, H = 300;
  const PT = 20, PB = 28;
  const chartH = H - PT - PB;

  const prices = data.map(d => d.p);
  const mn = Math.min(...prices);
  const mx = Math.max(...prices);
  const rng = mx - mn || 0.0001;

  const sx = (i: number) => (i / Math.max(1, data.length - 1)) * W;
  const sy = (p: number) => PT + (1 - (p - mn) / rng) * chartH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${sx(i).toFixed(1)} ${sy(d.p).toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L ${W} ${H} L 0 ${H} Z`;

  // Hover
  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverIdx(Math.round(frac * (data.length - 1)));
    },
    [data.length]
  );

  const hp = hoverIdx !== null ? data[hoverIdx] : null;
  const hx = hoverIdx !== null ? sx(hoverIdx) : null;
  const hy = hp ? sy(hp.p) : null;
  const htLabel = hp
    ? new Date(hp.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const curr = data[data.length - 1]?.p ?? basePrice;
  const open = data[0]?.p ?? basePrice;
  const pctChange = ((curr - open) / open) * 100;
  const isUp = pctChange >= 0;
  const LINE = isUp ? '#16a34a' : '#dc2626';
  const displayPrice = hp?.p ?? curr;

  const low  = Math.min(...prices);
  const high = Math.max(...prices);
  const lowPct  = ((low  - open) / open) * 100;
  const highPct = ((high - open) / open) * 100;

  const tooltipX = hx !== null ? Math.min(W - 84, Math.max(4, hx - 42)) : 0;

  return (
    <div>
      {/* ── Price header ──────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center -space-x-2">
            <img src="/logo-usdc.png" alt="USDC" className="h-7 w-7 rounded-full object-contain ring-2 ring-cream" />
            <img src="/logo-eurc.png" alt="EURC" className="h-7 w-7 rounded-full object-contain ring-2 ring-cream" />
          </div>
          <span className="font-display text-sm font-semibold text-ink">USDC / EURC</span>
          <span className="text-[11px] font-semibold text-ink-muted bg-black/6 px-2.5 py-0.5 rounded-full border border-black/8">
            Stellar Testnet
          </span>
        </div>

        <div className="font-display text-6xl font-bold text-ink tabular-nums leading-none">
          {displayPrice.toFixed(4)}
        </div>

        <div className={`flex items-center gap-2 mt-2 text-sm font-semibold ${isUp ? 'text-green-600' : 'text-red-500'}`}>
          <span>{isUp ? '↑' : '↓'}{Math.abs(pctChange).toFixed(2)}%</span>
          <span className="text-ink-muted font-normal text-xs">vs. period open</span>
        </div>
      </div>

      {/* ── SVG Chart ──────────────────────────────────────────────── */}
      <div
        className="relative w-full select-none rounded-xl overflow-hidden"
        style={{ paddingBottom: '30%' }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          onMouseMove={onMove}
          onMouseLeave={() => setHoverIdx(null)}
          style={{ cursor: 'crosshair' }}
        >
          <defs>
            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={LINE} stopOpacity="0.14" />
              <stop offset="100%" stopColor={LINE} stopOpacity="0"    />
            </linearGradient>
          </defs>

          {/* Area */}
          <path d={areaPath} fill="url(#cg)" />
          {/* Line */}
          <path d={linePath} fill="none" stroke={LINE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Crosshair */}
          {hx !== null && hy !== null && hoverIdx !== null && (
            <>
              {/* Time label pill */}
              <rect x={tooltipX} y={1} width="84" height="18" rx="5" fill="rgba(17,17,24,0.72)" />
              <text
                x={tooltipX + 42}
                y="13"
                textAnchor="middle"
                fontSize="10"
                fill="white"
                fontFamily="monospace"
              >
                {htLabel}
              </text>

              {/* Vertical dashed line */}
              <line
                x1={hx} y1={PT}
                x2={hx} y2={H - PB}
                stroke="#111118"
                strokeWidth="1"
                strokeOpacity="0.18"
                strokeDasharray="5 4"
              />

              {/* Dot */}
              <circle cx={hx} cy={hy} r="10" fill={LINE} fillOpacity="0.15" />
              <circle cx={hx} cy={hy} r="4.5" fill={LINE} />
            </>
          )}
        </svg>
      </div>

      {/* ── Period selector ────────────────────────────────────────── */}
      <div className="flex justify-end items-center gap-0.5 mt-3 pb-6 border-b border-black/10">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`relative flex items-center gap-1 px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors
              ${period === p ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink hover:bg-black/5'}`}
          >
            {p === 'LIVE' && (
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  period === 'LIVE' ? 'bg-green-400 animate-pulse' : 'bg-ink-muted/40'
                }`}
              />
            )}
            {p}
          </button>
        ))}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────── */}
      <div className="mt-7">
        <h3 className="font-display text-sm font-bold text-ink mb-5 uppercase tracking-wide">
          About USDC / EURC
        </h3>
        <div className="grid grid-cols-3 gap-x-6 gap-y-7">
          <Stat label="24H VOLUME"         value={fmt(stats.vol24h)} />
          <Stat
            label="1-HOUR LOW"
            value={`$${low.toFixed(4)}`}
            change={`${lowPct >= 0 ? '+' : ''}${lowPct.toFixed(2)}%`}
            pos={lowPct >= 0}
          />
          <Stat
            label="1-HOUR HIGH"
            value={`$${high.toFixed(4)}`}
            change={`${highPct >= 0 ? '+' : ''}${highPct.toFixed(2)}%`}
            pos={highPct >= 0}
          />
          <Stat label="MARKET CAP"         value={fmt(stats.mcap)} />
          <Stat label="FDV"                value={fmt(stats.mcap)} />
          <Stat label="CIRCULATING SUPPLY" value={stats.supply} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label, value, change, pos,
}: {
  label: string;
  value: string;
  change?: string;
  pos?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-ink-muted mb-1.5">{label}</p>
      <p className="font-display text-base font-bold text-ink">{value}</p>
      {change !== undefined && (
        <p className={`text-xs font-semibold mt-0.5 ${pos ? 'text-green-600' : 'text-red-500'}`}>
          {pos ? '↑' : '↓'} {change}
        </p>
      )}
    </div>
  );
}
