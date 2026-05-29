// Relay API 에러. 서버의 { error: { message } } 형식을 파싱해 status와 함께 던진다.
export class RelayError extends Error {
  readonly status: number;
  readonly requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "RelayError";
    this.status = status;
    this.requestId = requestId;
  }
}

// 비2xx 응답을 RelayError로 변환. body가 { error: { message } }면 그 메시지를 쓴다.
export async function toRelayError(res: Response): Promise<RelayError> {
  const requestId = res.headers.get("x-relay-request-id") || undefined;
  let message = `Relay request failed (HTTP ${res.status})`;
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    if (body?.error?.message) message = body.error.message;
  } catch {
    /* 비JSON 응답이면 기본 메시지 유지 */
  }
  return new RelayError(message, res.status, requestId);
}
