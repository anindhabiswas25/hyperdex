import { RfqQuoteMessage } from '../messages/incoming';
import { MakerConnection } from '../MakerConnection';
import { logger } from '../../utils/logger';
import { auctionStore } from '../../rfq/AuctionStore';
import { Maker } from '../../db/models/Maker';
import { verifyQuoteSignature, VerifiableQuote } from '../../rfq/verifyQuoteSignature';

export async function onRfqQuote(conn: MakerConnection, msg: RfqQuoteMessage): Promise<void> {
  const m = msg.message;
  const rfqId = m?.rfqId;

  if (!rfqId) {
    logger.warn('rfqQuote missing rfqId', { maker: conn.makerName });
    return;
  }

  // Bind the bid to the AUTHENTICATED connection identity. The makerAddress
  // field in the payload is ignored entirely — trusting it would let any maker
  // impersonate another or submit unlimited bids under fabricated addresses.
  const quote: VerifiableQuote & { signature: string } = {
    quoteId: m.quoteId,
    makerAddress: conn.makerAddress,
    takerAddress: m.takerAddress,
    tokenIn: m.tokenIn,
    tokenOut: m.tokenOut,
    amountIn: m.amountIn,
    amountOut: m.amountOut,
    expiryTimestamp: m.expiryTimestamp,
    salt: m.salt,
    signature: m.signature,
  };

  // Cheap structural checks before touching the DB.
  if (!quote.signature || quote.signature.length !== 128) {
    logger.warn('Invalid signature format', { maker: conn.makerName, rfqId: rfqId.slice(0, 8) });
    return;
  }
  if (!quote.amountOut || Number(quote.amountOut) <= 0) {
    logger.warn('Invalid amountOut', { maker: conn.makerName, rfqId: rfqId.slice(0, 8) });
    return;
  }
  if (!quote.expiryTimestamp || quote.expiryTimestamp <= Math.floor(Date.now() / 1000)) {
    logger.warn('Quote already expired', { maker: conn.makerName, rfqId: rfqId.slice(0, 8) });
    return;
  }

  // Fetch the maker's registered signer key and verify the ed25519 signature
  // off-chain. This rejects fake high bids (garbage signatures) before they can
  // win an auction and detonate on-chain at the trader's expense.
  let signerKey: string;
  try {
    const maker = await Maker.findOne({ stellarAddress: conn.makerAddress, active: true }).lean();
    if (!maker || !maker.signerPublicKey || !/^[0-9a-f]{64}$/.test(maker.signerPublicKey)) {
      logger.warn('Maker has no registered signer key — bid rejected', {
        maker: conn.makerName,
        rfqId: rfqId.slice(0, 8),
      });
      return;
    }
    signerKey = maker.signerPublicKey;
  } catch (err) {
    logger.error('Error fetching maker for verification', {
      err: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!verifyQuoteSignature(quote, quote.signature, signerKey)) {
    logger.warn('INVALID SIGNATURE — bid rejected', {
      maker: conn.makerName,
      rfqId: rfqId.slice(0, 8),
      amountOut: quote.amountOut,
    });
    return;
  }

  logger.info('Signature verified — bid accepted', {
    maker: conn.makerName,
    rfqId: rfqId.slice(0, 8),
    amountOut: quote.amountOut,
  });

  // Route to auction store (sealed-bid path).
  const auction = auctionStore.get(rfqId);
  if (auction) {
    auctionStore.addQuote(rfqId, {
      quoteId: quote.quoteId,
      makerAddress: quote.makerAddress,
      tokenIn: quote.tokenIn,
      tokenOut: quote.tokenOut,
      amountIn: quote.amountIn,
      amountOut: quote.amountOut,
      expiryTimestamp: quote.expiryTimestamp,
      salt: quote.salt,
      signature: quote.signature,
    });
    return;
  }

  // Fallback: legacy instant-quote pending promise.
  const pending = conn.pendingRfqs.get(rfqId);
  if (!pending) {
    logger.warn('Maker responded after deadline', { rfqId, makerId: conn.makerId });
    return;
  }
  clearTimeout(pending.timeout);
  conn.pendingRfqs.delete(rfqId);
  pending.resolve({ ...quote, rfqId });
}
