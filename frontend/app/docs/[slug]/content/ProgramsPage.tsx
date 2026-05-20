import { H1, P, Mono } from '@/components/docs/DocsPrimitives';

export default function ProgramsPage() {
  const programs = [
    { name: 'pool_registry', role: 'Identity layer', desc: 'The single source of truth for who is a registered maker and what their signing key is. All other contracts defer to this for maker lookups.' },
    { name: 'vault', role: 'Custody & swap execution', desc: 'Holds maker token inventory. The only contract that can actually move tokens between taker and maker. Only callable by quote_verifier.' },
    { name: 'quote_verifier', role: 'Taker entry point', desc: 'The only contract takers interact with directly. Verifies signatures, enforces invariants, orchestrates vault and fee_distributor.' },
    { name: 'fee_distributor', role: 'Fee accounting', desc: 'Accumulates protocol fees per token. Provides an admin withdrawal function to extract fees to treasury.' },
  ];

  return (
    <>
      <H1 tag="Programs">Programs Overview</H1>
      <P>HyperDex is composed of four Soroban smart contracts (called &quot;programs&quot; in Soroban terminology). They are deployed independently and call each other via cross-contract calls. Each program has a single clear responsibility.</P>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        {programs.map(p => (
          <div key={p.name} className="border border-black/10 rounded-2xl p-5 bg-white hover:-translate-y-0.5 transition-transform">
            <Mono>{p.name}</Mono>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-muted mt-2 mb-1">{p.role}</p>
            <p className="text-ink-muted text-sm leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
    </>
  );
}
