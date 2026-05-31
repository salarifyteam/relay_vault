import { defineConfig } from "vitest/config";
import { config as loadDotenv } from "dotenv";

// .env.local 로드 (테스트는 prod와 분리된 relaypay_test DB로 라우팅 — setup.ts에서 마무리)
loadDotenv({ path: ".env.local" });

export default defineConfig({
  resolve: { tsconfigPaths: true }, // @/* → ./src/*
  test: {
    globals: false,
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/api/**/*.test.ts"],
    exclude: ["packages/**", "node_modules", "tests/e2e/**"], // SDK + e2e는 별도
    testTimeout: 30_000,
    setupFiles: ["tests/setup.ts"],
    // integration·api는 같은 DB를 만지므로 파일 간 직렬 실행(cross-talk 방지)
    fileParallelism: false,
  },
});
