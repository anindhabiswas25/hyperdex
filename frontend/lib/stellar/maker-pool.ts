import { STELLAR_RPC_URL, NETWORK_PASSPHRASE } from '@/lib/constants';

async function getSdk() {
  return import('@stellar/stellar-sdk');
}

export async function getCurrentLedger(): Promise<number> {
  const { rpc } = await getSdk();
  const server = new rpc.Server(STELLAR_RPC_URL);
  const result = await server.getLatestLedger();
  return result.sequence;
}

/**
 * Build a deposit transaction for the maker's pool.
 * Single transaction — maker signs once, tokens transfer directly to pool.
 * No prior approve step needed (Soroban native pattern).
 */
export async function buildDepositTx(
  makerAddress: string,
  poolAddress: string,
  tokenAddress: string,
  amountStroops: bigint
): Promise<string> {
  const { Contract, TransactionBuilder, Address, nativeToScVal, rpc } = await getSdk();

  const server = new rpc.Server(STELLAR_RPC_URL);
  const account = await server.getAccount(makerAddress);
  const pool = new Contract(poolAddress);

  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      pool.call(
        'deposit',
        new Address(makerAddress).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(amountStroops, { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(
      `Deposit simulation failed: ${(simResult as { error: string }).error}`
    );
  }

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * Build a withdraw transaction from the maker's pool.
 */
export async function buildWithdrawTx(
  makerAddress: string,
  poolAddress: string,
  tokenAddress: string,
  amountStroops: bigint
): Promise<string> {
  const { Contract, TransactionBuilder, Address, nativeToScVal, rpc } = await getSdk();

  const server = new rpc.Server(STELLAR_RPC_URL);
  const account = await server.getAccount(makerAddress);
  const pool = new Contract(poolAddress);

  const tx = new TransactionBuilder(account, {
    fee: '1000000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      pool.call(
        'withdraw',
        new Address(makerAddress).toScVal(),
        new Address(tokenAddress).toScVal(),
        nativeToScVal(amountStroops, { type: 'i128' })
      )
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(
      `Withdraw simulation failed: ${(simResult as { error: string }).error}`
    );
  }

  const prepared = await server.prepareTransaction(tx);
  return prepared.toXDR();
}

/**
 * Read a maker's pool balance for a given token (read-only simulation).
 * Returns human-readable amount (7 decimal places).
 */
export async function getPoolBalance(
  makerAddress: string,
  poolAddress: string,
  tokenAddress: string
): Promise<string> {
  const { Contract, TransactionBuilder, Address, rpc, scValToNative } = await getSdk();

  const server = new rpc.Server(STELLAR_RPC_URL);

  try {
    const account = await server.getAccount(makerAddress);
    const pool = new Contract(poolAddress);

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        pool.call('get_balance', new Address(tokenAddress).toScVal())
      )
      .setTimeout(10)
      .build();

    const simResult = await server.simulateTransaction(tx);
    if (!rpc.Api.isSimulationSuccess(simResult) || !simResult.result) {
      return '0.0000000';
    }

    const raw = scValToNative(simResult.result.retval) as bigint;
    return (Number(raw) / 1e7).toFixed(7);
  } catch {
    return '0.0000000';
  }
}
