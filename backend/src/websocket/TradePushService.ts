import { ITrade } from '../db/models/Trade';
import { MakerConnectionRegistry } from './MakerConnection';
import { logger } from '../utils/logger';

interface PendingAck {
  trade: ITrade;
  attempts: number;
  timeoutHandle: NodeJS.Timeout;
}

class TradePushService {
  private pendingAcks: Map<string, PendingAck> = new Map();
  private readonly MAX_RETRY_DURATION_MS = 5 * 60 * 1000;
  private readonly RETRY_INTERVAL_MS = 30_000;

  async notifyMaker(trade: ITrade): Promise<void> {
    const tradeEventId = `evt_${trade.quoteId}_${Date.now()}`;
    const registry = MakerConnectionRegistry.getInstance();
    const makerId = (trade as any).makerId as string | undefined;

    if (!makerId) {
      logger.warn('Trade missing makerId — cannot push notification', { quoteId: trade.quoteId });
      return;
    }

    const connection = registry.getConnection(makerId);
    if (!connection) {
      logger.warn('Maker offline for trade notification', {
        makerId,
        quoteId: trade.quoteId,
      });
      return;
    }

    const message = {
      type: 'trade' as const,
      message: {
        tradeEventId,
        quoteId: trade.quoteId,
        rfqId: (trade as any).rfqId ?? null,
        makerAddress: trade.makerAddress,
        takerAddress: trade.takerAddress,
        tokenIn: trade.tokenIn,
        tokenOut: trade.tokenOut,
        amountIn: trade.amountIn,
        amountOut: trade.amountOut,
        feeAmount: trade.feeAmount,
        txHash: trade.txHash,
        confirmedAt: trade.confirmedAt?.toISOString() ?? null,
      },
    };

    connection.send(message);

    const timeoutHandle = setTimeout(
      () => this.retryNotification(tradeEventId),
      this.RETRY_INTERVAL_MS
    );

    this.pendingAcks.set(tradeEventId, { trade, attempts: 1, timeoutHandle });
  }

  handleAck(tradeEventId: string): void {
    const pending = this.pendingAcks.get(tradeEventId);
    if (!pending) return;
    clearTimeout(pending.timeoutHandle);
    this.pendingAcks.delete(tradeEventId);
    logger.info('Trade ack received', { tradeEventId });
  }

  private retryNotification(tradeEventId: string): void {
    const pending = this.pendingAcks.get(tradeEventId);
    if (!pending) return;

    const elapsed = Date.now() - (pending.trade.confirmedAt?.getTime() ?? 0);
    if (elapsed > this.MAX_RETRY_DURATION_MS) {
      logger.warn('Trade ack timeout — giving up', { tradeEventId });
      clearTimeout(pending.timeoutHandle);
      this.pendingAcks.delete(tradeEventId);
      return;
    }

    pending.attempts++;
    const makerId = (pending.trade as any).makerId as string | undefined;
    if (makerId) {
      const connection = MakerConnectionRegistry.getInstance().getConnection(makerId);
      if (connection) {
        connection.send({
          type: 'trade',
          message: {
            tradeEventId,
            quoteId: pending.trade.quoteId,
            rfqId: (pending.trade as any).rfqId ?? null,
            makerAddress: pending.trade.makerAddress,
            takerAddress: pending.trade.takerAddress,
            tokenIn: pending.trade.tokenIn,
            tokenOut: pending.trade.tokenOut,
            amountIn: pending.trade.amountIn,
            amountOut: pending.trade.amountOut,
            feeAmount: pending.trade.feeAmount,
            txHash: pending.trade.txHash,
            confirmedAt: pending.trade.confirmedAt?.toISOString() ?? null,
          },
        });
      }
    }

    pending.timeoutHandle = setTimeout(
      () => this.retryNotification(tradeEventId),
      this.RETRY_INTERVAL_MS
    );
  }
}

export const tradePushService = new TradePushService();
