# HyperDEX — End-to-End Maker Flow

Complete guide for running the full maker registration-to-trading test flow on Stellar Testnet.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| Rust + `wasm32-unknown-unknown` | `rustup target add wasm32-unknown-unknown` |
| Stellar CLI | `cargo install --locked stellar-cli` |
| MongoDB | Running on `localhost:27017` |
| Freighter Wallet | Browser extension, funded testnet account |

Fund two testnet accounts at https://laboratory.stellar.org/#account-creator?network=test:
- **MAKER** — the account that will register and trade
- **TAKER** — the account that will request swaps (or reuse MAKER)

---

## Phase 0 — Deploy Contracts (once per environment)

```bash
cd /home/asus/Project/HyperDex
chmod +x scripts/deploy-v2.sh
./scripts/deploy-v2.sh
```

This script:
1. Builds all contracts (`maker_pool`, `maker_pool_factory`, `pool_registry`, `quote_verifier`, `fee_distributor`)
2. Deploys and initializes them in dependency order
3. Writes all new addresses into `backend/.env` and `frontend/.env.local`
4. Removes stale `VAULT_CONTRACT_ADDRESS` references

After the script completes, confirm these env vars are set:

**`backend/.env`**
```
MAKER_POOL_FACTORY_ADDRESS=C...
POOL_REGISTRY_CONTRACT_ADDRESS=C...
QUOTE_VERIFIER_CONTRACT_ADDRESS=C...
FEE_DISTRIBUTOR_CONTRACT_ADDRESS=C...
PROTOCOL_FEE_BPS=10
```

**`frontend/.env.local`**
```
NEXT_PUBLIC_MAKER_POOL_FACTORY_ADDRESS=C...
NEXT_PUBLIC_POOL_REGISTRY_CONTRACT=C...
NEXT_PUBLIC_QUOTE_VERIFIER_CONTRACT=C...
```

---

## Phase 1 — Start Backend

```bash
cd /home/asus/Project/HyperDex/backend
npm install
npm run dev
# → Listening on :4000
```

Verify:
```bash
curl http://localhost:4000/api/health
# → { "status": "ok" }
```

---

## Phase 2 — Start Frontend

```bash
cd /home/asus/Project/HyperDex/frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Phase 3 — Maker Registration (via Admin)

### 3a. Open Admin Panel

Navigate to `http://localhost:3000/admin`. Use the admin Stellar address from `backend/.env` (`ADMIN_ADDRESS`) connected via Freighter.

### 3b. Approve Maker Application

1. Connect Freighter as the **MAKER** account
2. Go to `http://localhost:3000/maker`
3. Click **Apply to Become a Maker** — fill in name and description, submit
4. Switch Freighter to the **ADMIN** account
5. In `/admin`, find the pending application and click **Approve**

The maker's status in MongoDB is now `approved`.

---

## Phase 4 — SDK Setup (generates keypair + registers signer key)

```bash
cd /home/asus/Project/HyperDex/maker-sdk
npm install
npm run setup
```

The setup wizard will:
1. Prompt for: MAKER Stellar address, backend URL (`http://localhost:4000`), API key (leave blank for now — press Enter)
2. Generate an Ed25519 keypair (signer public key + secret)
3. Write credentials to `~/.hyperdex/maker-credentials.json`
4. Call `POST /api/makers/register-signer-key` — the backend stores the signer public key in MongoDB

**Expected output:**
```
✓ Signer key generated
  PUBLIC KEY:  <64 hex chars>
  SECRET KEY:  <64 hex chars> (keep safe!)

✓ Signer key registered with backend
  → Pool deployment form pre-filled on /maker
```

---

## Phase 5 — Deploy Pool Contract (frontend)

1. Connect Freighter as the **MAKER** account
2. Go to `http://localhost:3000/maker` — page shows **Step 3: Deploy Pool Contract**
3. The signer public key is auto-filled (from Step 4)
4. Click **Deploy Pool** — Freighter opens for ONE signature
5. Wait for Stellar confirmation (~5–30 s)
6. Page auto-advances to **Step 4: Deposit Inventory**

Verify the pool address in the **Overview** tab under "Pool Contract".

---

## Phase 6 — Deposit Inventory (two-TX flow)

In **Step 4: Deposit Inventory** (or go to the **Inventory** tab after activation):

1. Select token: `USDC`
2. Enter amount: e.g. `100`
3. Click **Deposit (2 txs)**
   - Freighter opens: **TX 1 — Approve** (token.approve → pool)
   - Freighter opens: **TX 2 — Deposit** (pool.deposit)
4. Repeat for `EURC` (e.g. `100`)

After both deposits, the page shows the pool as funded and auto-advances to **Step 5: Start SDK**.

---

## Phase 7 — Start the Maker SDK

```bash
cd /home/asus/Project/HyperDex/maker-sdk
npm run dev
```

**Expected banner:**
```
════════════════════════════════════════
  HYPERDEX MAKER SDK  ·  TESTNET
  Maker:   <your-name>
  Address: G...
  Pool:    C...
  USDC:    100.00   EURC:  100.00
════════════════════════════════════════
[WS] Connected to ws://localhost:4000/ws
[PriceLevels] Sent: 3 sell levels, 3 buy levels (USDC/EURC)
```

The `/maker` page Overview tab shows **SDK Online — streaming price levels**.

---

## Phase 8 — Execute a Swap (taker flow)

1. Connect Freighter as the **TAKER** account
2. Go to `http://localhost:3000/swap`
3. Select: **USDC → EURC**, amount `10`
4. Click **Get Quote** — the backend dispatches an RFQ to the maker SDK
5. The SDK responds within 3 seconds with a signed quote
6. Click **Execute Swap** — Freighter signs the `execute_quote` TX
7. Wait for Stellar confirmation

**Backend terminal shows:**
```
[RfqRouter] Dispatched RFQ to maker <id>
[RfqRouter] Quote received from maker <id>
[ConfirmationPoller] TX confirmed: <hash>
[TradePushService] Notified maker of confirmed trade <tradeEventId>
```

**SDK terminal shows:**
```
╔══════════════════════════════════════╗
║       TRADE CONFIRMED                ║
║  USDC→EURC  10 → 9.95 EURC          ║
║  Taker: G...                         ║
║  TX: <hash>                          ║
╚══════════════════════════════════════╝
[TradeAck] Acknowledged trade <tradeEventId>
```

---

## Phase 9 — Verify Dashboard

Go to `http://localhost:3000/maker`:

- **Overview** tab: 24h Trades = 1, pool balances updated
- **Inventory** tab: USDC balance decreased, EURC increased (from maker's perspective: sold USDC, received EURC from taker)
- **History** tab: trade appears with status `confirmed`
- **Rate Limits** tab: empty (no limits yet)

---

## Phase 10 — Test Rate Limiting

Trigger 11+ RFQ requests rapidly from the same taker (e.g. using the swap page). After the 11th:

- The maker SDK logs `[RateLimit] Auto-limited taker G... for 5 minutes`
- The maker sends `rfqError { reason: "rate_limit", expiryTimestampMs: ... }` to backend
- The backend stores the limit in `RateLimitStore`
- **Rate Limits** tab in dashboard shows the taker with remaining countdown

The taker sees an error message on the swap page: "No makers available".

---

## Phase 11 — Test Graceful Disconnect

Press `Ctrl+C` in the SDK terminal:

```
[WS] Graceful disconnect — sending empty price levels
[WS] Connection closed
```

- The backend removes the maker from all price book entries
- The `/maker` Overview tab switches to **SDK Offline** (yellow indicator)
- Any concurrent RFQ attempts route to other makers (or return "No makers available")

---

## Phase 12 — Verify Pool Balances On-Chain

Check the pool contract directly on the testnet explorer:

```
https://stellar.expert/explorer/testnet/contract/<POOL_ADDRESS>
```

Or via the backend:
```bash
curl http://localhost:4000/api/makers/<MAKER_ADDRESS>/inventory
```

Expected response:
```json
{
  "success": true,
  "vault": { "usdc": "90.00", "eurc": "109.95" },
  "wallet": { "usdc": "0.00", "eurc": "0.00", "xlm": "..." },
  "poolAddress": "C...",
  "poolDeployed": true
}
```

---

## Contract Addresses (Testnet — update after deploy-v2.sh)

| Contract | Address |
|---|---|
| USDC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| EURC | `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ` |
| PoolRegistry | `CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7` |
| QuoteVerifier | *(set by deploy-v2.sh)* |
| MakerPoolFactory | *(set by deploy-v2.sh)* |
| FeeDistributor | *(set by deploy-v2.sh)* |
| MakerPool (per-maker) | *(deployed in Phase 5, shown in dashboard)* |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/maker` stuck on "Checking maker status…" | Backend not running or wrong `NEXT_PUBLIC_BACKEND_URL` |
| "No makers available" on swap | SDK not running, or pool not funded |
| Freighter shows simulation error on Deploy Pool | Signer key not registered (re-run `npm run setup`) |
| Pool balances show 0 after deposit | Re-check Stellar confirmation; try `refetch` |
| Rate Limits tab empty after 11 RFQs | Ensure taker address matches; check backend logs for `setLimit` |
| Trade push not received by SDK | Check WebSocket connection in SDK logs; `TradePushService` retries every 30s for 5 min |
