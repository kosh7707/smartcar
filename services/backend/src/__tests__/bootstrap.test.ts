import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_DEV_ORGANIZATION_FIXTURES } from "../auth-dev-support";
import { runStartupTasks } from "../bootstrap";
import { AuthRateLimitDAO } from "../dao/auth-rate-limit.dao";
import {
  DevPasswordResetDeliveryDAO,
  OrganizationDAO,
  PasswordResetTokenDAO,
  RegistrationRequestDAO,
  SessionDAO,
  UserDAO,
} from "../dao/user.dao";
import { createTestDb } from "../test/test-db";
import { UserService } from "../services/user.service";

describe("runStartupTasks", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("seeds default platform admin plus mock org/admin fixtures when enabled", () => {
    process.env.AEGIS_AUTH_DEV_FIXTURES = "true";
    process.env.AEGIS_AUTH_DEV_ADMIN_PASSWORD = "Admin1234!";
    const db = createTestDb();
    const userDAO = new UserDAO(db);
    const organizationDAO = new OrganizationDAO(db);
    const service = new UserService(
      userDAO,
      new SessionDAO(db),
      organizationDAO,
      new RegistrationRequestDAO(db),
      new PasswordResetTokenDAO(db),
      new AuthRateLimitDAO(db),
      new DevPasswordResetDeliveryDAO(db),
    );

    runStartupTasks({ userService: service } as any);
    runStartupTasks({ userService: service } as any);

    expect(userDAO.findByUsername("admin")?.role).toBe("admin");
    for (const fixture of AUTH_DEV_ORGANIZATION_FIXTURES) {
      const organization = organizationDAO.findByCode(fixture.code);
      const admin = userDAO.findByUsername(fixture.adminUsername);
      expect(organization?.name).toBe(fixture.name);
      expect(admin?.email).toBe(fixture.adminEmail);
      expect(admin?.organizationId).toBe(organization?.id);
      expect(admin?.role).toBe("admin");
    }
    expect(userDAO.count()).toBe(1 + AUTH_DEV_ORGANIZATION_FIXTURES.length);
  });

  it("skips org fixture seeding when disabled", () => {
    process.env.AEGIS_AUTH_DEV_FIXTURES = "false";
    const db = createTestDb();
    const userDAO = new UserDAO(db);
    const organizationDAO = new OrganizationDAO(db);
    const service = new UserService(
      userDAO,
      new SessionDAO(db),
      organizationDAO,
      new RegistrationRequestDAO(db),
      new PasswordResetTokenDAO(db),
      new AuthRateLimitDAO(db),
      new DevPasswordResetDeliveryDAO(db),
    );

    runStartupTasks({ userService: service } as any);

    expect(userDAO.findByUsername("admin")?.role).toBe("admin");
    expect(organizationDAO.findByCode("ACME-KR-SEC")).toBeUndefined();
  });
});
