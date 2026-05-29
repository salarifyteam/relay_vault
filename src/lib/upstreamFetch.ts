import { logWarn } from "@/lib/log";

export interface UpstreamOpts {
  timeoutMs: number;
  retries?: number; // 추가 재시도 횟수(첫 시도 제외). 기본 2
  baseDelayMs?: number; // 지수 백오프 기준. 기본 500
  provider?: string; // 로그용
  requestId?: string; // 로그용
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function retryAfterMs(res: Response): number | null {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const sec = Number(h);
  if (Number.isFinite(sec)) return Math.min(sec, 30) * 1000; // 상한 30s
  const date = Date.parse(h);
  if (!Number.isNaN(date)) return Math.max(0, Math.min(date - Date.now(), 30_000));
  return null;
}

// 업스트림 fetch를 timeout + 안전 재시도로 감싼다.
// Response '획득'(상태/헤더/첫 바이트)까지만 timeout이 관장한다 — 반환된 .body를 호출부가 스트리밍하므로
// 긴 completion은 끊기지 않는다. 재시도는 .body를 읽기 전에만 일어나 mid-stream 중복이 구조적으로 불가능.
export async function upstreamFetch(
  url: string,
  init: RequestInit,
  opts: UpstreamOpts
): Promise<Response> {
  const retries = opts.retries ?? 2;
  const baseDelay = opts.baseDelayMs ?? 500;
  let lastResponse: Response | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) {
        return res; // 성공 또는 비재시도 상태 또는 마지막 시도 → 그대로 반환
      }
      lastResponse = res;
      const wait = retryAfterMs(res) ?? baseDelay * 2 ** attempt + Math.random() * 100;
      logWarn("upstream_retry", { provider: opts.provider, requestId: opts.requestId, status: res.status, attempt: attempt + 1 });
      await sleep(wait);
    } catch (e) {
      lastError = e;
      if (attempt === retries) break;
      const wait = baseDelay * 2 ** attempt + Math.random() * 100;
      logWarn("upstream_retry", { provider: opts.provider, requestId: opts.requestId, attempt: attempt + 1, errMsg: e instanceof Error ? e.message : "network error" });
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastResponse) return lastResponse; // 마지막 재시도 가능 응답(실제 상태/본문 노출)
  throw lastError ?? new Error("upstream fetch failed");
}
