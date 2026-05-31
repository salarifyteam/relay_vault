import { test, expect } from "@playwright/test";
import { createTestSession } from "../helpers/session";

const BASE = "http://localhost:3000";

// 각 describe에서 자기 rly-키를 세션 헬퍼로 발급 — 다른 spec의 DB clear와 무관
let rlyKey = "";

async function mintToken(): Promise<string> {
  const r = await fetch(`${BASE}/v1/registration-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${rlyKey}` },
    body: JSON.stringify({ endUserLabel: "e2e_widget_user" }),
  });
  if (!r.ok) throw new Error(`mintToken failed: ${r.status}`);
  const j = await r.json();
  return j.registrationToken;
}

test.describe("위젯 — 데스크탑 렌더 + 픽커", () => {
  test.beforeAll(async () => {
    const s = await createTestSession({ tenantName: "Widget E2E" });
    rlyKey = s.rlyKey;
    // dev 서버의 Mongo 연결이 새 테넌트를 보도록 폴링(드물게 인덱스/소켓 워밍 지연 케이스 회피)
    for (let i = 0; i < 10; i++) {
      const probe = await fetch(`${BASE}/v1/registration-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${rlyKey}` },
        body: JSON.stringify({ endUserLabel: "_probe", provider: "openai" }),
      });
      if (probe.ok) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  });

  test("프로바이더 선택 화면이 본문에 보임", async ({ page }) => {
    const token = await mintToken();
    await page.goto(`/test-embed.html?token=${token}`);
    const body = await page.locator("body").innerText({ timeout: 10_000 });
    expect(body).toMatch(/Connect an AI key|AI 키 연결/);
  });

  test("Shadow DOM에 OpenAI/Anthropic/Google 타일", async ({ page }) => {
    const token = await mintToken();
    await page.goto(`/test-embed.html?token=${token}`);
    const labels = await page.evaluate(async () => {
      const root = document.querySelector("#relay-widget > div") as HTMLElement | null;
      if (!root?.shadowRoot) return null;
      await new Promise((r) => setTimeout(r, 500));
      const tiles = root.shadowRoot.querySelectorAll('[data-provider]');
      return Array.from(tiles).map((t) => (t.textContent || "").trim());
    });
    expect(labels).not.toBeNull();
    expect(labels!.join("\n")).toMatch(/OpenAI/);
    expect(labels!.join("\n")).toMatch(/Anthropic/);
    expect(labels!.join("\n")).toMatch(/Google/);
  });
});

test.describe("위젯 — 모바일 viewport", () => {
  test.beforeAll(async () => {
    const s = await createTestSession({ tenantName: "Widget Mobile E2E" });
    rlyKey = s.rlyKey;
    for (let i = 0; i < 10; i++) {
      const probe = await fetch(`${BASE}/v1/registration-tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${rlyKey}` },
        body: JSON.stringify({ endUserLabel: "_probe", provider: "openai" }),
      });
      if (probe.ok) break;
      await new Promise((r) => setTimeout(r, 150));
    }
  });
  test.use({ viewport: { width: 390, height: 720 } });

  test("390px 폭에서도 위젯 카드 안 잘림(반응형)", async ({ page }) => {
    const token = await mintToken();
    await page.goto(`/test-embed.html?token=${token}`);
    const ok = await page.evaluate(async () => {
      const host = document.querySelector("#relay-widget > div") as HTMLElement | null;
      if (!host?.shadowRoot) return false;
      await new Promise((r) => setTimeout(r, 500));
      const card = host.shadowRoot.querySelector(".card") as HTMLElement | null;
      if (!card) return false;
      const rect = card.getBoundingClientRect();
      return rect.width > 0 && rect.width <= 420 && rect.left >= 0;
    });
    expect(ok).toBe(true);
  });
});
