import mongoose, { Schema, Document, Model } from "mongoose";
import type { PlanId } from "@/lib/billing/plans";

export interface ITenant extends Document {
  name: string;
  allowedOrigins: string[];
  defaultUserSpendCapUsd?: number;
  plan: PlanId;
  status: "active" | "disabled";
  ownerAccountId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// API 키는 별도 ApiKey 컬렉션(해시 저장)으로 이동. Tenant엔 평문 키를 두지 않는다.
const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    allowedOrigins: { type: [String], default: [] },
    defaultUserSpendCapUsd: { type: Number, required: false },
    plan: {
      type: String,
      enum: ["free", "growth", "scale", "enterprise"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
    ownerAccountId: {
      type: Schema.Types.ObjectId,
      ref: "DeveloperAccount",
      required: false,
      index: true,
      sparse: true,
    },
  },
  { timestamps: true }
);

const Tenant: Model<ITenant> =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);

export default Tenant;
