import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { upstreamFetch } from "@/lib/upstreamFetch";

// 결정적 sleep을 위해 setTimeout을 가짜로
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mockFetchSequence(responses: Array<Response | Error>) {
  let i = 0;
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
    const r = responses[i++];
    if (r instanceof Error) throw r;
    return r;
  });
}

describe("upstreamFetch — 성공 경로", () => {
  it("2xx면 한 번에 반환, 재시도 없음", async () => {
    const ok = new Response("{}", { status: 200 });
    const m = mockFetchSequence([ok]);
    const res = await upstreamFetch("https://x.test", { method: "GET" }, { timeoutMs: 1000 });
    expect(res.status).toBe(200);
    expect(m).toHaveBeenCalledTimes(1);
  });

  it("400(비재시도)는 즉시 반환", async () => {
    const bad = new Response("{}", { status: 400 });
    const m = mockFetchSequence([bad]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000 });
    expect(res.status).toBe(400);
    expect(m).toHaveBeenCalledTimes(1);
  });
});

describe("upstreamFetch — 재시도", () => {
  it("503 → 200: 한 번 재시도 후 성공", async () => {
    const m = mockFetchSequence([
      new Response("", { status: 503 }),
      new Response("ok", { status: 200 }),
    ]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("429 재시도", async () => {
    const m = mockFetchSequence([
      new Response("", { status: 429 }),
      new Response("ok", { status: 200 }),
    ]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("Retry-After 헤더 존중(초)", async () => {
    const m = mockFetchSequence([
      new Response("", { status: 429, headers: { "retry-after": "1" } }),
      new Response("ok", { status: 200 }),
    ]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("재시도 횟수 초과 시 마지막 응답 반환(throw 안 함)", async () => {
    const m = mockFetchSequence([
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
      new Response("", { status: 503 }),
    ]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(503);
    expect(m).toHaveBeenCalledTimes(3); // 첫 시도 + 재시도 2
  });

  it("400(클라이언트 에러)은 재시도 안 함", async () => {
    const m = mockFetchSequence([new Response("", { status: 400 })]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 5, baseDelayMs: 1 });
    expect(res.status).toBe(400);
    expect(m).toHaveBeenCalledTimes(1);
  });
});

describe("upstreamFetch — 네트워크 에러", () => {
  it("네트워크 throw → 재시도 → 성공", async () => {
    const m = mockFetchSequence([
      new TypeError("fetch failed"),
      new Response("ok", { status: 200 }),
    ]);
    const res = await upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 2, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(m).toHaveBeenCalledTimes(2);
  });

  it("재시도 다 실패 → throw", async () => {
    mockFetchSequence([
      new TypeError("network 1"),
      new TypeError("network 2"),
      new TypeError("network 3"),
    ]);
    await expect(
      upstreamFetch("https://x.test", {}, { timeoutMs: 1000, retries: 2, baseDelayMs: 1 })
    ).rejects.toThrow();
  });
});

describe("upstreamFetch — timeout (AbortController)", () => {
  it("timeoutMs 이내 응답 없으면 abort → 네트워크 에러로 간주 재시도", async () => {
    // fetch가 signal aborted를 받으면 abort 에러 throw하도록 모킹
    const m = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const signal = (init as RequestInit | undefined)?.signal;
      return new Promise<Response>((resolve, reject) => {
        if (signal) {
          signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }
        // 절대 resolve 안 함 → timeout 발동
      });
    });
    // 짧은 timeout으로 abort 유도. retries=0 → 한 번만 시도 후 throw
    await expect(
      upstreamFetch("https://x.test", {}, { timeoutMs: 50, retries: 0 })
    ).rejects.toBeDefined();
    expect(m).toHaveBeenCalledTimes(1);
  });
});
