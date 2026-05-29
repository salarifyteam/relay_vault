import OpenAI from "openai";
import { toRelayError } from "./errors";
import type {
  RelayOptions,
  RegistrationTokenParams,
  RegistrationTokenResult,
  OpenAIForUserOptions,
  HealthResult,
} from "./types";

const DEFAULT_BASE_URL = "https://vault.relayservice.im";

export class Relay {
  private readonly key: string;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: RelayOptions) {
    if (!opts?.key) throw new Error("Relay: 'key' is required (your rly- key)");
    this.key = opts.key;
    this.baseURL = (opts.baseURL || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = opts.fetch || globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error("Relay: no fetch available — pass { fetch } or use Node 18+");
    }
  }

  /**
   * 최종 사용자가 키를 등록할 수 있는 단회용 토큰 발급(백엔드에서 호출).
   * 이 토큰을 프론트로 내려 위젯에 전달한다. provider 생략 시 위젯에서 사용자가 선택.
   */
  async createRegistrationToken(params: RegistrationTokenParams): Promise<RegistrationTokenResult> {
    if (!params?.user) throw new Error("Relay: 'user' is required");
    const res = await this.fetchImpl(`${this.baseURL}/v1/registration-tokens`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.key}` },
      body: JSON.stringify({ endUserLabel: params.user, provider: params.provider }),
    });
    if (!res.ok) throw await toRelayError(res);
    return (await res.json()) as RegistrationTokenResult;
  }

  /**
   * 특정 최종 사용자에 바인딩된, 사전 설정된 OpenAI 클라이언트를 반환한다.
   * baseURL과 Relay 헤더(Authorization, X-Relay-User[, X-Relay-Paid])가 미리 박혀 있어
   * 개발자는 평소처럼 `client.chat.completions.create(...)` / `client.embeddings.create(...)`만 쓰면 된다.
   */
  openai(opts: OpenAIForUserOptions): OpenAI {
    if (!opts?.user) throw new Error("Relay: 'user' is required for openai()");
    const defaultHeaders: Record<string, string> = { "X-Relay-User": opts.user };
    // 서버는 "false"만 무료로 취급 → opt-out일 때만 헤더 전송
    if (opts.paid === false) defaultHeaders["X-Relay-Paid"] = "false";
    return new OpenAI({
      apiKey: this.key,
      baseURL: `${this.baseURL}/v1`,
      defaultHeaders,
      fetch: this.fetchImpl,
    });
  }

  /** 서비스 상태 확인 (인증 불필요). 주의: /api/health 는 /v1 rewrite 밖이다. */
  async health(): Promise<HealthResult> {
    const res = await this.fetchImpl(`${this.baseURL}/api/health`);
    if (!res.ok) throw await toRelayError(res);
    return (await res.json()) as HealthResult;
  }
}
