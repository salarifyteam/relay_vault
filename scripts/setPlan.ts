import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import mongoose from "mongoose";

// 사용: npm run set-plan -- <rlyKey|tenantName> <free|growth|scale|enterprise>
// (Stripe 셀프서비스 붙기 전까지 테넌트 플랜을 수동 설정하는 도구)
async function main() {
  const [identifier, plan] = process.argv.slice(2);
  if (!identifier || !plan) {
    throw new Error("사용법: npm run set-plan -- <rlyKey|tenantName> <free|growth|scale|enterprise>");
  }
  if (!(plan in PLANS)) {
    throw new Error(`알 수 없는 플랜 '${plan}'. 가능: ${Object.keys(PLANS).join(", ")}`);
  }

  await dbConnect();

  const query = identifier.startsWith("rly-") ? { rlyKey: identifier } : { name: identifier };
  const tenant = await Tenant.findOne(query);
  if (!tenant) {
    throw new Error(`테넌트를 찾을 수 없습니다: ${identifier}`);
  }

  tenant.plan = plan as PlanId;
  await tenant.save();

  console.log(`\n=== 플랜 변경 완료 ===`);
  console.log("Tenant:", tenant.name);
  console.log("rly- 키:", tenant.rlyKey);
  console.log("새 플랜:", PLANS[tenant.plan].label);

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
