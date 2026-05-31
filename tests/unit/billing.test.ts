import { describe, it, expect } from "vitest";
import { estimateBill, suggestUpgrade } from "@/lib/billing/estimate";
import { PLANS } from "@/lib/billing/plans";

describe("estimateBill", () => {
  it("Free: 0키 → $0, 청구 없음", () => {
    const b = estimateBill("free", 0);
    expect(b.totalUsd).toBe(0);
    expect(b.baseUsd).toBe(0);
    expect(b.overageKeys).toBe(0);
    expect(b.custom).toBe(false);
  });

  it("Free 포함 100 안쪽: $0", () => {
    expect(estimateBill("free", 50).totalUsd).toBe(0);
    expect(estimateBill("free", 100).totalUsd).toBe(0);
  });

  it("Growth: 포함 200 이내 = 기본료만", () => {
    const b = estimateBill("growth", 150);
    expect(b.baseUsd).toBe(99);
    expect(b.overageKeys).toBe(0);
    expect(b.totalUsd).toBe(99);
  });

  it("Growth: 200 정확히 = 기본료만", () => {
    expect(estimateBill("growth", 200).totalUsd).toBe(99);
  });

  it("Growth 250: $99 + 50*$0.8 = $139 (브리프 예시)", () => {
    const b = estimateBill("growth", 250);
    expect(b.overageKeys).toBe(50);
    expect(b.overageUsd).toBe(40);
    expect(b.totalUsd).toBe(139);
  });

  it("Scale 2500: $499 + 500*$0.5 = $749", () => {
    const b = estimateBill("scale", 2500);
    expect(b.overageKeys).toBe(500);
    expect(b.totalUsd).toBe(749);
  });

  it("Enterprise: custom 플래그, 자동 산정 X", () => {
    const b = estimateBill("enterprise", 9999);
    expect(b.custom).toBe(true);
    expect(b.totalUsd).toBe(0);
  });

  it("0 미만(이론상 불가)에도 음수 청구 안 함", () => {
    // overageKeys = max(0, ...) 보장
    const b = estimateBill("growth", -100);
    expect(b.overageKeys).toBe(0);
    expect(b.totalUsd).toBe(99);
  });
});

describe("suggestUpgrade — 자동 업셀 힌트", () => {
  it("Free 키 적을 때: 업그레이드 권장 없음", () => {
    expect(suggestUpgrade("free", 10)).toBeNull();
  });

  it("Growth 700키: Scale이 같거나 더 저렴 → 'scale'", () => {
    // growth@700 = 99 + 500*0.8 = $499 = scale base
    expect(suggestUpgrade("growth", 700)).toBe("scale");
  });

  it("Growth 200키(포함 안): Scale은 $499 > Growth $99 → 추천 없음", () => {
    expect(suggestUpgrade("growth", 200)).toBeNull();
  });

  it("Scale: 다음 단계는 enterprise(custom) → 추천 없음", () => {
    expect(suggestUpgrade("scale", 99999)).toBeNull();
  });

  it("Enterprise: 다음 단계 없음", () => {
    expect(suggestUpgrade("enterprise", 100)).toBeNull();
  });
});

describe("PLANS 설정 무결성", () => {
  it("모든 플랜이 id 일치", () => {
    for (const [key, p] of Object.entries(PLANS)) {
      expect(p.id).toBe(key);
    }
  });

  it("Free만 hardCapKeys 있음", () => {
    expect(PLANS.free.hardCapKeys).not.toBeNull();
    expect(PLANS.growth.hardCapKeys).toBeNull();
    expect(PLANS.scale.hardCapKeys).toBeNull();
    expect(PLANS.enterprise.hardCapKeys).toBeNull();
  });

  it("플랜별 reqPerMin 점점 커짐", () => {
    expect(PLANS.free.reqPerMin).toBeLessThan(PLANS.growth.reqPerMin);
    expect(PLANS.growth.reqPerMin).toBeLessThan(PLANS.scale.reqPerMin);
  });
});
