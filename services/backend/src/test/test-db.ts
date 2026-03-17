import { createDatabase, initSchema, type DatabaseType } from "../db";

/** 매 테스트마다 :memory: DB 생성 + 스키마 초기화 */
export function createTestDb(): DatabaseType {
  const db = createDatabase(":memory:");
  initSchema(db);
  return db;
}
