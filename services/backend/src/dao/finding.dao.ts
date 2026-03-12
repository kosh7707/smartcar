import type { Finding, FindingStatus, Severity, AnalysisModule } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO findings (id, run_id, project_id, module, status, severity, confidence, source_type, title, description, location, suggestion, rule_id, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(`SELECT * FROM findings WHERE id = ?`);
const selectByRunStmt = db.prepare(
  `SELECT * FROM findings WHERE run_id = ? ORDER BY created_at DESC`
);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM findings WHERE project_id = ? ORDER BY created_at DESC`
);
const updateStatusStmt = db.prepare(
  `UPDATE findings SET status = ?, updated_at = ? WHERE id = ?`
);

function rowToFinding(row: any): Finding {
  return {
    id: row.id,
    runId: row.run_id,
    projectId: row.project_id,
    module: row.module,
    status: row.status,
    severity: row.severity,
    confidence: row.confidence,
    sourceType: row.source_type,
    title: row.title,
    description: row.description,
    location: row.location ?? undefined,
    suggestion: row.suggestion ?? undefined,
    ruleId: row.rule_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface FindingFilters {
  status?: FindingStatus;
  severity?: Severity;
  module?: AnalysisModule;
}

class FindingDAO {
  save(finding: Finding): void {
    insertStmt.run(
      finding.id,
      finding.runId,
      finding.projectId,
      finding.module,
      finding.status,
      finding.severity,
      finding.confidence,
      finding.sourceType,
      finding.title,
      finding.description,
      finding.location ?? null,
      finding.suggestion ?? null,
      finding.ruleId ?? null,
      finding.createdAt,
      finding.updatedAt
    );
  }

  saveMany(findings: Finding[]): void {
    const tx = db.transaction((items: Finding[]) => {
      for (const f of items) this.save(f);
    });
    tx(findings);
  }

  findById(id: string): Finding | undefined {
    const row = selectByIdStmt.get(id);
    return row ? rowToFinding(row) : undefined;
  }

  findByRunId(runId: string): Finding[] {
    return selectByRunStmt.all(runId).map(rowToFinding);
  }

  findByProjectId(projectId: string, filters?: FindingFilters): Finding[] {
    if (!filters || (!filters.status && !filters.severity && !filters.module)) {
      return selectByProjectStmt.all(projectId).map(rowToFinding);
    }

    const conditions = ["project_id = ?"];
    const params: any[] = [projectId];

    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.severity) {
      conditions.push("severity = ?");
      params.push(filters.severity);
    }
    if (filters.module) {
      conditions.push("module = ?");
      params.push(filters.module);
    }

    const sql = `SELECT * FROM findings WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`;
    return db.prepare(sql).all(...params).map(rowToFinding);
  }

  updateStatus(id: string, status: FindingStatus): void {
    updateStatusStmt.run(status, new Date().toISOString(), id);
  }

  summaryByProjectId(projectId: string): { byStatus: Record<string, number>; bySeverity: Record<string, number>; total: number } {
    const rows = selectByProjectStmt.all(projectId).map(rowToFinding);
    const byStatus: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const f of rows) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    }

    return { byStatus, bySeverity, total: rows.length };
  }
}

export const findingDAO = new FindingDAO();
