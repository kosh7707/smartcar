import type { DynamicAnalysisSession, DynamicSource } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IDynamicSessionDAO } from "./interfaces";

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

export class DynamicSessionDAO implements IDynamicSessionDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectAllStmt;
  private selectByProjectStmt;
  private updateStatusStmt;
  private updateEndedStmt;
  private updateCountsStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO dynamic_analysis_sessions (id, project_id, status, source, message_count, alert_count, started_at)
       VALUES (?, ?, ?, ?, 0, 0, ?)`
    );
    this.selectByIdStmt = db.prepare(
      `SELECT * FROM dynamic_analysis_sessions WHERE id = ?`
    );
    this.selectAllStmt = db.prepare(
      `SELECT * FROM dynamic_analysis_sessions ORDER BY started_at DESC`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM dynamic_analysis_sessions WHERE project_id = ? ORDER BY started_at DESC`
    );
    this.updateStatusStmt = db.prepare(
      `UPDATE dynamic_analysis_sessions SET status = ? WHERE id = ?`
    );
    this.updateEndedStmt = db.prepare(
      `UPDATE dynamic_analysis_sessions SET status = 'stopped', ended_at = ? WHERE id = ?`
    );
    this.updateCountsStmt = db.prepare(
      `UPDATE dynamic_analysis_sessions SET message_count = ?, alert_count = ? WHERE id = ?`
    );
  }

  save(session: DynamicAnalysisSession): void {
    this.insertStmt.run(session.id, session.projectId, session.status, JSON.stringify(session.source), session.startedAt);
  }

  findById(id: string): DynamicAnalysisSession | undefined {
    const row = this.selectByIdStmt.get(id);
    return row ? rowToSession(row) : undefined;
  }

  findAll(): DynamicAnalysisSession[] {
    return this.selectAllStmt.all().map(rowToSession);
  }

  findByProjectId(projectId: string): DynamicAnalysisSession[] {
    return this.selectByProjectStmt.all(projectId).map(rowToSession);
  }

  updateStatus(id: string, status: string): void {
    this.updateStatusStmt.run(status, id);
  }

  stop(id: string, endedAt: string): void {
    this.updateEndedStmt.run(endedAt, id);
  }

  updateCounts(id: string, messageCount: number, alertCount: number): void {
    this.updateCountsStmt.run(messageCount, alertCount, id);
  }
}
