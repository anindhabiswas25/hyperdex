<div align="center">

<img src="https://img.shields.io/badge/Stellar-Soroban-7B2FBE?style=for-the-badge" />
<img src="https://img.shields.io/badge/Rust-1.70%2B-red?style=for-the-badge" />
<img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge" />
<img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge" />
<img src="https://img.shields.io/badge/Status-Live%20on%20Testnet-brightgreen?style=for-the-badge" />

# HyperDEX

### Sealed-Bid RFQ DEX on Stellar Soroban — USDC ↔ EURC with No AMM, No Slippage.

**Taker requests quote → Maker signs off-chain → Soroban verifies ed25519 and settles atomically**

[Live App](https://hyperdex-psi.vercel.app) · [Backend API](https://hyperdex.onrender.com/health) · [Explorer](https://stellar.expert/explorer/testnet) · [Contracts](#-deployed-contracts) · [Architecture](#-architecture) · [Quick Start](#-quick-start)

</div>

---

## Table of Contents

- [Overview](#-overview)
- [Why HyperDEX](#-why-hyperdex)
- [How It Works](#-how-it-works)
- [Architecture](#-architecture)
- [Smart Contracts](#-smart-contracts)
- [Project Structure](#-project-structure)
- [Deployed Contracts](#-deployed-contracts)
- [Backend & WebSocket Server](#-backend--websocket-server)
- [API Reference](#-api-reference)
- [Maker SDK](#-maker-sdk)
- [Frontend](#-frontend)
- [Quick Start](#-quick-start)
- [Testing](#-testing)
- [Security Notes](#-security-notes)
- [Roadmap](#-roadmap)
- [Tech Stack](#-tech-stack)

---

## 📌 Overview

HyperDEX is a **production-grade sealed-bid RFQ (Request-for-Quote) DEX** built on Stellar Soroban. It enables gasless, zero-slippage USDC ↔ EURC swaps by separating price discovery (off-chain, by market makers) from settlement (on-chain, by Soroban contracts).

Inspired by [Hashflow](https://hashflow.com), HyperDEX introduces the first RFQ architecture on Stellar:

1. A **taker** requests a swap quote from the backend
2. The backend dispatches an **RFQ** to connected market makers over WebSocket
3. The best-priced **maker** signs the quote with an ed25519 hot key
4. The backend returns the signed quote to the taker
5. The taker submits the quote to Soroban — the **`quote_verifier`** contract verifies the signature and atomically settles the swap

**Price is never discovered on-chain. Only verified and settled.**

---

## 🧩 Why HyperDEX

### The Problem with AMMs on Stellar

Existing Stellar DEXes use AMMs (Automated Market Makers) with on-chain bonding curves. These have fundamental limitations:

```
AMM Model
├── Price determined by reserve ratio (x·y = k)
├── Every large trade moves the price (price impact)
├── Sandwich attacks: bots front-run large swaps
├── Slippage: actual received amount < quoted amount
└── Capital efficiency: 99% of LP capital unused at any price
```

For stablecoin pairs like USDC ↔ EURC (which should trade at ~1:1), AMM slippage is a solved problem in TradFi — market makers quote tight spreads against real FX rates. HyperDEX brings this model on-chain.

### HyperDEX Solves This With a Sealed-Bid RFQ Model

```
RFQ Model (HyperDEX)
├── Price quoted off-chain by professional market makers
├── Quote is cryptographically signed (ed25519) — maker committed, no reneging
├── Quote is sealed: no front-running (bots cannot see it before settlement)
├── Zero slippage: taker receives the exact quoted amount_out
└── Capital efficiency: maker allocates inventory per-quote, not per-pool
```

### Why This Matters for Stellar's DeFi Ecosystem

| Without HyperDEX | With HyperDEX |
|---|---|
| AMM slippage on every USDC↔EURC swap | Zero slippage — guaranteed amount out |
| Front-running by MEV bots | Sealed-bid: quote invisible until settled |
| Fixed on-chain spread (curve-driven) | Competitive market maker spreads |
| LP capital 99% idle in price range | Maker deploys exactly the capital needed |
| No professional liquidity providers | Permissioned maker registration with reputation |

---

## ⚙️ How It Works

### 1. Quote Request & RFQ Dispatch

```
Taker enters: 20 EURC → USDC
        │
        ▼
POST /api/quote { tokenIn, tokenOut, amountIn, takerAddress }
        │
        ▼
Backend RFQ Router
        ├── Identify connected makers with USDC inventory
        ├── Dispatch RFQ to each via WebSocket (750ms timeout)
        └── Collect responses, return best quote (highest amountOut)
```

### 2. Maker Pricing & Signing

```
Maker SDK receives RFQ
        │
        ▼
Price Oracle (CoinGecko EURC/USDC rate)
        ├── Apply spread tiers based on amountIn
        ├── Build Quote struct { quoteId, maker, taker, tokenIn, tokenOut,
        │                         amountIn, amountOut, expiry, salt }
        └── Sign SHA256(XDR(quote)) with ed25519 hot key
        │
        ▼
Return { quote, signature } to backend → backend to taker
```

### 3. On-Chain Settlement (Soroban)

```
Taker calls: quote_verifier.execute_quote(quote, signature)
        │
        ├── Validate: expiry not passed (ledger.timestamp)
        ├── Validate: replay protection (quote_id not used before)
        ├── Validate: taker identity (quote.taker == tx.source)
        ├── Verify: ed25519_verify(maker_signer_key, SHA256(XDR(quote)), sig)
        ├── Execute: maker_pool.execute_swap(quote)
        │     ├── Transfer taker's token_in → pool
        │     └── Transfer pool's token_out → taker (amount_out - protocol_fee)
        └── Route: fee_distributor.collect_fee(token, fee_amount)
```

### 4. Trade Confirmation

```
Backend ConfirmationPoller
        ├── Polls Stellar Horizon for TX status every 5s
        ├── On success: updates trade record → "confirmed"
        ├── Pushes confirmation to maker SDK via WebSocket
        └── Maker SDK displays trade confirmation banner
```

### Quote Struct

The maker signs `SHA256(XDR(quote))` with their registered ed25519 hot key. Soroban serializes `#[contracttype]` structs in **alphabetical field order**:

```rust
pub struct Quote {
    pub amount_in:  i128,        // taker sends this (in stroops)
    pub amount_out: i128,        // taker receives this (guaranteed)
    pub expiry:     u64,         // unix timestamp in seconds (+30s from now)
    pub maker:      Address,     // registered maker Stellar address
    pub quote_id:   BytesN<32>,  // SHA256(params) — unique per quote
    pub salt:       BytesN<32>,  // random 32 bytes
    pub taker:      Address,     // specific taker address
    pub token_in:   Address,     // EURC or USDC SAC
    pub token_out:  Address,     // USDC or EURC SAC
}
```

> **Critical:** Field serialization order is **alphabetical** (`amount_in`, `amount_out`, `expiry`, …), not declaration order. Both the maker SDK serializer and the frontend must match this exactly or signature verification fails.

---

## 🏗 Architecture

### System Architecture Diagram

```
╔═══════════════════════════════════════════════════════════════════╗
║                     STELLAR TESTNET                               ║
║                                                                   ║
║   ┌─────────────────────────────────────────────────────────┐    ║
║   │  Soroban Smart Contracts                                │    ║
║   │                                                         │    ║
║   │  ┌──────────────┐   ┌─────────────────────────────┐   │    ║
║   │  │ pool_registry│   │     quote_verifier           │   │    ║
║   │  │              │   │                              │   │    ║
║   │  │ maker → key  │   │ 1. validate expiry / replay  │   │    ║
║   │  │ signer map   │◄──│ 2. verify ed25519 signature  │   │    ║
║   │  └──────────────┘   │ 3. call maker_pool.swap()    │   │    ║
║   │                     └────────────┬────────────────-─┘   │    ║
║   │                                  │                       │    ║
║   │  ┌──────────────────────────────▼──────────────────┐   │    ║
║   │  │  maker_pool  (per-maker, deployed by factory)   │   │    ║
║   │  │                                                 │   │    ║
║   │  │  token_in (EURC) ──► pool ──► token_out (USDC)  │   │    ║
║   │  │  protocol fee  ──────────────► fee_distributor  │   │    ║
║   │  └─────────────────────────────────────────────────┘   │    ║
║   │                                                         │    ║
║   │  ┌──────────────┐   ┌──────────────────────────────┐  │    ║
║   │  │ maker_pool_  │   │     fee_distributor           │  │    ║
║   │  │ factory      │   │  accumulates 10 bps per swap  │  │    ║
║   │  │ deploys pools│   │  admin withdraws to treasury  │  │    ║
║   │  └──────────────┘   └──────────────────────────────┘  │    ║
║   └─────────────────────────────────────────────────────────┘    ║
╚═══════════════════════════════════════════════════════════════════╝
                              ▲  ▲
                              │  │ Soroban RPC
╔═══════════════════════════════════════════════════════════════════╗
║                     BACKEND (Node.js / Express)                   ║
║                     https://hyperdex.onrender.com                 ║
║                                                                   ║
║   REST API ──── /api/quote ──────────────── RFQ Router            ║
║                 /api/trades                      │                ║
║                 /api/makers                      │ WebSocket      ║
║                 /api/health               ┌──────▼────────┐      ║
║                                           │  WsServer     │      ║
║   Confirmation ──── Horizon Poller        │               │      ║
║   Poller             (every 5s)           │  maker conns  │      ║
║                                           └──────┬────────┘      ║
║   MongoDB ──── trades, makers,                   │               ║
║                rate limits,                      │ WS messages   ║
║                price book                        │               ║
╚═══════════════════════════════════════════════════════════════════╝
                                                   │
╔══════════════════════════════════════════════════╪════════════════╗
║              MARKET MAKER SDK (Node.js)          │                ║
║              http://localhost:3001               │                ║
║                                                  │                ║
║   Price Oracle (CoinGecko) ──► Ghost Pricer      │                ║
║                                    │             │                ║
║   Price Levels (sent every 1s) ────┼─────────────►               ║
║                                    │             │                ║
║   RFQ Received ◄───────────────────┼─────────────               ║
║        │                           │                              ║
║        ▼                           │                              ║
║   Signer (ed25519) ──► Quote + Sig ►──── to taker (via backend)  ║
║                                                                   ║
║   Trade Confirmed ◄─────── TradePushService push                 ║
╚═══════════════════════════════════════════════════════════════════╝
                    ▲
╔═══════════════════╪═══════════════════════════════════════════════╗
║        FRONTEND (Next.js 14)  ·  https://hyperdex-psi.vercel.app  ║
║                   │                                               ║
║   /swap  ──── Quote UI ──────── POST /api/quote                   ║
║   /maker ──── Maker Dashboard ─ REST + WebSocket                  ║
║   /admin ──── Admin Panel ───── REST (admin-gated)                ║
║                                                                   ║
║   Wallet: Freighter (Stellar browser extension)                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Full RFQ Sequence

```
Taker (browser)          Backend               Maker SDK           Soroban
      │                     │                      │                   │
      │─ POST /api/quote ──►│                      │                   │
      │                     │─── WS rfqRequest ───►│                   │
      │                     │                      │─ price oracle     │
      │                     │                      │─ build quote      │
      │                     │                      │─ sign SHA256(XDR) │
      │                     │◄── WS rfqQuote ──────│                   │
      │◄─ { quote, sig } ───│                      │                   │
      │                     │                      │                   │
      │─ execute_quote() ──────────────────────────────────────────────►
      │                     │                      │  verify sig       │
      │                     │                      │  atomic swap      │
      │◄── TX hash ─────────────────────────────────────────────────── │
      │                     │                      │                   │
      │                     │─ poll Horizon ────────────────────────── │
      │                     │◄─ TX confirmed ──────────────────────────│
      │                     │─── WS tradeConfirmed ►│                  │
      │◄── trade status ────│                      │                   │
```

---

## 📜 Smart Contracts

All contracts are written in **Rust / Soroban SDK** and compiled to WebAssembly. They run on Stellar's Soroban smart contract platform.

### `pool_registry`

The single source of truth for registered market makers. Stores the ed25519 hot signing key that the `quote_verifier` uses to validate quotes.

| Function | Description |
|---|---|
| `register_maker(maker, signer_key)` | Register a maker address with their ed25519 public key |
| `update_signer(maker, new_key)` | Rotate signer key without downtime |
| `set_maker_active(maker, active)` | Pause/unpause a maker (admin or self) |
| `get_maker(maker)` | Returns `{ signer_key, active, registered_at }` |
| `get_all_makers()` | Returns list of all registered makers |

**Security:** Each maker's signing key is stored in persistent Soroban storage with extended TTL. Signer rotation is permissioned — only the maker themselves or admin can rotate.

### `quote_verifier`

The taker-facing entry point. Validates and settles every swap.

**Settlement logic:**
```
execute_quote(quote: Quote, signature: BytesN<64>)
  1. require!( ledger.timestamp() < quote.expiry )          // not expired
  2. require!( !used_quote_ids.contains(quote.quote_id) )  // no replay
  3. require!( quote.taker == env.invoker() )               // correct taker
  4. let signer_key = pool_registry.get_maker(quote.maker).signer_key
  5. ed25519_verify(signer_key, sha256(quote.to_xdr()), signature)  // valid sig
  6. used_quote_ids.insert(quote.quote_id)                  // mark used
  7. maker_pool.execute_swap(quote)                         // atomic settlement
```

| Function | Description |
|---|---|
| `execute_quote(quote, sig)` | Verify + settle a signed quote |
| `set_pool_registry(addr)` | Admin — set the registry contract address |
| `set_fee_distributor(addr)` | Admin — set fee distributor address |
| `set_protocol_fee_bps(bps)` | Admin — set protocol fee in basis points |

### `maker_pool` (per-maker, factory-deployed)

Each registered maker has their own isolated pool contract deployed by the factory. Holds token inventory, executes atomic swaps, and routes protocol fees.

| Function | Description |
|---|---|
| `deposit(token, amount)` | Maker deposits USDC or EURC inventory (2-TX: approve + deposit) |
| `withdraw(token, amount)` | Maker withdraws inventory |
| `execute_swap(quote)` | Called by `quote_verifier` — transfers token_in from taker, token_out to taker |
| `get_balances()` | Returns `{ usdc, eurc }` in stroops |

**Access control:** `execute_swap` requires `require_auth()` from the registered `quote_verifier` address — cannot be called directly.

**Persistent storage TTL:** All storage entries (`Usdc`, `Eurc`, `SignerKey`, `QuoteVerifier`, `Owner`) are extended on every `deposit()` and `withdraw()` call to prevent testnet ledger expiry (~4096 ledger TTL on testnet ≈ 6 hours without bump).

### `maker_pool_factory`

Deploys new `maker_pool` contracts for registered makers using deterministic addressing.

| Function | Description |
|---|---|
| `deploy_pool(maker, signer_key)` | Deploy a pool for this maker; salt = `sha256(maker.to_xdr())` |
| `get_pool(maker)` | Returns deployed pool address for a maker |

**Deterministic salt:** `salt = sha256(maker.to_xdr())` — ensures the same pool address is computed in both simulation and execution (no ledger-sequence salt which would cause footprint mismatch).

### `fee_distributor`

Accumulates protocol fees (10 bps per swap). Admin withdraws to treasury.

| Function | Description |
|---|---|
| `collect_fee(token, amount)` | Called by `maker_pool` on every swap |
| `withdraw_fees(token)` | Admin withdraws accumulated fees to treasury |
| `get_balance(token)` | Returns accumulated fee balance |

---

## 📁 Project Structure

```
HyperDex/
│
├── contracts/                        # Soroban smart contracts (Rust)
│   ├── pool_registry/                # Maker registration + signer key store
│   │   ├── src/
│   │   │   ├── lib.rs                # Contract entry points
│   │   │   └── types.rs              # MakerInfo, storage keys
│   │   └── Cargo.toml
│   │
│   ├── quote_verifier/               # Taker entry point — verify + settle
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   └── types.rs              # Quote struct (alphabetical field order)
│   │   └── Cargo.toml
│   │
│   ├── maker_pool/                   # Per-maker inventory vault + swap executor
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   └── types.rs
│   │   └── Cargo.toml
│   │
│   ├── maker_pool_factory/           # Factory — deploys maker_pool contracts
│   │   ├── src/
│   │   │   └── lib.rs
│   │   └── Cargo.toml
│   │
│   └── fee_distributor/              # Protocol fee accumulator
│       ├── src/
│       │   └── lib.rs
│       └── Cargo.toml
│
├── backend/                          # Node.js REST API + WebSocket server
│   ├── src/
│   │   ├── index.ts                  # Express app + WsServer bootstrap
│   │   │
│   │   ├── routes/
│   │   │   ├── quote.ts              # POST /api/quote — RFQ dispatch + auction
│   │   │   ├── makers.ts             # GET/POST /api/makers — CRUD + inventory
│   │   │   ├── trades.ts             # GET /api/trades — trade history + status
│   │   │   ├── health.ts             # GET /health
│   │   │   ├── admin.ts              # GET /api/admin — admin endpoints
│   │   │   └── adminPending.ts       # GET /api/admin/pending — maker approvals
│   │   │
│   │   ├── websocket/
│   │   │   ├── WsServer.ts           # WebSocket server — maker connections
│   │   │   ├── MakerConnection.ts    # Per-maker WS state + ping/pong
│   │   │   ├── TradePushService.ts   # Push trade confirmations to makers
│   │   │   ├── messages/             # WS message type definitions
│   │   │   └── handlers/
│   │   │       ├── onRfqQuote.ts     # Handle maker quote response
│   │   │       └── onError.ts        # Handle maker error / rate limit
│   │   │
│   │   └── utils/
│   │       └── logger.ts             # Winston logger
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                          # See Environment Variables section
│
├── maker-sdk/                        # Market maker server (TypeScript)
│   ├── src/
│   │   ├── server.ts                 # Express server + WS client bootstrap
│   │   ├── ws-client.ts              # WebSocket connection to backend
│   │   ├── ghost-price.ts            # ★ Auto-pricing: CoinGecko oracle + ed25519 signer
│   │   ├── price-levels.ts           # Streams price levels to backend every 1s
│   │   ├── signer.ts                 # ed25519 sign/verify utilities
│   │   ├── serializer.ts             # Quote → XDR ScVal (alphabetical field order)
│   │   ├── oracle.ts                 # CoinGecko price feed with caching
│   │   ├── rate-limiter.ts           # Per-taker RFQ rate limiting
│   │   ├── inventory-checker.ts      # Read pool balances from Soroban
│   │   ├── setup.ts                  # Interactive setup wizard
│   │   ├── activate.ts               # Activate maker after pool deployment
│   │   ├── generate-keypair.ts       # Generate ed25519 keypair
│   │   ├── update-signer.ts          # Update signer key on-chain
│   │   └── types.ts                  # Shared type definitions
│   │
│   ├── package.json
│   └── .env                          # MAKER_ADDRESS, SIGNER_PRIVATE_KEY, API_KEY
│
├── frontend/                         # Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx                  # Landing page
│   │   ├── swap/page.tsx             # Taker swap UI — request quote + execute
│   │   ├── maker/page.tsx            # Maker dashboard — register, deposit, monitor
│   │   ├── admin/page.tsx            # Admin panel — approve maker applications
│   │   └── api/
│   │       └── maker-application/    # Next.js API routes (proxy to backend)
│   │
│   ├── hooks/
│   │   ├── useAuction.ts             # Quote polling + 30s countdown timer
│   │   ├── useIsAdmin.ts             # Check if connected wallet is admin
│   │   ├── useMakerState.ts          # Maker registration status polling
│   │   └── useWallet.ts              # Freighter wallet connect/disconnect
│   │
│   ├── lib/
│   │   └── constants.ts              # Contract addresses, BACKEND_URL
│   │
│   ├── store/                        # Zustand state stores
│   ├── components/                   # Shared UI components
│   │
│   ├── .env.local                    # See Environment Variables section
│   └── next.config.js
│
├── scripts/                          # Deployment + utility scripts
│   ├── deploy-v2.sh                  # Deploy all contracts, write addrs to .env
│   ├── smoke-test.sh                 # 14-step smoke test
│   ├── register-maker-onchain.ts     # Register maker in pool_registry
│   ├── register-maker-mongodb.ts     # Register maker in MongoDB + issue API key
│   └── deposit-vault-inventory.ts    # Deposit USDC/EURC into maker pool
│
├── HYPERDEX_E2E_FLOW.md              # Step-by-step E2E test guide
├── HYPERDEX_TESTING_GUIDE.md         # Full testing reference
├── MAKER_REGISTRATION.md             # Maker onboarding guide
├── MAKER_FLOW.md                     # Maker flow walkthrough
└── README.md
```

---

## 🚀 Deployed Contracts

### Stellar Testnet — Live

> Explorer: [https://stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)

| Contract | Address | Explorer |
|---|---|---|
| **pool_registry** | `CAWPFMTTRQD76CBXMRBJTXKFBFYD37RZM6ZZXOZ7QBYTKCXK5YOEOK4J` | [view](https://stellar.expert/explorer/testnet/contract/CAWPFMTTRQD76CBXMRBJTXKFBFYD37RZM6ZZXOZ7QBYTKCXK5YOEOK4J) |
| **quote_verifier** | `CA5EB6VSUMCTXPKN7RYOZO26WCFCEV3ETWREUBIDLPF4ICF2ASV56CQI` | [view](https://stellar.expert/explorer/testnet/contract/CA5EB6VSUMCTXPKN7RYOZO26WCFCEV3ETWREUBIDLPF4ICF2ASV56CQI) |
| **maker_pool_factory** | `CDLPUEPZM6BD7M7UA4J2LZSPHNBXHLNHMNKWLJCUL4P345FBDCMNDHMH` | [view](https://stellar.expert/explorer/testnet/contract/CDLPUEPZM6BD7M7UA4J2LZSPHNBXHLNHMNKWLJCUL4P345FBDCMNDHMH) |
| **fee_distributor** | `CAOO73GNR27CNWMRN66ZCFRILFCLMHMLSNGA6QBGQ6ZUQVCAWNILYUMZ` | [view](https://stellar.expert/explorer/testnet/contract/CAOO73GNR27CNWMRN66ZCFRILFCLMHMLSNGA6QBGQ6ZUQVCAWNILYUMZ) |
| **USDC SAC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | [view](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |
| **EURC SAC** | `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ` | [view](https://stellar.expert/explorer/testnet/contract/CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ) |

**Admin / Treasury:** `GAL6ZVVRE2RPFS2X23I65QANHHIBGHKTGGVIT5AJURRKTIMEVUMJJUZZ`  
**Protocol Fee:** 10 bps (0.1%) per swap  
**Token Issuer (both USDC + EURC):** `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` (Circle testnet)

### WASM Hashes (deployed 2026-05-18)

| Contract | WASM Hash |
|---|---|
| maker_pool | `6c0c93323753e52da4342cd424077e50101152369789c3449000b3eb8e25aaa6` |
| maker_pool_factory | `d62472cfabe0e0f7010e14ee1ab404e01525ac26ee67890557a94794c260fdf7` |

---

## 🤖 Backend & WebSocket Server

### Service Architecture

The backend handles two concerns: **REST API** for the frontend and **WebSocket server** for maker SDK connections.

```
Express HTTP Server (:4000)
├── POST /api/quote        ─── RFQ auction (750ms window, best-quote wins)
├── GET  /api/makers       ─── List makers + connection status
├── GET  /api/trades       ─── Trade history + status polling
├── GET  /health           ─── { activeMakers, priceBookEntries, dbStatus }
├── POST /api/makers/apply ─── Maker application (stores in MongoDB)
└── GET  /api/admin/...    ─── Admin: list/approve/reject pending makers

WebSocket Server (:4000/ws/maker)
├── Auth: Authorization: Bearer <api_key>  (hashed in MongoDB)
├── MakerConnection  ─── per-maker state, ping/pong heartbeat (30s)
├── RFQ dispatch     ─── { type: "rfqRequest", ... } → maker
├── Quote receipt    ─── { type: "rfqQuote", ... }   ← maker
├── Price levels     ─── { type: "priceLevels", ... } ← maker (every 1s)
├── Trade push       ─── { type: "tradeConfirmed", ... } → maker
└── Rate limit       ─── { type: "rfqError", reason: "rate_limit" } ← maker
```

### RFQ Auction (30s Quote Window)

```
POST /api/quote
  │
  ├── Query price book: find makers with token_out inventory
  ├── Dispatch rfqRequest to up to 3 makers (RFQ_MAX_MAKERS)
  ├── Wait up to 750ms (RFQ_TIMEOUT_MS) for responses
  ├── Pick best quote (highest amountOut for the taker)
  └── Return { quote, signature, makerName }
```

### Confirmation Poller

After the taker submits a quote on-chain, the backend polls Stellar Horizon every 5 seconds (up to TX_TIMEOUT_MS) to detect confirmation, then:

1. Updates the trade record in MongoDB to `"confirmed"`
2. Pushes a `tradeConfirmed` WebSocket event to the maker SDK
3. Maker SDK acknowledges (`tradeAck`) to confirm it received the notification

### MongoDB Collections

| Collection | Purpose |
|---|---|
| `makers` | Address, name, API key hash, signer key, status, pool address |
| `trades` | Quote ID, amounts, TX hash, status, timestamps |
| `rateLimits` | Per-taker limits set by makers, with expiry timestamps |

---

## 📡 API Reference

Base URL: `https://hyperdex.onrender.com`

### Core Endpoints

| Method | Path | Description | Response |
|---|---|---|---|
| `GET` | `/health` | Server health + live maker count | `{ status, activeMakers, priceBookEntries, dbStatus }` |
| `POST` | `/api/quote` | Request a swap quote (triggers RFQ) | `{ success, quote: { quoteId, amountIn, amountOut, signature, ... } }` |
| `GET` | `/api/makers` | List all makers + WebSocket status | `[{ address, name, connectionStatus, poolAddress }]` |
| `GET` | `/api/trades` | Trade history | `{ trades: [{ status, amountIn, amountOut, txHash, ... }] }` |
| `GET` | `/api/trades/:quoteId/status` | Poll a specific trade status | `{ status: "submitted" \| "confirmed" \| "failed" }` |

### Quote Request Body

```json
{
  "tokenIn":      "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
  "tokenOut":     "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  "amountIn":     "200000000",
  "takerAddress": "G..."
}
```

> Amounts are in **stroops** (1 USDC = 10,000,000 stroops = 1e7).

### Maker Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/makers/apply` | Submit a maker application |
| `GET` | `/api/makers/:address/inventory` | Pool USDC + EURC balances |
| `POST` | `/api/makers/register-signer-key` | Store signer public key in MongoDB |

### Admin Endpoints (admin address only)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/pending` | List pending maker applications |
| `POST` | `/api/admin/pending/:id/approve` | Approve application + issue API key |
| `POST` | `/api/admin/pending/:id/reject` | Reject application |
| `POST` | `/api/admin/pending/:id/rotate-key` | Rotate API key for a maker |

### WebSocket Messages (maker SDK ↔ backend)

| Direction | Type | Description |
|---|---|---|
| backend → maker | `rfqRequest` | RFQ dispatch: `{ quoteId, tokenIn, tokenOut, amountIn, takerAddress }` |
| maker → backend | `rfqQuote` | Signed quote: `{ quoteId, quote, signature }` |
| maker → backend | `rfqError` | Error: `{ quoteId, reason: "no_inventory" \| "rate_limit" }` |
| maker → backend | `priceLevels` | Price book update: `{ levels: [{ tokenIn, tokenOut, price, maxAmount }] }` |
| backend → maker | `tradeConfirmed` | `{ tradeEventId, txHash, amountIn, amountOut }` |
| maker → backend | `tradeAck` | `{ tradeEventId }` |

---

## 🛠 Maker SDK

The maker SDK is a standalone Node.js server that connects to the backend via WebSocket, auto-prices quotes using a CoinGecko oracle, and signs them with an ed25519 key.

### Setup (one-time)

```bash
cd maker-sdk
npm install
npm run setup
```

The interactive setup wizard:
1. Prompts for your maker Stellar address and backend URL
2. Generates an ed25519 keypair — the **public key** is registered in `pool_registry` on-chain; the **secret key** stays local
3. Writes credentials to `~/.hyperdex/maker-credentials.json`
4. Calls `POST /api/makers/register-signer-key` to store the signer key in MongoDB

### Running the SDK

```bash
npm run dev
```

**Startup banner:**
```
════════════════════════════════════════
  HYPERDEX MAKER SDK  ·  TESTNET
  Maker:   HyperDEX MM
  Address: GALNCMRJ2...
  Pool:    C...
  USDC:    100.00   EURC:  100.00
════════════════════════════════════════
[WS] Connected to ws://localhost:4000/ws
[PriceLevels] Sent: 3 sell levels, 3 buy levels (USDC/EURC)
```

### Ghost Pricer (Auto-Pricing)

The `ghost-price.ts` module handles automated pricing for the demo maker:

```typescript
// Every RFQ received:
1. Fetch EURC/USDC spot rate from CoinGecko (cached 30s)
2. Apply spread: amountOut = amountIn × rate × (1 - spread)
   where spread depends on trade size:
   │  < $100:  0.05%
   │  < $500:  0.10%
   │  < $5000: 0.20%
   └  ≥ $5000: 0.30%
3. Build Quote struct (alphabetical XDR field order)
4. Sign SHA256(XDR(quote)) with ed25519 key
5. Return { quote, signature } to backend within 750ms
```

### Rate Limiting

The SDK tracks RFQ requests per taker address. After 10 requests within a rolling window, it sends `rfqError { reason: "rate_limit", expiryTimestampMs }` to the backend. The backend stores this in MongoDB and blocks further RFQs from that taker for the specified duration.

### maker-sdk `.env`

```env
MAKER_ADDRESS=G...
SIGNER_PRIVATE_KEY=<64 hex chars — ed25519 secret>
PORT=3001
MAKER_NAME=HyperDEX MM
USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
EURC_CONTRACT=CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ
BACKEND_WS_URL=wss://hyperdex.onrender.com/ws/maker
MAKER_API_KEY=sk_live_...
```

---

## 🖥 Frontend

Built with **Next.js 14 App Router**, **TypeScript**, and **Tailwind CSS**. Wallet integration via **Freighter** (Stellar browser extension).

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | Landing | Protocol overview and entry points |
| `/swap` | Swap | EURC ↔ USDC swap UI — request quote, 30s countdown, execute on Soroban |
| `/maker` | Maker Dashboard | Multi-step setup: apply → deploy pool → deposit → start SDK → monitor trades |
| `/admin` | Admin Panel | Approve / reject pending maker applications, rotate API keys |

### Maker Dashboard — Setup Flow

The `/maker` page guides market makers through a 5-step onboarding flow:

```
Step 1: Apply          → fill name + description, submit application
Step 2: Get Approved   → admin approves in /admin; API key issued
Step 3: Deploy Pool    → sign 1 TX in Freighter; pool_factory deploys maker_pool
Step 4: Deposit        → deposit USDC + EURC (2 TXs each: approve + deposit)
Step 5: Start SDK      → run `npm run dev` in maker-sdk; SDK comes online
```

After activation, the dashboard shows:
- **Overview tab:** SDK status (online/offline), 24h trade count, pool balances
- **Inventory tab:** Live USDC + EURC balances, deposit/withdraw UI
- **History tab:** Trade list with TX hashes and timestamps
- **Rate Limits tab:** Active taker rate limits with countdown timers

### Swap UI — Quote Lifecycle

```
User enters: 20 EURC → USDC
        │
        ▼ (debounced 800ms)
POST /api/quote via Next.js API route
        │
        ▼
Quote panel appears:
  ┌─────────────────────────────────────┐
  │ Rate:    1 EURC ≈ 1.09 USDC         │
  │ You Get: ~21.80 USDC (guaranteed)   │
  │ Fee:     0.10%                      │
  │ ████████████████░░░░  28s           │ ← countdown timer
  └─────────────────────────────────────┘
        │
        ▼ user clicks Swap → Confirm
Freighter signs execute_quote TX
        │
        ▼
"Swap confirmed!" toast + explorer link
```

### `frontend/.env.local`

```env
NEXT_PUBLIC_BACKEND_URL=https://hyperdex.onrender.com
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_QUOTE_VERIFIER_CONTRACT=CA5EB6VSUMCTXPKN7RYOZO26WCFCEV3ETWREUBIDLPF4ICF2ASV56CQI
NEXT_PUBLIC_POOL_REGISTRY_CONTRACT=CAWPFMTTRQD76CBXMRBJTXKFBFYD37RZM6ZZXOZ7QBYTKCXK5YOEOK4J
NEXT_PUBLIC_MAKER_POOL_FACTORY_ADDRESS=CDLPUEPZM6BD7M7UA4J2LZSPHNBXHLNHMNKWLJCUL4P345FBDCMNDHMH
NEXT_PUBLIC_USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
NEXT_PUBLIC_EURC_CONTRACT=CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ
NEXT_PUBLIC_ADMIN_ADDRESS=GAL6ZVVRE2RPFS2X23I65QANHHIBGHKTGGVIT5AJURRKTIMEVUMJJUZZ
```

---

## ⚡ Quick Start

### Prerequisites

- **Rust** 1.70+ with `wasm32-unknown-unknown` target
- **Node.js** 20+
- **Stellar CLI** (`cargo install --locked stellar-cli`)
- **MongoDB** (local or Atlas)
- **Freighter** browser extension set to Testnet
- A funded Stellar testnet account ([get funds](https://laboratory.stellar.org/#account-creator?network=test))

### 1. Clone & Install

```bash
git clone https://github.com/anindhabiswas25/hyperdex.git
cd hyperdex
```

### 2. Build Contracts

```bash
# Add wasm target (one-time)
rustup target add wasm32-unknown-unknown

# Build all contracts
cargo build --target wasm32-unknown-unknown --release
```

WASM files land in `target/wasm32-unknown-unknown/release/`:
- `pool_registry.wasm`
- `quote_verifier.wasm`
- `maker_pool.wasm`
- `maker_pool_factory.wasm`
- `fee_distributor.wasm`

### 3. Deploy Contracts (or use existing testnet deployments)

```bash
# Configure stellar identity
stellar keys generate admin --network testnet
stellar keys fund admin --network testnet

export ADMIN_IDENTITY=admin
chmod +x scripts/deploy-v2.sh
./scripts/deploy-v2.sh
# Contract addresses auto-written to backend/.env and frontend/.env.local
```

Or skip deployment and use the already-deployed testnet contracts from the [Deployed Contracts](#-deployed-contracts) section.

### 4. Run the Backend

```bash
cd backend
npm install

# Copy and fill in environment variables
cp .env.example .env   # edit MONGODB_URI

# Development
npm run dev
# → Server listening on port 4000
# → MongoDB connected

# Production (Render)
npm run build && npm start
```

### 5. Run the Frontend

```bash
cd frontend
npm install

# Development
npm run dev
# → Ready on http://localhost:3000

# Production build
npm run build && npm start
```

### 6. Register as a Maker

```bash
cd maker-sdk
npm install
npm run setup   # interactive wizard — generates keypair, registers signer key
npm run dev     # start pricing server
```

Then complete the on-chain pool deployment via `http://localhost:3000/maker`.

### 7. Execute a Test Swap

1. Open `http://localhost:3000/swap` in your browser
2. Connect Freighter (taker account)
3. Select **EURC → USDC**, enter `20`
4. Click **Swap** → approve in Freighter
5. Watch the confirmation toast appear in ~5–15 seconds

---

## 🧪 Testing

### Smoke Test (14 steps)

```bash
chmod +x scripts/smoke-test.sh
./scripts/smoke-test.sh
```

The smoke test covers:
1. Backend health check
2. Maker SDK connectivity
3. Price level streaming
4. Quote request (EURC → USDC, 20 units)
5. Quote expiry validation
6. Replay protection
7. Vault balance check
8. Swap execution on-chain
9. Confirmation polling
10. Trade push to maker SDK
11. Rate limit enforcement
12. Admin approval flow
13. Signer key rotation
14. Pool balance verification after swap

### Manual E2E Flow

See `HYPERDEX_E2E_FLOW.md` for a step-by-step guide with expected outputs for each phase.

### API Testing

```bash
# Health check
curl https://hyperdex.onrender.com/health

# Request a quote (20 EURC → USDC)
curl -X POST https://hyperdex.onrender.com/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":      "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
    "tokenOut":     "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "amountIn":     "200000000",
    "takerAddress": "G..."
  }'

# List connected makers
curl https://hyperdex.onrender.com/api/makers
```

---

## 🔐 Security Notes

> **This is a testnet MVP.** The following caveats apply before mainnet deployment.

| Area | Current State | Production Recommendation |
|---|---|---|
| **Signer key storage** | ed25519 secret in `maker-sdk/.env` | HSM or KMS-backed key management |
| **Admin key** | Single Stellar keypair | Migrate to multisig (e.g. Stellar threshold signatures) |
| **Audit** | Not audited | Full audit by OtterSec / Halborn before mainnet |
| **Replay protection** | `quote_id` stored in Soroban persistent storage | Confirmed — enforced on-chain |
| **Quote expiry** | 30 seconds, enforced on-chain via `ledger().timestamp()` | Confirmed — cannot be bypassed |
| **Vault access** | `execute_swap` requires `require_auth()` from `quote_verifier` | Confirmed — direct calls impossible |
| **Rate limiting** | Maker-side, enforced in SDK + backend MongoDB | Move to contract-level limit for stronger guarantees |
| **Persistent TTL** | Extended on every deposit/withdraw | Confirmed — all storage entries bumped per-interaction |
| **Front-running** | Sealed-bid: quote sealed until `execute_quote` TX lands | Confirmed by design — price never on-chain before settlement |

---

## 📈 Roadmap

### Phase 1 — Testnet MVP (Current ✅)
- [x] 5 Soroban contracts deployed on Stellar testnet
- [x] Sealed-bid RFQ architecture — zero slippage, no front-running
- [x] WebSocket-based maker SDK with ed25519 signing
- [x] Automated pricing via CoinGecko oracle (ghost pricer)
- [x] Multi-step maker onboarding dashboard
- [x] Admin panel — maker application review + API key management
- [x] Trade confirmation push service (WebSocket, retries for 5 min)
- [x] Per-taker rate limiting by maker
- [x] 14/14 smoke tests passing

### Phase 2 — Protocol Maturation
- [ ] Multiple token pairs (XLM/USDC, BTC/USDC via wrapped assets)
- [ ] Multiple concurrent makers with auction-based best-quote selection
- [ ] On-chain rate limiting (contract-level enforcement)
- [ ] Maker reputation scoring (fill rate, latency, cancellation rate)
- [ ] taker partial fills — split across multiple makers
- [ ] Quote streaming (WebSocket quote updates instead of polling)

### Phase 3 — Advanced Features
- [ ] Mainnet deployment
- [ ] Professional market maker integrations (API docs + SDK packaging)
- [ ] Protocol governance — fee parameter voting
- [ ] Maker insurance fund — slashing for quote non-fulfillment
- [ ] Cross-chain RFQ — USDC on Stellar ↔ USDC on EVM chains

### Phase 4 — Ecosystem
- [ ] Public maker registration (permissionless after audit)
- [ ] SDK published to npm (`@hyperdex/maker-sdk`)
- [ ] REST API for taker integrations (aggregators, wallets)
- [ ] Institutional maker toolkit — inventory management, PnL reporting

---

## 🛠 Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Smart Contracts | Rust + Soroban SDK | latest |
| Blockchain | Stellar Testnet (Soroban) | — |
| Contract CLI | Stellar CLI | latest |
| Backend Runtime | Node.js | 20+ |
| API Framework | Express | 4.x |
| WebSocket | `ws` | 8.x |
| Database | MongoDB (Atlas) | 6.x |
| Maker SDK | Node.js + TypeScript | — |
| ed25519 signing | `tweetnacl` | 1.x |
| XDR serialization | `@stellar/stellar-sdk` | 15.x |
| Price Oracle | CoinGecko API | — |
| Frontend | Next.js (App Router) | 14 |
| Styling | Tailwind CSS | 3.x |
| Wallet | Freighter (browser extension) | — |
| Language | TypeScript | 5.x |
| Deployment (frontend) | Vercel | — |
| Deployment (backend) | Render | — |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Build contracts: `cargo build --target wasm32-unknown-unknown --release`
4. Run the smoke test: `./scripts/smoke-test.sh` — all 14 steps must pass
5. Run TypeScript checks: `npx tsc --noEmit` in `backend/` and `frontend/`
6. Submit a pull request with a clear description of the change

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built for the Stellar ecosystem

**HyperDEX — Where Off-Chain Pricing Meets On-Chain Settlement | Built on Stellar Soroban**

[Live App](https://hyperdex-psi.vercel.app) · [Backend API](https://hyperdex.onrender.com/health) · [GitHub](https://github.com/anindhabiswas25/hyperdex)

</div>
