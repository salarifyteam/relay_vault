// Relay API 에러. 서버의 { error: { message, code, doc_url } } 형식을 파싱해 던진다.
// code는 안정적 식별자 — `if (err.code === "relay_key_revoked")`처럼 분기에 쓴다.
// (message는 사람용이라 바뀔 수 있으니 분기 기준으로 쓰지 말 것.)
export class RelayError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly requestId?: string;
  readonly docUrl?: string;

  // 하위호환: (message, status, requestId) positional 유지. code/docUrl은 4번째 옵션 객체.
  constructor(
    message: string,
    status: number,
    requestId?: string,
    extra?: { code?: string; docUrl?: string }
  ) {
    super(message);
    this.name = "RelayError";
    this.status = status;
    this.requestId = requestId;
    this.code = extra?.code;
    this.docUrl = extra?.docUrl;
  }
}

// 비2xx 응답을 RelayError로 변환. body가 { error: { message, code, doc_url } }면 함께 채운다.
export async function toRelayError(res: Response): Promise<RelayError> {
  const headerRequestId = res.headers.get("x-relay-request-id") || undefined;
  let message = `Relay request failed (HTTP ${res.status})`;
  let code: string | undefined;
  let docUrl: string | undefined;
  let bodyRequestId: string | undefined;
  try {
    const body = (await res.json()) as {
      error?: { message?: string; code?: string; doc_url?: string; request_id?: string };
    };
    if (body?.error?.message) message = body.error.message;
    code = body?.error?.code;
    docUrl = body?.error?.doc_url;
    bodyRequestId = body?.error?.request_id;
  } catch {
    /* 비JSON 응답이면 기본 메시지 유지 */
  }
  return new RelayError(message, res.status, headerRequestId ?? bodyRequestId, { code, docUrl });
}
