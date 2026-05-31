import crypto from "crypto";

export type Environment = "test" | "live";

const KEY_BODY_LEN = 48;

function randomBody(length = KEY_BODY_LEN): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

function randomToken(prefix: string, length = KEY_BODY_LEN): string {
  return prefix + randomBody(length);
}

// rly_live_… / rly_test_… 형식의 환경-각인 API 키. 비밀 = prefix + body.
// 해시는 비밀 '전체'(prefix 포함)에 건다 → test/live 비밀이 절대 혼동·충돌하지 않음.
export function generateApiKey(environment: Environment): {
  secret: string;
  prefix: string;
  last4: string;
} {
  const prefix = `rly_${environment}_`;
  const body = randomBody();
  return { secret: prefix + body, prefix, last4: body.slice(-4) };
}

// 비밀 키 → 저장·조회용 SHA-256(hex). 평문은 DB에 두지 않는다.
export function hashApiKey(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}

export function generateRegistrationToken(): string {
  return randomToken("rgt-");
}
