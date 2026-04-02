/**
 * Bootstrap — 기동 시 1회 실행되는 초기화 작업
 */
import { logger } from "./lib";
import type { AppContext } from "./composition";

export function runStartupTasks(ctx: AppContext): void {
  // 초기 admin 사용자 시딩 (DB에 사용자가 없을 때만)
  ctx.userService.seedAdmin(
    process.env.ADMIN_USERNAME ?? "admin",
    process.env.ADMIN_PASSWORD ?? "admin1234",
  );

  logger.info("Startup tasks completed");
}
