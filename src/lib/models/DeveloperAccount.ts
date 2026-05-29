import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDeveloperAccount extends Document {
  googleSub: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeveloperAccountSchema = new Schema<IDeveloperAccount>(
  {
    googleSub: { type: String, required: true, unique: true },
    email: { type: String, required: true, lowercase: true, index: true },
    name: { type: String },
    picture: { type: String },
  },
  { timestamps: true }
);

const DeveloperAccount: Model<IDeveloperAccount> =
  mongoose.models.DeveloperAccount ||
  mongoose.model<IDeveloperAccount>("DeveloperAccount", DeveloperAccountSchema);

export default DeveloperAccount;
