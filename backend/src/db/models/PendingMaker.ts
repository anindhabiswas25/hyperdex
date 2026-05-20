import mongoose, { Document, Schema } from 'mongoose';

export interface IPendingMaker extends Document {
  stellarAddress: string;
  name: string;
  contactEmail?: string;
  contactTelegram?: string;
  requestedPairs: Array<{ tokenIn: string; tokenOut: string }>;
  status: 'pending' | 'approved' | 'rejected' | 'registered';
  submittedAt: Date;
  reviewedAt: Date | null;
  registeredAt: Date | null;
  onChainRegistered: boolean;
  generatedApiKey: string | null;
  apiKeyGeneratedAt: Date | null;
  adminNotes: string | null;
  makerId: mongoose.Types.ObjectId | null;
}

const PendingMakerSchema = new Schema<IPendingMaker>(
  {
    stellarAddress: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactEmail: { type: String, default: null },
    contactTelegram: { type: String, default: null },
    requestedPairs: [{ tokenIn: String, tokenOut: String }],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'registered'],
      default: 'pending',
      index: true,
    },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date, default: null },
    registeredAt: { type: Date, default: null },
    onChainRegistered: { type: Boolean, default: false },
    generatedApiKey: { type: String, default: null },
    apiKeyGeneratedAt: { type: Date, default: null },
    adminNotes: { type: String, default: null },
    makerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Maker',
      default: null,
    },
  },
  { timestamps: true }
);

export const PendingMaker = mongoose.model<IPendingMaker>('PendingMaker', PendingMakerSchema);
