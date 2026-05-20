# HyperDEX Maker SDK

Market making on HyperDEX — Stellar Soroban RFQ DEX.

## Getting Started

### Step 1 — Install

```bash
npm install
```

### Step 2 — Generate your keypair

```bash
npm run setup
```

Generates your signing keypair and collects your identity (Stellar address + display name).
At the end it shows you exactly what to send your admin. **No API key needed yet.**

### Step 3 — Send your admin

After setup, send your admin:
- Your **public key** (shown at end of setup)
- Your **Stellar address** (G...)
- Your **display name**

Your admin will:
1. Register you in the database and generate an API key
2. Register you on-chain in the pool_registry contract
3. Send you back the API key (`sk_live_...`)

### Step 4 — Activate with your API key

Once you receive your API key from the admin:

```bash
npm run activate
```

Enters your API key, verifies it against the backend, and completes your `.env` configuration.

### Step 5 — Start your maker server

```bash
npm run dev
```

You are live. Your server streams price levels and responds to RFQ quotes automatically.

---

## Complete Flow

```
MAKER RUNS:
  npm install
  npm run setup

WIZARD OUTPUTS:
  ✓ Step 1 Complete

  Send your admin:
    PUBLIC KEY: f0a725f3...
    ADDRESS:    G...
    NAME:       AlphaMaker

  Once you receive your API key, run:
    npm run activate

─── MAKER CONTACTS ADMIN ──────────────────────────────

ADMIN DOES (in HyperDEX admin dashboard /admin):
  Opens Register Maker tab
  Fills in: name, address, public key
  Clicks: Register in Database → gets sk_live_... key
  Sends maker: sk_live_a8f3b2...

─── MAKER RECEIVES API KEY ────────────────────────────

MAKER RUNS:
  npm run activate

WIZARD ASKS:
  ? API key from your admin: sk_live_a8f3b2...
  ? Backend WebSocket URL: ws://localhost:4000/ws/maker
  ? Port: 3001

WIZARD OUTPUTS:
  ✓ API key verified
  ✓ Activation complete

  Start your maker server:
    npm run dev

MAKER RUNS:
  npm run dev

MAKER IS LIVE.
```

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Part 1: generate keypair, collect identity, write partial `.env` |
| `npm run activate` | Part 2: enter API key, verify with backend, complete `.env` |
| `npm run dev` | Start the maker server (requires completed `.env`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Run compiled server |
| `npm run keypair` | Standalone keypair generator (advanced) |

## What gets configured

| Setting | Set by | Command |
|---------|--------|---------|
| Signing keypair | Generated automatically | `npm run setup` |
| Stellar address | You type it | `npm run setup` |
| Maker name | You type it | `npm run setup` |
| API key | Admin provides it | `npm run activate` |
| Backend URL | You confirm | `npm run activate` |
| Token contracts | Pre-configured for testnet | — |

## Security

- The **private key** is written to `.env` with mode `600` (owner read/write only) and is **never printed to the terminal**
- The **API key** is only entered during `npm run activate` and stored in `.env`
- Never commit `.env` to version control — it is excluded by `.gitignore`

## API Endpoints (at runtime)

### GET /health
```json
{ "status": "ok", "maker": "G...", "public_key": "<64-hex>" }
```

### POST /quote
Request: `{ "token_in", "token_out", "amount_in", "taker" }`
Response: signed quote with `signature` (128 hex chars)

## Customizing Pricing

Edit `src/example-pricer.ts` to implement your own pricing strategy. The example uses a CoinGecko price oracle with a 0.2% spread.
