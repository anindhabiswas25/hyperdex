import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { RfqRouter } from '../rfq/RfqRouter';
import { Trade } from '../db/models/Trade';
import { Maker } from '../db/models/Maker';
import {
  ValidationError,
  NotFoundError,
  NoMakersError,
  QuoteRefusedError,
  QuoteTimeoutError,
} from '../utils/errors';
import { config } from '../config';
import { logger } from '../utils/logger';
import { auctionStore } from '../rfq/AuctionStore';
import { MakerConnectionRegistry } from '../websocket/MakerConnection';
import { PriceBook } from '../pricebook/PriceBook';
import { rateLimitStore } from '../rfq/RateLimitStore';

const router = Router();

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});

// Auctions fan out RFQs to every connected maker, so they need a tighter cap
// than plain reads. Keyed by taker address when present, falling back to IP.
const auctionLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => (req.body?.takerAddress as string) || req.ip || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many quote requests. Please wait before trying again.',
      },
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Result polling is frequent (once/sec for ~30s) but cheap; allow generous IP-based polling.
const resultLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  keyGenerator: (req) => req.ip || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
});

const QuoteRequestSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.string().regex(/^\d+$/, 'amountIn must be a positive integer string'),
  takerAddress: z.string().regex(/^G[A-Z2-7]{55}$/, 'invalid Stellar address'),
});

const ConfirmSchema = z.object({
  quoteId: z.string().min(1),
  txHash: z.string().min(1),
  takerAddress: z.string().regex(/^G[A-Z2-7]{55}$/, 'invalid Stellar address'),
});

router.post('/api/quote', limiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = QuoteRequestSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: body.error.issues.map(i => i.message).join('; '),
        },
      });
      return;
    }

    const { tokenIn, tokenOut, amountIn, takerAddress } = body.data;
    const usdc = config.USDC_CONTRACT_ADDRESS;
    const eurc = config.EURC_CONTRACT_ADDRESS;

    if (![usdc, eurc].includes(tokenIn)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'tokenIn must be USDC or EURC' },
      });
      return;
    }
    if (![usdc, eurc].includes(tokenOut)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'tokenOut must be USDC or EURC' },
      });
      return;
    }
    if (tokenIn === tokenOut) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'tokenIn and tokenOut must differ' },
      });
      return;
    }

    const quote = await RfqRouter.getInstance().requestQuote({
      tokenIn,
      tokenOut,
      amountIn,
      takerAddress,
    });
    res.json({ success: true, quote });
  } catch (err) {
    if (err instanceof NoMakersError) {
      res.status(503).json({
        success: false,
        error: { code: 'NO_MAKERS', message: err.message },
      });
      return;
    }
    if (err instanceof QuoteRefusedError) {
      res.status(503).json({
        success: false,
        error: { code: 'QUOTE_REFUSED', message: err.message, reasons: err.reasons },
      });
      return;
    }
    if (err instanceof QuoteTimeoutError) {
      res.status(503).json({
        success: false,
        error: { code: 'QUOTE_TIMEOUT', message: err.message },
      });
      return;
    }
    if (err instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: (err as Error).message },
      });
      return;
    }
    next(err);
  }
});

router.post('/api/quote/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ConfirmSchema.safeParse(req.body);
    if (!body.success) {
      throw new ValidationError(body.error.issues.map(i => i.message).join('; '));
    }

    const { quoteId, txHash, takerAddress } = body.data;
    const trade = await Trade.findOne({ quoteId });
    if (!trade) throw new NotFoundError(`Trade not found for quoteId: ${quoteId}`);
    if (trade.takerAddress !== takerAddress) throw new ValidationError('takerAddress mismatch');

    trade.status = 'submitted';
    trade.txHash = txHash;
    trade.submittedAt = new Date();
    await trade.save();

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/quote/start ───────────────────────────────────────────────────

router.post('/api/quote/start', auctionLimiter, async (req: Request, res: Response) => {
  try {
    const { tokenIn, tokenOut, amountIn, takerAddress } = req.body

    const usdc = config.USDC_CONTRACT_ADDRESS
    const eurc = config.EURC_CONTRACT_ADDRESS

    if (![usdc, eurc].includes(tokenIn) || ![usdc, eurc].includes(tokenOut)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Unsupported token. Supported: USDC, EURC' }
      })
      return
    }
    if (tokenIn === tokenOut) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'tokenIn and tokenOut must be different' }
      })
      return
    }
    if (!amountIn || isNaN(Number(amountIn)) || Number(amountIn) <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Invalid amount' }
      })
      return
    }
    if (!takerAddress || !/^G[A-Z2-7]{55}$/.test(takerAddress)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PARAMS', message: 'Invalid taker address' }
      })
      return
    }

    const rankedMakers = PriceBook.getInstance().getBestMakers(
      tokenIn, tokenOut, Number(amountIn)
    )

    if (rankedMakers.length === 0) {
      res.status(503).json({
        success: false,
        error: { code: 'NO_MAKERS', message: 'No market makers are currently online' }
      })
      return
    }

    const auctionId = randomUUID()
    const WINDOW_MS = 30_000

    auctionStore.create({
      auctionId,
      tokenIn,
      tokenOut,
      amountIn,
      takerAddress,
      makerCount: rankedMakers.length,
      windowMs: WINDOW_MS
    })

    const registry = MakerConnectionRegistry.getInstance()
    let dispatched = 0
    for (const maker of rankedMakers) {
      if (rateLimitStore.isLimited(maker.makerId, takerAddress)) continue
      const conn = registry.getConnection(maker.makerId)
      if (!conn) continue

      conn.send({
        type: 'rfq',
        message: {
          rfqId:       auctionId,
          takerAddress,
          tokenIn,
          tokenOut,
          amountIn,
          feesBps:     config.PROTOCOL_FEE_BPS,
          requestedAt: Date.now()
        }
      })
      dispatched++

      logger.info('RFQ dispatched', {
        auctionId: auctionId.slice(0, 8),
        maker:     maker.makerId.slice(0, 8)
      })
    }

    if (dispatched === 0) {
      res.status(503).json({
        success: false,
        error: { code: 'NO_MAKERS', message: 'No makers available (all rate-limited)' }
      })
      return
    }

    setTimeout(() => {
      auctionStore.complete(auctionId)
    }, WINDOW_MS + 500)

    res.json({
      success:       true,
      auctionId,
      makerCount:    dispatched,
      windowSeconds: 30,
      message:       `Collecting sealed bids from ${dispatched} maker(s)`
    })

  } catch (err: any) {
    logger.error('Error starting auction', { err: err.message })
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message }
    })
  }
})

// ─── GET /api/quote/result/:auctionId ────────────────────────────────────────

router.get('/api/quote/result/:auctionId', resultLimiter, async (req: Request, res: Response) => {
  try {
    const { auctionId } = req.params
    const auction = auctionStore.get(auctionId)

    if (!auction) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Auction not found' }
      })
      return
    }

    if (auction.status === 'collecting') {
      const elapsed   = Date.now() - auction.startedAt
      const remaining = Math.max(0, Math.ceil((auction.windowMs - elapsed) / 1000))
      res.json({
        success:          true,
        status:           'collecting',
        auctionId,
        quotesReceived:   auction.quotes.length,
        makerCount:       auction.makerCount,
        secondsRemaining: remaining
      })
      return
    }

    if (auction.status === 'no_quotes') {
      res.json({
        success:  true,
        status:   'no_quotes',
        auctionId,
        message:  'No makers submitted bids for this trade'
      })
      return
    }

    if (auction.status === 'completed' && auction.bestQuote) {
      const q = auction.bestQuote

      let makerName = 'Market Maker'
      try {
        const maker = await Maker.findOne({ stellarAddress: q.makerAddress })
        if (maker?.name) makerName = maker.name
      } catch { /* ignore */ }

      const amtIn    = Number(auction.amountIn)
      const amtOut   = Number(q.amountOut)
      const rate     = (amtOut / amtIn).toFixed(7)
      const humanIn  = (amtIn  / 1e7).toFixed(7)
      const humanOut = (amtOut / 1e7).toFixed(7)
      const inSym    = auction.tokenIn  === config.USDC_CONTRACT_ADDRESS ? 'USDC' : 'EURC'
      const outSym   = auction.tokenOut === config.USDC_CONTRACT_ADDRESS ? 'USDC' : 'EURC'

      res.json({
        success:  true,
        status:   'completed',
        auctionId,
        bestQuote: {
          quoteId:         q.quoteId,
          makerAddress:    q.makerAddress,
          takerAddress:    auction.takerAddress,
          makerName,
          tokenIn:         auction.tokenIn,
          tokenOut:        auction.tokenOut,
          amountIn:        auction.amountIn,
          amountOut:       q.amountOut,
          expiryTimestamp: q.expiryTimestamp,
          salt:            q.salt,
          signature:       q.signature,
          rate:            `1 ${inSym} = ${rate} ${outSym}`,
          humanAmountIn:   humanIn,
          humanAmountOut:  humanOut,
          quotesReceived:  auction.quotes.length,
          allBidsCount:    auction.quotes.length
        }
      })
      return
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Unknown state' }
    })

  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message }
    })
  }
})

export default router;
