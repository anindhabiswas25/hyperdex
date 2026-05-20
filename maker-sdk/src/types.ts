// Quote struct — must match the Soroban contract's Quote #[contracttype] exactly.
// Field order matters for XDR serialization used in signature verification.
export interface Quote {
  quote_id: string;    // hex, 32 bytes — unique ID per quote
  maker: string;       // Stellar address (G... or C...)
  taker: string;       // Stellar address of taker (or zero-address for open)
  token_in: string;    // Stellar contract address (USDC or EURC SAC)
  token_out: string;   // Stellar contract address (USDC or EURC SAC)
  amount_in: string;   // i128 as decimal string (in stroops, 7 decimals)
  amount_out: string;  // i128 as decimal string (in stroops, 7 decimals)
  expiry: number;      // unix timestamp in seconds
  salt: string;        // hex, 32 bytes — random, ensures quote_id uniqueness
}

export interface SignedQuote extends Quote {
  signature: string;   // hex, 64 bytes — ed25519 signature
  maker_name: string;
}

export interface QuoteRequest {
  token_in: string;
  token_out: string;
  amount_in: string;   // stroops
  taker?: string;
}
