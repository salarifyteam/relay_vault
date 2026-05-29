import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITenant extends Document {
  name: string;
  rlyKey: string;
  allowedOrigins: string[];
  defaultUserSpendCapUsd?: number;
  status: "active" | "disabled";
  ownerAccountId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    rlyKey: { type: String, required: true, unique: true },
    allowedOrigins: { type: [String], default: [] },
    defaultUserSpendCapUsd: { type: Number, required: false },
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
