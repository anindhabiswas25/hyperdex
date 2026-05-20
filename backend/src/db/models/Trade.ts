import mongoose, { Document, Schema } from 'mongoose';

export type TradeStatus = 'quoted' | 'submitted' | 'confirmed' | 'failed' | 'expired';

export interface ITrade extends Document {
  quoteId: string;
  rfqId: string | null;
  poolAddress: string | null;
  makerId: string | null;
  makerAddress: string;
  takerAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountInUsd: number | null;
  feeAmount: string;
  txHash: string | null;
  status: TradeStatus;
  failureReason: string | null;
  quotedAt: Date;
  submittedAt: Date | null;
  confirmedAt: Date | null;
  expiryTimestamp: number;
}

const TradeSchema = new Schema<ITrade>({
  quoteId: { type: String, required: true, unique: true, index: true },
  rfqId: { type: String, default: null },
  poolAddress: { type: String, default: null },
  makerId: { type: String, default: null },
  makerAddress: { type: String, required: true, index: true },
  takerAddress: { type: String, required: true, index: true },
  tokenIn: { type: String, required: true },
  tokenOut: { type: String, required: true },
  amountIn: { type: String, required: true },
  amountOut: { type: String, required: true },
  amountInUsd: { type: Number, default: null },
  feeAmount: { type: String, default: '0' },
  txHash: { type: String, default: null, index: { sparse: true } },
  failureReason: { type: String, default: null },
  status: {
    type: String,
    enum: ['quoted', 'submitted', 'confirmed', 'failed', 'expired'],
    default: 'quoted',
    index: true,
  },
  quotedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  confirmedAt: { type: Date, default: null },
  expiryTimestamp: { type: Number, required: true },
});

TradeSchema.index({ quotedAt: -1 });
TradeSchema.index({ makerAddress: 1, quotedAt: -1 });

export const Trade = mongoose.model<ITrade>('Trade', TradeSchema);
