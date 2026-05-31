import mongoose, { Schema, Document, Model } from "mongoose";
import type { ByokProvider } from "@/lib/services/byokProvider";
import type { Environment } from "@/lib/keys";

export interface IUsageRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  environment: Environment;
  endUserLabel: string;
  provider: ByokProvider;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  estimatedCostUsd: number;
  stream: boolean;
  requestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UsageRecordSchema = new Schema<IUsageRecord>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
    },
    environment: { type: String, enum: ["test", "live"], required: true, default: "live" },
    endUserLabel: { type: String, required: true },
    provider: {
      type: String,
      enum: ["openai", "google", "anthropic", "xai", "zai"],
      required: true,
    },
    modelName: { type: String, required: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cachedInputTokens: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: 0 },
    stream: { type: Boolean, default: false },
    requestId: { type: String, required: false },
  },
  { timestamps: true }
);

UsageRecordSchema.index({ tenantId: 1, environment: 1, endUserLabel: 1, createdAt: -1 });

const UsageRecord: Model<IUsageRecord> =
  mongoose.models.UsageRecord ||
  mongoose.model<IUsageRecord>("UsageRecord", UsageRecordSchema);

export default UsageRecord;
