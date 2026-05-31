import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";

const SAFE_DB_SUFFIX = "_test";

// 테스트 DB 안전성 가드 + 컬렉션 일괄 정리 헬퍼.
// 실수로 prod DB(relaypay)에 붙으면 throw.
export async function connectTestDb(): Promise<void> {
  await dbConnect();
  const dbName = mongoose.connection.db?.databaseName || "";
  if (!dbName.endsWith(SAFE_DB_SUFFIX)) {
    throw new Error(
      `SAFETY: 테스트 DB 이름이 '${dbName}' — '${SAFE_DB_SUFFIX}'로 끝나지 않음. setup.ts 확인.`
    );
  }
}

// 각 테스트 그룹 시작 전에 한 번 호출해 전체 데이터 정리.
export async function clearAllTestCollections(): Promise<void> {
  await connectTestDb();
  const conn = mongoose.connection;
  const collections = await conn.db!.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
}

export async function disconnectTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
