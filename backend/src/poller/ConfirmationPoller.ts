import { Trade, ITrade } from '../db/models/Trade';
import { logger } from '../utils/logger';
import { config } from '../config';
import { StellarTxFetcher, TxResult } from './StellarTxFetcher';
import { EventParser } from './EventParser';
import { StatsUpdater } from './StatsUpdater';
import { tradePushService } from '../websocket/TradePushService';

export class ConfirmationPoller {
  private fetcher: StellarTxFetcher;
  private parser: EventParser;
  private statsUpdater: StatsUpdater;

  private isRunning = false;
  private readonly pollIntervalMs: number;
  private readonly txTimeoutMs: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private inFlightTxHashes = new Set<string>();

  constructor(fetcher: StellarTxFetcher, parser: EventParser, statsUpdater: StatsUpdater) {
    this.fetcher = fetcher;
    this.parser = parser;
    this.statsUpdater = statsUpdater;
    this.pollIntervalMs = config.POLL_INTERVAL_MS;
    this.txTimeoutMs = config.TX_TIMEOUT_MS;
  }

  start(): void {
    this.isRunning = true;
    logger.info('Confirmation poller started', { intervalMs: this.pollIntervalMs });
    void this.poll();
    this.intervalHandle = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    logger.info('Confirmation poller stopped');
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;
    const startMs = Date.now();

    try {
      // STEP 1 — Fetch submitted trades
      const submittedTrades = await Trade.find({
        status: 'submitted',
        txHash: { $ne: null },
      }).limit(50);

      if (submittedTrades.length === 0) {
        logger.debug('No submitted trades in this poll cycle');
      }

      // STEP 2 — Expire stuck "quoted" trades (never submitted)
      const stuckTrades = await Trade.find({
        status: 'quoted',
        quotedAt: { $lt: new Date(Date.now() - 120_000) },
      }).limit(20);

      for (const stuck of stuckTrades) {
        try {
          await Trade.findByIdAndUpdate(stuck._id, { $set: { status: 'expired' } });
          logger.info('Quote expired without submission', { quoteId: stuck.quoteId });
        } catch (err) {
          logger.error('Failed to expire stuck trade', {
            quoteId: stuck.quoteId,
            error: (err as Error).message,
          });
        }
      }

      // STEP 3 — Process submitted trades in batches
      const batchSize = config.POLL_CONCURRENCY;
      for (let i = 0; i < submittedTrades.length; i += batchSize) {
        const batch = submittedTrades.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(trade => this.processTrade(trade)));
      }

      const durationMs = Date.now() - startMs;
      logger.debug('Poll cycle complete', {
        event: 'poll_cycle',
        submittedCount: submittedTrades.length,
        stuckCount: stuckTrades.length,
        durationMs,
      });
    } catch (err) {
      logger.error('Unhandled error in poll cycle', {
        event: 'stellar_rpc_error',
        message: (err as Error).message,
        stack: (err as Error).stack,
      });
    }
  }

  private async processTrade(trade: ITrade): Promise<void> {
    const txHash = trade.txHash!;

    if (this.inFlightTxHashes.has(txHash)) {
      logger.debug('TX already in-flight, skipping', { txHash });
      return;
    }
    this.inFlightTxHashes.add(txHash);

    try {
      // STEP 1 — Check for timeout
      const submittedAt = trade.submittedAt;
      if (submittedAt) {
        const ageMs = Date.now() - submittedAt.getTime();
        if (ageMs > this.txTimeoutMs) {
          logger.warn('TX timeout — marking failed', {
            event: 'trade_timeout',
            quoteId: trade.quoteId,
            txHash,
            ageMs,
          });
          await Trade.findByIdAndUpdate(trade._id, {
            $set: { status: 'failed', failureReason: 'Transaction not confirmed within timeout' },
          });
          return;
        }
      }

      // STEP 2 — Query Stellar
      const result = await this.fetcher.getTransaction(txHash);

      // STEP 3 — Handle by status
      if (result.status === 'NOT_FOUND' || result.status === 'PENDING') {
        logger.debug('TX pending, will retry', { event: 'tx_pending', txHash });
        return;
      }

      if (result.status === 'FAILED') {
        const reason = result.failureReason ?? 'Transaction failed on-chain';
        logger.warn('TX failed on-chain', {
          event: 'trade_failed',
          quoteId: trade.quoteId,
          txHash,
          reason,
        });
        await Trade.findByIdAndUpdate(trade._id, {
          $set: { status: 'failed', failureReason: reason },
        });
        return;
      }

      if (result.status === 'SUCCESS') {
        await this.handleSuccess(trade, result);
      }
    } catch (err) {
      logger.error('Error processing trade', {
        quoteId: trade.quoteId,
        txHash,
        error: (err as Error).message,
        stack: (err as Error).stack,
      });
    } finally {
      this.inFlightTxHashes.delete(txHash);
    }
  }

  private async handleSuccess(trade: ITrade, result: TxResult): Promise<void> {
    // STEP 1 — Extract swap event
    const swapEvent = this.parser.extractSwapEvent(result.events ?? []);

    if (!swapEvent) {
      logger.warn('No swap event in confirmed tx — marking confirmed anyway', {
        quoteId: trade.quoteId,
        txHash: trade.txHash,
      });
      await Trade.findByIdAndUpdate(trade._id, {
        $set: {
          status: 'confirmed',
          confirmedAt: result.ledgerCloseTime ?? new Date(),
        },
      });
      return;
    }

    // STEP 2 — Validate event matches trade
    if (swapEvent.parsed) {
      if (swapEvent.parsed.quoteId !== trade.quoteId) {
        logger.error('Event quoteId mismatch — chain is truth, confirming anyway', {
          eventQuoteId: swapEvent.parsed.quoteId,
          tradeQuoteId: trade.quoteId,
          txHash: trade.txHash,
        });
      }
      if (swapEvent.parsed.takerAddress !== trade.takerAddress) {
        logger.error('Event takerAddress mismatch — chain is truth, confirming anyway', {
          eventTaker: swapEvent.parsed.takerAddress,
          tradeTaker: trade.takerAddress,
          txHash: trade.txHash,
        });
      }
    }

    // STEP 3 — Update trade with confirmed on-chain data
    await Trade.findByIdAndUpdate(trade._id, {
      $set: {
        status: 'confirmed',
        confirmedAt: result.ledgerCloseTime ?? new Date(),
        amountIn: swapEvent.parsed?.amountIn ?? trade.amountIn,
        amountOut: swapEvent.parsed?.amountOut ?? trade.amountOut,
      },
    });

    // STEP 4 — Update maker stats (errors are swallowed inside updateAfterConfirmedTrade)
    await this.statsUpdater.updateAfterConfirmedTrade(trade);

    // STEP 5 — Push trade notification to maker
    try {
      await tradePushService.notifyMaker(trade);
    } catch (err) {
      logger.warn('Failed to push trade notification', {
        quoteId: trade.quoteId,
        error: (err as Error).message,
      });
    }

    // STEP 6 — Log success
    logger.info('Trade confirmed', {
      event: 'trade_confirmed',
      quoteId: trade.quoteId,
      txHash: trade.txHash,
      makerAddress: trade.makerAddress,
      takerAddress: trade.takerAddress,
      amountIn: swapEvent.parsed?.amountIn ?? trade.amountIn,
      amountOut: swapEvent.parsed?.amountOut ?? trade.amountOut,
      ledger: result.ledger,
    });
  }
}
