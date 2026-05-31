import { defineConfig, devices } from "@playwright/test";
import { config as loadDotenv } from "dotenv";

// 테스트 DB env 로드(콘솔 E2E의 세션 헬퍼가 DB를 직접 만짐)
loadDotenv({ path: ".env.test" });

// E2E는 로컬 dev 서버를 자동 기동(:3000)하고 그 위에서 돈다.
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // 세션/DB 공유 → 순차
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    timeout: 90_000,
    reuseExistingServer: true,
    env: {
      // E2E도 테스트 DB로
      NODE_ENV: "test",
    },
  },
});
