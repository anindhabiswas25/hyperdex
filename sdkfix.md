Fix maker-sdk so everything is fully automatic.
When maker runs npm run dev <name>, it reads all
required values from the credential file which was
written completely by npm run setup.

No manual editing. No missing fields. Ever.

=======================================================
THE EXACT BUG
=======================================================

In setup.ts, the credential file is written BEFORE
or WITHOUT the maker address and pool address being
included in the content string.

The setup output shows:
  ✔ Verified as: Riju (GCTCIR6T…)       ← address IS fetched
  ✔ Pool found: CDK3KFFF...             ← pool IS fetched

But the credential file is missing both values because
the credContent string template does not include them.

This is the ONLY bug. Fix it in setup.ts.

=======================================================
FIX 1 — setup.ts: write ALL fields to credential file
=======================================================

FILE: maker-sdk/src/setup.ts

Find the section where credContent is built.
It currently looks something like this:

  const credContent = [
    `# HyperDEX Maker Credentials — ${makerName}`,
    `MAKER_API_KEY=${apiKey}`,
    `SIGNER_PRIVATE_KEY=${privateKeyHex}`,
    `PORT=${credentials.port}`,
    `BACKEND_WS_URL=${credentials.backendWsUrl}`,
  ].join('\n')

REPLACE it with this complete version:

  const credContent = [
    `# HyperDEX Maker Credentials — ${makerName}`,
    `# Generated: ${new Date().toISOString()}`,
    `# KEEP THIS FILE SECURE — DO NOT COMMIT`,
    ``,
    `# Authentication`,
    `MAKER_API_KEY=${apiKey}`,
    ``,
    `# Signing keypair (ed25519) — NEVER SHARE`,
    `SIGNER_PRIVATE_KEY=${privateKeyHex}`,
    ``,
    `# Maker identity — fetched from backend`,
    `MAKER_ADDRESS=${makerAddress}`,
    ``,
    `# Pool contract — fetched from backend`,
    `POOL_ADDRESS=${poolAddress}`,
    ``,
    `# Network`,
    `PORT=${credentials.port || 3001}`,
    `BACKEND_WS_URL=${credentials.backendWsUrl}`,
    ``,
    `# Token contracts (Stellar Testnet SAC addresses)`,
    `USDC_CONTRACT=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`,
    `EURC_CONTRACT=CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ`,
  ].join('\n')

The variables makerAddress and poolAddress must be
declared BEFORE this line. They come from:

  makerAddress: the verify-key response
    → verifyResponse.data.maker.stellarAddress
    OR verifyResponse.maker.stellarAddress
    (check which shape your verify-key returns)

  poolAddress: the pool fetch response
    → poolRes.data.poolAddress || ''

If poolAddress is empty (pool not deployed yet):
  Write POOL_ADDRESS= (empty value)
  The server.ts startup check will warn the maker
  to deploy their pool first

=======================================================
FIX 2 — server.ts: load env from credential file
=======================================================

FILE: maker-sdk/src/server.ts

The server must load the credential file into
process.env BEFORE any other code runs.

At the very top of server.ts, before any imports
that use process.env:

  import * as path from 'path'
  import * as fs from 'fs'

  // Get credential name from command line arg
  const credentialName = process.argv[2]

  if (credentialName) {
    const credPath = path.join(
      __dirname, '../credentials', `${credentialName}.cred`
    )

    if (!fs.existsSync(credPath)) {
      console.error(`\n  ✗ Credential file not found: ${credPath}`)
      console.error(`  Run: npm run setup\n`)
      process.exit(1)
    }

    // Parse and load credential file into process.env
    const lines = fs.readFileSync(credPath, 'utf8').split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) continue
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      if (key && !process.env[key]) {
        process.env[key] = value
      }
    }

    console.log(`  Loaded credentials: ${credentialName}`)
  }

This runs SYNCHRONOUSLY at startup, before any
inventory checks, oracle starts, or WebSocket connects.
After this block, ALL env vars from the cred file
are available via process.env.MAKER_ADDRESS etc.

NOTE: Do not use dotenv.config() — it does not support
custom file paths cleanly. The manual parse above is
more reliable.

=======================================================
FIX 3 — inventory-checker.ts: use env vars correctly
=======================================================

FILE: maker-sdk/src/inventory-checker.ts

The inventory checker reads MAKER_ADDRESS and
POOL_ADDRESS from process.env. These are now set
by Fix 2 before inventory-checker is ever used.

BUT the problem is that these constants may be read
at MODULE LOAD TIME (top of file) before server.ts
has loaded the credential file.

CHANGE from module-level constants to lazy getters:

WRONG (read at module load — may be undefined):
  const POOL_ADDRESS = process.env.POOL_ADDRESS || ''
  const MAKER_ADDRESS = process.env.MAKER_ADDRESS || ''

CORRECT (read at call time — always current):
  class InventoryChecker {

    private get poolAddress(): string {
      return process.env.POOL_ADDRESS || ''
    }

    private get makerAddress(): string {
      return process.env.MAKER_ADDRESS || ''
    }

    private get usdcContract(): string {
      return process.env.USDC_CONTRACT ||
        'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
    }

    private get eurcContract(): string {
      return process.env.EURC_CONTRACT ||
        'CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ'
    }

    private getBackendHttpUrl(): string {
      const wsUrl = process.env.BACKEND_WS_URL ||
        'ws://localhost:4000/ws/maker'
      return wsUrl
        .replace('wss://', 'https://')
        .replace('ws://', 'http://')
        .replace(/\/ws\/maker.*$/, '')
    }

    async getBalance(): Promise<{ usdc: number; eurc: number }> {
      // Return cache if fresh
      if (this.cache &&
          Date.now() - this.cache.fetchedAt < this.cacheMs) {
        return { usdc: this.cache.usdc, eurc: this.cache.eurc }
      }

      // Try Soroban direct read first
      if (this.poolAddress && this.makerAddress) {
        try {
          const result = await this.readFromSoroban()
          this.cache = { ...result, fetchedAt: Date.now() }
          return result
        } catch (err) {
          console.warn('[Inventory] Soroban read failed:', err)
        }
      }

      // Fallback to backend API
      if (this.makerAddress) {
        try {
          const result = await this.readFromBackend()
          this.cache = { ...result, fetchedAt: Date.now() }
          return result
        } catch (err) {
          // Only log once per minute to avoid spam
          if (!this.lastBackendError ||
              Date.now() - this.lastBackendError > 60_000) {
            console.warn('[Inventory] Backend read failed:', err)
            this.lastBackendError = Date.now()
          }
        }
      } else {
        // Only log this once
        if (!this.loggedMissingConfig) {
          console.error('[Inventory] MAKER_ADDRESS not set in credentials')
          this.loggedMissingConfig = true
        }
      }

      return { usdc: 0, eurc: 0 }
    }

    private async readFromSoroban(): Promise<{
      usdc: number; eurc: number
    }> {
      const StellarSdk = require('@stellar/stellar-sdk')
      const server = new StellarSdk.SorobanRpc.Server(
        'https://soroban-testnet.stellar.org'
      )
      const contract = new StellarSdk.Contract(this.poolAddress)

      const getTokenBal = async (tokenAddr: string): Promise<number> => {
        try {
          const account = await server.getAccount(this.makerAddress)
          const tx = new StellarSdk.TransactionBuilder(account, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: StellarSdk.Networks.TESTNET
          })
          .addOperation(contract.call(
            'get_balance',
            StellarSdk.Address.fromString(tokenAddr).toScVal()
          ))
          .setTimeout(10)
          .build()

          const sim = await server.simulateTransaction(tx)
          if (!StellarSdk.SorobanRpc.Api.isSimulationSuccess(sim))
            return 0
          if (!sim.result?.retval) return 0
          const raw = StellarSdk.scValToNative(sim.result.retval)
          return Number(raw) / 1e7
        } catch {
          return 0
        }
      }

      const [usdc, eurc] = await Promise.all([
        getTokenBal(this.usdcContract),
        getTokenBal(this.eurcContract)
      ])

      console.log(
        `[Inventory] Pool: USDC ${usdc.toFixed(2)} | ` +
        `EURC ${eurc.toFixed(2)}`
      )
      return { usdc, eurc }
    }

    private async readFromBackend(): Promise<{
      usdc: number; eurc: number
    }> {
      const url = `${this.getBackendHttpUrl()}/api/makers/` +
        `${this.makerAddress}/inventory`

      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      })

      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        throw new Error(
          `Non-JSON response from ${url}: ${res.status} ${contentType}`
        )
      }

      const data = await res.json()
      return {
        usdc: parseFloat(data.vault?.usdc || '0'),
        eurc: parseFloat(data.vault?.eurc || '0')
      }
    }

    private cache: {
      usdc: number; eurc: number; fetchedAt: number
    } | null = null
    private cacheMs = 30_000
    private lastBackendError: number = 0
    private loggedMissingConfig = false

    invalidateCache(): void {
      this.cache = null
    }

    async canFill(
      tokenOut: string,
      amountOutStroops: number
    ): Promise<{
      canFill: boolean; balance: number; reason?: string
    }> {
      try {
        const balance = await this.getBalance()
        const isEurc = tokenOut === this.eurcContract
        const available = isEurc ? balance.eurc : balance.usdc
        const required = amountOutStroops / 1e7
        const safeLimit = available * 0.8

        if (required > safeLimit) {
          return {
            canFill: false,
            balance: available,
            reason: 'insufficient_liquidity'
          }
        }
        return { canFill: true, balance: available }
      } catch {
        // Fail open — let the contract handle it
        return { canFill: true, balance: 999999 }
      }
    }
  }

export const inventoryChecker = new InventoryChecker()

=======================================================
FIX 4 — example-pricer.ts: same lazy getter pattern
=======================================================

FILE: maker-sdk/src/example-pricer.ts

If this file has module-level constants like:
  const USDC_CONTRACT = process.env.USDC_CONTRACT || ''

Change them to read inside functions:
  function getUsdcContract() {
    return process.env.USDC_CONTRACT ||
      'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
  }

Same for EURC_CONTRACT, MAKER_ADDRESS, POOL_ADDRESS.

Any file that uses process.env values that come from
the credential file must NOT read them at module load.
They must be read inside functions/methods.

=======================================================
FIX 5 — ws-client.ts: same lazy getter pattern
=======================================================

FILE: maker-sdk/src/ws-client.ts

If this file has:
  const MAKER_ADDRESS = process.env.MAKER_ADDRESS || ''
  const MAKER_API_KEY = process.env.MAKER_API_KEY || ''

Change to read inside the connect function:
  function connect() {
    const apiKey = process.env.MAKER_API_KEY || ''
    const wsUrl = process.env.BACKEND_WS_URL || ''
    // ...
  }

=======================================================
FIX 6 — price-levels.ts: same lazy getter pattern
=======================================================

FILE: maker-sdk/src/price-levels.ts

If this file reads USDC_CONTRACT or EURC_CONTRACT
at module load time, change to function parameters
or lazy getters.

=======================================================
VERIFY THE COMPLETE STARTUP SEQUENCE
=======================================================

After all fixes, npm run dev riju must follow
this exact sequence:

1. server.ts loads
2. process.argv[2] = 'riju'
3. credentials/riju.cred is read synchronously
4. All env vars set: MAKER_ADDRESS, POOL_ADDRESS,
   USDC_CONTRACT, EURC_CONTRACT, MAKER_API_KEY,
   SIGNER_PRIVATE_KEY, BACKEND_WS_URL, PORT
5. Oracle starts (uses no env vars from cred file)
6. InventoryChecker initializes (lazy — reads env
   vars at call time, not module load time)
7. Server attempts to read inventory:
   MAKER_ADDRESS is set ✓
   POOL_ADDRESS is set ✓
   Calls Soroban to read pool balance
   Returns USDC: 100.00 | EURC: 10.00
8. Banner prints with correct balances
9. WebSocket connects and authenticates
10. Price level interval starts
11. First price level message:
    [Levels] SELL: 3 tiers | BUY: 3 tiers |
    USDC: 100.00 | EURC: 10.00
12. priceBookEntries goes from 0 to 1 on backend
13. Quote requests start working

=======================================================
BUILD ORDER
=======================================================

1. Fix setup.ts — add MAKER_ADDRESS, POOL_ADDRESS,
   USDC_CONTRACT, EURC_CONTRACT to credContent string

2. Fix server.ts — load credential file synchronously
   at startup using manual line-by-line parse
   BEFORE any other imports use process.env

3. Fix inventory-checker.ts — use lazy getters
   (private get poolAddress()) instead of
   module-level constants

4. Fix example-pricer.ts — same lazy getter pattern

5. Fix ws-client.ts — same lazy getter pattern

6. Fix price-levels.ts — same lazy getter pattern

7. Delete existing riju.cred:
   rm credentials/riju.cred

8. Run setup again:
   npm run setup
   Enter the API key when prompted

9. Verify credential file has all fields:
   cat credentials/riju.cred
   Must show: MAKER_ADDRESS, POOL_ADDRESS,
   USDC_CONTRACT, EURC_CONTRACT

10. Run dev:
    npm run dev riju
    Must show:
    Pool: USDC: 100.00 | EURC: 10.00
    [Levels] SELL: 3 tiers | BUY: 3 tiers

11. Check health:
    curl http://localhost:4000/health
    Must show: priceBookEntries: 1

12. Test swap in browser:
    localhost:3000/swap
    Type 10 → quote must appear