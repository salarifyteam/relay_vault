import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Tenant from "@/lib/models/Tenant";
import RegistrationToken from "@/lib/models/RegistrationToken";
import { generateRegistrationToken } from "@/lib/keys";
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
  const auth = req.headers.get("authorization") || "";
  const rlyKey = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!rlyKey.startsWith("rly-")) {
    return NextResponse.json(
      { error: { message: "Missing or invalid Relay key" } },
      { status: 401 }
    );
  }

  let body: { endUserLabel?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const endUserLabel = body.endUserLabel?.trim();
  const provider = body.provider as ByokProvider;
  if (!endUserLabel) {
    return NextResponse.json(
      { error: { message: "Missing endUserLabel" } },
      { status: 400 }
    );
  }
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json(
      { error: { message: "Missing or invalid provider" } },
      { status: 400 }
    );
  }

  await dbConnect();
  const tenant = await Tenant.findOne({ rlyKey, status: "active" });
  if (!tenant) {
    return NextResponse.json(
      { error: { message: "Unknown or disabled Relay key" } },
      { status: 401 }
    );
  }

  const token = generateRegistrationToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await RegistrationToken.create({
    token,
    tenantId: tenant._id,
    endUserLabel,
    provider,
    expiresAt,
  });

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    registrationToken: token,
    expiresAt: expiresAt.toISOString(),
    submitUrl: `${origin}/api/widget/keys`,
  });
}
