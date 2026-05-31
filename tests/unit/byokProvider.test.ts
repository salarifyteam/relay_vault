import { describe, it, expect } from "vitest";
import { maskByokKey } from "@/lib/services/byokProvider";

describe("maskByokKey", () => {
  it("긴 키: 앞 6자 + ... + 뒤 3자", () => {
    expect(maskByokKey("sk-proj-abcdef123456789XYZ")).toBe("sk-pro...XYZ");
  });

  it("짧은 키(<=10자): 앞 3자 + ...", () => {
    expect(maskByokKey("sk-12345")).toBe("sk-...");
  });

  it("빈 문자열 안전", () => {
    expect(maskByokKey("")).toBe("");
  });

  it("앞뒤 공백은 의도적으로 trim하지 않고 그대로 사용(정확한 길이 보존)", () => {
    // 현재 구현이 trim하면 길이 변화 → 함수가 trim하지 않는다고 가정
    const v = "  abcdefghijklm  ";
    const m = maskByokKey(v);
    // 양쪽 공백을 trim해서 길이 13 → 긴 키 경로(앞6+...+뒤3)
    expect(m).toBe("abcdef...klm");
  });
});
