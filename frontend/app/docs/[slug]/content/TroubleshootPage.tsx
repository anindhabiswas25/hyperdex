import { H1, P } from '@/components/docs/DocsPrimitives';

export default function TroubleshootPage() {
  const issues = [
    { problem: 'Health check shows activeMakers: 0', why: 'The Maker SDK is not connected to the backend WebSocket.', fix: 'Ensure the SDK is running (npm run dev in maker-sdk/). Check that BACKEND_WS and MAKER_API_KEY env vars are set correctly. Check SDK terminal for connection error logs.' },
    { problem: '"No bids received" after 30-second auction', why: 'The maker did not send a bid. Usually means the SDK is offline, the maker has zero vault balance for that token, or the SDK encountered a pricing error.', fix: 'Check maker-sdk terminal logs for errors. Run the balance check endpoint. Deposit inventory if zero.' },
    { problem: 'Freighter shows "Transaction Failed"', why: 'The quote expired (10-second accept window elapsed) or the vault balance was drained between auction and settlement.', fix: 'Accept quotes faster. If vault balance is the issue, deposit more inventory.' },
    { problem: 'Freighter not connecting to Testnet', why: 'Freighter is set to Mainnet.', fix: 'Open Freighter → Settings → Network → select Testnet.' },
    { problem: '"Maker not registered" error on /maker page', why: 'Your wallet address is not in the pool_registry contract.', fix: 'Complete Step 2 of maker registration — call register_maker via the /maker UI.' },
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
