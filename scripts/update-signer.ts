/**
 * HyperDEX — Update Maker Signer Key on Pool Registry
 *
 * Updates the on-chain signer key for GCVCHO43 to 47fee375...
 * (the key in maker-sdk/credentials/marlin.cred)
 *
 * Usage:
 *   MAKER_SECRET=S... npx ts-node scripts/update-signer.ts
 *
 * Where MAKER_SECRET is the Stellar secret key for GCVCHO43:
 *   In Freighter: select GCVCHO43 account → ⋮ menu → Show Secret Key
 */

import * as StellarSdk from '@stellar/stellar-sdk'

const POOL_REGISTRY = 'CCJHRG7A4O36MJ7473AKID4FY6YJAUWCMDFOCB5KUWOP5ZPXVKMKRIK7'
const SOROBAN_RPC   = 'https://soroban-testnet.stellar.org'
const MAKER_ADDRESS = 'GCVCHO43YMPEHBDWOVKP5Y2XZWEUHCZNPIGJRZAFFFGWMNGO5UVUMCO3'
const NEW_SIGNER    = '47fee375ac735a3ec8ee279842a087bf0baccd015c483f413417c70eb8d09436'

async function main() {
  const secret = process.env.MAKER_SECRET
  if (!secret) {
    console.error('Usage: MAKER_SECRET=S... npx ts-node scripts/update-signer.ts')
    console.error('')
    console.error('Export the secret key from Freighter:')
    console.error('  Select GCVCHO43 account → ⋮ menu → Show Secret Key')
    process.exit(1)
  }

  const kp = StellarSdk.Keypair.fromSecret(secret)
  console.log(`Maker keypair: ${kp.publicKey()}`)
  if (kp.publicKey() !== MAKER_ADDRESS) {
    console.error(`Wrong key! Expected ${MAKER_ADDRESS}, got ${kp.publicKey()}`)
    process.exit(1)
  }
  console.log('✅ Keypair matches GCVCHO43\n')

  const server = new StellarSdk.rpc.Server(SOROBAN_RPC)
  const contract = new StellarSdk.Contract(POOL_REGISTRY)

  const makerScVal = new StellarSdk.Address(MAKER_ADDRESS).toScVal()
  const signerKeyScVal = StellarSdk.xdr.ScVal.scvBytes(Buffer.from(NEW_SIGNER, 'hex'))

  console.log(`Calling pool_registry.update_signer(GCVCHO43, ${NEW_SIGNER.slice(0, 16)}...)`)

  const account = await server.getAccount(MAKER_ADDRESS)
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: StellarSdk.Networks.TESTNET,
  })
    .addOperation(contract.call('update_signer', makerScVal, signerKeyScVal))
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
      console.log(`\n✅ update_signer confirmed! Ledger: ${(txResult as any).ledger}`)
      console.log('\nPool registry now has signer: 47fee375...')
      console.log('The maker SDK (marlin) will now sign quotes correctly.')
      console.log('\nNext: run E2E swap test:')
      console.log('  npx ts-node scripts/e2e-swap-test.ts')
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
