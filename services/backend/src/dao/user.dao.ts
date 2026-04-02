import type { User, UserRole } from "@aegis/shared";
import type { DatabaseType } from "../db";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  token: string;
  user_id: string;
  expires_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class UserDAO {
  constructor(private db: DatabaseType) {}

  save(user: { id: string; username: string; displayName: string; passwordHash: string; role: UserRole }): void {
    this.db.prepare(
      `INSERT INTO users (id, username, display_name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
    ).run(user.id, user.username, user.displayName, user.passwordHash, user.role);
  }

  findById(id: string): User | undefined {
    const row = this.db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
    return row ? rowToUser(row) : undefined;
  }

  findByUsername(username: string): (User & { passwordHash: string }) | undefined {
    const row = this.db.prepare(`SELECT * FROM users WHERE username = ?`).get(username) as UserRow | undefined;
    return row ? { ...rowToUser(row), passwordHash: row.password_hash } : undefined;
  }

  findAll(): User[] {
    return (this.db.prepare(`SELECT * FROM users ORDER BY created_at`).all() as UserRow[]).map(rowToUser);
  }

  count(): number {
    return (this.db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number }).cnt;
  }
}

export class SessionDAO {
  constructor(private db: DatabaseType) {}

  create(token: string, userId: string, expiresAt: string): void {
    this.db.prepare(
      `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
    ).run(token, userId, expiresAt);
  }

  findByToken(token: string): { token: string; userId: string; expiresAt: string } | undefined {
    const row = this.db.prepare(`SELECT * FROM sessions WHERE token = ?`).get(token) as SessionRow | undefined;
    return row ? { token: row.token, userId: row.user_id, expiresAt: row.expires_at } : undefined;
  }

  deleteByToken(token: string): void {
    this.db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }

  deleteExpired(): number {
    return this.db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run().changes;
  }
}
