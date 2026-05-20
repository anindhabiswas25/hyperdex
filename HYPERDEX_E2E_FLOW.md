# HyperDex — End-to-End Flow Guide
**Network:** Stellar Testnet | **Test:** 20 EURC → USDC swap

---

## Quick Reference

### Service URLs
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend | http://localhost:4000 |
| Maker SDK | http://localhost:3001 |
| Explorer | https://stellar.expert/explorer/testnet |

### Accounts (Testnet only — never use on mainnet)
| Role | Stellar Address | Secret Key |
|------|----------------|------------|
| Market Maker | `GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726` | `SDLZVHAQNYI4OGE5BOIZLUEVOLCDT466MGZX37ICQBNE63WWTC53CWOC` |
| Taker (User) | `GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A` | `SCHRXIECOQTPZJ4SRJ4EXBT5V6XD3NGAFOIPCS7BQJSAHAAJC3IH2SBY` |

### Contract Addresses
| Contract | Address |
|----------|---------|
| pool_registry | `CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7` |
| vault | `CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB` |
| quote_verifier | `CDBLP52CBG4D6IG26DGTO7G3APVU3UZAZXTXC52V6LK4H4WXFYOBDZSC` |
| USDC SAC | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| EURC SAC | `CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X` |

### Maker Credentials
| Key | Value |
|-----|-------|
| Maker API Key | `sk_live_REDACTED_SEE_ADMIN_DASHBOARD` |
| Signer public key (ed25519 hex) | `f89265fbd7803601eb3a50a830f7ac0b3e5a3c490ec9705058e3a83311eca9d7` |
| Signer private key (ed25519 hex) | `cd171106b70bb9175e7887f19d06b5dc40ca19127bf3d2541a88f6fb3113847e` |

---

## PHASE 0 — Prerequisites

### 0.1 — Install Freighter Wallet
1. Install the Freighter browser extension: https://www.freighter.app
2. Open Freighter → Settings → Network → select **Testnet**

### 0.2 — Start All Services

Open three separate terminals:

**Terminal 1 — Backend**
```bash
cd /home/asus/Project/HyperDex/backend
npm run dev
```
Expected: `Server listening on port 4000`, `MongoDB connected`

**Terminal 2 — Maker SDK**
```bash
cd /home/asus/Project/HyperDex/maker-sdk
npm run dev
```
Expected: `Maker server listening on port 3001`, `Connected to backend WS`, `Price oracle initialized`

**Terminal 3 — Frontend**
```bash
cd /home/asus/Project/HyperDex/frontend
npm run dev
```
Expected: `Ready on http://localhost:3000`

### 0.3 — Verify All Services Are Up
```bash
curl http://localhost:4000/health
```
Expected response:
```json
{
  "status": "ok",
  "activeMakers": 1,
  "priceBookEntries": 1,
  "dbStatus": "connected"
}
```

If `activeMakers` is 0, the maker SDK is not connected — check Terminal 2 logs.

---

## PHASE 1 — Market Maker Registration

The maker must be registered in two places: **on-chain** (pool_registry contract) and **off-chain** (backend MongoDB for WebSocket auth + API key).

> **Already done?** If `activeMakers: 1` appeared in Phase 0.3, the maker is registered and connected. Skip to [verify registration](#verify-registration-status) and proceed to Phase 2.

---

### Step 1A — Register On-Chain via Frontend

This writes the maker's signing key to the `pool_registry` Soroban contract so the contract can verify quotes later.

1. Open http://localhost:3000/maker in your browser
2. Click **Connect Wallet** — Freighter popup appears
3. Import the maker account if not already in Freighter:
   - Freighter → Account menu → Import Account
   - Paste secret: `SDLZVHAQNYI4OGE5BOIZLUEVOLCDT466MGZX37ICQBNE63WWTC53CWOC`
4. Select the maker account and click Connect
5. On the dashboard, click the **Register** tab
6. In the **Signer Key** field, paste:
   ```
   f89265fbd7803601eb3a50a830f7ac0b3e5a3c490ec9705058e3a83311eca9d7
   ```
7. Click **Register Market Maker**
8. Freighter popup appears — verify:
   - Network: Testnet
   - Contract: `CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7`
9. Click **Approve**

Expected: Success toast appears within 10–15 seconds. The maker is now registered on-chain.

> **Alternative (script):** If the frontend is unavailable, run:
> ```bash
> cd /home/asus/Project/HyperDex/backend
> MAKER_SECRET_KEY=SDLZVHAQNYI4OGE5BOIZLUEVOLCDT466MGZX37ICQBNE63WWTC53CWOC \
> SIGNER_PUBLIC_KEY=f89265fbd7803601eb3a50a830f7ac0b3e5a3c490ec9705058e3a83311eca9d7 \
> NODE_PATH=./node_modules npx ts-node --transpile-only --project tsconfig.json ../scripts/register-maker-onchain.ts
> ```

---

### Step 1B — Register in Backend DB & Get API Key

This creates the maker's MongoDB record and generates the API key used for WebSocket authentication.

```bash
cd /home/asus/Project/HyperDex/backend
NODE_PATH=./node_modules npx ts-node --transpile-only --project tsconfig.json ../scripts/register-maker-mongodb.ts
```

Expected output:
```
=== MAKER REGISTERED ===
Address: GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726
API Key: sk_live_...
========================
```

**Copy the API key** — it is shown only once. The key for this session is:
```
sk_live_REDACTED_SEE_ADMIN_DASHBOARD
```

> Re-running the script generates a **new** key and invalidates the old one.

---

### Step 1C — Configure Maker SDK `.env`

The file at `maker-sdk/.env` must contain the API key from Step 1B. Current contents:

```env
MAKER_ADDRESS=GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726
SIGNER_PRIVATE_KEY=cd171106b70bb9175e7887f19d06b5dc40ca19127bf3d2541a88f6fb3113847e
PORT=3001
MAKER_NAME=HyperDEX MM
USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
EURC_CONTRACT=CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X
BACKEND_WS_URL=ws://localhost:4000/ws/maker
MAKER_API_KEY=sk_live_REDACTED_SEE_ADMIN_DASHBOARD
```

If you generated a new API key in Step 1B, update `MAKER_API_KEY` and restart the maker SDK (Terminal 2).

---

### Step 1D — Verify Maker SDK is Connected

```bash
# Maker SDK is alive
curl http://localhost:3001/health
```
Expected:
```json
{
  "status": "ok",
  "maker": "GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726",
  "public_key": "f89265fbd7803601eb3a50a830f7ac0b3e5a3c490ec9705058e3a83311eca9d7"
}
```

```bash
# Backend sees the maker connected via WebSocket
curl http://localhost:4000/api/makers
```
Expected: one maker entry with `"connectionStatus": "connected"`

---

### Verify Registration Status

Skip Steps 1A–1D and run these two checks if you think the maker is already registered:

```bash
# On-chain check — should return the maker's registration data
curl http://localhost:4000/health | python3 -m json.tool
# activeMakers >= 1 means registered + connected

# Off-chain check
curl http://localhost:4000/api/makers
# connectionStatus: "connected" means WebSocket is live
```

---

## PHASE 2 — Vault Deposit

The vault holds the maker's inventory. For the 20 EURC → USDC swap, the vault needs **USDC** (the taker pays EURC, the vault pays USDC).

### Step 2A — Check Current Vault Inventory

```bash
curl http://localhost:4000/api/makers/GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726/inventory
```

Expected (current state):
```json
{
  "balances": {
    "usdc": "10000000000",
    "eurc": "0"
  }
}
```

`10000000000` stroops = **1000 USDC** — sufficient for the 20 EURC → USDC test. No deposit needed.

---

### Step 2B — Deposit USDC (only if vault is depleted)

**Via frontend:**
1. Ensure maker account is active in Freighter
2. Go to http://localhost:3000/maker → **Inventory** tab
3. Click **Deposit** under USDC
4. Enter amount (e.g. `500`) and click Deposit
5. Approve in Freighter — wait ~10s for confirmation

**Via script (if frontend unavailable):**
```bash
cd /home/asus/Project/HyperDex/backend
MAKER_SECRET_KEY=SDLZVHAQNYI4OGE5BOIZLUEVOLCDT466MGZX37ICQBNE63WWTC53CWOC \
USDC_CONTRACT_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA \
EURC_CONTRACT_ADDRESS=CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X \
VAULT_CONTRACT_ADDRESS=CAJBOJRTSXS7CLNOSMO23D2MFXKGKTL3XVQH56H5HKPD6V7SHAHT7SSB \
NODE_PATH=./node_modules npx ts-node --transpile-only --project tsconfig.json ../scripts/deposit-vault-inventory.ts
```

The script deposits **1000 USDC** by default (approve + deposit = 2 on-chain transactions, ~30s total).

---

### Step 2C — Get EURC for the Taker

The taker account needs at least 20 EURC to execute the swap.

1. Go to **https://faucet.circle.com/**
2. Select network: **Stellar**
3. Select asset: **EURC**
4. Enter taker address: `GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A`
5. Click Request — Circle sends EURC to the testnet address (usually under 1 minute)

Verify the taker received EURC:
```bash
curl -s "https://horizon-testnet.stellar.org/accounts/GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A" \
  | python3 -c "import sys,json; b=[x for x in json.load(sys.stdin)['balances'] if 'EURC' in str(x)]; print(b)"
```

Expected: entry showing EURC balance ≥ 20.

---

## PHASE 3 — User Swap (20 EURC → USDC)

### Step 3A — Pre-flight API Check

Confirm the full quoting pipeline works before opening the browser:

```bash
curl -X POST http://localhost:4000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":  "CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X",
    "tokenOut": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "amountIn": "200000000",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"
  }'
```

`200000000 stroops = 20 EURC`

Expected response (HTTP 200):
```json
{
  "success": true,
  "quote": {
    "quoteId": "...",
    "makerAddress": "GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A",
    "tokenIn":  "CDOIV56NSBNVNZN4XPTOT7JVRK6AW4RUISEPYUZYIIKMVIY7X3OH4S5X",
    "tokenOut": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "amountIn": "200000000",
    "amountOut": "~218000000",
    "signature": "<128 hex chars>",
    "makerName": "HyperDEX MM"
  }
}
```

Check: `signature` is exactly 128 hex characters, `amountOut > 0`.
If HTTP 503 "No liquidity" → maker SDK is not connected (re-check Phase 1D).

---

### Step 3B — Switch to Taker Account in Freighter

1. Open Freighter → click the account name at the top
2. Select **Import Account**
3. Paste secret key: `SCHRXIECOQTPZJ4SRJ4EXBT5V6XD3NGAFOIPCS7BQJSAHAAJC3IH2SBY`
4. Confirm the address shown is: `GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A`
5. Make sure Freighter is still on **Testnet**

---

### Step 3C — Execute the Swap in the Frontend

1. Open http://localhost:3000/swap
2. Click **Connect Wallet** — Freighter connects the taker account
3. Confirm the address shown ends in `...HEP5A` and EURC balance ≥ 20

4. In **"You Pay"**: click the token selector → choose **EURC**
5. Type `20` in the amount field
6. In **"You Receive"**: click the token selector → choose **USDC**

7. Wait 1–2 seconds — the quote auto-fetches from the backend

8. Verify the quote details panel shows:
   - Rate: 1 EURC ≈ 1.09 USDC (live rate, will vary)
   - Amount out: ~21.8 USDC
   - Countdown timer: 30 seconds

9. Click **Swap**

10. Review the confirmation modal:
    - "You Pay: 20 EURC"
    - "You Receive: ~21.8 USDC (guaranteed)"
    - "No slippage. Price guaranteed by market maker."

11. Click **Confirm**

12. Freighter popup appears — verify before approving:
    - Network: **Testnet**
    - Contract called: `CDBLP52CBG4D6IG26DGTO7G3APVU3UZAZXTXC52V6LK4H4WXFYOBDZSC` (quote_verifier)
    - Fee: less than 1 XLM

13. Click **Approve** in Freighter

---

### Step 3D — Watch the Swap Complete

Expected sequence after approval:
- Swap button changes to **"Confirming on Stellar..."** with a spinner
- After 5–15 seconds: success toast appears — **"Swap confirmed!"**
- Toast contains a link to the Stellar explorer

Expected balance changes:
- EURC: decreases by 20
- USDC: increases by ~21.8

If the quote timer expires before you click Confirm, close the modal and wait for the auto-refresh (25 seconds) or change the amount by 1 and back to trigger a fresh quote.

---

### Step 3E — Verify On-Chain

Click the explorer link in the success toast, or check directly:

```bash
# Most recent trade in the backend
curl http://localhost:4000/api/trades?limit=1 | python3 -m json.tool
```

Expected:
```json
{
  "trades": [{
    "status": "confirmed",
    "amountIn": "200000000",
    "amountOut": "~218000000",
    "txHash": "..."
  }]
}
```

Check the TX on explorer:
```
https://stellar.expert/explorer/testnet/tx/<txHash>
```

Expected: TX Status = **SUCCESS**, contract invoked = `quote_verifier`.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `activeMakers: 0` in health | Maker SDK not connected | Restart `npm run dev` in maker-sdk; check `MAKER_API_KEY` in `.env` matches MongoDB |
| `503 No liquidity` on quote | Maker SDK down or no price levels | Check `curl localhost:3001/health`, restart SDK |
| Freighter shows "Simulation failed" | Quote expired or vault empty | Wait for fresh quote; run deposit script to refill USDC |
| EURC balance shows 0 | Circle faucet not processed | Wait 1–2 min, refresh Freighter, check explorer for incoming EURC |
| Quote countdown jumps to expired immediately | System clock skew | Restart maker SDK; expiry is set to +30s from maker's clock |
| "Wrong network" warning in frontend | Freighter on Mainnet | Freighter → Settings → Network → Testnet |
| TX succeeds but status stays "submitted" | Backend confirmation poller catching up | Wait 30s; poll `GET /api/trades/<quoteId>/status` |

---

## Flow Summary

```
MAKER SIDE
──────────
1. Register on-chain  →  pool_registry contract stores signer pubkey
2. Register in DB     →  MongoDB stores maker + issues API key
3. Configure SDK      →  maker-sdk/.env gets MAKER_API_KEY
4. Start SDK          →  SDK connects via WebSocket, sends price levels every 1s

VAULT
─────
5. Check USDC balance →  10000000000 stroops (1000 USDC) already deposited
6. (Optional) top up  →  frontend Deposit UI or deposit-vault-inventory.ts script

USER SIDE
─────────
7. Get EURC           →  Circle testnet faucet → taker address
8. Open /swap         →  select EURC → USDC, enter 20
9. Quote auto-fetches →  backend dispatches RFQ to maker via WS (750ms timeout)
10. Maker responds    →  signs quote with ed25519 signer key
11. User confirms     →  Freighter signs execute_quote TX
12. On-chain settle   →  quote_verifier validates signature, transfers tokens
13. Backend confirms  →  trade status updated to "confirmed"
```

---

*Network: Stellar Testnet — do not use real funds*
*Accounts file: `/home/asus/Project/HyperDex/scripts/testnet-accounts.json`*
