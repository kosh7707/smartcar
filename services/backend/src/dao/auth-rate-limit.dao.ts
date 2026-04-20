import crypto from "crypto";
import type { DatabaseType } from "../db";
import { RateLimitError } from "../lib/errors";

export class AuthRateLimitDAO {
  constructor(private db: DatabaseType) {}

  enforce(scope: string, key: string, limit: number, windowMs: number, message: string): void {
    const now = new Date();
    const occurredAt = now.toISOString();
    const windowStart = new Date(now.getTime() - windowMs).toISOString();
    const pruneBefore = new Date(now.getTime() - windowMs * 2).toISOString();

    this.db.transaction(() => {
      this.db.prepare(
        `DELETE FROM auth_rate_limit_events
         WHERE scope = ? AND key = ? AND occurred_at < ?`,
      ).run(scope, key, pruneBefore);

      const count = (
        this.db.prepare(
          `SELECT COUNT(*) AS cnt
           FROM auth_rate_limit_events
           WHERE scope = ? AND key = ? AND occurred_at >= ?`,
        ).get(scope, key, windowStart) as { cnt: number }
      ).cnt;

      if (count >= limit) {
        throw new RateLimitError(message, undefined, { scope, key, limit, windowMs });
      }

      this.db.prepare(
        `INSERT INTO auth_rate_limit_events (id, scope, key, occurred_at)
         VALUES (?, ?, ?, ?)`,
      ).run(`arl-${crypto.randomUUID().slice(0, 8)}`, scope, key, occurredAt);
    })();
  }
}
