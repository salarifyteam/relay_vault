import { NextRequest, NextResponse } from "next/server";
import { getCurrentDeveloper } from "@/lib/auth";
import { requireRole } from "@/lib/requireRole";
import { mintApiKey, revokeApiKey } from "@/lib/services/apiKeyService";

// Playground 프록시: 브라우저는 v1을 직접 못 부른다(CORS 없음 + 평문 키 없음).
// 여기서 세션 인증 → test 키를 '요청당' 발급 → 동일 오리진 v1 라우트로 내부 호출 →
// 응답을 그대로(verbatim) 브라우저에 돌려준다. 키는 브라우저에 절대 노출되지 않는다.
// 보안: 키는 mint 후 단 1회 사용하고 finally에서 폐기한다(해시 저장이라 재사용 불가하기도 함).

type Endpoint = "chat" | "embeddings" | "registration-token";

const PATHS: Record<Endpoint, string> = {
  chat: "/api/v1/chat/completions",
  embeddings: "/api/v1/embeddings",
  "registration-token": "/api/v1/registration-tokens",
};

export async function POST(req: NextRequest) {
  const me = await getCurrentDeveloper();
  if (!me) {
    return NextResponse.json({ error: { message: "Not authenticated" } }, { status: 401 });
  }
  const forbidden = requireRole(me, "member");
  if (forbidden) return forbidden;

  let input: {
    endpoint?: Endpoint;
    endUserLabel?: string;
    body?: unknown;
    provider?: string;
  };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON body" } }, { status: 400 });
  }

  const endpoint = input.endpoint;
  if (!endpoint || !(endpoint in PATHS)) {
    return NextResponse.json(
      { error: { message: "endpoint must be 'chat', 'embeddings', or 'registration-token'" } },
      { status: 400 }
    );
  }
  // chat/embeddings는 엔드유저 라벨이 필요(레지스트레이션 토큰은 불필요).
  if (endpoint !== "registration-token" && !input.endUserLabel?.trim()) {
    return NextResponse.json(
      { error: { message: "endUserLabel is required for chat/embeddings" } },
      { status: 400 }
    );
  }

  // 내부 호출 본문 구성.
  const forwardBody =
    endpoint === "registration-token"
      ? { endUserLabel: input.endUserLabel?.trim(), provider: input.provider || undefined }
      : input.body ?? {};

  const origin = new URL(req.url).origin;
  const url = `${origin}${PATHS[endpoint]}`;

  // 요청당 test 키 발급 → 사용 → 폐기.
  const minted = await mintApiKey({
    tenantId: String(me.tenant._id),
    environment: "test",
    name: "playground",
    createdByAccountId: String(me.account._id),
  });

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${minted.secret}`,
    };
    if (endpoint !== "registration-token") {
      headers["X-Relay-User"] = input.endUserLabel!.trim();
    }

    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(forwardBody),
    });

    // 응답을 그대로 전달(상태·본문·request id). UI가 실제 에러 코드를 보게 한다.
    const text = await upstream.text();
    const requestId = upstream.headers.get("X-Relay-Request-Id") || undefined;
    const contentType = upstream.headers.get("Content-Type") || "application/json";

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        "Content-Type": contentType,
        ...(requestId ? { "X-Relay-Request-Id": requestId } : {}),
      },
    });
  } finally {
    // 키는 단 1회용 — 즉시 폐기(평문은 메모리에서 사라진다).
    await revokeApiKey(minted.id);
  }
}
