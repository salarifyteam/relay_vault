import mongoose, { Schema, Document, Model } from "mongoose";
import type { ByokProvider } from "@/lib/services/byokProvider";
import type { Environment } from "@/lib/keys";

export interface IRegistrationToken extends Document {
  token: string;
  tenantId: mongoose.Types.ObjectId;
  // 토큰을 발급한 rly 키의 환경. 이 토큰으로 만들어지는 EndUserKey가 이 환경을 물려받는다.
  environment: Environment;
  endUserLabel: string;
  // 미지정이면 위젯에서 최종 사용자가 프로바이더를 직접 선택한다.
  provider?: ByokProvider;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationTokenSchema = new Schema<IRegistrationToken>(
  {
    token: { type: String, required: true, unique: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
      required: true,
      index: true,
    },
    environment: { type: String, enum: ["test", "live"], required: true, default: "live" },
    endUserLabel: { type: String, required: true },
    provider: {
      type: String,
      enum: ["openai", "google", "anthropic", "xai", "zai"],
      required: false,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, required: false },
  },
  { timestamps: true }
);

// 만료된 토큰 자동 삭제 (Mongo TTL 인덱스)
RegistrationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RegistrationToken: Model<IRegistrationToken> =
  mongoose.models.RegistrationToken ||
  mongoose.model<IRegistrationToken>("RegistrationToken", RegistrationTokenSchema);

export default RegistrationToken;
