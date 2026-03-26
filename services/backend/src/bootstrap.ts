/**
 * Bootstrap — 기동 시 1회 실행되는 초기화 작업
 */
import { logger } from "./lib";
import type { AppContext } from "./composition";

export function runStartupTasks(_ctx: AppContext): void {
  logger.info("Startup tasks completed (no-op)");
}
