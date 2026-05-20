'use client';

import { useWalletStore } from '@/store/walletStore';

export default function FreighterNotInstalledModal() {
  const { showFreighterModal, dismissFreighterModal } = useWalletStore();
  if (!showFreighterModal) return null;

  return (
    <div
      onClick={dismissFreighterModal}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#1a1d27',
          border: '1px solid #2a2d3a',
          borderRadius: '16px',
          padding: '36px 32px',
          maxWidth: '380px',
          width: '90%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '36px', marginBottom: '16px' }}>🔑</div>
        <h2 style={{ color: '#f1f5f9', fontSize: '18px', fontWeight: 700, marginBottom: '10px' }}>
          Freighter Required
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: 1.6, marginBottom: '24px' }}>
          HyperDEX uses the Freighter browser wallet to connect to Stellar.
          Install it to continue.
        </p>

        <a
          href="https://www.freighter.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            background: '#7c3aed',
            color: '#fff',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
            marginBottom: '12px',
            width: '100%',
          }}
        >
          Install Freighter ↗
        </a>

        <p style={{ color: '#475569', fontSize: '12px', marginBottom: '20px' }}>
          After installing, refresh this page and click Connect Wallet again.
        </p>

        <button
          onClick={dismissFreighterModal}
          style={{
            background: 'transparent',
            border: '1px solid #2a2d3a',
            color: '#94a3b8',
            borderRadius: '8px',
            padding: '8px 20px',
            fontSize: '13px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
