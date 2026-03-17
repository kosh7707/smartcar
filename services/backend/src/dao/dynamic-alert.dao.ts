import type { DynamicAlert } from "@smartcar/shared";
import type { DatabaseType } from "../db";
import type { IDynamicAlertDAO } from "./interfaces";

function rowToAlert(row: any): DynamicAlert {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    description: row.description,
    llmAnalysis: row.llm_analysis ?? undefined,
    relatedMessages: JSON.parse(row.related_messages),
    detectedAt: row.detected_at,
  };
}

export class DynamicAlertDAO implements IDynamicAlertDAO {
  private insertStmt;
  private selectBySessionStmt;
  private updateLlmStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO dynamic_analysis_alerts (id, session_id, severity, title, description, llm_analysis, related_messages, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectBySessionStmt = db.prepare(
      `SELECT * FROM dynamic_analysis_alerts WHERE session_id = ? ORDER BY detected_at ASC`
    );
    this.updateLlmStmt = db.prepare(
      `UPDATE dynamic_analysis_alerts SET llm_analysis = ? WHERE id = ?`
    );
  }

  save(alert: DynamicAlert, sessionId: string): void {
    this.insertStmt.run(
      alert.id,
      sessionId,
      alert.severity,
      alert.title,
      alert.description,
      alert.llmAnalysis ?? null,
      JSON.stringify(alert.relatedMessages),
      alert.detectedAt
    );
  }

  findBySessionId(sessionId: string): DynamicAlert[] {
    return this.selectBySessionStmt.all(sessionId).map(rowToAlert);
  }

  updateLlmAnalysis(alertId: string, llmAnalysis: string): void {
    this.updateLlmStmt.run(llmAnalysis, alertId);
  }
}
