import mongoose, { Schema, Document, Model } from "mongoose";
import type { Environment } from "@/lib/keys";

// 발급된 API 키 1건 = 1행. Tenant.rlyKey(단일 평문)를 대체한다.
// 인증은 keyHash로 조회하고, environment가 그 요청이 어느 환경(test/live)에서 도는지를 결정한다.
// 평문은 DB에 없다(생성 시 1회만 반환). 목록엔 prefix+last4만 노출.
export interface IApiKey extends Document {
  tenantId: mongoose.Types.ObjectId;
  environment: Environment;
  keyHash: string; // sha256(secret) — 조회 키
  prefix: string; // "rly_live_" | "rly_test_" | "rly-"(레거시)
  last4: string;
  name: string;
  status: "active" | "revoked";
  createdByAccountId?: mongoose.Types.ObjectId;
  lastUsedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    environment: { type: String, enum: ["test", "live"], required: true },
    keyHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    last4: { type: String, required: true },
    name: { type: String, required: true, default: "default", trim: true },
    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
    createdByAccountId: {
      type: Schema.Types.ObjectId,
      ref: "DeveloperAccount",
      required: false,
    },
    lastUsedAt: { type: Date, required: false },
    revokedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// 콘솔 목록: 테넌트 × 환경 × 상태
ApiKeySchema.index({ tenantId: 1, environment: 1, status: 1 });

const ApiKey: Model<IApiKey> =
  mongoose.models.ApiKey || mongoose.model<IApiKey>("ApiKey", ApiKeySchema);

export default ApiKey;
