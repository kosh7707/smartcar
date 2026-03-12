import type { Run } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO runs (id, project_id, module, status, analysis_result_id, finding_count, started_at, ended_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(`SELECT * FROM runs WHERE id = ?`);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC`
);
const selectByAnalysisResultStmt = db.prepare(
  `SELECT * FROM runs WHERE analysis_result_id = ?`
);
const updateFindingCountStmt = db.prepare(
  `UPDATE runs SET finding_count = ? WHERE id = ?`
);

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

class RunDAO {
  save(run: Run): void {
    insertStmt.run(
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
    const row = selectByIdStmt.get(id);
    return row ? rowToRun(row) : undefined;
  }

  findByProjectId(projectId: string): Run[] {
    return selectByProjectStmt.all(projectId).map(rowToRun);
  }

  findByAnalysisResultId(analysisResultId: string): Run | undefined {
    const row = selectByAnalysisResultStmt.get(analysisResultId);
    return row ? rowToRun(row) : undefined;
  }

  updateFindingCount(id: string, count: number): void {
    updateFindingCountStmt.run(count, id);
  }
}

export const runDAO = new RunDAO();
