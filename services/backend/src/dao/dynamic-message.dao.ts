import type { CanMessage } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IDynamicMessageDAO } from "./interfaces";

interface CanMessageRow {
  id: number;
  session_id: string;
  timestamp: string;
  can_id: string;
  dlc: number;
  data: string;
  flagged: number;
  injected: number;
}

function rowToCanMessage(row: CanMessageRow): CanMessage {
  return {
    timestamp: row.timestamp,
    id: row.can_id,
    dlc: row.dlc,
    data: row.data,
    flagged: row.flagged === 1,
    injected: row.injected === 1,
  };
}

export class DynamicMessageDAO implements IDynamicMessageDAO {
  private insertStmt;
  private selectBySessionStmt;
  private selectRecentStmt;
  private countBySessionStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO dynamic_analysis_messages (session_id, timestamp, can_id, dlc, data, flagged, injected)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectBySessionStmt = db.prepare(
      `SELECT * FROM dynamic_analysis_messages WHERE session_id = ? ORDER BY id ASC`
    );
    this.selectRecentStmt = db.prepare(
      `SELECT * FROM dynamic_analysis_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?`
    );
    this.countBySessionStmt = db.prepare(
      `SELECT COUNT(*) AS cnt FROM dynamic_analysis_messages WHERE session_id = ?`
    );
  }

  save(sessionId: string, msg: CanMessage): void {
    this.insertStmt.run(sessionId, msg.timestamp, msg.id, msg.dlc, msg.data, msg.flagged ? 1 : 0, msg.injected ? 1 : 0);
  }

  findBySessionId(sessionId: string): CanMessage[] {
    return (this.selectBySessionStmt.all(sessionId) as CanMessageRow[]).map(rowToCanMessage);
  }

  findRecent(sessionId: string, limit: number): CanMessage[] {
    return (this.selectRecentStmt.all(sessionId, limit) as CanMessageRow[]).map(rowToCanMessage).reverse();
  }

  countBySessionId(sessionId: string): number {
    return (this.countBySessionStmt.get(sessionId) as { cnt: number }).cnt;
  }
}
