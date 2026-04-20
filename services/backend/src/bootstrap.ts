/**
 * Bootstrap — 기동 시 1회 실행되는 초기화 작업
 */
import {
  AUTH_DEV_ORGANIZATION_FIXTURES,
  getAuthDevFixtureAdminPassword,
  isAuthDevFixtureSeedingEnabled,
} from "./auth-dev-support";
import { logger } from "./lib";
import type { AppContext } from "./composition";

export function runStartupTasks(ctx: AppContext): void {
  // 초기 admin 사용자 시딩 (DB에 사용자가 없을 때만)
  ctx.userService.seedAdmin(
    process.env.ADMIN_USERNAME ?? "admin",
    process.env.ADMIN_PASSWORD ?? "admin1234",
  );

  if (isAuthDevFixtureSeedingEnabled()) {
    const fixtureAdminPassword = getAuthDevFixtureAdminPassword();
    for (const fixture of AUTH_DEV_ORGANIZATION_FIXTURES) {
      const organization = ctx.userService.seedOrganization({
        id: fixture.id,
        code: fixture.code,
        name: fixture.name,
        region: fixture.region,
        defaultRole: fixture.defaultRole,
        emailDomainHint: fixture.emailDomainHint,
        adminDisplayName: fixture.adminDisplayName,
        adminEmail: fixture.adminEmail,
      });
      ctx.userService.seedUserIfMissing({
        username: fixture.adminUsername,
        password: fixtureAdminPassword,
        displayName: fixture.adminDisplayName,
        role: "admin",
        email: fixture.adminEmail,
        organizationId: organization.id,
      });
    }

    logger.info({
      organizations: AUTH_DEV_ORGANIZATION_FIXTURES.map(({ code, adminUsername, adminEmail }) => ({
        code,
        adminUsername,
        adminEmail,
      })),
    }, "Auth dev fixtures verified");
  }

  logger.info("Startup tasks completed");
}
