import type { BackendQuote } from './types';
import {
  STELLAR_RPC_URL,
  QUOTE_VERIFIER_CONTRACT,
  POOL_REGISTRY_CONTRACT,
  USDC_CONTRACT,
  EURC_CONTRACT,
  FREIGHTER_NETWORK,
} from './constants';

const NETWORK_PASSPHRASE =
  FREIGHTER_NETWORK === 'TESTNET'
    ? 'Test SDF Network ; September 2015'
    : 'Public Global Stellar Network ; September 2015';
const MAX_FEE = '1000000';

function buildQuoteScVal(quote: ExecuteQuoteInput, xdrMod: typeof import('@stellar/stellar-sdk').xdr, nativeToScVal: typeof import('@stellar/stellar-sdk').nativeToScVal, Address: typeof import('@stellar/stellar-sdk').Address) {
  const entry = (key: string, val: import('@stellar/stellar-sdk').xdr.ScVal): import('@stellar/stellar-sdk').xdr.ScMapEntry =>
    new xdrMod.ScMapEntry({ key: xdrMod.ScVal.scvSymbol(key), val });

  return xdrMod.ScVal.scvMap([
    entry('amount_in',  nativeToScVal(BigInt(quote.amountIn),       { type: 'i128' })),
    entry('amount_out', nativeToScVal(BigInt(quote.amountOut),      { type: 'i128' })),
    entry('expiry',     nativeToScVal(BigInt(quote.expiryTimestamp),{ type: 'u64' })),
    entry('maker',      new Address(quote.makerAddress).toScVal()),
    entry('quote_id',   xdrMod.ScVal.scvBytes(Buffer.from(quote.quoteId, 'hex'))),
    entry('salt',       xdrMod.ScVal.scvBytes(Buffer.from(quote.salt, 'hex'))),
    entry('taker',      new Address(quote.takerAddress).toScVal()),
    entry('token_in',   new Address(quote.tokenIn).toScVal()),
    entry('token_out',  new Address(quote.tokenOut).toScVal()),
  ]);
}

async function getSdk() {
  const sdk = await import('@stellar/stellar-sdk');
  return sdk;
}

type ExecuteQuoteInput = Pick<BackendQuote, 'amountIn' | 'amountOut' | 'expiryTimestamp' | 'makerAddress' | 'takerAddress' | 'tokenIn' | 'tokenOut' | 'quoteId' | 'salt' | 'signature'>

export async function buildExecuteQuoteTx(quote: ExecuteQuoteInput, takerAddress: string): Promise<string> {
  const sdk = await getSdk();
  const { Contract, TransactionBuilder, Networks, xdr, Address, nativeToScVal, rpc } = sdk;

  const rpcServer = new rpc.Server(STELLAR_RPC_URL);
  const account = await rpcServer.getAccount(takerAddress);

  const quoteScVal = buildQuoteScVal(quote, xdr, nativeToScVal, Address);
  const sigScVal = xdr.ScVal.scvBytes(Buffer.from(quote.signature, 'hex'));

  const contract = new Contract(QUOTE_VERIFIER_CONTRACT);
  const op = contract.call('execute_quote', quoteScVal, sigScVal);

  const tx = new TransactionBuilder(account, {
    fee: MAX_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const simResult = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${(simResult as { error: string }).error}`);
  }

  return rpc.assembleTransaction(tx, simResult).build().toXDR();
}

export async function getOnChainSignerKey(makerAddress: string): Promise<string | null> {
  try {
    const sdk = await getSdk();
    const { Contract, TransactionBuilder, Address, rpc } = sdk;

    const rpcServer = new rpc.Server(STELLAR_RPC_URL);
    const account = await rpcServer.getAccount(makerAddress);

    const contract = new Contract(POOL_REGISTRY_CONTRACT);
    const op = contract.call('get_signer_key', new Address(makerAddress).toScVal());

    const tx = new TransactionBuilder(account, {
      fee: MAX_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(op)
      .setTimeout(30)
      .build();

    const simResult = await rpcServer.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simResult)) return null;

    const retval = (simResult as { result?: { retval: import('@stellar/stellar-sdk').xdr.ScVal } }).result?.retval;
    if (!retval) return null;

    const bytes = retval.bytes();
    return Buffer.from(bytes).toString('hex');
  } catch {
    return null;
  }
}

export async function buildUpdateSignerTx(makerAddress: string, newSignerPubKeyHex: string): Promise<string> {
  const sdk = await getSdk();
  const { Contract, TransactionBuilder, xdr, Address, rpc } = sdk;

  const rpcServer = new rpc.Server(STELLAR_RPC_URL);
  const account = await rpcServer.getAccount(makerAddress);

  const makerScVal      = new Address(makerAddress).toScVal();
  const signerKeyScVal  = xdr.ScVal.scvBytes(Buffer.from(newSignerPubKeyHex, 'hex'));

  const contract = new Contract(POOL_REGISTRY_CONTRACT);
  const op = contract.call('update_signer', makerScVal, signerKeyScVal);

  const tx = new TransactionBuilder(account, {
    fee: MAX_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const simResult = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${(simResult as { error: string }).error}`);
  }

  return rpc.assembleTransaction(tx, simResult).build().toXDR();
}

export async function buildRegisterMakerTx(makerAddress: string, signerKey: string): Promise<string> {
  const sdk = await getSdk();
  const { Contract, TransactionBuilder, xdr, Address, rpc } = sdk;

  const rpcServer = new rpc.Server(STELLAR_RPC_URL);
  const account = await rpcServer.getAccount(makerAddress);

  const makerScVal = new Address(makerAddress).toScVal();
  const signerKeyScVal = xdr.ScVal.scvBytes(Buffer.from(signerKey, 'hex'));

  const pairUE = xdr.ScVal.scvVec([new Address(USDC_CONTRACT).toScVal(), new Address(EURC_CONTRACT).toScVal()]);
  const pairEU = xdr.ScVal.scvVec([new Address(EURC_CONTRACT).toScVal(), new Address(USDC_CONTRACT).toScVal()]);
  const pairsScVal = xdr.ScVal.scvVec([pairUE, pairEU]);

  const contract = new Contract(POOL_REGISTRY_CONTRACT);
  const op = contract.call('register_maker', makerScVal, signerKeyScVal, pairsScVal);

  const tx = new TransactionBuilder(account, {
    fee: MAX_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const simResult = await rpcServer.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed: ${(simResult as { error: string }).error}`);
  }

  return rpc.assembleTransaction(tx, simResult).build().toXDR();
}


export async function submitTransaction(signedXdr: string): Promise<string> {
  const sdk = await getSdk();
  const { Transaction, rpc } = sdk;

  const rpcServer = new rpc.Server(STELLAR_RPC_URL);
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);

  const response = await rpcServer.sendTransaction(tx);
  if (response.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(response.errorResult)}`);
  }
  return response.hash;
}

export async function submitAndWait(signedXdr: string): Promise<string> {
  const sdk = await getSdk();
  const { Transaction, rpc } = sdk;
  const rpcServer = new rpc.Server(STELLAR_RPC_URL);
  const tx = new Transaction(signedXdr, NETWORK_PASSPHRASE);
  const response = await rpcServer.sendTransaction(tx);
  if (response.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(response.errorResult)}`);
  }
  if (response.status === 'TRY_AGAIN_LATER') {
    throw new Error('Network busy — please retry your swap');
  }
  const hash = response.hash;
  // Poll for confirmation using raw RPC (avoids XDR-parse failures on testnet).
  for (let i = 0; i < 90; i++) {
    await new Promise(r => setTimeout(r, i < 10 ? 2000 : 5000));
    try {
      const raw = await (rpcServer as any)._getTransaction(hash) as { status: string };
      if (raw.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash;
      if (raw.status === rpc.Api.GetTransactionStatus.FAILED)  throw new Error('Transaction failed on-chain');
    } catch (e: any) {
      if (e.message === 'Transaction failed on-chain') throw e;
      // transient network / parse error — keep polling
    }
  }
  throw new Error('Transaction confirmation timeout');
}

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { isConnected } = await import('@stellar/freighter-api');
    const res = await isConnected();
    return res.isConnected === true;
  } catch {
    return false;
  }
}

export async function connectFreighter(): Promise<string> {
  const { setAllowed, requestAccess } = await import('@stellar/freighter-api');
  await setAllowed();
  const res = await requestAccess();
  if (res.error) throw new Error((res.error as { message?: string }).message ?? 'Freighter access denied');
  return res.address;
}

export async function getFreighterAddress(): Promise<string> {
  try {
    const { isAllowed, getAddress } = await import('@stellar/freighter-api');
    const allowed = await isAllowed();
    if (!allowed.isAllowed) return '';
    const res = await getAddress();
    if (res.error || !res.address) return '';
    return res.address;
  } catch {
    return '';
  }
}

export async function signWithFreighter(txXdr: string): Promise<string> {
  const { signTransaction, getNetworkDetails } = await import('@stellar/freighter-api');

  // Guard against the #1 cause of txBadAuth: Freighter signing on a different
  // network than the one the transaction was built for. Signing on the wrong
  // network produces a signature the target network rejects (txBadAuth).
  try {
    const net = await getNetworkDetails();
    if (!net.error && net.networkPassphrase && net.networkPassphrase !== NETWORK_PASSPHRASE) {
      const want = FREIGHTER_NETWORK === 'PUBLIC' ? 'Mainnet (Public)' : 'Testnet';
      throw new Error(
        `Freighter is connected to the wrong network. Switch it to ${want} in the Freighter extension, then try again.`
      );
    }
  } catch (e) {
    // Re-throw our own guard message; ignore failures of the network probe itself.
    if (e instanceof Error && e.message.startsWith('Freighter is connected')) throw e;
  }

  const result = await signTransaction(txXdr, { networkPassphrase: NETWORK_PASSPHRASE });
  if (result.error) {
    throw new Error((result.error as { message?: string }).message ?? 'Freighter failed to sign the transaction');
  }
  return result.signedTxXdr;
}

export function stroopsToHuman(stroops: string | bigint, decimals = 7): string {
  // Handle already-human-readable decimal strings (e.g. '40.0025000' from legacy Horizon responses)
  if (typeof stroops === 'string' && stroops.includes('.')) {
    const n = parseFloat(stroops);
    if (isNaN(n)) return '0';
    return n.toFixed(decimals).replace(/\.?0+$/, '') || '0';
  }
  const s = BigInt(stroops);
  const factor = BigInt(10 ** decimals);
  const whole = s / factor;
  const frac = s % factor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export function humanToStroops(human: string, decimals = 7): bigint {
  const [whole, frac = ''] = human.split('.');
  const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole) * BigInt(10 ** decimals) + BigInt(fracPadded);
}
