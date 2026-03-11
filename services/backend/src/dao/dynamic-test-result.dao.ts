import type { DynamicTestResult, DynamicTestFinding, AnalysisStatus } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO dynamic_test_results (id, project_id, config, status, total_runs, crashes, anomalies, findings, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(
  `SELECT * FROM dynamic_test_results WHERE id = ?`
);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM dynamic_test_results WHERE project_id = ? ORDER BY created_at DESC`
);
const updateResultStmt = db.prepare(
  `UPDATE dynamic_test_results SET status = ?, total_runs = ?, crashes = ?, anomalies = ?, findings = ? WHERE id = ?`
);
const deleteByIdStmt = db.prepare(
  `DELETE FROM dynamic_test_results WHERE id = ?`
);

function rowToResult(row: any): DynamicTestResult {
  return {
    id: row.id,
    projectId: row.project_id,
    config: JSON.parse(row.config),
    status: row.status,
    totalRuns: row.total_runs,
    crashes: row.crashes,
    anomalies: row.anomalies,
    findings: JSON.parse(row.findings),
    createdAt: row.created_at,
  };
}

class DynamicTestResultDAO {
  save(result: DynamicTestResult): void {
    insertStmt.run(
      result.id,
      result.projectId,
      JSON.stringify(result.config),
      result.status,
      result.totalRuns,
      result.crashes,
      result.anomalies,
      JSON.stringify(result.findings),
      result.createdAt
    );
  }

  findById(id: string): DynamicTestResult | undefined {
    const row = selectByIdStmt.get(id);
    return row ? rowToResult(row) : undefined;
  }

  findByProjectId(projectId: string): DynamicTestResult[] {
    return selectByProjectStmt.all(projectId).map(rowToResult);
  }

  updateResult(
    id: string,
    updates: {
      status: AnalysisStatus;
      totalRuns: number;
      crashes: number;
      anomalies: number;
      findings: DynamicTestFinding[];
    }
  ): void {
    updateResultStmt.run(
      updates.status,
      updates.totalRuns,
      updates.crashes,
      updates.anomalies,
      JSON.stringify(updates.findings),
      id
    );
  }

  deleteById(id: string): boolean {
    const result = deleteByIdStmt.run(id);
    return result.changes > 0;
  }
}

export const dynamicTestResultDAO = new DynamicTestResultDAO();
