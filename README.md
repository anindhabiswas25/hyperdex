# HyperDEX — Sealed-Bid RFQ DEX on Stellar Soroban

HyperDEX is a sealed-bid RFQ (Request-for-Quote) DEX for USDC ↔ EURC swaps on Stellar testnet. Inspired by Hashflow, it settles off-chain signed quotes atomically on-chain with no AMM or on-chain pricing.

## Architecture

```
                 Off-chain                      On-chain (Soroban)
┌──────────────────────────────┐    ┌─────────────────────────────────────┐
│  Market Maker Pricing Server │    │  pool_registry  — maker registration│
│  1. Receives quote request   │    │  vault          — maker inventory    │
│  2. Prices the swap          │    │  quote_verifier — taker entry point  │
│  3. Signs quote with ed25519 │───▶│  fee_distributor— protocol fees      │
│  4. Returns quote + sig      │    └─────────────────────────────────────┘
└──────────────────────────────┘
         ▼ taker submits signed quote
  quote_verifier.execute_quote()
  → verify signature → vault.execute_swap() → fee_distributor.collect_fee()
```

**No AMM. No bonding curve. Price is never discovered on-chain — only verified and settled.**

## Contracts

| Contract | Purpose |
|---|---|
| `pool_registry` | Single source of truth for registered market makers and their hot ed25519 signing keys |
| `vault` | Holds maker token inventory; executes atomic token swaps; only callable by `quote_verifier` |
| `fee_distributor` | Accumulates protocol fees per token; admin withdraws to treasury |
| `quote_verifier` | Taker-facing entry point; verifies ed25519 signatures; orchestrates settlement |

## Token Scope (Testnet)

| Token | Issuer | Stellar Testnet SAC Address |
|---|---|---|
| USDC | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| EURC | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | `CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X` |

## Quote Struct & Serialization

The maker signs `SHA256(XDR(quote))` with their ed25519 hot key. The quote is a Soroban `#[contracttype]` struct serialized as XDR ScVal:

```rust
pub struct Quote {
    pub quote_id:   BytesN<32>,  // unique quote ID (SHA256 of params recommended)
    pub maker:      Address,     // registered maker address
    pub taker:      Address,     // specific taker, or zero-address for open quotes
    pub token_in:   Address,     // USDC or EURC
    pub token_out:  Address,     // USDC or EURC (different from token_in)
    pub amount_in:  i128,        // taker sends this amount
    pub amount_out: i128,        // taker receives (amount_out - fee)
    pub expiry:     u64,         // unix timestamp in seconds
    pub salt:       BytesN<32>,  // random bytes for uniqueness
}
```

### Off-chain signing (TypeScript example)

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";
import { xdr } from "@stellar/stellar-sdk";

// 1. Build the Quote as an XDR ScVal (matches Soroban contracttype layout)
//    Use @stellar/stellar-sdk's SorobanClient to encode the struct

// 2. SHA256 the XDR bytes
const quoteXdr = encodeQuoteAsScVal(quote);  // encode as XDR ScVal
const msgHash = sha256(quoteXdr);            // 32 bytes

// 3. Sign the hash with maker's ed25519 key
const keypair = StellarSdk.Keypair.fromSecret(MAKER_HOT_SECRET);
const signature = keypair.sign(msgHash);     // 64-byte ed25519 signature

// 4. Submit to taker; taker calls execute_quote on-chain
```

### On-chain verification (Soroban)

```
msg_hash = sha256(XDR(quote))        // canonical, deterministic
ed25519_verify(signer_key, hash, sig) // Soroban host verifies
```

## Contract Addresses (Testnet — deployed 2026-05-15)

| Contract | Testnet Address | Stellar Expert |
|---|---|---|
| pool_registry | `CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7` | [view](https://stellar.expert/explorer/testnet/contract/CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7) |
| vault | `CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB` | [view](https://stellar.expert/explorer/testnet/contract/CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB) |
| fee_distributor | `CBOQ5X23YTHT5NKB3EPW3Q3A77TRR4CQUYWEU4TA2XCNUKX57JTDYYJA` | [view](https://stellar.expert/explorer/testnet/contract/CBOQ5X23YTHT5NKB3EPW3Q3A77TRR4CQUYWEU4TA2XCNUKX57JTDYYJA) |
| quote_verifier | `CDBLP52CBG4D6IG26DGTO7G3APVU3UZAZXTXC52V6LK4H4WXFYOBDZSC` | [view](https://stellar.expert/explorer/testnet/contract/CDBLP52CBG4D6IG26DGTO7G3APVU3UZAZXTXC52V6LK4H4WXFYOBDZSC) |

Admin/Treasury: `GAL6ZVVRE2RPFS2X23I65QANHHIBGHKTGGVIT5AJURRKTIMEVUMJJUZZ` (deployer)  
Protocol fee: 10 bps (0.1%)

## Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

WASM files land in `target/wasm32-unknown-unknown/release/`:
- `pool_registry.wasm`
- `vault.wasm`
- `fee_distributor.wasm`
- `quote_verifier.wasm`

## Deploy

```bash
# Configure stellar identity
stellar keys generate admin --network testnet
stellar keys fund admin --network testnet   # fund via friendbot

export ADMIN_IDENTITY=admin
export TREASURY=<treasury-address>
bash scripts/deploy.sh
```

## Test Flow

```bash
# After deploy, export contract IDs printed by deploy.sh
export POOL_REGISTRY_ID=C...
export VAULT_ID=C...
export FEE_DISTRIBUTOR_ID=C...
export QUOTE_VERIFIER_ID=C...

stellar keys generate maker --network testnet
stellar keys generate taker --network testnet
export MAKER_IDENTITY=maker
export TAKER_IDENTITY=taker

bash scripts/test_flow.sh
```

## Protocol Flow

1. **Maker registers**: `pool_registry.register_maker(maker, signer_key, pairs)` — stores ed25519 hot key
2. **Maker deposits**: `vault.deposit(maker, token, amount)` — funds maker's vault inventory
3. **Quote cycle** (off-chain):
   - Taker requests a quote from maker's server
   - Maker prices the swap, builds `Quote` struct, signs `SHA256(XDR(quote))`
   - Maker sends `(quote, signature)` to taker
4. **Settlement** (on-chain): `quote_verifier.execute_quote(quote, sig)`
   - Validates tokens, expiry, replay protection, taker identity
   - Verifies ed25519 signature against maker's registered hot key
   - Atomically swaps via vault (taker's token_in → vault; vault's token_out → taker)
   - Routes protocol fee to fee_distributor
5. **Fee withdrawal**: `fee_distributor.withdraw_fees(token)` — admin sends accumulated fees to treasury

## Security Notes

- Replay protection: each `quote_id` is stored in persistent ledger after use
- Quote expiry: enforced on-chain via `ledger().timestamp()`
- Maker pause: `pool_registry.set_maker_active(maker, false)` disables all new quotes
- Hot key rotation: `pool_registry.update_signer(maker, new_key)` without downtime
- Vault access: `execute_swap` requires `require_auth()` from the stored `quote_verifier` address
