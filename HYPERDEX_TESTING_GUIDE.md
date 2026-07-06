# HyperDEX E2E Testing Guide
**Network:** Stellar Testnet
**Version:** v1.0.0-testnet

## Local Service URLs
| Service    | URL                        |
|------------|----------------------------|
| Frontend   | http://localhost:3000       |
| Backend    | http://localhost:4000       |
| Maker SDK  | http://localhost:3001       |
| Testnet Explorer | https://stellar.expert/explorer/testnet |

## Contract Addresses
| Contract        | Address |
|-----------------|---------|
| pool_registry   | `CA6HM3OXPWVKJ2GOJV7JXXPYG2GXYHL3DI6QRTUZ5FN4KJGP4MSOFWCP` |
| quote_verifier  | `CA5VBADGOYSM4RXZPNA57GQYISA5DF3RDOHNYDXYYYGQDJJVW47TXIVN` |
| maker_pool_factory | `CBDOO3W2VUUN3FEGSHL4PRWQATXFN25NHR555YLPNZ4ZPAQQ4PIQPFV6` |
| fee_distributor | `CCQIZPZD7T2ZFYFTISMJ7GSPLK32L43EXJLHZM7JJX6ERXWO7DURJSYF` |
| USDC SAC        | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| EURC SAC        | `CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ` |

> No shared "vault" — each maker has their own `maker_pool` deployed by the factory.

Issuer (Circle testnet): `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`

## Test Accounts
| Role   | Address | Secret (TESTNET ONLY) |
|--------|---------|----------------------|
| Maker  | `GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726` | `SDLZVHAQNYI4OGE5BOIZLUEVOLCDT466MGZX37ICQBNE63WWTC53CWOC` |
| Taker  | `GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A` | `SCHRXIECOQTPZJ4SRJ4EXBT5V6XD3NGAFOIPCS7BQJSAHAAJC3IH2SBY` |

Maker signer pubkey (Ed25519): `f89265fbd7803601eb3a50a830f7ac0b3e5a3c490ec9705058e3a83311eca9d7`

## Current Vault Inventory
| Token | Vault Balance | Status |
|-------|--------------|--------|
| USDC  | 1000         | ✅ Ready |
| EURC  | 0            | ⚠️ Requires Circle faucet (see below) |

## Before You Start
- [ ] Install Freighter: https://www.freighter.app
- [ ] Set Freighter to **Stellar Testnet** (Settings → Network → Testnet)
- [ ] Import Taker account into Freighter (Import account → paste taker secret key above)
- [ ] Start all 3 services (see commands below)

### Get EURC for Full Bidirectional Testing
EURC (Euro Coin) is a Circle-issued token on Stellar testnet. The vault needs EURC inventory for USDC→EURC swaps, and the taker needs EURC for EURC→USDC swaps.

**Step 1** — Go to https://faucet.circle.com/
**Step 2** — Select **Stellar** network and **EURC** asset
**Step 3** — Get EURC for the maker: `GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726`
**Step 4** — Get EURC for the taker: `GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A`
**Step 5** — Deposit EURC into your maker pool: open `/maker` → **Inventory** tab
→ enter an EURC amount → **Deposit**. This runs the 2-TX `approve` + `deposit`
flow in Freighter. (The old `deposit-vault-inventory.ts` script has been removed;
deposits are frontend-driven now.)

## Start Commands
```bash
# Terminal 1
cd /home/asus/Project/HyperDex/backend && npm run dev

# Terminal 2  (after `npm run setup` creates credentials/<name>.cred)
cd /home/asus/Project/HyperDex/maker-sdk && npm run dev <name>
# built-in ghost-price engine; or a custom one: npm run dev <name> -- --engine=./examples/binance-engine.ts

# Terminal 3
cd /home/asus/Project/HyperDex/frontend && npm run dev
```

---

## SECTION 1 — BACKEND API TESTS

### Test 1.1 — Health Check
```bash
curl http://localhost:4000/health
```
Expected:
```json
{
  "status": "ok",
  "activeMakers": 1,
  "priceBookEntries": 1,
  "dbStatus": "connected"
}
```
Pass: activeMakers >= 1, dbStatus = "connected"

### Test 1.2 — Get Active Makers
```bash
curl http://localhost:4000/api/makers
```
Pass: makers array has at least 1 entry with connectionStatus: "connected"

### Test 1.3 — Quote Request (USDC → EURC)
```bash
curl -X POST http://localhost:4000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "tokenOut": "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
    "amountIn": "10000000",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"
  }'
```
Pass: HTTP 200, signature is exactly 128 chars, amountOut > 0

### Test 1.4 — Quote Request (EURC → USDC)
```bash
curl -X POST http://localhost:4000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":  "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
    "tokenOut": "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "amountIn": "10000000",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"
  }'
```
Pass: HTTP 200, rate is approximately inverse of 1.3

### Test 1.5 — Invalid Token Rejected
```bash
curl -X POST http://localhost:4000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":  "INVALID_ADDRESS",
    "tokenOut": "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
    "amountIn": "10000000",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"
  }'
```
Pass: HTTP 400 VALIDATION_ERROR, not 500

### Test 1.6 — Vault Balance
```bash
curl http://localhost:4000/api/makers/GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726/inventory
```
Pass: usdc balance > 0 (currently 10000000000 stroops = 1000 USDC)

### Test 1.7 — Trade History
```bash
curl http://localhost:4000/api/trades?limit=10
```
Pass: HTTP 200, trades is an array

---

## SECTION 2 — MAKER SDK TESTS

### Test 2.1 — Maker SDK Health
```bash
curl http://localhost:3001/health
```
Expected:
```json
{
  "status": "ok",
  "maker": "GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726",
  "connected": true,
  "midRate": 0.8788,
  "volatility": 0.0,
  "vault": { "usdc": "1000.0000000", "eurc": "0.0000000" },
  "oracle": { "midRate": 0.8788, "volatility": 0.0, "stale": false }
}
```
Pass: status "ok", `connected: true`, `midRate` > 0, `vault` balances present

### Test 2.2 — Price Oracle Live
Start maker SDK and check backend health for priceBookEntries >= 1.
If oracle hits rate limit on CoinGecko, the fallback (open.er-api.com) is used.
Pass: priceBookEntries >= 1 within 5 seconds of maker SDK start

### Test 2.3 — Engine-signed quote via the backend RFQ
The SDK no longer exposes a direct `POST /quote` endpoint. Quotes are produced by
the maker's **engine** (`getQuote()`) and signed only in response to a backend RFQ
auction. Exercise it through the backend (same call as Test 1.3):
```bash
curl -X POST http://localhost:4000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "tokenOut": "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
    "amountIn": "10000000",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"
  }'
```
Pass: HTTP 200, `quote.signature` is exactly 128 hex chars, `amountOut` > 0

### Test 2.4 — Signature Format
From the Test 2.3 response's `quote.signature`:
- signature.length === 128 ✓
- signature matches /^[0-9a-f]{128}$/ ✓

### Test 2.5 — Custom engine loads (optional)
Start the SDK with `npm run dev <name> -- --engine=./examples/binance-engine.ts`.
Pass: startup banner shows `Engine: binance-engine.ts [custom]` and quotes still
sign. A bad `--engine` path must **fall back** to the built-in engine, not crash.
See `maker-sdk/TESTING_ENGINES.md` for the full engine test recipe.

---

## SECTION 3 — FRONTEND USER FLOW TESTS

### Test 3.1 — Page Load
1. Open http://localhost:3000
2. Check no console errors (F12 → Console tab)

Pass: Page renders, no JavaScript errors

### Test 3.2 — Wallet Connection
1. Click "Connect Wallet"
2. Freighter popup → click Connect
3. Approve

Expected:
- Button shows truncated address GABN...EP5A
- USDC balance: ~1000
- EURC balance: ~0 (or amount if Circle faucet was used)

Pass: Address shown, USDC balance non-zero

### Test 3.3 — Quote Fetch (USDC → EURC)
1. Select USDC in "You Pay"
2. Select EURC in "You Receive"
3. Type: 10
4. Wait 1-2 seconds

Expected:
- "You Receive" shows ~8.6 EURC (live rate with spread)
- Quote details panel appears with rate, fee, countdown
- "Swap" button active

Pass: Amount appears, countdown visible

### Test 3.4 — Token Swap Direction
1. Click the swap arrow between inputs

Expected:
- EURC now in "You Pay"
- USDC now in "You Receive"
- Amount clears

Pass: Tokens switch positions

### Test 3.5 — Countdown and Expiry
1. Get a quote
2. Watch countdown timer (30 seconds)
3. At 10s: timer turns red
4. At 0s: expired state

Expected:
- Red at 10s
- "Quote expired" at 0
- "Refresh Quote" button

Pass: All state transitions occur

### Test 3.6 — MAX Button
1. Click MAX next to USDC balance

Pass: Amount field fills with wallet USDC balance (~1000)

### Test 3.7 — Confirmation Modal
1. Type 10 in amount
2. Wait for quote
3. Click "Swap"

Expected modal:
- "You pay: 10 USDC"
- "You receive: X.XX EURC (guaranteed)"
- "No slippage. Price guaranteed by market maker."
- "Confirm" and "Cancel" buttons

Pass: Modal shows correct amounts

### Test 3.8 — Cancel Does Nothing
1. Open modal
2. Click Cancel

Pass: Modal closes, no Freighter popup, no transaction

### Test 3.9 — FULL SWAP EXECUTION (EURC → USDC) ⭐
*Note: This direction requires vault USDC inventory (currently 1000 USDC available).*
*The taker also needs EURC. If the taker has no EURC, get it from https://faucet.circle.com/ first.*

1. Select EURC in "You Pay", USDC in "You Receive"
2. Type: 10
3. Wait for quote
4. Click "Swap"
5. Verify modal amounts
6. Click "Confirm"
7. Freighter popup appears
   - Verify: Network = Testnet
   - Verify: Contract = `CA5VBADGOYSM4RXZPNA57GQYISA5DF3RDOHNYDXYYYGQDJJVW47TXIVN`
   - Verify: Fee < 1 XLM
8. Click "Approve" in Freighter

Expected sequence:
- Button: "Confirming on Stellar..." + spinner
- After ~5-15s: success toast "Swap confirmed!"
- Toast has Stellar explorer link
- EURC balance decreases by 10
- USDC balance increases by ~10.9

On-chain check:
- Click explorer link in toast
- TX status: SUCCESS
- Contract: quote_verifier

Pass: TX confirmed, balances updated

### Test 3.10 — Balance Update
After Test 3.9:
- EURC: reduced by swap amount
- USDC: increased by ~10.9 USDC

Pass: Both balances reflect the swap

### Test 3.11 — Reverse Swap (USDC → EURC) ⭐
*Note: Vault needs EURC inventory. Deposit EURC into vault first (see Pre-Testing section).*

1. Select USDC in "You Pay", EURC in "You Receive"
2. Type: 10
3. Complete full swap

Expected:
- Rate: 1 USDC ≈ 0.86 EURC (live rate)
- Swap confirms on-chain

Pass: Reverse swap confirmed

---

## SECTION 4 — MAKER DASHBOARD TESTS

### Setup
1. Switch Freighter to maker account
   (Import secret: `SDLZVHAQNYI4OGE5BOIZLUEVOLCDT466MGZX37ICQBNE63WWTC53CWOC`)
2. Navigate to http://localhost:3000/maker
3. Connect wallet

### Test 4.1 — Dashboard Loads
Pass: Sidebar visible, maker name "HyperDEX MM" shown

### Test 4.2 — Inventory Display
Click "Inventory" tab

Expected:
- USDC vault: 1000 USDC (reduced if swaps were executed)
- EURC vault: 0 (or amount after Circle faucet + deposit)

Pass: Balances match on-chain vault state

### Test 4.3 — Server Status
Click "Overview" tab

Expected:
- Green dot "Online"
- Last seen: < 1 min ago

Pass: Online status visible

### Test 4.4 — Deposit Flow
1. Click "Inventory"
2. Click "Deposit" under USDC
3. Enter: 50
4. Click "Deposit"
5. Freighter → Approve

Pass: TX confirms, vault USDC increases by 50

### Test 4.5 — Withdraw Flow
1. Click "Withdraw" under USDC
2. Enter: 10
3. Freighter → Approve

Pass: TX confirms, vault USDC decreases by 10

---

## SECTION 5 — SECURITY TESTS

### Test 5.1 — Expired Quote Rejection
1. Get signed quote via Test 1.3 curl
2. Save the full quote JSON
3. Wait 35 seconds
4. Try submitting the quote (either via frontend or directly)

Expected: Contract error "Quote expired"
Pass: On-chain rejection after expiry

### Test 5.2 — Replay Attack Prevention
1. Complete Test 3.9 (save quoteId)
2. Try submitting same quote again via the frontend or Stellar Lab

Expected: Contract error "Quote already used"
Pass: Second submission fails

### Test 5.3 — Wrong Taker Rejection
1. Get a quote addressed to the taker
2. Try to submit from a different wallet (e.g., the maker wallet)

Expected: Auth error or contract rejection
Pass: Only the quoted taker can execute

### Test 5.4 — Excessive Amount
1. Try to quote 5000 USDC (more than vault has in each token direction)

Expected: 503 "No liquidity" or maker rfqError
Pass: Clear error before on-chain submission

---

## SECTION 6 — ERROR STATE TESTS

### Test 6.1 — No Amount Entered
1. Connect wallet
2. Do not type anything

Pass: Button shows "Enter Amount" (disabled, gray)

### Test 6.2 — Wrong Network
1. Switch Freighter to Mainnet
2. Try to use the swap

Pass: Warning shown "Please switch to Stellar Testnet"

### Test 6.3 — Insufficient Balance
1. Type amount larger than wallet balance

Pass: "Insufficient USDC balance" error, Swap disabled

---

## TROUBLESHOOTING

### "Simulation failed" in Freighter
- Vault low on inventory → run deposit script
- Quote expired → wait for fresh quote
- Token address mismatch → check .env files

### "No liquidity available"
- Check: `curl http://localhost:3001/health`
- Maker SDK must show status: "ok"
- Restart maker SDK if needed: `cd maker-sdk && npm run dev <name>`
- If a custom `--engine` won't load, the SDK falls back to the built-in engine and logs why — fix the path (keep the `--` separator)

### Balances showing 0
- Wrong token address in frontend .env.local
- EURC trustline missing (add in Freighter manually)
- Wait 10s and refresh (Stellar RPC can be slow)

### Quote not fetching
- Check: `curl http://localhost:4000/health`
- Backend must be running on port 4000
- Check browser console for CORS errors

### EURC balance is 0
This is expected unless you have used the Circle testnet faucet at https://faucet.circle.com/
(Select Stellar + EURC, provide testnet address).
All EURC-output swaps require vault EURC inventory and taker EURC balance.

---

## QUICK SYSTEM CHECK SCRIPT

Save as: `hyperdex/scripts/check-system.sh`

```bash
#!/bin/bash
echo "=== HyperDEX System Status ==="

echo ""
echo "1. Backend:"
curl -s http://localhost:4000/health | python3 -m json.tool

echo ""
echo "2. Maker SDK:"
curl -s http://localhost:3001/health | python3 -m json.tool

echo ""
echo "3. Quote test (USDC → EURC):"
curl -s -X POST http://localhost:4000/api/quote \
  -H 'Content-Type: application/json' \
  -d '{
    "tokenIn":  "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
    "tokenOut": "CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ",
    "amountIn": "10000000",
    "takerAddress": "GABIRDNI5LREXRZQ7RS34CE7WOWL6ZQSK3UVFJAH4R54P255OSHNEP5A"
  }' | python3 -m json.tool

echo ""
echo "4. Frontend:"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000

echo ""
echo "5. Vault inventory:"
curl -s http://localhost:4000/api/makers/GALNCMRJ2GCQ34RH7L55HZLUCZ3EHDIKPWTNTWDGVJ4FJWCP5GDVA726/inventory | python3 -m json.tool

echo ""
echo "=== Done ==="
```

```bash
chmod +x /home/asus/Project/HyperDex/scripts/check-system.sh
```

---

## SERIALIZATION REFERENCE

The maker signs `sha256(XDR(Quote))` where XDR uses Soroban `#[contracttype]` encoding.

| Property | Value |
|----------|-------|
| Field order | alphabetical: amount_in, amount_out, expiry, maker, quote_id, salt, taker, token_in, token_out |
| XDR byte length | 464 bytes |
| Test vector hash | `ff65f4b0ee5af00d0c3faa902e50be2d1db3ecc4ce5ae963a1d3c0d229822584` |
| Verified by | `cargo test -p quote_verifier test_quote_hash_matches_typescript` |

---

## TEST RESULTS TABLE

Fill in as you test:

| Test  | Description              | Status | Notes | TX Hash |
|-------|--------------------------|--------|-------|---------|
| 1.1   | Health check             |        |       |         |
| 1.2   | Active makers            |        |       |         |
| 1.3   | Quote USDC→EURC          |        |       |         |
| 1.4   | Quote EURC→USDC          |        |       |         |
| 1.5   | Invalid token rejected   |        |       |         |
| 1.6   | Vault balance            |        |       |         |
| 1.7   | Trade history            |        |       |         |
| 2.1   | Maker SDK health         |        |       |         |
| 2.3   | Engine quote via backend |        |       |         |
| 2.5   | Custom engine loads      |        |       |         |
| 3.1   | Page load                |        |       |         |
| 3.2   | Wallet connect           |        |       |         |
| 3.3   | Quote fetch              |        |       |         |
| 3.5   | Countdown expiry         |        |       |         |
| 3.7   | Confirmation modal       |        |       |         |
| 3.9   | ⭐ Full swap EURC→USDC   |        |       |         |
| 3.11  | ⭐ Full swap USDC→EURC   |        |       |         |
| 4.1   | Maker dashboard          |        |       |         |
| 4.2   | Inventory display        |        |       |         |
| 4.4   | Deposit flow             |        |       |         |
| 4.5   | Withdraw flow            |        |       |         |
| 5.1   | Expired quote rejected   |        |       |         |
| 5.2   | Replay prevented         |        |       |         |
| 5.4   | Excessive amount         |        |       |         |
| 6.2   | Wrong network warning    |        |       |         |

---

*Network: Stellar Testnet — TESTNET ONLY — do not use real funds*

*Accounts file: `/home/asus/Project/HyperDex/scripts/testnet-accounts.json`*
