import type { DynamicAlert } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO dynamic_analysis_alerts (id, session_id, severity, title, description, llm_analysis, related_messages, detected_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectBySessionStmt = db.prepare(
  `SELECT * FROM dynamic_analysis_alerts WHERE session_id = ? ORDER BY detected_at ASC`
);
const updateLlmStmt = db.prepare(
  `UPDATE dynamic_analysis_alerts SET llm_analysis = ? WHERE id = ?`
);

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

class DynamicAlertDAO {
  save(alert: DynamicAlert, sessionId: string): void {
    insertStmt.run(
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
    return selectBySessionStmt.all(sessionId).map(rowToAlert);
  }

  updateLlmAnalysis(alertId: string, llmAnalysis: string): void {
    updateLlmStmt.run(llmAnalysis, alertId);
  }
}

export const dynamicAlertDAO = new DynamicAlertDAO();
