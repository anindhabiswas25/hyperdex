'use client';

import { useWalletStore } from '@/store/walletStore';
import { STELLAR_NETWORK } from '@/lib/constants';

const WANT_NETWORK = STELLAR_NETWORK === 'mainnet' ? 'Stellar Mainnet (Public)' : 'Stellar Testnet';

export default function WrongNetworkBanner() {
  const isWrongNetwork = useWalletStore(s => s.isWrongNetwork);
  if (!isWrongNetwork) return null;

  return (
    <div style={{
      background: 'rgba(245,158,11,0.08)',
      borderBottom: '1px solid rgba(245,158,11,0.25)',
      padding: '10px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
    }}>
      <span style={{ fontSize: '16px' }}>⚠️</span>
      <span style={{ fontSize: '13px', color: '#f59e0b' }}>
        Wrong network detected. Please switch Freighter to{' '}
        <strong>{WANT_NETWORK}</strong> in the extension settings, then reconnect.
      </span>
    </div>
  );
}
