import { H1, P } from '@/components/docs/DocsPrimitives';

export default function TroubleshootPage() {
  const issues = [
    { problem: 'Health check shows activeMakers: 0', why: 'The Maker SDK is not connected to the backend WebSocket.', fix: 'Ensure the SDK is running (npm run dev <name> in maker-sdk/). Check that MAKER_API_KEY and BACKEND_WS_URL in credentials/<name>.cred are correct. Check the SDK terminal for connection error logs.' },
    { problem: '"No bids received" after the 30-second auction', why: 'The maker did not send a bid. Usually the SDK is offline, the pool has zero balance for that token, or the drift guard paused quoting (ghost price >3% from the live oracle mid).', fix: 'Check maker-sdk terminal logs. Query the /api/makers/<address>/inventory endpoint and deposit if zero. If drift-paused, press Ctrl+R to re-price.' },
    { problem: 'Dashboard shows "SDK Offline" but the SDK terminal is connected', why: 'Idle WebSocket connections drop on hosted backends; the SDK auto-reconnects and the backend now guards the reconnect race so the live socket stays registered.', fix: 'Usually self-heals within seconds. If it persists, restart the SDK (Ctrl+C, then npm run dev <name>).' },
    { problem: 'Custom --engine did not load', why: 'The engine path is wrong or the file does not export getLevels/getQuote.', fix: 'Fix the path and keep the -- separator (npm run dev <name> -- --engine=./x.ts). The SDK falls back to the built-in engine and logs why, so check the banner Engine: line.' },
    { problem: 'Freighter shows "Transaction Failed"', why: 'The quote expired (30-second quote window elapsed) or the pool balance was drained between auction and settlement.', fix: 'Accept quotes faster. If pool balance is the issue, deposit more inventory.' },
    { problem: 'Freighter not connecting to Testnet', why: 'Freighter is set to Mainnet.', fix: 'Open Freighter → Settings → Network → select Testnet.' },
    { problem: '"Maker not registered" error on /maker page', why: 'Your wallet address is not in the pool_registry contract.', fix: 'Complete the on-chain registration step — paste your signer public key and call register_maker via the /maker UI.' },
  ];

  return (
    <>
      <H1 tag="Getting Started">Troubleshooting</H1>
      <P>Common issues and their solutions when setting up or using HyperDex.</P>
      {issues.map(t => (
        <div key={t.problem} className="border border-black/10 rounded-2xl p-5 mb-3 bg-white hover:-translate-y-0.5 transition-transform">
          <p className="font-display font-bold text-ink text-sm mb-1">{t.problem}</p>
          <p className="text-ink-muted text-xs mb-2"><strong>Why:</strong> {t.why}</p>
          <p className="text-ink-muted text-xs"><strong>Fix:</strong> {t.fix}</p>
        </div>
      ))}
    </>
  );
}
