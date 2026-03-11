import type { CanMessage } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO dynamic_analysis_messages (session_id, timestamp, can_id, dlc, data, flagged, injected)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const selectBySessionStmt = db.prepare(
  `SELECT * FROM dynamic_analysis_messages WHERE session_id = ? ORDER BY id ASC`
);
const selectRecentStmt = db.prepare(
  `SELECT * FROM dynamic_analysis_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?`
);
const countBySessionStmt = db.prepare(
  `SELECT COUNT(*) AS cnt FROM dynamic_analysis_messages WHERE session_id = ?`
);

function rowToCanMessage(row: any): CanMessage {
  return {
    timestamp: row.timestamp,
    id: row.can_id,
    dlc: row.dlc,
    data: row.data,
    flagged: row.flagged === 1,
    injected: row.injected === 1,
  };
}

class DynamicMessageDAO {
  save(sessionId: string, msg: CanMessage): void {
    insertStmt.run(sessionId, msg.timestamp, msg.id, msg.dlc, msg.data, msg.flagged ? 1 : 0, msg.injected ? 1 : 0);
  }

  findBySessionId(sessionId: string): CanMessage[] {
    return selectBySessionStmt.all(sessionId).map(rowToCanMessage);
  }

  findRecent(sessionId: string, limit: number): CanMessage[] {
    return selectRecentStmt.all(sessionId, limit).map(rowToCanMessage).reverse();
  }

  countBySessionId(sessionId: string): number {
    return (countBySessionStmt.get(sessionId) as any).cnt;
  }
}

export const dynamicMessageDAO = new DynamicMessageDAO();
