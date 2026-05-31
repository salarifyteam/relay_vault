import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import EndUserKey from "@/lib/models/EndUserKey";
import ApiKey from "@/lib/models/ApiKey";
import { getCrypto } from "@/lib/crypto";
import { maskByokKey } from "@/lib/services/byokProvider";
import { mintApiKey } from "@/lib/services/apiKeyService";
import mongoose from "mongoose";

const TENANT_NAME = "노트메이트 (seed)";
const END_USER_LABEL = "jieun_123";
const PROVIDER = "openai" as const;

async function main() {
  const rawKey = process.env.TEST_OPENAI_KEY;
  if (!rawKey) {
    throw new Error("TEST_OPENAI_KEY가 .env.local에 없습니다. 시드할 BYOK 키가 필요합니다.");
  }

  await dbConnect();

  // 1) 테넌트 (없으면 생성, 있으면 재사용)
  let tenant = await Tenant.findOne({ name: TENANT_NAME });
  if (!tenant) {
    tenant = await Tenant.create({
      name: TENANT_NAME,
      allowedOrigins: ["http://localhost:3000", "http://localhost:3001"],
    });
  }

  // 1b) live API 키 보장 — 시드는 재실행 가능해야 하므로 없을 때만 새로 발급.
  // (해시 저장이라 평문은 발급 순간에만 얻을 수 있어, 새로 발급한 경우에만 curl 예시에 평문을 노출)
  let liveSecret: string | null = null;
  const existingLive = await ApiKey.findOne({ tenantId: tenant._id, environment: "live", status: "active" });
  if (!existingLive) {
    const minted = await mintApiKey({ tenantId: String(tenant._id), environment: "live", name: "seed" });
    liveSecret = minted.secret;
  }

  // 2) 엔드유저 키 (TEST_OPENAI_KEY를 암호화해 저장) — live 환경에 시드
  const crypto = getCrypto();
  const sealed = await crypto.seal(rawKey, { tenantId: String(tenant._id) });

  await EndUserKey.findOneAndUpdate(
    { tenantId: tenant._id, environment: "live", endUserLabel: END_USER_LABEL, provider: PROVIDER },
    {
      tenantId: tenant._id,
      environment: "live",
      endUserLabel: END_USER_LABEL,
      provider: PROVIDER,
      keyEncrypted: sealed.ciphertext,
      keyMasked: maskByokKey(rawKey),
      cryptoVersion: sealed.cryptoVersion,
      wrappedDataKey: sealed.wrappedDataKey,
      validationState: "valid",
      isActive: true,
    },
    { upsert: true, new: true }
  );

  console.log("\n=== SEED 완료 ===");
  console.log("Tenant:        ", TENANT_NAME);
  console.log("End-user 라벨: ", END_USER_LABEL);
  console.log("저장된 키:     ", maskByokKey(rawKey), "(암호화 저장됨)");
  if (liveSecret) {
    console.log("live API 키:   ", liveSecret, "(지금만 표시 — 해시 저장되어 다시 못 봄)");
    console.log("\n검증 curl 예시:");
    console.log(
      `curl -s -X POST http://localhost:3001/api/v1/chat/completions \\
  -H "Authorization: Bearer ${liveSecret}" \\
  -H "X-Relay-User: ${END_USER_LABEL}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Reply with: RELAY_PAY_M2_OK"}],"max_tokens":20}'\n`
    );
  } else {
    console.log("live API 키:    이미 존재(평문은 최초 발급 시에만 표시됨). 콘솔에서 롤하여 새 키 발급 가능.");
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
