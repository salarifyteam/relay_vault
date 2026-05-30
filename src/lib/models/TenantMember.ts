import mongoose, { Schema, Document, Model } from "mongoose";

// 테넌트 ↔ 계정 멤버십. RBAC의 진실의 원천(Tenant.ownerAccountId는 호환용 유지).
export type TenantRole = "owner" | "member";

export interface ITenantMember extends Document {
  tenantId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  role: TenantRole;
  joinedAt: Date;
  createdAt: Date;
}

const TenantMemberSchema = new Schema<ITenantMember>({
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  accountId: { type: Schema.Types.ObjectId, ref: "DeveloperAccount", required: true },
  role: { type: String, enum: ["owner", "member"], required: true },
  joinedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

TenantMemberSchema.index({ tenantId: 1, accountId: 1 }, { unique: true });
TenantMemberSchema.index({ accountId: 1 });

const TenantMember: Model<ITenantMember> =
  mongoose.models.TenantMember || mongoose.model<ITenantMember>("TenantMember", TenantMemberSchema);

export default TenantMember;
