import { v4 as uuid } from 'uuid';
import { PriceBook } from '../pricebook/PriceBook';
import { MakerConnectionRegistry, RfqQuotePayload } from '../websocket/MakerConnection';
import { Trade } from '../db/models/Trade';
import { Maker } from '../db/models/Maker';
import { rateLimitStore } from './RateLimitStore';
import {
  ValidationError,
  NoMakersError,
  QuoteRefusedError,
  QuoteTimeoutError,
  MakerRefusalError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';

const FEES_BPS = parseInt(process.env.PROTOCOL_FEE_BPS || '10', 10);

export interface QuoteRequest {
  takerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
}

export interface SignedQuote extends RfqQuotePayload {
  rfqId: string;
  makerName: string;
  rate: string;
  expiresInSeconds: number;
}

export class RfqRouter {
  private static instance: RfqRouter;

  static getInstance(): RfqRouter {
    if (!RfqRouter.instance) {
      RfqRouter.instance = new RfqRouter();
    }
    return RfqRouter.instance;
  }

  async requestQuote(params: QuoteRequest): Promise<SignedQuote> {
    const { takerAddress, tokenIn, tokenOut, amountIn } = params;

    // STEP 1: Validate tokens and amount
    const usdc = config.USDC_CONTRACT_ADDRESS;
    const eurc = config.EURC_CONTRACT_ADDRESS;

    if (!([usdc, eurc].includes(tokenIn))) {
      throw new ValidationError('tokenIn must be USDC or EURC address');
    }
    if (!([usdc, eurc].includes(tokenOut))) {
      throw new ValidationError('tokenOut must be USDC or EURC address');
    }
    if (tokenIn === tokenOut) {
      throw new ValidationError('tokenIn and tokenOut must be different');
    }
    const amountInNum = parseInt(amountIn, 10);
    if (isNaN(amountInNum) || amountInNum <= 0) {
      throw new ValidationError('amountIn must be a positive integer string');
    }

    // STEP 2: Get ranked makers
    const priceBook = PriceBook.getInstance();
    const rankedMakers = priceBook.getBestMakers(tokenIn, tokenOut, amountInNum);
    if (rankedMakers.length === 0) {
      throw new NoMakersError('No makers available for this pair');
    }

    // STEP 3: Generate RFQ ID
    const rfqId = uuid();

    // STEP 4: Dispatch to top N makers simultaneously
    const registry = MakerConnectionRegistry.getInstance();
    const topMakers = rankedMakers.slice(0, config.RFQ_MAX_MAKERS);
    const racingPromises: Array<{ promise: Promise<RfqQuotePayload>; makerId: string }> = [];

    logger.info('RFQ dispatched', {
      rfqId,
      tokenIn: tokenIn.slice(0, 8),
      tokenOut: tokenOut.slice(0, 8),
      amountIn,
      makerCount: topMakers.length,
    });

    for (const ranked of topMakers) {
      if (rateLimitStore.isLimited(ranked.makerId, takerAddress)) {
        logger.info('Skipping rate-limited maker', {
          makerId: ranked.makerId,
          takerAddress,
          expiresAt: new Date(rateLimitStore.getExpiry(ranked.makerId, takerAddress)!),
        });
        continue;
      }

      const conn = registry.getConnection(ranked.makerId);
      if (!conn) continue;

      priceBook.incrementRfqsSent(ranked.makerId);

      const promise = conn.sendRfq(
        {
          type: 'rfq',
          message: {
            rfqId,
            takerAddress,
            tokenIn,
            tokenOut,
            amountIn,
            feesBps: FEES_BPS,
            requestedAt: Date.now(),
          },
        },
        config.RFQ_TIMEOUT_MS
      );
      racingPromises.push({ promise, makerId: ranked.makerId });
    }

    if (racingPromises.length === 0) {
      throw new NoMakersError('No connected makers for this pair');
    }

    // STEP 5: Collect all results with deadline
    const results = await Promise.allSettled(racingPromises.map(r => r.promise));

    // STEP 6: Handle rfqError results — record penalties
    const refusalReasons: string[] = [];
    let timeoutCount = 0;

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason;
        if (err instanceof MakerRefusalError) {
          refusalReasons.push(err.reason);
          logger.info('Maker refused RFQ', {
            rfqId,
            makerId: err.makerId,
            reason: err.reason,
          });
        } else {
          timeoutCount++;
          logger.debug('Maker timed out or errored', {
            rfqId,
            makerId: racingPromises[i]?.makerId,
            err: err?.message,
          });
        }
      }
    });

    // STEP 7: Collect valid quotes with basic sanity checks
    const validQuotes = results
      .filter((r): r is PromiseFulfilledResult<RfqQuotePayload> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter(q => {
        if (!q.signature || q.signature.length !== 128) return false;
        if (Number(q.amountOut) <= 0) return false;
        if (q.expiryTimestamp < Date.now() / 1000 + 10) return false;
        return true;
      });

    if (validQuotes.length === 0) {
      if (refusalReasons.length > 0) {
        throw new QuoteRefusedError(
          'Market makers could not quote this trade',
          refusalReasons
        );
      }
      if (timeoutCount > 0) {
        throw new QuoteTimeoutError('Market makers did not respond in time');
      }
      throw new NoMakersError('No valid quotes received');
    }

    // STEP 8: Validate quotes against advertised price levels
    for (const quote of validQuotes) {
      const makerEntry = topMakers.find(m => m.makerAddress === quote.makerAddress);
      if (!makerEntry) continue;

      const advertisedLevels = priceBook.getMakerLevelsForPair(
        makerEntry.makerId,
        tokenIn,
        tokenOut
      );
      if (!advertisedLevels || advertisedLevels.length === 0) continue;

      const advertisedRate = priceBook.simulateLevelRate(advertisedLevels, amountInNum);
      const actualRate = Number(quote.amountOut) / amountInNum;

      if (advertisedRate > 0) {
        const deviation = (advertisedRate - actualRate) / advertisedRate;
        if (deviation > 0.005) {
          priceBook.recordBadQuote(makerEntry.makerId, advertisedRate, actualRate);
          logger.warn('Quote worse than price levels', {
            rfqId,
            makerId: makerEntry.makerId,
            advertisedRate: advertisedRate.toFixed(6),
            actualRate: actualRate.toFixed(6),
            deviation: `${(deviation * 100).toFixed(3)}%`,
          });
        }
      }
    }

    // STEP 9: Select best quote (highest amountOut)
    validQuotes.sort((a, b) => parseFloat(b.amountOut) - parseFloat(a.amountOut));
    const bestQuote = validQuotes[0];

    logger.info('Best quote selected', {
      rfqId,
      makerAddress: bestQuote.makerAddress,
      amountOut: bestQuote.amountOut,
      competingQuotes: validQuotes.length,
    });

    // STEP 10: Save to MongoDB
    const maker = await Maker.findOne({ stellarAddress: bestQuote.makerAddress }).lean();
    const makerName = maker?.name ?? 'Unknown';

    await Trade.create({
      quoteId: bestQuote.quoteId,
      rfqId,
      makerId: maker?._id?.toString() ?? null,
      makerAddress: bestQuote.makerAddress,
      takerAddress: bestQuote.takerAddress,
      tokenIn: bestQuote.tokenIn,
      tokenOut: bestQuote.tokenOut,
      amountIn: bestQuote.amountIn,
      amountOut: bestQuote.amountOut,
      expiryTimestamp: bestQuote.expiryTimestamp,
      status: 'quoted',
      quotedAt: new Date(),
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const amountInF = parseFloat(amountIn);
    const amountOutF = parseFloat(bestQuote.amountOut);
    const rate = amountInF > 0 ? (amountOutF / amountInF).toFixed(6) : '0';

    // STEP 11: Return best quote
    return {
      ...bestQuote,
      rfqId,
      makerName,
      rate,
      expiresInSeconds: bestQuote.expiryTimestamp - nowSec,
    };
  }
}
