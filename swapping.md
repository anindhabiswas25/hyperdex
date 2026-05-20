Fix the swap execution error:
"Unsupported address type: undefined"

This error occurs in buildExecuteQuoteTx() when
one of the Soroban Address.fromString() calls
receives undefined instead of a valid C... or G...
address string.

=======================================================
STEP 1 — FIND THE UNDEFINED VALUE
=======================================================

FILE: hyperdex-frontend/lib/stellar/quote-verifier.ts

ADD this validation block at the very top of
buildExecuteQuoteTx(), before any other code:

export async function buildExecuteQuoteTx(
  takerAddress: string,
  quote: BestQuote
): Promise<string> {

  // ── VALIDATE ALL ADDRESSES BEFORE ANYTHING ELSE ──
  const QUOTE_VERIFIER = process.env
    .NEXT_PUBLIC_QUOTE_VERIFIER_ADDRESS
  const STELLAR_RPC = process.env.NEXT_PUBLIC_STELLAR_RPC

  const checks = {
    'takerAddress':          takerAddress,
    'quote.makerAddress':    quote?.makerAddress,
    'quote.takerAddress':    quote?.takerAddress,
    'quote.tokenIn':         quote?.tokenIn,
    'quote.tokenOut':        quote?.tokenOut,
    'quote.amountIn':        quote?.amountIn,
    'quote.amountOut':       quote?.amountOut,
    'quote.quoteId':         quote?.quoteId,
    'quote.salt':            quote?.salt,
    'quote.signature':       quote?.signature,
    'quote.expiryTimestamp': quote?.expiryTimestamp,
    'QUOTE_VERIFIER_ADDRESS': QUOTE_VERIFIER,
    'STELLAR_RPC':            STELLAR_RPC,
  }

  const missing: string[] = []
  for (const [key, value] of Object.entries(checks)) {
    if (value === undefined || value === null || value === '') {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    console.error('buildExecuteQuoteTx missing values:')
    missing.forEach(k => console.error(`  MISSING: ${k}`))
    console.error('Full quote object:', JSON.stringify(quote, null, 2))
    console.error('Full env check:', {
      QUOTE_VERIFIER,
      STELLAR_RPC,
      takerAddress
    })
    throw new Error(
      `Missing required values: ${missing.join(', ')}`
    )
  }

  // Validate address formats
  const addressFields = {
    'takerAddress':       takerAddress,
    'quote.makerAddress': quote.makerAddress,
    'quote.takerAddress': quote.takerAddress,
    'quote.tokenIn':      quote.tokenIn,
    'quote.tokenOut':     quote.tokenOut,
    'QUOTE_VERIFIER':     QUOTE_VERIFIER!
  }

  for (const [key, addr] of Object.entries(addressFields)) {
    if (!/^[CG][A-Z2-7]{55}$/.test(addr)) {
      console.error(`Invalid address format for ${key}: ${addr}`)
      throw new Error(
        `Invalid address format for ${key}: "${addr}"`
      )
    }
  }

  // All checks passed — proceed with transaction build
  // ... rest of function
}

=======================================================
STEP 2 — FIX THE MOST COMMON CAUSE
=======================================================

The most likely undefined value is
NEXT_PUBLIC_QUOTE_VERIFIER_ADDRESS in the frontend
.env.local file.

CHECK:
  cat ~/Project/HyperDex/hyperdex-frontend/.env.local

MUST HAVE ALL OF THESE:
  NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org
  NEXT_PUBLIC_QUOTE_VERIFIER_ADDRESS=C...
  NEXT_PUBLIC_POOL_REGISTRY_ADDRESS=C...
  NEXT_PUBLIC_MAKER_POOL_FACTORY_ADDRESS=C...
  NEXT_PUBLIC_USDC_ADDRESS=CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA
  NEXT_PUBLIC_EURC_ADDRESS=CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ
  NEXT_PUBLIC_BACKEND_URL=http://localhost:4000

After updating .env.local:
  MUST restart the Next.js dev server
  Environment variables are only loaded at startup

=======================================================
STEP 3 — FIX THE QUOTE OBJECT MAPPING
=======================================================

The second most likely cause is that the bestQuote
from the auction result is not being mapped correctly
into the format that buildExecuteQuoteTx expects.

FILE: hyperdex-frontend/hooks/useAuction.ts

When the auction result comes back, the bestQuote
fields must match exactly what buildExecuteQuoteTx
expects.

CHECK the backend response shape:
  curl http://localhost:4000/api/quote/result/<AUCTION_ID>

The response should have:
  bestQuote.quoteId
  bestQuote.makerAddress
  bestQuote.takerAddress    ← might be missing
  bestQuote.tokenIn
  bestQuote.tokenOut
  bestQuote.amountIn
  bestQuote.amountOut
  bestQuote.expiryTimestamp
  bestQuote.salt
  bestQuote.signature

IF takerAddress is missing from bestQuote:

  UPDATE the auction result endpoint in backend:

  FILE: backend/src/routes/quote.ts

  In GET /api/quote/result/:auctionId,
  add takerAddress to the bestQuote response:

  return res.json({
    success:  true,
    status:   'completed',
    auctionId,
    bestQuote: {
      quoteId:         q.quoteId,
      makerAddress:    q.makerAddress,
      takerAddress:    auction.takerAddress,  // ← ADD THIS
      tokenIn:         auction.tokenIn,
      tokenOut:        auction.tokenOut,
      amountIn:        auction.amountIn,
      amountOut:       q.amountOut,
      expiryTimestamp: q.expiryTimestamp,
      salt:            q.salt,
      signature:       q.signature,
      rate:            `1 ${inSym} = ${rate} ${outSym}`,
      humanAmountIn:   humanIn,
      humanAmountOut:  humanOut,
      quotesReceived:  auction.quotes.length
    }
  })

  NOTE: takerAddress comes from auction.takerAddress
  not from the quote itself. The quote only stores
  what the maker signed. The taker address was stored
  when the auction was created.

=======================================================
STEP 4 — FIX buildExecuteQuoteTx COMPLETELY
=======================================================

FILE: hyperdex-frontend/lib/stellar/quote-verifier.ts

REWRITE the entire function with correct ScVal
encoding for each field:

import * as StellarSdk from '@stellar/stellar-sdk'

export async function buildExecuteQuoteTx(
  takerAddress: string,
  quote: {
    quoteId:         string   // 64 hex chars
    makerAddress:    string   // G... address
    takerAddress:    string   // G... address
    tokenIn:         string   // C... SAC address
    tokenOut:        string   // C... SAC address
    amountIn:        string   // stroops as string
    amountOut:       string   // stroops as string
    expiryTimestamp: number   // unix seconds
    salt:            string   // 64 hex chars
    signature:       string   // 128 hex chars
  }
): Promise<string>  // returns prepared XDR

  const QUOTE_VERIFIER =
    process.env.NEXT_PUBLIC_QUOTE_VERIFIER_ADDRESS!
  const STELLAR_RPC =
    process.env.NEXT_PUBLIC_STELLAR_RPC!

  // Validation (from Step 1 above)
  // ... validation code ...

  const server = new StellarSdk.SorobanRpc.Server(STELLAR_RPC)
  const contract = new StellarSdk.Contract(QUOTE_VERIFIER)
  const account = await server.getAccount(takerAddress)

  // ── ENCODE QUOTE STRUCT AS SCVAL MAP ────────────
  //
  // The Rust contract expects:
  //   pub struct Quote {
  //     pub quote_id:   BytesN<32>,
  //     pub maker:      Address,
  //     pub taker:      Address,
  //     pub token_in:   Address,
  //     pub token_out:  Address,
  //     pub amount_in:  i128,
  //     pub amount_out: i128,
  //     pub expiry:     u64,
  //     pub salt:       BytesN<32>,
  //   }
  //
  // MUST match field names exactly as in Rust struct
  // MUST be in the same order as defined in Rust

  const quoteIdBytes = Buffer.from(quote.quoteId, 'hex')
  const saltBytes    = Buffer.from(quote.salt,    'hex')
  const sigBytes     = Buffer.from(quote.signature, 'hex')

  if (quoteIdBytes.length !== 32) {
    throw new Error(
      `quoteId must be 32 bytes, got ${quoteIdBytes.length}`
    )
  }
  if (saltBytes.length !== 32) {
    throw new Error(
      `salt must be 32 bytes, got ${saltBytes.length}`
    )
  }
  if (sigBytes.length !== 64) {
    throw new Error(
      `signature must be 64 bytes, got ${sigBytes.length}`
    )
  }

  // Build the Quote ScVal
  // Using scvMap with entries matching Rust struct fields
  const quoteScVal = StellarSdk.xdr.ScVal.scvMap([
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('quote_id'),
      val: StellarSdk.xdr.ScVal.scvBytes(quoteIdBytes)
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('maker'),
      val: StellarSdk.Address.fromString(
        quote.makerAddress
      ).toScVal()
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('taker'),
      val: StellarSdk.Address.fromString(
        quote.takerAddress
      ).toScVal()
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('token_in'),
      val: StellarSdk.Address.fromString(
        quote.tokenIn
      ).toScVal()
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('token_out'),
      val: StellarSdk.Address.fromString(
        quote.tokenOut
      ).toScVal()
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('amount_in'),
      val: StellarSdk.nativeToScVal(
        BigInt(quote.amountIn), { type: 'i128' }
      )
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('amount_out'),
      val: StellarSdk.nativeToScVal(
        BigInt(quote.amountOut), { type: 'i128' }
      )
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('expiry'),
      val: StellarSdk.nativeToScVal(
        BigInt(quote.expiryTimestamp), { type: 'u64' }
      )
    }),
    new StellarSdk.xdr.ScMapEntry({
      key: StellarSdk.xdr.ScVal.scvSymbol('salt'),
      val: StellarSdk.xdr.ScVal.scvBytes(saltBytes)
    }),
  ])

  // Signature as BytesN<64>
  const signatureScVal =
    StellarSdk.xdr.ScVal.scvBytes(sigBytes)

  // Build transaction
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',  // 0.1 XLM max fee
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
  .addOperation(
    contract.call(
      'execute_quote',
      quoteScVal,
      signatureScVal
    )
  )
  .setTimeout(30)
  .build()

  // Simulate first — catches errors before Freighter
  const simResult = await server.simulateTransaction(tx)

  if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult)) {
    // Parse the error message
    const errorMsg = simResult.error || 'Simulation failed'
    console.error('Simulation error:', errorMsg)
    console.error('Quote sent to contract:', {
      quoteId:   quote.quoteId,
      maker:     quote.makerAddress,
      taker:     quote.takerAddress,
      tokenIn:   quote.tokenIn,
      tokenOut:  quote.tokenOut,
      amountIn:  quote.amountIn,
      amountOut: quote.amountOut,
      expiry:    quote.expiryTimestamp,
      salt:      quote.salt,
      sigLen:    quote.signature.length
    })
    throw new Error(`Contract simulation failed: ${errorMsg}`)
  }

  // Prepare (adds Soroban resource data)
  const preparedTx = await server.prepareTransaction(tx)
  return preparedTx.toXDR()

=======================================================
STEP 5 — FIX useAuction.ts approveSwap
=======================================================

FILE: hyperdex-frontend/hooks/useAuction.ts

The approveSwap function must pass the correct
takerAddress to buildExecuteQuoteTx.

The function signature is:
  buildExecuteQuoteTx(takerAddress, quote)

The takerAddress should come from the connected wallet,
NOT from the quote object. Use address from useWallet.

UPDATE approveSwap:

  async function approveSwap() {
    if (!state.bestQuote || !address) return

    // VERIFY taker address matches connected wallet
    if (state.bestQuote.takerAddress &&
        state.bestQuote.takerAddress !== address) {
      setState(s => ({
        ...s,
        status: 'error',
        error: 'Connected wallet does not match quote taker. ' +
               'Connect the correct wallet.'
      }))
      return
    }

    clearInterval(acceptRef.current!)
    setState(s => ({ ...s, status: 'executing' }))

    try {
      const { buildExecuteQuoteTx } = await import(
        '@/lib/stellar/quote-verifier'
      )

      // Log before building to catch issues
      console.log('Building swap transaction:', {
        takerAddress: address,
        quoteId:   state.bestQuote.quoteId,
        maker:     state.bestQuote.makerAddress,
        taker:     state.bestQuote.takerAddress,
        tokenIn:   state.bestQuote.tokenIn,
        tokenOut:  state.bestQuote.tokenOut,
        amountIn:  state.bestQuote.amountIn,
        amountOut: state.bestQuote.amountOut,
        expiry:    state.bestQuote.expiryTimestamp,
        saltLen:   state.bestQuote.salt?.length,
        sigLen:    state.bestQuote.signature?.length
      })

      const xdr = await buildExecuteQuoteTx(
        address,           // connected wallet = taker
        state.bestQuote    // the winning quote
      )

      // Sign with Freighter
      const { signTransaction } = await import(
        '@stellar/freighter-api'
      )
      const signedXdr = await signTransaction(xdr, {
        network: 'TESTNET',
        networkPassphrase:
          'Test SDF Network ; September 2015'
      })

      setState(s => ({ ...s, status: 'confirming' }))

      // Submit to Stellar
      const StellarSdk = await import('@stellar/stellar-sdk')
      const server = new StellarSdk.SorobanRpc.Server(
        process.env.NEXT_PUBLIC_STELLAR_RPC!
      )
      const tx = StellarSdk.TransactionBuilder.fromXDR(
        signedXdr,
        StellarSdk.Networks.TESTNET
      )

      const sendResult = await server.sendTransaction(tx)

      if (sendResult.status === 'ERROR') {
        throw new Error(
          'Transaction rejected: ' +
          JSON.stringify(sendResult.errorResult)
        )
      }

      const txHash = sendResult.hash

      // Notify backend
      fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/quote/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quoteId:      state.bestQuote.quoteId,
            txHash,
            takerAddress: address
          })
        }
      ).catch(() => {})

      // Poll for confirmation
      let confirmed = false
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const result = await server.getTransaction(txHash)
          if (result.status === 'SUCCESS') {
            confirmed = true
            break
          }
          if (result.status === 'FAILED') {
            // Extract failure reason from result
            throw new Error(
              'Transaction failed on-chain. ' +
              'Check Stellar explorer for details.'
            )
          }
        } catch (e: any) {
          if (e.message?.includes('failed')) throw e
          // NOT_FOUND = still pending, keep polling
        }
      }

      if (!confirmed) {
        throw new Error(
          'Confirmation timeout. Check explorer: ' +
          `https://stellar.expert/explorer/testnet/tx/${txHash}`
        )
      }

      setState(s => ({
        ...s, status: 'success', txHash
      }))

    } catch (err: any) {
      // User cancelled Freighter
      if (err.message?.includes('cancel') ||
          err.message?.includes('denied') ||
          err.message?.includes('User declined') ||
          err.message?.includes('rejected')) {
        setState(s => ({
          ...s,
          status: state.acceptSeconds > 0
            ? 'completed' : 'error',
          error: null
        }))
        // Restart accept countdown if time remains
        if (state.acceptSeconds > 0) {
          startAcceptCountdown(state.acceptSeconds)
        }
        return
      }

      console.error('Swap execution error:', err)
      setState(s => ({
        ...s,
        status: 'error',
        error:  err.message || 'Swap failed'
      }))
    }
  }

=======================================================
STEP 6 — VERIFY QUOTE VERIFIER CONTRACT FUNCTION
=======================================================

Your quote_verifier contract's execute_quote function
signature must match what the frontend sends.

Check the contract:
  FILE: contracts/quote_verifier/src/lib.rs

  The function must be:
  pub fn execute_quote(
    env: Env,
    quote: Quote,
    signature: BytesN<64>
  )

  The Quote struct fields must match exactly:
  #[contracttype]
  pub struct Quote {
    pub quote_id:   BytesN<32>,
    pub maker:      Address,
    pub taker:      Address,
    pub token_in:   Address,
    pub token_out:  Address,
    pub amount_in:  i128,
    pub amount_out: i128,
    pub expiry:     u64,
    pub salt:       BytesN<32>,
  }

  CRITICAL: The ScVal map keys in the frontend
  must match the Rust field names EXACTLY:
    quote_id   (not quoteId)
    token_in   (not tokenIn)
    token_out  (not tokenOut)
    amount_in  (not amountIn)
    amount_out (not amountOut)

  If your Rust struct uses different field names,
  update the frontend ScVal map keys to match.

=======================================================
BUILD ORDER
=======================================================

1. Run check:
   cat ~/Project/HyperDex/hyperdex-frontend/.env.local
   Verify NEXT_PUBLIC_QUOTE_VERIFIER_ADDRESS is set

2. Add validation block to buildExecuteQuoteTx
   Run the swap — check console for which field is undefined

3. Fix the identified undefined field:
   a. If QUOTE_VERIFIER_ADDRESS missing → add to .env.local
   b. If takerAddress missing → fix backend response
   c. If any quote field missing → fix auction result mapping

4. Rebuild buildExecuteQuoteTx with correct ScVal encoding

5. Fix approveSwap in useAuction.ts

6. Restart frontend (env vars need restart)

7. Test swap:
   Open browser console
   Click Approve Swap
   Watch console logs for the quote values
   Should see all values populated
   Freighter popup should open
   Approve → Stellar confirms

=======================================================
AFTER SUCCESSFUL SWAP — VERIFY BALANCES
=======================================================

After swap of 1 USDC → EURC:

Check taker wallet:
  USDC balance: decreased by 1
  EURC balance: increased by ~0.859

Check maker pool:
  curl http://localhost:4000/api/makers/GCG6...72DJ/inventory
  vault.usdc: increased by 1
  vault.eurc: decreased by ~0.859