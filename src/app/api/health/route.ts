import { NextResponse } from "next/server";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

// 가벼운 헬스체크. DB는 기존 연결 상태(readyState)만 보고 — 매 호출 새 연결을 강제하지 않는다.
export async function GET() {
  const dbConnected = mongoose.connection.readyState === 1;
  return NextResponse.json({ status: "ok", db: dbConnected ? "up" : "unknown" });
}
