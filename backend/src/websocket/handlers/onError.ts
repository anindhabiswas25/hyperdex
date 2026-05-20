import { RfqErrorMessage } from '../messages/incoming';
import { MakerConnection } from '../MakerConnection';
import { PriceBook } from '../../pricebook/PriceBook';
import { rateLimitStore } from '../../rfq/RateLimitStore';
import { MakerRefusalError } from '../../utils/errors';
import { logger } from '../../utils/logger';

export function onRfqError(conn: MakerConnection, msg: RfqErrorMessage): void {
  const { rfqId, reason, expiryTimestampMs } = msg.message;
  const pending = conn.pendingRfqs.get(rfqId);

  if (!pending) {
    logger.warn('Maker error response for unknown RFQ', {
      rfqId,
      makerId: conn.makerId,
      reason,
    });
    return;
  }

  clearTimeout(pending.timeout);
  conn.pendingRfqs.delete(rfqId);

  logger.debug('Maker rejected RFQ', { rfqId, makerId: conn.makerId, reason });

  if (reason === 'rate_limit') {
    const expiryMs = expiryTimestampMs ?? Date.now() + 60_000;
    const takerAddress = pending.takerAddress;
    if (takerAddress) {
      rateLimitStore.setLimit(conn.makerId, takerAddress, expiryMs);
      logger.info('Maker rate limited taker', {
        makerId: conn.makerId,
        takerAddress,
        expiresAt: new Date(expiryMs),
      });
    }
  } else if (reason !== 'internal_error') {
    PriceBook.getInstance().recordRefusal(conn.makerId);
  }

  pending.reject(new MakerRefusalError(conn.makerId, reason));
}
