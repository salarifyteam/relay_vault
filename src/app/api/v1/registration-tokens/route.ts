import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import ApiKey from "@/lib/models/ApiKey";
import RegistrationToken from "@/lib/models/RegistrationToken";
import { generateRegistrationToken, hashApiKey } from "@/lib/keys";
import { relayError } from "@/lib/errors/relayError";
import type { ByokProvider } from "@/lib/services/byokProvider";

const VALID_PROVIDERS: ByokProvider[] = [
  "openai",
  "google",
  "anthropic",
  "xai",
  "zai",
];
const TOKEN_TTL_MS = 10 * 60 * 1000;

export async function POST(req: NextRequest) {
  // v1 API 통일: 안정 에러 코드 + X-Relay-Request-Id 추적(이전엔 둘 다 없었다).
  const requestId = crypto.randomUUID();

  const auth = req.headers.get("authorization") || "";
  const secret = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^rly[_-]/.test(secret)) {
    return relayError("relay_key_invalid", "Missing or invalid Relay key", requestId);
  }

  let body: { endUserLabel?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return relayError("invalid_json", "Invalid JSON body", requestId);
  }

  const endUserLabel = body.endUserLabel?.trim();
  // provider는 선택. 생략하면 위젯에서 최종 사용자가 직접 고른다.
  const provider = body.provider ? (body.provider as ByokProvider) : undefined;
  if (!endUserLabel) {
    return relayError("enduser_label_missing", "Missing endUserLabel", requestId);
  }
  if (provider && !VALID_PROVIDERS.includes(provider)) {
    return relayError("provider_invalid", "Invalid provider", requestId);
  }

  await dbConnect();
  // 키 해시 → ApiKey → 테넌트 + 환경. 토큰이 이 환경을 물려받아 EndUserKey가 같은 환경으로 생성된다.
  const apiKeyDoc = await ApiKey.findOne({ keyHash: hashApiKey(secret), status: "active" });
  if (!apiKeyDoc) {
    return relayError("relay_key_revoked", "Unknown or revoked Relay key", requestId);
  }
  const tenant = await Tenant.findById(apiKeyDoc.tenantId);
  if (!tenant || tenant.status !== "active") {
    return relayError("relay_tenant_disabled", "Unknown or disabled Relay key", requestId);
  }

  const token = generateRegistrationToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await RegistrationToken.create({
    token,
    tenantId: tenant._id,
    environment: apiKeyDoc.environment,
    endUserLabel,
    provider,
    expiresAt,
  });

  const origin = new URL(req.url).origin;
  return NextResponse.json(
    {
      registrationToken: token,
      expiresAt: expiresAt.toISOString(),
      submitUrl: `${origin}/api/widget/keys`,
    },
    { headers: { "X-Relay-Request-Id": requestId } }
  );
}
