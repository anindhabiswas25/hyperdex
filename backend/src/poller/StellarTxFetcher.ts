import * as StellarSdk from '@stellar/stellar-sdk';
import { logger } from '../utils/logger';
import { EventParser, SorobanEvent } from './EventParser';
import { config } from '../config';

export interface TxResult {
  status: 'SUCCESS' | 'FAILED' | 'NOT_FOUND' | 'PENDING';
  txHash: string;
  ledger?: number;
  ledgerCloseTime?: Date;
  resultXdr?: StellarSdk.xdr.TransactionResult;
  envelopeXdr?: StellarSdk.xdr.TransactionEnvelope;
  events?: SorobanEvent[];
  failureReason?: string;
}

export class StellarTxFetcher {
  private server: StellarSdk.rpc.Server;
  private parser: EventParser;

  constructor(rpcUrl: string, _networkPassphrase: string) {
    this.server = new StellarSdk.rpc.Server(rpcUrl, { allowHttp: true });
    this.parser = new EventParser(config.QUOTE_VERIFIER_CONTRACT_ADDRESS);
  }

  async getTransaction(txHash: string): Promise<TxResult> {
    try {
      const response = await this.server.getTransaction(txHash);

      if (response.status === StellarSdk.rpc.Api.GetTransactionStatus.SUCCESS) {
        const events = this.parser.parseTransactionEvents(response.resultMetaXdr);
        return {
          status: 'SUCCESS',
          txHash,
          ledger: response.ledger,
          ledgerCloseTime: new Date(response.createdAt * 1000),
          resultXdr: response.resultXdr,
          envelopeXdr: response.envelopeXdr,
          events,
        };
      }

      if (response.status === StellarSdk.rpc.Api.GetTransactionStatus.FAILED) {
        let failureReason = 'Transaction failed on-chain';
        try {
          const resultCode = response.resultXdr.result().switch().name as string;
          failureReason = resultCode;
        } catch {
          // Keep default
        }
        return {
          status: 'FAILED',
          txHash,
          ledger: response.ledger,
          ledgerCloseTime: new Date(response.createdAt * 1000),
          failureReason,
        };
      }

      // NOT_FOUND
      return { status: 'NOT_FOUND', txHash };
    } catch (err) {
      logger.error('Stellar RPC error in getTransaction', {
        event: 'stellar_rpc_error',
        message: (err as Error).message,
        stack: (err as Error).stack,
        txHash,
      });
      return { status: 'NOT_FOUND', txHash };
    }
  }

  async getCurrentLedger(): Promise<number> {
    const response = await this.server.getLatestLedger();
    return response.sequence;
  }
}
