import mongoose, { Schema, Document, Model } from "mongoose";

// 테넌트 초대 토큰. 링크 복사 방식(이메일 X) — Owner가 만들어 Slack 등으로 직접 전달.
// 1회용·TTL 7일. 받은 사람이 클릭→구글 로그인→자동 합류.
export interface ITenantInvite extends Document {
  token: string;
  tenantId: mongoose.Types.ObjectId;
  invitedBy: mongoose.Types.ObjectId; // 작성자 계정
  role: "member";
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const TenantInviteSchema = new Schema<ITenantInvite>({
  token: { type: String, required: true, unique: true },
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  invitedBy: { type: Schema.Types.ObjectId, ref: "DeveloperAccount", required: true },
  role: { type: String, enum: ["member"], default: "member" },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now },
});

// 만료된 초대 자동 정리
TenantInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TenantInvite: Model<ITenantInvite> =
  mongoose.models.TenantInvite || mongoose.model<ITenantInvite>("TenantInvite", TenantInviteSchema);

export default TenantInvite;
