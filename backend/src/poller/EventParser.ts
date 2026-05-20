import * as StellarSdk from '@stellar/stellar-sdk';
import { logger } from '../utils/logger';

export interface SorobanEvent {
  type: 'contract';
  contractId: string;
  topics: unknown[];
  data: unknown;
  parsed?: {
    eventType: 'quote_executed';
    quoteId: string;
    makerAddress: string;
    takerAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
  };
}

export class EventParser {
  private quoteVerifierContractId: string;

  constructor(quoteVerifierContractId: string) {
    this.quoteVerifierContractId = quoteVerifierContractId;
  }

  parseTransactionEvents(meta: StellarSdk.xdr.TransactionMeta): SorobanEvent[] {
    const results: SorobanEvent[] = [];

    let rawEvents: StellarSdk.xdr.ContractEvent[] = [];
    try {
      const sorobanMeta = meta.v3().sorobanMeta();
      rawEvents = sorobanMeta?.events() ?? [];
    } catch {
      // Non-Soroban transaction or unsupported meta version — no events
      return results;
    }

    for (const event of rawEvents) {
      try {
        // Only process contract-type events
        if (event.type().name !== 'contract') continue;

        const rawContractId = event.contractId();
        if (!rawContractId) continue;

        // xdr.Hash is a Buffer at runtime despite the strict type definition
        const contractId = StellarSdk.Address.contract(rawContractId as unknown as Buffer).toString();

        // Only process events from the quote_verifier contract
        if (contractId !== this.quoteVerifierContractId) continue;

        const body = event.body().v0();
        const topics = body.topics().map(t => StellarSdk.scValToNative(t));
        const data = StellarSdk.scValToNative(body.data());

        const sorobanEvent: SorobanEvent = { type: 'contract', contractId, topics, data };

        // Populate parsed field for quote_executed events
        if (topics[0] === 'quote_executed') {
          try {
            const dataArr = Array.isArray(data) ? data : [data];
            const quoteIdRaw = topics[1];
            const quoteId = Buffer.isBuffer(quoteIdRaw)
              ? (quoteIdRaw as Buffer).toString('hex')
              : String(quoteIdRaw);
            const makerAddress = String(topics[2]);
            const takerAddress = String(topics[3]);
            const tokenIn = String(dataArr[0]);
            const tokenOut = String(dataArr[1]);
            const amountIn = typeof dataArr[2] === 'bigint'
              ? (dataArr[2] as bigint).toString()
              : String(dataArr[2]);
            const amountOut = typeof dataArr[3] === 'bigint'
              ? (dataArr[3] as bigint).toString()
              : String(dataArr[3]);

            sorobanEvent.parsed = {
              eventType: 'quote_executed',
              quoteId,
              makerAddress,
              takerAddress,
              tokenIn,
              tokenOut,
              amountIn,
              amountOut,
            };
          } catch (parseErr) {
            logger.warn('Failed to parse quote_executed event fields', {
              event: 'event_parse_error',
              message: (parseErr as Error).message,
              contractId,
            });
          }
        }

        results.push(sorobanEvent);
      } catch (err) {
        logger.warn('Failed to parse contract event — skipping', {
          event: 'event_parse_error',
          message: (err as Error).message,
        });
      }
    }

    return results;
  }

  extractSwapEvent(events: SorobanEvent[]): SorobanEvent | null {
    return events.find(e => e.parsed?.eventType === 'quote_executed') ?? null;
  }
}
