import type { GateResult } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IGateResultDAO } from "./interfaces";

function rowToGateResult(row: any): GateResult {
  return {
    id: row.id,
    runId: row.run_id,
    projectId: row.project_id,
    status: row.status,
    rules: JSON.parse(row.rules),
    evaluatedAt: row.evaluated_at,
    override: row.override ? JSON.parse(row.override) : undefined,
    createdAt: row.created_at,
  };
}

export class GateResultDAO implements IGateResultDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByRunStmt;
  private selectByProjectStmt;
  private updateOverrideStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO gate_results (id, run_id, project_id, status, rules, evaluated_at, override, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM gate_results WHERE id = ?`);
    this.selectByRunStmt = db.prepare(`SELECT * FROM gate_results WHERE run_id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM gate_results WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.updateOverrideStmt = db.prepare(
      `UPDATE gate_results SET status = 'pass', override = ? WHERE id = ?`
    );
  }

  save(result: GateResult): void {
    this.insertStmt.run(
      result.id,
      result.runId,
      result.projectId,
      result.status,
      JSON.stringify(result.rules),
      result.evaluatedAt,
      result.override ? JSON.stringify(result.override) : null,
      result.createdAt
    );
  }

  findById(id: string): GateResult | undefined {
    const row = this.selectByIdStmt.get(id);
    return row ? rowToGateResult(row) : undefined;
  }

  findByRunId(runId: string): GateResult | undefined {
    const row = this.selectByRunStmt.get(runId);
    return row ? rowToGateResult(row) : undefined;
  }

  findByProjectId(projectId: string): GateResult[] {
    return this.selectByProjectStmt.all(projectId).map(rowToGateResult);
  }

  updateOverride(id: string, override: GateResult["override"]): void {
    this.updateOverrideStmt.run(JSON.stringify(override), id);
  }

  statsByProject(
    projectId: string,
    since?: string
  ): { total: number; passed: number; failed: number; rate: number } {
    const conditions = ["project_id = ?"];
    const params: any[] = [projectId];
    if (since) {
      conditions.push("created_at >= ?");
      params.push(since);
    }

    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pass' THEN 1 END) as passed,
        COUNT(CASE WHEN status = 'fail' THEN 1 END) as failed
      FROM gate_results
      WHERE ${conditions.join(" AND ")}
    `;

    const row = this.db.prepare(sql).get(...params) as { total: number; passed: number; failed: number };
    return {
      total: row.total,
      passed: row.passed,
      failed: row.failed,
      rate: row.total > 0 ? Number((row.passed / row.total).toFixed(4)) : 0,
    };
  }
}
