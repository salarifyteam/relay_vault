import mongoose, { Schema, Document, Model } from "mongoose";

// 민감 작업 감사 기록. "누가 언제 무엇을 했나"를 DB에 영속(stdout 로그는 휘발성이라 별개).
export type AuditAction =
  | "key_regenerated" // rly- 키 재발급(레거시 alias)
  | "api_key_created" // API 키 발급(test/live)
  | "api_key_rolled" // API 키 롤(신규 발급 + 기존 폐기)
  | "api_key_revoked" // API 키 폐기
  | "enduser_key_revoked" // 엔드유저 BYOK 키 비활성화
  | "spend_cap_updated" // 스펜드캡 변경
  | "plan_changed" // 플랜 변경
  | "member_invited"
  | "member_removed";

export interface IAuditLog extends Document {
  tenantId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId; // 작업을 수행한 개발자 계정
  actorEmail?: string; // 사람이 읽기 쉬운 작업자 표기
  action: AuditAction;
  target?: string; // 대상 식별자(예: endUserLabel, "tenant")
  detail?: string; // 변경 요약(민감정보·키 원문 금지)
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: "DeveloperAccount", required: false },
  actorEmail: { type: String, required: false },
  action: { type: String, required: true },
  target: { type: String, required: false },
  detail: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });

const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
