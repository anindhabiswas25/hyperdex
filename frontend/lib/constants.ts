export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
export const STELLAR_RPC_URL = process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org';
export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet';

// Derived from STELLAR_NETWORK so there are no hardcoded testnet passphrases.
export const NETWORK_PASSPHRASE =
  STELLAR_NETWORK === 'mainnet'
    ? 'Public Global Stellar Network ; September 2015'
    : 'Test SDF Network ; September 2015';

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ??
  (STELLAR_NETWORK === 'mainnet'
    ? 'https://horizon.stellar.org'
    : 'https://horizon-testnet.stellar.org');

export const QUOTE_VERIFIER_CONTRACT = process.env.NEXT_PUBLIC_QUOTE_VERIFIER_CONTRACT!;
export const POOL_REGISTRY_CONTRACT = process.env.NEXT_PUBLIC_POOL_REGISTRY_CONTRACT!;
export const MAKER_POOL_FACTORY_CONTRACT = process.env.NEXT_PUBLIC_MAKER_POOL_FACTORY_ADDRESS ?? '';
export const FEE_DISTRIBUTOR_CONTRACT = process.env.NEXT_PUBLIC_FEE_DISTRIBUTOR_CONTRACT ?? '';
export const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? '';
export const USDC_CONTRACT = process.env.NEXT_PUBLIC_USDC_CONTRACT!;
export const EURC_CONTRACT = process.env.NEXT_PUBLIC_EURC_CONTRACT!;

export const STROOPS_PER_UNIT = 10_000_000n;

export const TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  [USDC_CONTRACT]: { symbol: 'USDC', name: 'USD Coin', decimals: 7 },
  [EURC_CONTRACT]: { symbol: 'EURC', name: 'Euro Coin', decimals: 7 },
};

export const EXPLORER_BASE =
  STELLAR_NETWORK === 'mainnet'
    ? 'https://stellar.expert/explorer/public'
    : 'https://stellar.expert/explorer/testnet';

export const FREIGHTER_NETWORK = STELLAR_NETWORK === 'mainnet' ? 'PUBLIC' : 'TESTNET';
