import type { Run } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IRunDAO } from "./interfaces";

function rowToRun(row: any): Run {
  return {
    id: row.id,
    projectId: row.project_id,
    module: row.module,
    status: row.status,
    analysisResultId: row.analysis_result_id,
    findingCount: row.finding_count,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    createdAt: row.created_at,
  };
}

export class RunDAO implements IRunDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private selectByAnalysisResultStmt;
  private updateFindingCountStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO runs (id, project_id, module, status, analysis_result_id, finding_count, started_at, ended_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM runs WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.selectByAnalysisResultStmt = db.prepare(
      `SELECT * FROM runs WHERE analysis_result_id = ?`
    );
    this.updateFindingCountStmt = db.prepare(
      `UPDATE runs SET finding_count = ? WHERE id = ?`
    );
  }

  save(run: Run): void {
    this.insertStmt.run(
      run.id,
      run.projectId,
      run.module,
      run.status,
      run.analysisResultId,
      run.findingCount,
      run.startedAt ?? null,
      run.endedAt ?? null,
      run.createdAt
    );
  }

  findById(id: string): Run | undefined {
    const row = this.selectByIdStmt.get(id);
    return row ? rowToRun(row) : undefined;
  }

  findByProjectId(projectId: string): Run[] {
    return this.selectByProjectStmt.all(projectId).map(rowToRun);
  }

  findByAnalysisResultId(analysisResultId: string): Run | undefined {
    const row = this.selectByAnalysisResultStmt.get(analysisResultId);
    return row ? rowToRun(row) : undefined;
  }

  updateFindingCount(id: string, count: number): void {
    this.updateFindingCountStmt.run(count, id);
  }

  trendByModule(
    projectId: string,
    module: string,
    since?: string
  ): Array<{ date: string; runCount: number; findingCount: number; gatePassCount: number }> {
    const conditions = ["r.project_id = ?", "r.module = ?"];
    const params: any[] = [projectId, module];
    if (since) {
      conditions.push("r.created_at >= ?");
      params.push(since);
    }

    const sql = `
      SELECT
        DATE(r.created_at) as date,
        COUNT(DISTINCT r.id) as run_count,
        COALESCE(SUM(r.finding_count), 0) as finding_count,
        COUNT(DISTINCT CASE WHEN g.status = 'pass' THEN g.id END) as gate_pass_count
      FROM runs r
      LEFT JOIN gate_results g ON g.run_id = r.id
      WHERE ${conditions.join(" AND ")}
      GROUP BY DATE(r.created_at)
      ORDER BY date ASC
    `;

    const rows = this.db.prepare(sql).all(...params) as Array<{
      date: string;
      run_count: number;
      finding_count: number;
      gate_pass_count: number;
    }>;

    return rows.map((row) => ({
      date: row.date,
      runCount: row.run_count,
      findingCount: row.finding_count,
      gatePassCount: row.gate_pass_count,
    }));
  }
}
