import { describe, it, expect } from "vitest";
import { hasRole, requireRole } from "@/lib/requireRole";
import type { CurrentDeveloper } from "@/lib/auth";

function fakeMe(role: "owner" | "member"): CurrentDeveloper {
  return {
    // 타입만 만족시키면 됨(이 테스트는 role만 봄)
    account: {} as CurrentDeveloper["account"],
    tenant: {} as CurrentDeveloper["tenant"],
    role,
    memberships: [],
  };
}

describe("hasRole — 권한 순위", () => {
  it("owner는 member 권한 포함", () => {
    expect(hasRole(fakeMe("owner"), "member")).toBe(true);
  });

  it("owner는 owner 통과", () => {
    expect(hasRole(fakeMe("owner"), "owner")).toBe(true);
  });

  it("member는 member 통과", () => {
    expect(hasRole(fakeMe("member"), "member")).toBe(true);
  });

  it("member는 owner 권한 NO", () => {
    expect(hasRole(fakeMe("member"), "owner")).toBe(false);
  });
});

describe("requireRole — Response 반환 형태", () => {
  it("통과 시 null", () => {
    expect(requireRole(fakeMe("owner"), "member")).toBeNull();
    expect(requireRole(fakeMe("member"), "member")).toBeNull();
  });

  it("미달 시 403 JSON 응답", async () => {
    const r = requireRole(fakeMe("member"), "owner");
    expect(r).not.toBeNull();
    expect(r!.status).toBe(403);
    const body = await r!.json();
    expect(body.error.message).toMatch(/owner/i);
  });
});
