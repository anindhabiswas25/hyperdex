export interface BackendQuote {
  rfqId: string;
  quoteId: string;
  makerAddress: string;
  takerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  expiryTimestamp: number;
  salt: string;
  signature: string;
  makerName: string;
  rate: string;
  expiresInSeconds: number;
}

export interface TradeStatus {
  quoteId: string;
  status: 'quoted' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  txHash: string | null;
  confirmedAt: string | null;
  amountIn: string;
  amountOut: string;
  explorerUrl: string | null;
}

export interface MakerInventory {
  balances: { usdc: string; eurc: string };
}

export interface HealthStatus {
  status: string;
  activeMakers: number;
  priceBookEntries: number;
  dbStatus: string;
}

export interface MakerInfo {
  name: string;
  stellarAddress: string;
  connectionStatus: string;
  lastSeenAt: string;
  supportedPairs: { tokenIn: string; tokenOut: string }[];
  totalTrades: number;
  totalVolume: string;
}

export interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface MakerInventoryV2 {
  success: boolean;
  vault: { usdc: string; eurc: string };
  wallet: { usdc: string; eurc: string; xlm: string };
}

export interface TradeRecord {
  quoteId: string;
  makerAddress: string;
  takerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  status: 'quoted' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  txHash: string | null;
  quotedAt: string;
  confirmedAt: string | null;
}

export interface AdminMakerRecord {
  _id: string;
  stellarAddress: string;
  name: string;
  signerPublicKey: string;
  active: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'unknown';
  lastSeenAt: string | null;
  totalTrades: number;
  totalVolume: number;
  createdAt: string;
  supportedPairs: { tokenIn: string; tokenOut: string }[];
}
