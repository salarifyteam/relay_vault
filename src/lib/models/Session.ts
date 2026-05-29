import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISession extends Document {
  sessionId: string;
  accountId: mongoose.Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: "DeveloperAccount",
    required: true,
    index: true,
  },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

// 만료 세션 자동 삭제
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session: Model<ISession> =
  mongoose.models.Session || mongoose.model<ISession>("Session", SessionSchema);

export default Session;
