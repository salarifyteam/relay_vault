import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import DeveloperAccount from "@/lib/models/DeveloperAccount";
import Tenant from "@/lib/models/Tenant";
import TenantMember from "@/lib/models/TenantMember";
import { ensureTenant } from "@/lib/auth";
import { clearAllTestCollections, disconnectTestDb } from "../helpers/db";

beforeAll(async () => {
  await clearAllTestCollections();
});
beforeEach(async () => {
  await Tenant.deleteMany({});
  await TenantMember.deleteMany({});
  await DeveloperAccount.deleteMany({});
});
afterAll(async () => {
  await disconnectTestDb();
});

async function mkAccount(sub: string, email: string) {
  return DeveloperAccount.create({ googleSub: sub, email });
}

describe("ensureTenant — 첫 로그인 자동 생성 + 멤버십", () => {
  it("처음: 'My App' Tenant + owner TenantMember 동시 생성", async () => {
    const a = await mkAccount("sub-1", "a@test");
    const t = await ensureTenant(String(a._id));
    expect(t.name).toBe("My App");
    // 키 자동 발급 없음: API 키는 별도 ApiKey 컬렉션에서 콘솔로 직접 발급(reveal-once).
    const m = await TenantMember.findOne({ tenantId: t._id, accountId: a._id });
    expect(m).toBeTruthy();
    expect(m!.role).toBe("owner");
  });

  it("두 번 호출해도 멤버십 1건만(멱등)", async () => {
    const a = await mkAccount("sub-2", "b@test");
    await ensureTenant(String(a._id));
    await ensureTenant(String(a._id));
    const count = await TenantMember.countDocuments({ accountId: a._id });
    expect(count).toBe(1);
    const tCount = await Tenant.countDocuments({ ownerAccountId: a._id });
    expect(tCount).toBe(1);
  });

  it("계정마다 별개 테넌트", async () => {
    const a1 = await mkAccount("sub-a", "x@test");
    const a2 = await mkAccount("sub-b", "y@test");
    const t1 = await ensureTenant(String(a1._id));
    const t2 = await ensureTenant(String(a2._id));
    expect(String(t1._id)).not.toBe(String(t2._id));
  });
});

describe("TenantMember 인덱스 — 동일(tenant, account) unique", () => {
  it("같은 (tenant, account)로 두 번 insert → 두 번째는 거부", async () => {
    const a = await mkAccount("sub-u", "u@test");
    const t = await Tenant.create({ name: "T" });
    await TenantMember.create({ tenantId: t._id, accountId: a._id, role: "owner", joinedAt: new Date() });
    await expect(
      TenantMember.create({ tenantId: t._id, accountId: a._id, role: "member", joinedAt: new Date() })
    ).rejects.toBeDefined();
  });

  it("다른 테넌트에는 같은 계정이 또 가입 가능", async () => {
    const a = await mkAccount("sub-multi", "m@test");
    const t1 = await Tenant.create({ name: "T1" });
    const t2 = await Tenant.create({ name: "T2" });
    await TenantMember.create({ tenantId: t1._id, accountId: a._id, role: "owner", joinedAt: new Date() });
    await TenantMember.create({ tenantId: t2._id, accountId: a._id, role: "member", joinedAt: new Date() });
    expect(await TenantMember.countDocuments({ accountId: a._id })).toBe(2);
  });
});
