// vitest 글로벌 셋업: 테스트용 환경변수 강제.
// 실제 운영 DB(relaypay)와 분리된 relaypay_test DB로 라우팅.
import "dotenv/config"; // .env.local 로드

const baseUri = process.env.MONGODB_URI;
if (baseUri && !baseUri.includes("/relaypay_test")) {
  // mongodb+srv://...host/relaypay?opts → .../relaypay_test?opts
  process.env.MONGODB_URI = baseUri.replace(/\/relaypay(\?|$)/, "/relaypay_test$1");
}

// 테스트는 KMS 없이 env 암호화로(실 KMS 비용/지연 회피)
process.env.RELAY_CRYPTO = "env";
process.env.BYOK_KEY_SECRET = process.env.BYOK_KEY_SECRET || "test-byok-secret-32-bytes-long-aaaaaa";
