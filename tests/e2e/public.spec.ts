import { test, expect } from "@playwright/test";

test.describe("공개 페이지 — 로그인 불필요", () => {
  test("랜딩 (/) 렌더 + Docs/Console 링크", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Relay" })).toBeVisible();
    const docsLink = page.locator('a[href="/docs"]');
    await expect(docsLink).toBeVisible();
    const consoleLink = page.locator('a[href="/login"]');
    await expect(consoleLink).toBeVisible();
  });

  test("/docs 사이드바 + 코드블록 + brand", async ({ page }) => {
    await page.goto("/docs");
    await expect(page.getByRole("heading", { name: /Relay — BYOK AI infrastructure/i })).toBeVisible();
    // 사이드바 항목 일부 — 데스크탑에서만 보임
    await expect(page.getByRole("link", { name: "Quickstart" })).toBeVisible();
    await expect(page.getByRole("link", { name: "SDK" })).toBeVisible();
    // SDK 코드 예시(여러 코드블록에 등장 가능)
    await expect(page.getByText("@relayservice/sdk").first()).toBeVisible();
    // Console 진입 링크
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test("/login Continue with Google 버튼 + ?next 라우트", async ({ page }) => {
    await page.goto("/login?next=%2Finvite%2Ftest");
    const g = page.locator('a[href*="/api/auth/google"]');
    await expect(g).toBeVisible();
    const href = await g.getAttribute("href");
    // next= 파라미터가 OAuth start URL에 보존돼야
    expect(href).toContain("next=");
  });

  test("/console 미로그인 → 307 → /login", async ({ page }) => {
    const res = await page.goto("/console");
    // Playwright는 자동 follow 후 최종 페이지 — 최종이 /login이어야
    expect(page.url()).toContain("/login");
    expect(res?.status()).toBeLessThan(400);
  });
});
