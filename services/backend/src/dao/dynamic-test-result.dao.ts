import type { DynamicTestResult, DynamicTestFinding, AnalysisStatus } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IDynamicTestResultDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface DynamicTestResultRow {
  id: string;
  project_id: string;
  config: string;
  status: AnalysisStatus;
  total_runs: number;
  crashes: number;
  anomalies: number;
  findings: string;
  created_at: string;
}

function rowToResult(row: DynamicTestResultRow): DynamicTestResult {
  return {
    id: row.id,
    projectId: row.project_id,
    config: safeJsonParse(row.config, {} as DynamicTestResult["config"]),
    status: row.status,
    totalRuns: row.total_runs,
    crashes: row.crashes,
    anomalies: row.anomalies,
    findings: safeJsonParse(row.findings, []),
    createdAt: row.created_at,
  };
}

export class DynamicTestResultDAO implements IDynamicTestResultDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private updateResultStmt;
  private deleteByIdStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO dynamic_test_results (id, project_id, config, status, total_runs, crashes, anomalies, findings, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(
      `SELECT * FROM dynamic_test_results WHERE id = ?`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM dynamic_test_results WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.updateResultStmt = db.prepare(
      `UPDATE dynamic_test_results SET status = ?, total_runs = ?, crashes = ?, anomalies = ?, findings = ? WHERE id = ?`
    );
    this.deleteByIdStmt = db.prepare(
      `DELETE FROM dynamic_test_results WHERE id = ?`
    );
  }

  save(result: DynamicTestResult): void {
    this.insertStmt.run(
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
    const row = this.selectByIdStmt.get(id) as DynamicTestResultRow | undefined;
    return row ? rowToResult(row) : undefined;
  }

  findByProjectId(projectId: string): DynamicTestResult[] {
    return (this.selectByProjectStmt.all(projectId) as DynamicTestResultRow[]).map(rowToResult);
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
    this.updateResultStmt.run(
      updates.status,
      updates.totalRuns,
      updates.crashes,
      updates.anomalies,
      JSON.stringify(updates.findings),
      id
    );
  }

  deleteById(id: string): boolean {
    const result = this.deleteByIdStmt.run(id);
    return result.changes > 0;
  }
}
