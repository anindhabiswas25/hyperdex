import mongoose, { Document, Schema } from 'mongoose';

export interface IApiKey extends Document {
  makerId: mongoose.Types.ObjectId;
  keyHash: string;
  keyPrefix: string;
  label: string;
  active: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    makerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Maker',
      required: true,
      index: true,
    },
    keyHash: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    label: { type: String, default: 'Default' },
    active: { type: Boolean, default: true, index: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
