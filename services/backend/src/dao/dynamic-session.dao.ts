import type { DynamicAnalysisSession, DynamicSource } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO dynamic_analysis_sessions (id, project_id, status, source, message_count, alert_count, started_at)
   VALUES (?, ?, ?, ?, 0, 0, ?)`
);
const selectByIdStmt = db.prepare(
  `SELECT * FROM dynamic_analysis_sessions WHERE id = ?`
);
const selectAllStmt = db.prepare(
  `SELECT * FROM dynamic_analysis_sessions ORDER BY started_at DESC`
);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM dynamic_analysis_sessions WHERE project_id = ? ORDER BY started_at DESC`
);
const updateStatusStmt = db.prepare(
  `UPDATE dynamic_analysis_sessions SET status = ? WHERE id = ?`
);
const updateEndedStmt = db.prepare(
  `UPDATE dynamic_analysis_sessions SET status = 'stopped', ended_at = ? WHERE id = ?`
);
const updateCountsStmt = db.prepare(
  `UPDATE dynamic_analysis_sessions SET message_count = ?, alert_count = ? WHERE id = ?`
);

function rowToSession(row: any): DynamicAnalysisSession {
  let source: DynamicSource = { type: "adapter", adapterId: "", adapterName: "" };
  try { source = JSON.parse(row.source); } catch {}
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    source,
    messageCount: row.message_count,
    alertCount: row.alert_count,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
  };
}

class DynamicSessionDAO {
  save(session: DynamicAnalysisSession): void {
    insertStmt.run(session.id, session.projectId, session.status, JSON.stringify(session.source), session.startedAt);
  }

  findById(id: string): DynamicAnalysisSession | undefined {
    const row = selectByIdStmt.get(id);
    return row ? rowToSession(row) : undefined;
  }

  findAll(): DynamicAnalysisSession[] {
    return selectAllStmt.all().map(rowToSession);
  }

  findByProjectId(projectId: string): DynamicAnalysisSession[] {
    return selectByProjectStmt.all(projectId).map(rowToSession);
  }

  updateStatus(id: string, status: string): void {
    updateStatusStmt.run(status, id);
  }

  stop(id: string, endedAt: string): void {
    updateEndedStmt.run(endedAt, id);
  }

  updateCounts(id: string, messageCount: number, alertCount: number): void {
    updateCountsStmt.run(messageCount, alertCount, id);
  }
}

export const dynamicSessionDAO = new DynamicSessionDAO();
