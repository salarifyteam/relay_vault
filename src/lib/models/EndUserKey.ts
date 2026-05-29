import mongoose, { Schema, Document, Model } from "mongoose";
import type { ByokProvider } from "@/lib/services/byokProvider";

export interface IEndUserKey extends Document {
  tenantId: mongoose.Types.ObjectId;
  endUserLabel: string;
  provider: ByokProvider;
  keyEncrypted: string;
  keyMasked: string;
  cryptoVersion: string;
  wrappedDataKey?: string;
  validationState: "pending" | "valid" | "invalid";
  availableModels?: string[];
  lastValidatedAt?: Date;
  lastError?: string;
  spendCapUsd?: number;
  spentUsd: number;
  ownerUserId?: mongoose.Types.ObjectId;
  isActive: boolean;
  isPaid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EndUserKeySchema = new Schema<IEndUserKey>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    endUserLabel: { type: String, required: true },
    provider: {
      type: String,
      enum: ["openai", "google", "anthropic", "xai", "zai"],
      required: true,
    },
    keyEncrypted: { type: String, required: true },
    keyMasked: { type: String, required: true },
    cryptoVersion: { type: String, required: true },
    wrappedDataKey: { type: String, required: false },
    validationState: {
      type: String,
      enum: ["pending", "valid", "invalid"],
      default: "pending",
    },
    availableModels: { type: [String], required: false },
    lastValidatedAt: { type: Date, required: false },
    lastError: { type: String, required: false },
    spendCapUsd: { type: Number, required: false },
    spentUsd: { type: Number, default: 0 },
    ownerUserId: { type: Schema.Types.ObjectId, required: false },
    isActive: { type: Boolean, default: true },
    // 과금 분류: 유료 엔드유저 키인지. 무료앱+BYOK는 X-Relay-Paid:false로 false 처리(브리프 §5).
    isPaid: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EndUserKeySchema.index(
  { tenantId: 1, endUserLabel: 1, provider: 1 },
  { unique: true }
);
EndUserKeySchema.index({ ownerUserId: 1 }, { sparse: true });

const EndUserKey: Model<IEndUserKey> =
  mongoose.models.EndUserKey ||
  mongoose.model<IEndUserKey>("EndUserKey", EndUserKeySchema);

export default EndUserKey;
