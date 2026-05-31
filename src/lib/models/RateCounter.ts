import mongoose, { Schema, Document, Model } from "mongoose";
import type { Environment } from "@/lib/keys";

// 테넌트×환경별 고정윈도(1분) 요청 카운터. Cloud Run 다중 인스턴스에서 교차-정확하도록 DB에 둔다.
// 환경 분리: test 트래픽이 live 레이트리밋 예산을 먹지 않는다(반대도 동일).
export interface IRateCounter extends Document {
  tenantId: mongoose.Types.ObjectId;
  environment: Environment;
  windowStart: Date; // 분 단위 윈도 시작
  count: number;
  createdAt: Date;
}

const RateCounterSchema = new Schema<IRateCounter>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  environment: { type: String, enum: ["test", "live"], required: true, default: "live" },
  windowStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

RateCounterSchema.index({ tenantId: 1, environment: 1, windowStart: 1 }, { unique: true });
// 윈도 만료 후 자동 정리(2분 여유)
RateCounterSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 });

const RateCounter: Model<IRateCounter> =
  mongoose.models.RateCounter ||
  mongoose.model<IRateCounter>("RateCounter", RateCounterSchema);

export default RateCounter;
