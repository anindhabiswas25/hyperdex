import {
  STELLAR_RPC_URL,
  MAKER_POOL_FACTORY_CONTRACT,
  USDC_CONTRACT,
  EURC_CONTRACT,
} from '@/lib/constants';

const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';

async function getSdk() {
  return import('@stellar/stellar-sdk');
}

/**
 * Build a transaction that calls MakerPoolFactory.deploy_pool().
 * Returns prepared XDR string ready for Freighter signing.
 */
export async function buildDeployPoolTx(
  makerAddress: string,
  signerPublicKey: string
): Promise<string> {
  const { Contract, TransactionBuilder, Address, xdr, rpc } = await getSdk();

  const server = new rpc.Server(STELLAR_RPC_URL);
  const account = await server.getAccount(makerAddress);

  const factory = new Contract(MAKER_POOL_FACTORY_CONTRACT);

  const signerKeyBytes = Buffer.from(signerPublicKey, 'hex');

  // supported_pairs: [(USDC, EURC)]
  const pairsScVal = xdr.ScVal.scvVec([
    xdr.ScVal.scvVec([
      new Address(USDC_CONTRACT).toScVal(),
      new Address(EURC_CONTRACT).toScVal(),
    ]),
  ]);

  const tx = new TransactionBuilder(account, {
    fee: '5000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      factory.call(
        'deploy_pool',
        new Address(makerAddress).toScVal(),
        xdr.ScVal.scvBytes(signerKeyBytes),
        pairsScVal
      )
    )
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * Query the factory for a maker's pool address.
 * Returns the pool contract address string, or null if not deployed.
 */
export async function getMakerPoolAddress(makerAddress: string): Promise<string | null> {
  if (!MAKER_POOL_FACTORY_CONTRACT) return null;

  try {
    const { Contract, TransactionBuilder, Address, rpc, scValToNative } = await getSdk();

    const server = new rpc.Server(STELLAR_RPC_URL);
    const account = await server.getAccount(makerAddress);
    const factory = new Contract(MAKER_POOL_FACTORY_CONTRACT);

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(factory.call('get_pool', new Address(makerAddress).toScVal()))
      .setTimeout(30)
      .build();

    const result = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(result) || !result.result) return null;

    const val = scValToNative(result.result.retval);
    if (!val) return null;
    return val as string;
  } catch {
    return null;
  }
}
