import { RfqQuoteMessage } from '../messages/incoming';
import { MakerConnection } from '../MakerConnection';
import { logger } from '../../utils/logger';
import { auctionStore } from '../../rfq/AuctionStore';

export function onRfqQuote(conn: MakerConnection, msg: RfqQuoteMessage): void {
  const { rfqId } = msg.message;

  // Route to auction store (sealed bid path)
  const auction = auctionStore.get(rfqId);
  if (auction) {
    auctionStore.addQuote(rfqId, {
      quoteId:         msg.message.quoteId,
      makerAddress:    msg.message.makerAddress,
      tokenIn:         msg.message.tokenIn,
      tokenOut:        msg.message.tokenOut,
      amountIn:        msg.message.amountIn,
      amountOut:       msg.message.amountOut,
      expiryTimestamp: msg.message.expiryTimestamp,
      salt:            msg.message.salt,
      signature:       msg.message.signature
    });
    return;
  }

  // Fallback: old instant-quote pending promise
  const pending = conn.pendingRfqs.get(rfqId);

  if (!pending) {
    logger.warn('Maker responded after deadline', {
      rfqId,
      makerId: conn.makerId,
      latencyMs: 'unknown — already expired',
    });
    return;
  }

  if (!msg.message.signature || msg.message.signature.length !== 128) {
    logger.error('Invalid signature length from maker', {
      makerId:         conn.makerId,
      signatureLength: msg.message.signature?.length,
      rfqId,
    });
    clearTimeout(pending.timeout);
    conn.pendingRfqs.delete(rfqId);
    pending.reject(new Error('Invalid signature length'));
    return;
  }

  clearTimeout(pending.timeout);
  conn.pendingRfqs.delete(rfqId);

  logger.debug('Individual maker quote received', {
    rfqId,
    makerId:   conn.makerId,
    amountOut: msg.message.amountOut,
  });

  pending.resolve(msg.message);
}
