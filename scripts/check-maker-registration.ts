import * as StellarSdk from '@stellar/stellar-sdk'

async function checkRegistration() {
  const server = new StellarSdk.rpc.Server('https://soroban-testnet.stellar.org')
  const makerAddress = process.env.MAKER_ADDRESS!
  const contract = new StellarSdk.Contract(process.env.POOL_REGISTRY_CONTRACT_ADDRESS!)
  const account = await server.getAccount(makerAddress)
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: StellarSdk.Networks.TESTNET
  })
  .addOperation(contract.call(
    'get_maker',
    StellarSdk.Address.fromString(makerAddress).toScVal()
  ))
  .setTimeout(30)
  .build()

  try {
    const result = await server.simulateTransaction(tx)
    if (StellarSdk.rpc.Api.isSimulationSuccess(result)) {
      const val = StellarSdk.scValToNative(result.result!.retval)
      console.log('✅ Maker IS registered on-chain')
      console.log('Data:', JSON.stringify(val))
    } else {
      console.log('❌ Maker NOT registered on-chain')
      console.log('Error:', result.error?.slice(0, 200))
    }
  } catch (e) {
    console.log('❌ Maker NOT registered on-chain:', (e as Error).message?.slice(0, 200))
  }
}

if (!process.env.MAKER_ADDRESS || !process.env.POOL_REGISTRY_CONTRACT_ADDRESS) {
  console.error('Set MAKER_ADDRESS and POOL_REGISTRY_CONTRACT_ADDRESS env vars')
  process.exit(1)
}
checkRegistration()
