import type { DynamicAlert, Severity } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IDynamicAlertDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface DynamicAlertRow {
  id: string;
  session_id: string;
  severity: Severity;
  title: string;
  description: string;
  llm_analysis: string | null;
  related_messages: string;
  detected_at: string;
}

function rowToAlert(row: DynamicAlertRow): DynamicAlert {
  return {
    id: row.id,
    severity: row.severity,
    title: row.title,
    description: row.description,
    llmAnalysis: row.llm_analysis ?? undefined,
    relatedMessages: safeJsonParse(row.related_messages, []),
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
    return (this.selectBySessionStmt.all(sessionId) as DynamicAlertRow[]).map(rowToAlert);
  }

  updateLlmAnalysis(alertId: string, llmAnalysis: string): void {
    this.updateLlmStmt.run(llmAnalysis, alertId);
  }
}
