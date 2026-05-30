import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import TenantMember from "@/lib/models/TenantMember";
import mongoose from "mongoose";

// 기존 모든 Tenant.ownerAccountId → TenantMember{role:"owner"} upsert.
// 중복 안전(이미 있으면 변경 없음). RBAC 첫 배포 전 1회 실행 권장.
async function main() {
  await dbConnect();
  const tenants = await Tenant.find({ ownerAccountId: { $exists: true, $ne: null } }).lean();
  let created = 0;
  let existed = 0;
  let skipped = 0;
  for (const t of tenants) {
    if (!t.ownerAccountId) {
      skipped++;
      continue;
    }
    const existing = await TenantMember.findOne({ tenantId: t._id, accountId: t.ownerAccountId });
    if (existing) {
      existed++;
      continue;
    }
    await TenantMember.create({
      tenantId: t._id,
      accountId: t.ownerAccountId,
      role: "owner",
      joinedAt: t.createdAt || new Date(),
    });
    created++;
  }
  console.log(`\n=== RBAC backfill 완료 ===`);
  console.log(`tenants 검사: ${tenants.length}`);
  console.log(`신규 owner 멤버십 생성: ${created}`);
  console.log(`이미 존재(skip): ${existed}`);
  console.log(`ownerAccountId 없음(skip): ${skipped}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
