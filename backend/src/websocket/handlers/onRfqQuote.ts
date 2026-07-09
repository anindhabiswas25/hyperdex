import { RfqQuoteMessage } from '../messages/incoming';
import { MakerConnection } from '../MakerConnection';
import { logger } from '../../utils/logger';
import { auctionStore } from '../../rfq/AuctionStore';
import { Maker } from '../../db/models/Maker';
import { verifyQuoteSignature, VerifiableQuote } from '../../rfq/verifyQuoteSignature';
import { getOnChainSignerKey } from '../../utils/stellarUtils';

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

  // Verify the ed25519 signature off-chain against the maker's key AS REGISTERED
  // ON-CHAIN in pool_registry — the exact key quote_verifier will check at
  // settlement. Using the on-chain key (not the mutable MongoDB copy) guarantees
  // a bid that passes here also passes on-chain, so a fake high bid can't win an
  // auction and detonate at the trader's expense, and an honest bid is never
  // rejected because the DB drifted from the registry.
  let signerKey: string;
  try {
    const maker = await Maker.findOne({ stellarAddress: conn.makerAddress, active: true }).lean();
    if (!maker) {
      logger.warn('Maker not active — bid rejected', {
        maker: conn.makerName,
        rfqId: rfqId.slice(0, 8),
      });
      return;
    }
    const onChainKey = await getOnChainSignerKey(conn.makerAddress);
    if (!onChainKey) {
      logger.warn('No on-chain signer key in registry — bid rejected', {
        maker: conn.makerName,
        rfqId: rfqId.slice(0, 8),
      });
      return;
    }
    signerKey = onChainKey;
  } catch (err) {
    logger.error('Error fetching on-chain signer key for verification', {
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
