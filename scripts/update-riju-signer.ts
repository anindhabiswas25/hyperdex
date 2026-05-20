/**
 * HyperDEX — Fix Riju's on-chain signer key in pool_registry
 *
 * The pool_registry currently has signer key c9c7a1cc... for Riju,
 * but riju.cred now uses private key da1f5334... (→ public key 56cfda93...).
 * This mismatch causes InvalidSignature on every execute_quote attempt.
 *
 * This script calls pool_registry.update_signer(RIJU, 56cfda93...)
 * which requires Riju's Stellar account to sign the transaction.
 *
 * Usage:
 *   MAKER_SECRET=S... npx ts-node scripts/update-riju-signer.ts
 *
 * Get the secret key from Freighter:
 *   Select the Riju account (GCTCIR6T...) → ⋮ menu → Show Secret Key
 */

import * as StellarSdk from '@stellar/stellar-sdk'

const POOL_REGISTRY  = 'CAWPFMTTRQD76CBXMRBJTXKFBFYD37RZM6ZZXOZ7QBYTKCXK5YOEOK4J'
const SOROBAN_RPC    = 'https://soroban-testnet.stellar.org'
const MAKER_ADDRESS  = 'GCTCIR6TXCG5ZJDDYATNAEFS77URJELTQHDPVJNB573QHRGTTKX5K3B5'
const NEW_SIGNER_KEY = '56cfda934a1c4355553ffb3cdac3126258b68e08227b82df5ae7c65f08d9e427'

async function main() {
  const secret = process.env.MAKER_SECRET
  if (!secret) {
    console.error('Usage: MAKER_SECRET=S... npx ts-node scripts/update-riju-signer.ts')
    console.error('')
    console.error('Get the secret key from Freighter:')
    console.error('  Select Riju account (GCTCIR6T...) → ⋮ menu → Show Secret Key')
    process.exit(1)
  }

  const kp = StellarSdk.Keypair.fromSecret(secret)
  console.log(`Keypair public key: ${kp.publicKey()}`)
  if (kp.publicKey() !== MAKER_ADDRESS) {
    console.error(`Wrong key! Expected ${MAKER_ADDRESS}, got ${kp.publicKey()}`)
    process.exit(1)
  }
  console.log('✅ Keypair matches Riju\n')

  const server = new StellarSdk.rpc.Server(SOROBAN_RPC)
  const contract = new StellarSdk.Contract(POOL_REGISTRY)

  console.log(`Updating signer key to: ${NEW_SIGNER_KEY.slice(0, 16)}...`)

  const account = await server.getAccount(MAKER_ADDRESS)
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call(
      'update_signer',
      new StellarSdk.Address(MAKER_ADDRESS).toScVal(),
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(NEW_SIGNER_KEY, 'hex'))
    ))
    .setTimeout(60)
    .build()

  const prepared = await server.prepareTransaction(tx)
  prepared.sign(kp)

  console.log('Submitting update_signer transaction...')
  const result = await server.sendTransaction(prepared)
  if (result.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(result.errorResult)}`)
  }
  console.log(`TX hash: ${result.hash}`)

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 5000))
    const txResult = await server.getTransaction(result.hash)
    if (txResult.status === 'SUCCESS') {
      console.log(`\n✅ update_signer confirmed!`)
      console.log(`   Pool registry now has signer: ${NEW_SIGNER_KEY.slice(0, 16)}...`)
      console.log('\nSwap should now work. Test:')
      console.log('  curl -X POST http://localhost:4000/api/quote \\')
      console.log('    -H "Content-Type: application/json" \\')
      console.log(`    -d '{"tokenIn":"CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA","tokenOut":"CCUUDM434BMZMYWYDITHFXHDMIVTGGD6T2I5UKNX5BSLXLW7HVR4MCGZ","amountIn":"30000000","takerAddress":"${MAKER_ADDRESS}"}'`)
      return
    } else if (txResult.status === 'FAILED') {
      console.error('❌ Transaction failed:', JSON.stringify(txResult).slice(0, 500))
      return
    }
    process.stdout.write(`  Waiting... (${i + 1}/20)\r`)
  }
  throw new Error('Timeout waiting for confirmation')
}

main().catch(e => { console.error('\n❌', e.message || e); process.exit(1) })
