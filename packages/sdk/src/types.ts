// SDK는 앱 소스와 분리된 별도 패키지이므로 자체 최소 타입을 정의한다.

export type RelayProvider = "openai" | "anthropic" | "google" | "xai" | "zai";

export interface RelayOptions {
  /** Relay 테넌트 키 (rly-...) */
  key: string;
  /** 기본 https://vault.relayservice.im. 테스트/셀프호스트 시 재정의 */
  baseURL?: string;
  /** 커스텀 fetch 주입(테스트/Node 구버전 등) */
  fetch?: typeof fetch;
}

export interface RegistrationTokenParams {
  /** 제공자 앱의 최종 사용자 식별 라벨 (예: "jieun_123") */
  user: string;
  /** 생략하면 위젯에서 사용자가 직접 프로바이더를 고른다 */
  provider?: RelayProvider;
}

export interface RegistrationTokenResult {
  registrationToken: string;
  expiresAt: string;
  submitUrl: string;
}

export interface OpenAIForUserOptions {
  /** 이 호출이 대신하는 최종 사용자 라벨 (X-Relay-User) */
  user: string;
  /** 무료 사용자 키이면 false (과금 분류용, X-Relay-Paid). 기본 유료 */
  paid?: boolean;
}

export interface HealthResult {
  status: string;
  db: string;
}
