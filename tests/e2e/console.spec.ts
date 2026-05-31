import { test, expect } from "@playwright/test";
import { createTestSession } from "../helpers/session";
import { clearAllTestCollections } from "../helpers/db";

const PAGES = [
  { path: "/console", title: /Home/i },
  { path: "/console/keys", title: /API keys/i },
  { path: "/console/users", title: /End-users/i },
  { path: "/console/usage", title: /Usage/i },
  { path: "/console/billing", title: /Billing/i },
  { path: "/console/members", title: /Members/i },
  { path: "/console/docs", title: /Quickstart/i },
  { path: "/console/settings", title: /Settings/i },
];

test.describe.serial("콘솔 페이지 스모크 — 세션 주입(owner)", () => {
  let cookie: string;

  test.beforeAll(async () => {
    await clearAllTestCollections();
    const s = await createTestSession({ role: "owner", tenantName: "E2E Tenant" });
    cookie = s.cookie;
  });
  // disconnect 안 함 — 다른 spec 파일이 같은 mongoose 캐시를 재사용

  for (const p of PAGES) {
    test(`${p.path} 정상 렌더`, async ({ page, context }) => {
      // __session 쿠키 주입
      await context.addCookies([
        {
          name: "__session",
          value: cookie.split("=")[1],
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);
      const res = await page.goto(p.path);
      expect(res?.status()).toBeLessThan(400);
      // 페이지 제목 또는 본문 헤딩 확인
      await expect(page.getByRole("heading", { name: p.title })).toBeVisible({ timeout: 10_000 });
    });
  }
});
