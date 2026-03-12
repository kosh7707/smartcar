import pino from "pino";
import crypto from "crypto";
import path from "path";

const LOG_DIR = process.env.LOG_DIR ?? path.resolve(__dirname, "../../../../logs");

const transport = pino.transport({
  targets: [
    { target: "pino/file", options: { destination: 1 } },
    { target: "pino/file", options: { destination: path.join(LOG_DIR, "s2-backend.jsonl"), mkdir: true } },
  ],
});

const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  name: "s2-backend",
}, transport);

export function createLogger(component: string) {
  return rootLogger.child({ component });
}

/**
 * HTTP 요청 외의 작업(CAN 프레임 처리, 자동 재연결, 기동 초기화 등)에도
 * 일관된 추적 ID를 부여하기 위한 유틸리티.
 *
 * 접두사 규칙:
 *   - req   : HTTP 요청 (미들웨어가 생성)
 *   - can   : CAN 프레임 → alert → LLM 체인
 *   - reconn: 어댑터 자동 재연결
 *   - sys   : 기동/마이그레이션 등 시스템 작업
 */
export function generateRequestId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export default rootLogger;
