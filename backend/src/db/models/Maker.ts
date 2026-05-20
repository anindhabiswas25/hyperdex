import mongoose, { Document, Schema } from 'mongoose';

export interface IMaker extends Document {
  stellarAddress: string;
  name: string;
  signerPublicKey: string;
  active: boolean;
  serverUrl: string | null;
  supportedPairs: Array<{ tokenIn: string; tokenOut: string }>;
  connectionStatus: 'connected' | 'disconnected' | 'unknown';
  lastSeenAt: Date | null;
  totalVolume: number;
  totalTrades: number;
  totalFeesEarned: number;
  createdAt: Date;
  updatedAt: Date;
}

const MakerSchema = new Schema<IMaker>(
  {
    stellarAddress: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    signerPublicKey: { type: String, default: '' },
    active: { type: Boolean, default: true, index: true },
    serverUrl: { type: String, default: null },
    supportedPairs: [{ tokenIn: String, tokenOut: String }],
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'unknown'],
      default: 'unknown',
    },
    lastSeenAt: { type: Date, default: null, index: { sparse: true } },
    totalVolume: { type: Number, default: 0 },
    totalTrades: { type: Number, default: 0 },
    totalFeesEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MakerSchema.index({ lastSeenAt: -1 });

export const Maker = mongoose.model<IMaker>('Maker', MakerSchema);
