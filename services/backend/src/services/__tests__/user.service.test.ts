import crypto from "crypto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_SESSION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  REGISTRATION_LOOKUP_TTL_MS,
  REMEMBER_ME_SESSION_TTL_MS,
  UserService,
} from "../user.service";
import {
  OrganizationDAO,
  PasswordResetTokenDAO,
  RegistrationRequestDAO,
  SessionDAO,
  UserDAO,
} from "../../dao/user.dao";
import { AuthRateLimitDAO } from "../../dao/auth-rate-limit.dao";
import { createTestDb } from "../../test/test-db";
import { ConflictError, ForbiddenError, InvalidInputError, RateLimitError } from "../../lib/errors";
import type { DatabaseType } from "../../db";

describe("UserService", () => {
  let db: DatabaseType;
  let service: UserService;
  let userDAO: UserDAO;
  let sessionDAO: SessionDAO;
  let organizationDAO: OrganizationDAO;
  let registrationRequestDAO: RegistrationRequestDAO;
  let passwordResetTokenDAO: PasswordResetTokenDAO;
  let authRateLimitDAO: AuthRateLimitDAO;

  beforeEach(() => {
    db = createTestDb();
    userDAO = new UserDAO(db);
    sessionDAO = new SessionDAO(db);
    authRateLimitDAO = new AuthRateLimitDAO(db);
    organizationDAO = new OrganizationDAO(db);
    registrationRequestDAO = new RegistrationRequestDAO(db);
    passwordResetTokenDAO = new PasswordResetTokenDAO(db);
    service = new UserService(
      userDAO,
      sessionDAO,
      organizationDAO,
      registrationRequestDAO,
      passwordResetTokenDAO,
      authRateLimitDAO,
    );

    organizationDAO.save({
      id: "org-1",
      code: "ACME-KR",
      name: "ACME Corp",
      region: "kr-seoul-1",
      defaultRole: "viewer",
      emailDomainHint: "acme.kr",
      adminDisplayName: "Alice Admin",
      adminEmail: "admin@acme.kr",
    });
  });

  describe("createUser", () => {
    it("creates user with valid input", () => {
      const user = service.createUser("alice", "pass1234", "Alice");
      expect(user.username).toBe("alice");
      expect(user.displayName).toBe("Alice");
      expect(user.role).toBe("analyst");
      expect(user.id).toMatch(/^user-/);
      expect((user as any).passwordHash).toBeUndefined();
    });

    it("uses username as displayName when empty", () => {
      const user = service.createUser("bob", "pass1234", "");
      expect(user.displayName).toBe("bob");
    });

    it("throws on duplicate username", () => {
      service.createUser("alice", "pass1234", "Alice");
      expect(() => service.createUser("alice", "pass5678", "Alice 2")).toThrow(InvalidInputError);
    });

    it("throws on duplicate email", () => {
      service.createUser("alice", "pass1234", "Alice", "analyst", { email: "alice@acme.kr" });
      expect(() => service.createUser("bob", "pass5678", "Bob", "analyst", { email: "alice@acme.kr" })).toThrow(ConflictError);
    });
  });

  describe("authenticate", () => {
    beforeEach(() => {
      service.createUser("alice", "pass1234", "Alice", "analyst", { email: "alice@acme.kr", organizationId: "org-1" });
    });

    it("returns token and user on valid credentials by username", () => {
      const result = service.authenticate("alice", "pass1234");
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();
      expect(result.user.username).toBe("alice");
      expect(result.user.email).toBe("alice@acme.kr");
    });

    it("falls back to email as login identifier", () => {
      const result = service.authenticate("alice@acme.kr", "pass1234");
      expect(result.user.username).toBe("alice");
    });

    it("extends expiry when rememberMe is true", () => {
      const short = service.authenticate("alice", "pass1234", false);
      const long = service.authenticate("alice", "pass1234", true);
      const shortTtl = new Date(short.expiresAt).getTime() - Date.now();
      const longTtl = new Date(long.expiresAt).getTime() - Date.now();
      expect(shortTtl).toBeGreaterThan(DEFAULT_SESSION_TTL_MS - 10_000);
      expect(longTtl).toBeGreaterThan(REMEMBER_ME_SESSION_TTL_MS - 10_000);
      expect(longTtl).toBeGreaterThan(shortTtl);
    });

    it("throws on wrong password", () => {
      expect(() => service.authenticate("alice", "wrong")).toThrow(InvalidInputError);
    });

    it("rate limits repeated login attempts by identifier and ip", () => {
      for (let i = 0; i < 10; i += 1) {
        expect(() => service.authenticate("alice", "wrong", false, "127.0.0.1")).toThrow(InvalidInputError);
      }
      expect(() => service.authenticate("alice", "wrong", false, "127.0.0.1")).toThrow(RateLimitError);
    });

    it("persists login throttling across service instances via DB-backed events", () => {
      for (let i = 0; i < 10; i += 1) {
        expect(() => service.authenticate("alice", "wrong", false, "127.0.0.1")).toThrow(InvalidInputError);
      }
      const reloaded = new UserService(
        userDAO,
        sessionDAO,
        organizationDAO,
        registrationRequestDAO,
        passwordResetTokenDAO,
        authRateLimitDAO,
      );
      expect(() => reloaded.authenticate("alice", "wrong", false, "127.0.0.1")).toThrow(RateLimitError);
    });
  });

  describe("validateSession", () => {
    it("returns user for valid token", () => {
      service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      const user = service.validateSession(token);
      expect(user).toBeDefined();
      expect(user!.username).toBe("alice");
    });

    it("stores session tokens hashed at rest", () => {
      service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      const stored = db.prepare("SELECT token FROM sessions").get() as { token: string };
      expect(stored.token).not.toBe(token);
      expect(stored.token).toMatch(/^[a-f0-9]{64}$/);
    });

    it("rejects stored session hash as a bearer token", () => {
      service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      const stored = db.prepare("SELECT token FROM sessions").get() as { token: string };
      expect(stored.token).not.toBe(token);
      expect(service.validateSession(stored.token)).toBeUndefined();
      expect(service.validateSession(token)?.username).toBe("alice");
    });

    it("returns undefined and cleans up expired session", () => {
      service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      const session = sessionDAO.findByToken(token)!;
      db.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").run(
        new Date(Date.now() - 1000).toISOString(),
        session.token,
      );
      expect(service.validateSession(token)).toBeUndefined();
      expect(sessionDAO.findByToken(token)).toBeUndefined();
    });

    it("returns undefined for disabled users", () => {
      const user = service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      userDAO.update(user.id, { accountStatus: "disabled" });
      expect(service.validateSession(token)).toBeUndefined();
    });
  });

  describe("organization verify and registration lifecycle", () => {
    it("verifies organization preview", () => {
      const preview = service.verifyOrganization("ACME-KR", "127.0.0.1");
      expect(preview.name).toBe("ACME Corp");
      expect(preview.admin.email).toBe("admin@acme.kr");
    });

    it("submits registration, returns lookup token, and public lookup works", () => {
      const result = service.submitRegistration({
        fullName: "Bob Analyst",
        email: "bob@acme.kr",
        password: "Passw0rd!",
        orgCode: "ACME-KR",
        termsAcceptedAt: new Date().toISOString(),
        auditAcceptedAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
      });

      expect(result.status).toBe("pending_admin_review");
      expect(result.lookupToken).toBeDefined();
      expect(new Date(result.lookupExpiresAt).getTime()).toBeGreaterThan(Date.now() + REGISTRATION_LOOKUP_TTL_MS - 10_000);

      const lookup = service.lookupRegistration(result.lookupToken);
      expect(lookup.email).toBe("bob@acme.kr");
      expect(lookup.status).toBe("pending_admin_review");
    });

    it("approves registration with same-org admin and enables login immediately", () => {
      const admin = service.createUser("org-admin", "pass1234", "Org Admin", "admin", {
        email: "admin1@acme.kr",
        organizationId: "org-1",
      });
      const registration = service.submitRegistration({
        fullName: "Bob Analyst",
        email: "bob@acme.kr",
        password: "Passw0rd!",
        orgCode: "ACME-KR",
        termsAcceptedAt: new Date().toISOString(),
        auditAcceptedAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
      });

      const approved = service.approveRegistration(
        { ...admin, organizationId: "org-1" },
        registration.registrationId,
        "analyst",
      );

      expect(approved.status).toBe("approved");
      const login = service.authenticate("bob@acme.kr", "Passw0rd!");
      expect(login.user.email).toBe("bob@acme.kr");
      expect(login.user.role).toBe("analyst");
    });

    it("rejects cross-org admin review", () => {
      organizationDAO.save({
        id: "org-2",
        code: "BETA-KR",
        name: "Beta Corp",
        region: "kr-seoul-1",
        defaultRole: "viewer",
        adminDisplayName: "Beta Admin",
        adminEmail: "admin@beta.kr",
      });
      const admin = service.createUser("beta-admin", "pass1234", "Beta Admin", "admin", {
        email: "beta-admin@beta.kr",
        organizationId: "org-2",
      });
      const registration = service.submitRegistration({
        fullName: "Bob Analyst",
        email: "bob@acme.kr",
        password: "Passw0rd!",
        orgCode: "ACME-KR",
        termsAcceptedAt: new Date().toISOString(),
        auditAcceptedAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
      });

      expect(() => service.approveRegistration(
        { ...admin, organizationId: "org-2" },
        registration.registrationId,
        "analyst",
      )).toThrow(ForbiddenError);
    });

    it("allows platform-admin bypass", () => {
      service.seedAdmin("admin", "admin1234");
      const platformAdmin = userDAO.findByUsername("admin")!;
      const registration = service.submitRegistration({
        fullName: "Bob Analyst",
        email: "bob@acme.kr",
        password: "Passw0rd!",
        orgCode: "ACME-KR",
        termsAcceptedAt: new Date().toISOString(),
        auditAcceptedAt: new Date().toISOString(),
        ipAddress: "127.0.0.1",
      });

      const approved = service.approveRegistration(
        { ...platformAdmin, organizationId: null },
        registration.registrationId,
        "viewer",
      );

      expect(approved.status).toBe("approved");
      expect(service.authenticate("bob@acme.kr", "Passw0rd!").user.role).toBe("viewer");
    });
  });

  describe("password reset", () => {
    beforeEach(() => {
      service.createUser("alice", "pass1234", "Alice", "analyst", { email: "alice@acme.kr", organizationId: "org-1" });
    });

    it("returns generic success for unknown email", () => {
      const result = service.requestPasswordReset("nobody@acme.kr", "127.0.0.1");
      expect(result).toEqual({ accepted: true });
    });

    it("issues reset token, resets password, and invalidates sessions", () => {
      const login = service.authenticate("alice", "pass1234");
      const reset = service.requestPasswordReset("alice@acme.kr", "127.0.0.1");
      expect(reset.token).toBeDefined();

      const stored = passwordResetTokenDAO.findByTokenHash(
        crypto.createHash("sha256").update(reset.token!).digest("hex"),
      );
      expect(stored?.expiresAt).toBeDefined();
      expect(new Date(stored!.expiresAt).getTime()).toBeGreaterThan(Date.now() + PASSWORD_RESET_TTL_MS - 10_000);

      service.confirmPasswordReset(reset.token!, "NewPassw0rd!");
      expect(sessionDAO.findByToken(login.token)).toBeUndefined();
      expect(() => service.authenticate("alice", "pass1234")).toThrow(InvalidInputError);
      expect(service.authenticate("alice", "NewPassw0rd!").user.email).toBe("alice@acme.kr");
    });

    it("revokes older outstanding reset tokens when issuing a new one and after confirm", () => {
      const first = service.requestPasswordReset("alice@acme.kr", "127.0.0.1");
      const firstHash = crypto.createHash("sha256").update(first.token!).digest("hex");
      expect(passwordResetTokenDAO.findByTokenHash(firstHash)?.consumedAt).toBeUndefined();

      const second = service.requestPasswordReset("alice@acme.kr", "127.0.0.2");
      expect(passwordResetTokenDAO.findByTokenHash(firstHash)?.consumedAt).toBeDefined();

      service.confirmPasswordReset(second.token!, "NewPassw0rd!");
      const secondHash = crypto.createHash("sha256").update(second.token!).digest("hex");
      expect(passwordResetTokenDAO.findByTokenHash(secondHash)?.consumedAt).toBeDefined();
    });
  });
});
