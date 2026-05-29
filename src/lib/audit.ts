import mongoose from "mongoose";
import AuditLog, { type AuditAction } from "@/lib/models/AuditLog";
import { logInfo } from "@/lib/log";

// 민감 작업을 감사 로그(DB)에 기록 + stdout 구조화 로그에도 남긴다.
// 감사 기록 실패가 본 작업을 막지 않도록 호출부에서 await하되 throw는 흡수.
export async function recordAudit(params: {
  tenantId: mongoose.Types.ObjectId | string;
  accountId?: mongoose.Types.ObjectId | string;
  actorEmail?: string;
  action: AuditAction;
  target?: string;
  detail?: string;
}): Promise<void> {
  try {
    await AuditLog.create({
      tenantId: params.tenantId,
      accountId: params.accountId,
      actorEmail: params.actorEmail,
      action: params.action,
      target: params.target,
      detail: params.detail,
    });
    logInfo("audit", { tenantId: String(params.tenantId) });
  } catch {
    /* 감사 기록 실패는 본 작업을 막지 않음 */
  }
}
