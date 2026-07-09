// Central network configuration for the maker SDK.
//
// Every network-specific value resolves through env vars first, falling back to
// the per-network defaults below. Set STELLAR_NETWORK=mainnet (plus the mainnet
// RPC/token env vars) to run against production. No testnet value is hardcoded
// into any operational code path anymore.

export const NETWORK_CONFIG = {
  testnet: {
    rpcUrl: 'https://soroban-testnet.stellar.org',
    usdc: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
    eurc: 'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ',
    passphrase: 'Test SDF Network ; September 2015',
  },
  mainnet: {
    rpcUrl: 'https://mainnet.sorobanrpc.com',
    // Mainnet USDC SAC (contract) address.
    usdc: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    // WARNING: the value below is a placeholder ISSUER account, NOT the EURC SAC
    // contract address. Before mainnet you MUST override EURC_CONTRACT_ADDRESS
    // with the real EURC Stellar Asset Contract (C...) address via env.
    eurc: 'GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
} as const;

const NETWORK = process.env.STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
export const ACTIVE_CONFIG = NETWORK_CONFIG[NETWORK];

export const STELLAR_RPC = process.env.STELLAR_RPC_URL || ACTIVE_CONFIG.rpcUrl;
export const NETWORK_PASSPHRASE = ACTIVE_CONFIG.passphrase;
export const USDC_CONTRACT =
  process.env.USDC_CONTRACT_ADDRESS || process.env.USDC_CONTRACT || ACTIVE_CONFIG.usdc;
export const EURC_CONTRACT =
  process.env.EURC_CONTRACT_ADDRESS || process.env.EURC_CONTRACT || ACTIVE_CONFIG.eurc;

// pool_registry contract address (network-specific, set at deploy time).
export const POOL_REGISTRY =
  process.env.POOL_REGISTRY_CONTRACT_ADDRESS || process.env.POOL_REGISTRY_CONTRACT || '';
