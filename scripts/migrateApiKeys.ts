import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import Tenant from "@/lib/models/Tenant";
import ApiKey from "@/lib/models/ApiKey";
import EndUserKey from "@/lib/models/EndUserKey";
import UsageRecord from "@/lib/models/UsageRecord";
import RateCounter from "@/lib/models/RateCounter";
import { hashApiKey } from "@/lib/keys";

// test/live 키 분리 마이그레이션. 멱등(여러 번 실행 안전).
// 운영 사용자가 없으므로 본질적으로 dev 데이터 정리 + 스키마 전환 마무리용이다.
//
// 하는 일:
//   1. tenants.rlyKey_1 (구 스키마의 유니크 인덱스) 제거 — ★ 안 지우면 rlyKey 필드 제거 후
//      두 번째 테넌트 생성 시 { rlyKey: null } 중복으로 E11000 실패(운영 지뢰).
//   2. 남아있는 평문 rlyKey가 있는 테넌트 → live ApiKey 행으로 승격(해시 저장).
//   3. EndUserKey / UsageRecord 의 environment 누락분 → "live" 백필.
//   4. tenants 문서에서 orphan rlyKey 필드 제거(정리).
async function main() {
  await dbConnect();
  const db = mongoose.connection.db;
  if (!db) throw new Error("DB 연결 없음");

  // 1) 구 유니크 인덱스 제거 (있을 때만)
  const tenantIndexes = await db.collection("tenants").indexes();
  if (tenantIndexes.some((i) => i.name === "rlyKey_1")) {
    await db.collection("tenants").dropIndex("rlyKey_1");
    console.log("✓ dropped stale index tenants.rlyKey_1");
  } else {
    console.log("· tenants.rlyKey_1 already absent");
  }

  // 2) 남은 평문 rlyKey → ApiKey(live) 승격. (Tenant 모델엔 rlyKey가 없으니 raw 컬렉션에서 읽는다)
  const legacy = await db
    .collection("tenants")
    .find({ rlyKey: { $exists: true, $ne: null } })
    .project({ _id: 1, rlyKey: 1 })
    .toArray();
  let promoted = 0;
  for (const t of legacy) {
    const secret = t.rlyKey as string;
    const keyHash = hashApiKey(secret);
    const exists = await ApiKey.findOne({ keyHash });
    if (exists) continue; // 멱등
    await ApiKey.create({
      tenantId: t._id,
      environment: "live",
      keyHash,
      prefix: "rly-",
      last4: secret.slice(-4),
      name: "default",
      status: "active",
    });
    promoted++;
  }
  console.log(`✓ promoted ${promoted} legacy rly- key(s) → ApiKey(live)`);

  // 3) environment 백필 (누락분만)
  const euk = await EndUserKey.updateMany(
    { environment: { $exists: false } },
    { $set: { environment: "live" } }
  );
  const usg = await UsageRecord.updateMany(
    { environment: { $exists: false } },
    { $set: { environment: "live" } }
  );
  console.log(`✓ backfilled environment=live on ${euk.modifiedCount} EndUserKey, ${usg.modifiedCount} UsageRecord`);

  // 4) orphan rlyKey 필드 제거(정리)
  const unset = await db.collection("tenants").updateMany(
    { rlyKey: { $exists: true } },
    { $unset: { rlyKey: "" } }
  );
  console.log(`✓ unset rlyKey on ${unset.modifiedCount} tenant doc(s)`);

  // 인덱스 동기화: environment가 추가된 컬렉션들의 구 인덱스(환경 미포함)를 제거하고
  // 새 인덱스를 빌드한다. ★ 반드시 environment 백필(위 3단계) 이후에 실행 — 그래야
  // 새 유니크 인덱스 빌드 시 null/누락 충돌이 없다. 안 하면 두 번째 환경 row에서 E11000.
  await EndUserKey.syncIndexes();
  await UsageRecord.syncIndexes();
  await RateCounter.syncIndexes();
  console.log("✓ synced indexes (EndUserKey/UsageRecord/RateCounter — environment-scoped)");

  console.log("\n마이그레이션 완료.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
