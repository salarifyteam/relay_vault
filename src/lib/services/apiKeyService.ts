import mongoose from "mongoose";
import ApiKey, { type IApiKey } from "@/lib/models/ApiKey";
import { generateApiKey, hashApiKey, type Environment } from "@/lib/keys";

export interface MintedKey {
  id: string;
  secret: string; // 평문 — 호출부가 1회만 사용자에게 반환할 것
  environment: Environment;
  prefix: string;
  last4: string;
  name: string;
}

// 새 API 키 1건 발급. 평문 secret을 1회 반환하고, DB엔 해시만 저장한다.
export async function mintApiKey(params: {
  tenantId: mongoose.Types.ObjectId | string;
  environment: Environment;
  name: string;
  createdByAccountId?: mongoose.Types.ObjectId | string;
}): Promise<MintedKey> {
  const { secret, prefix, last4 } = generateApiKey(params.environment);
  const doc = await ApiKey.create({
    tenantId: params.tenantId,
    environment: params.environment,
    keyHash: hashApiKey(secret),
    prefix,
    last4,
    name: params.name,
    status: "active",
    createdByAccountId: params.createdByAccountId,
  });
  return {
    id: String(doc._id),
    secret,
    environment: params.environment,
    prefix,
    last4,
    name: params.name,
  };
}

// 폐기(소프트): status→revoked. 이미 폐기됐으면 그대로 둔다.
export async function revokeApiKey(id: mongoose.Types.ObjectId | string): Promise<void> {
  await ApiKey.updateOne(
    { _id: id, status: "active" },
    { $set: { status: "revoked", revokedAt: new Date() } }
  );
}

// 목록 표시용 안전 형태(평문·해시 제외).
export interface ApiKeyView {
  id: string;
  environment: Environment;
  prefix: string;
  last4: string;
  name: string;
  status: "active" | "revoked";
  lastUsedAt?: Date;
  createdAt: Date;
}

export function toApiKeyView(doc: IApiKey): ApiKeyView {
  return {
    id: String(doc._id),
    environment: doc.environment,
    prefix: doc.prefix,
    last4: doc.last4,
    name: doc.name,
    status: doc.status,
    lastUsedAt: doc.lastUsedAt,
    createdAt: doc.createdAt,
  };
}
