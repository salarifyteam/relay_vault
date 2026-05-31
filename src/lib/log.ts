// 한 줄 JSON 구조화 로거. Cloud Run이 stdout을 구조화 로그로 수집한다.
// console.* 대신 stdout.write를 써서 Next dev 포맷팅을 피하고 grep을 깨끗하게 유지.
// 절대 금지: 메시지 본문, 복호화된 키, 입력 텍스트 등 PII/민감정보. 허용 필드만 넘긴다.
type Level = "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  tenantId?: string;
  environment?: string;
  provider?: string;
  model?: string;
  status?: number;
  latencyMs?: number;
  attempt?: number;
  stream?: boolean;
  errCode?: string;
  errMsg?: string;
}

function emit(level: Level, event: string, fields: LogFields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  process.stdout.write(line + "\n");
}

export const logInfo = (event: string, fields?: LogFields) => emit("info", event, fields);
export const logWarn = (event: string, fields?: LogFields) => emit("warn", event, fields);
export const logError = (event: string, fields?: LogFields) => emit("error", event, fields);
