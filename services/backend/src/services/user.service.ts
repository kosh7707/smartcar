import crypto from "crypto";
import { scryptSync, randomBytes } from "crypto";
import type { User, UserRole } from "@aegis/shared";
import type { UserDAO, SessionDAO } from "../dao/user.dao";
import { createLogger } from "../lib/logger";
import { InvalidInputError } from "../lib/errors";

const logger = createLogger("user-service");
const SESSION_EXPIRY_HOURS = 24;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return hash === derived;
}

export class UserService {
  constructor(
    private userDAO: UserDAO,
    private sessionDAO: SessionDAO,
  ) {}

  createUser(username: string, password: string, displayName: string, role: UserRole = "analyst"): User {
    if (!username || username.length < 2) throw new InvalidInputError("Username must be at least 2 characters");
    if (!password || password.length < 4) throw new InvalidInputError("Password must be at least 4 characters");
    const existing = this.userDAO.findByUsername(username);
    if (existing) throw new InvalidInputError(`Username already exists: ${username}`);

    const id = `user-${crypto.randomUUID().slice(0, 8)}`;
    const passwordHash = hashPassword(password);
    this.userDAO.save({ id, username, displayName: displayName || username, passwordHash, role });
    logger.info({ userId: id, username, role }, "User created");
    return this.userDAO.findById(id)!;
  }

  authenticate(username: string, password: string): { token: string; user: User } {
    const user = this.userDAO.findByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new InvalidInputError("Invalid username or password");
    }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    this.sessionDAO.create(token, user.id, expiresAt);
    logger.info({ userId: user.id, username }, "User authenticated");
    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  }

  validateSession(token: string): User | undefined {
    const session = this.sessionDAO.findByToken(token);
    if (!session) return undefined;
    if (new Date(session.expiresAt) < new Date()) {
      this.sessionDAO.deleteByToken(token);
      return undefined;
    }
    return this.userDAO.findById(session.userId);
  }

  logout(token: string): void {
    this.sessionDAO.deleteByToken(token);
  }

  findAll(): User[] {
    return this.userDAO.findAll();
  }

  /** 최초 기동 시 DB에 사용자가 없으면 admin 시딩 */
  seedAdmin(username: string, password: string): void {
    if (this.userDAO.count() > 0) return;
    this.createUser(username, password, "Administrator", "admin");
    logger.info({ username }, "Default admin user seeded");
  }
}
