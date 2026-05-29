import mongoose, { Schema, Document, Model } from "mongoose";
import type { ByokProvider } from "@/lib/services/byokProvider";

export interface IRegistrationToken extends Document {
  token: string;
  tenantId: mongoose.Types.ObjectId;
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
