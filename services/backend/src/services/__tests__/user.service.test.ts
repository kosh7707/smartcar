import { describe, it, expect, beforeEach } from "vitest";
import { UserService } from "../user.service";
import { UserDAO, SessionDAO } from "../../dao/user.dao";
import { createTestDb } from "../../test/test-db";
import { InvalidInputError } from "../../lib/errors";

describe("UserService", () => {
  let service: UserService;
  let userDAO: UserDAO;
  let sessionDAO: SessionDAO;

  beforeEach(() => {
    const db = createTestDb();
    userDAO = new UserDAO(db);
    sessionDAO = new SessionDAO(db);
    service = new UserService(userDAO, sessionDAO);
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

    it("throws on short username", () => {
      expect(() => service.createUser("a", "pass1234", "A")).toThrow(InvalidInputError);
    });

    it("throws on short password", () => {
      expect(() => service.createUser("alice", "ab", "Alice")).toThrow(InvalidInputError);
    });

    it("assigns custom role", () => {
      const user = service.createUser("admin1", "pass1234", "Admin", "admin");
      expect(user.role).toBe("admin");
    });
  });

  describe("authenticate", () => {
    beforeEach(() => {
      service.createUser("alice", "pass1234", "Alice");
    });

    it("returns token and user on valid credentials", () => {
      const result = service.authenticate("alice", "pass1234");
      expect(result.token).toBeDefined();
      expect(result.token.length).toBeGreaterThan(0);
      expect(result.user.username).toBe("alice");
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it("throws on wrong password", () => {
      expect(() => service.authenticate("alice", "wrong")).toThrow(InvalidInputError);
    });

    it("throws on nonexistent user", () => {
      expect(() => service.authenticate("nobody", "pass1234")).toThrow(InvalidInputError);
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

    it("returns undefined for invalid token", () => {
      expect(service.validateSession("nonexistent-token")).toBeUndefined();
    });

    it("returns undefined and cleans up expired session", () => {
      service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      // Manually expire the session
      const session = sessionDAO.findByToken(token)!;
      const db = (sessionDAO as any).db;
      db.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").run(
        new Date(Date.now() - 1000).toISOString(),
        token,
      );
      expect(service.validateSession(token)).toBeUndefined();
      // Session should be cleaned up
      expect(sessionDAO.findByToken(token)).toBeUndefined();
    });
  });

  describe("logout", () => {
    it("invalidates session token", () => {
      service.createUser("alice", "pass1234", "Alice");
      const { token } = service.authenticate("alice", "pass1234");
      service.logout(token);
      expect(service.validateSession(token)).toBeUndefined();
    });
  });

  describe("findAll", () => {
    it("returns all users", () => {
      service.createUser("alice", "pass1234", "Alice");
      service.createUser("bob", "pass5678", "Bob");
      const users = service.findAll();
      expect(users).toHaveLength(2);
    });
  });

  describe("seedAdmin", () => {
    it("creates admin when DB is empty", () => {
      service.seedAdmin("admin", "admin1234");
      const users = service.findAll();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("admin");
      expect(users[0].role).toBe("admin");
    });

    it("does nothing when users already exist", () => {
      service.createUser("existing", "pass1234", "Existing");
      service.seedAdmin("admin", "admin1234");
      const users = service.findAll();
      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("existing");
    });
  });
});
