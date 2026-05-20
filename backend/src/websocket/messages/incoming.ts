import { z } from 'zod';

const PriceLevelSchema = z.object({
  quantity: z.string(),
  price: z.string(),
});

// New format: one message with both BUY and SELL sides
export const PriceLevelsMessageSchema = z.object({
  type: z.literal('priceLevels'),
  message: z.object({
    tokenIn: z.string(),
    tokenOut: z.string(),
    buyLevels: z.array(PriceLevelSchema),
    sellLevels: z.array(PriceLevelSchema),
  }),
});

export const RfqQuoteMessageSchema = z.object({
  type: z.literal('rfqQuote'),
  message: z.object({
    rfqId: z.string().uuid(),
    quoteId: z.string().length(64),
    makerAddress: z.string(),
    takerAddress: z.string(),
    tokenIn: z.string(),
    tokenOut: z.string(),
    amountIn: z.string(),
    amountOut: z.string(),
    expiryTimestamp: z.number().int().positive(),
    salt: z.string().length(64),
    signature: z.string().length(128),
    spreadBps: z.number().int().nonnegative().optional(),
  }),
});

export const RfqErrorMessageSchema = z.object({
  type: z.literal('rfqError'),
  message: z.object({
    rfqId: z.string().uuid(),
    reason: z.enum([
      'insufficient_liquidity',
      'pair_not_supported',
      'market_conditions',
      'internal_error',
      'rate_limit',
      'below_minimum',
      'above_maximum',
      'calculation_error',
    ]),
    expiryTimestampMs: z.number().optional(),
  }),
});

export const TradeAckMessageSchema = z.object({
  type: z.literal('tradeAck'),
  message: z.object({
    tradeEventId: z.string(),
  }),
});

export const PongMessageSchema = z.object({
  type: z.literal('pong'),
  timestamp: z.number(),
});

export const IncomingMessageSchema = z.discriminatedUnion('type', [
  PriceLevelsMessageSchema,
  RfqQuoteMessageSchema,
  RfqErrorMessageSchema,
  TradeAckMessageSchema,
  PongMessageSchema,
]);

export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type PriceLevelsMessage = z.infer<typeof PriceLevelsMessageSchema>;
export type RfqQuoteMessage = z.infer<typeof RfqQuoteMessageSchema>;
export type RfqErrorMessage = z.infer<typeof RfqErrorMessageSchema>;
export type TradeAckMessage = z.infer<typeof TradeAckMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
