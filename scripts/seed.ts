import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import EndUserKey from "@/lib/models/EndUserKey";
import { getCrypto } from "@/lib/crypto";
import { maskByokKey } from "@/lib/services/byokProvider";
import { generateRlyKey } from "@/lib/keys";
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
      rlyKey: generateRlyKey(),
      allowedOrigins: ["http://localhost:3000", "http://localhost:3001"],
    });
  }

  // 2) 엔드유저 키 (TEST_OPENAI_KEY를 암호화해 저장)
  const crypto = getCrypto();
  const sealed = await crypto.seal(rawKey, { tenantId: String(tenant._id) });

  await EndUserKey.findOneAndUpdate(
    { tenantId: tenant._id, endUserLabel: END_USER_LABEL, provider: PROVIDER },
    {
      tenantId: tenant._id,
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
  console.log("rly- 키:       ", tenant.rlyKey);
  console.log("End-user 라벨: ", END_USER_LABEL);
  console.log("저장된 키:     ", maskByokKey(rawKey), "(암호화 저장됨)");
  console.log("\n검증 curl 예시:");
  console.log(
    `curl -s -X POST http://localhost:3001/api/v1/chat/completions \\
  -H "Authorization: Bearer ${tenant.rlyKey}" \\
  -H "X-Relay-User: ${END_USER_LABEL}" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Reply with: RELAY_PAY_M2_OK"}],"max_tokens":20}'\n`
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
