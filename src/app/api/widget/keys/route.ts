import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import EndUserKey from "@/lib/models/EndUserKey";
import RegistrationToken from "@/lib/models/RegistrationToken";
import { getCrypto } from "@/lib/crypto";
import { maskByokKey, validateByokKey } from "@/lib/services/byokProvider";
import type { ByokProvider } from "@/lib/services/byokProvider";

// 위젯에서 사용자가 직접 고를 수 있는 프로바이더(이번엔 3사)
const SELECTABLE_PROVIDERS: ByokProvider[] = ["openai", "anthropic", "google"];

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const json = (data: unknown, status: number) =>
    NextResponse.json(data, { status, headers: cors });

  let body: { registrationToken?: string; apiKey?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const registrationToken = body.registrationToken?.trim();
  const apiKey = body.apiKey?.trim();
  if (!registrationToken || !apiKey) {
    return json(
      { ok: false, error: "registrationToken and apiKey are required" },
      400
    );
  }

  await dbConnect();

  const tokenDoc = await RegistrationToken.findOne({ token: registrationToken });
  if (!tokenDoc) {
    return json({ ok: false, error: "Invalid registration token" }, 400);
  }
  if (tokenDoc.usedAt) {
    return json({ ok: false, error: "Registration token already used" }, 410);
  }
  if (tokenDoc.expiresAt.getTime() < Date.now()) {
    return json({ ok: false, error: "Registration token expired" }, 410);
  }

  const tenant = await Tenant.findById(tokenDoc.tenantId);
  if (!tenant || tenant.status !== "active") {
    return json({ ok: false, error: "Tenant unavailable" }, 400);
  }

  // 프로바이더 확정: 토큰에 고정돼 있으면 그것이 우선(제공자가 잠금 가능),
  // 없으면 위젯에서 사용자가 고른 것(요청 body)을 쓴다.
  const provider = (tokenDoc.provider ?? body.provider) as ByokProvider | undefined;
  if (!provider) {
    return json({ ok: false, error: "Missing provider" }, 400);
  }
  if (!tokenDoc.provider && !SELECTABLE_PROVIDERS.includes(provider)) {
    return json({ ok: false, error: "Unsupported provider" }, 400);
  }

  // 라이브 검증: 키가 진짜 살아있는지 프로바이더에 확인 (가짜/오타 키는 저장 안 함)
  const validation = await validateByokKey(provider, apiKey);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error || "Invalid API key" }, 400);
  }

  const sealed = await getCrypto().seal(apiKey, {
    tenantId: String(tenant._id),
  });

  await EndUserKey.findOneAndUpdate(
    {
      tenantId: tenant._id,
      endUserLabel: tokenDoc.endUserLabel,
      provider,
    },
    {
      tenantId: tenant._id,
      endUserLabel: tokenDoc.endUserLabel,
      provider,
      keyEncrypted: sealed.ciphertext,
      keyMasked: maskByokKey(apiKey),
      cryptoVersion: sealed.cryptoVersion,
      wrappedDataKey: sealed.wrappedDataKey,
      validationState: "valid",
      availableModels: validation.models,
      lastValidatedAt: new Date(),
      lastError: undefined,
      isActive: true,
    },
    { upsert: true }
  );

  tokenDoc.usedAt = new Date();
  await tokenDoc.save();

  return json(
    {
      ok: true,
      masked: maskByokKey(apiKey),
      endUserLabel: tokenDoc.endUserLabel,
      provider,
      availableModels: validation.models,
    },
    200
  );
}
