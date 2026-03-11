import type { AnalysisResult } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO analysis_results (id, project_id, module, status, vulnerabilities, summary, warnings, analyzed_file_ids, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(
  `SELECT * FROM analysis_results WHERE id = ?`
);
const selectAllStmt = db.prepare(
  `SELECT * FROM analysis_results ORDER BY created_at DESC`
);
const selectByModuleStmt = db.prepare(
  `SELECT * FROM analysis_results WHERE module = ? ORDER BY created_at DESC`
);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM analysis_results WHERE project_id = ? ORDER BY created_at DESC`
);

function rowToResult(row: any): AnalysisResult {
  const warnings = JSON.parse(row.warnings || "[]");
  const analyzedFileIds = JSON.parse(row.analyzed_file_ids || "[]");
  return {
    id: row.id,
    projectId: row.project_id,
    module: row.module,
    status: row.status,
    vulnerabilities: JSON.parse(row.vulnerabilities),
    summary: JSON.parse(row.summary),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(analyzedFileIds.length > 0 ? { analyzedFileIds } : {}),
    createdAt: row.created_at,
  };
}

const deleteByIdStmt = db.prepare(
  `DELETE FROM analysis_results WHERE id = ?`
);

class AnalysisResultDAO {
  save(result: AnalysisResult): void {
    insertStmt.run(
      result.id,
      result.projectId,
      result.module,
      result.status,
      JSON.stringify(result.vulnerabilities),
      JSON.stringify(result.summary),
      JSON.stringify(result.warnings ?? []),
      JSON.stringify(result.analyzedFileIds ?? []),
      result.createdAt
    );
  }

  findById(id: string): AnalysisResult | undefined {
    const row = selectByIdStmt.get(id);
    return row ? rowToResult(row) : undefined;
  }

  findAll(): AnalysisResult[] {
    return selectAllStmt.all().map(rowToResult);
  }

  findByModule(module: string): AnalysisResult[] {
    return selectByModuleStmt.all(module).map(rowToResult);
  }

  findByProjectId(projectId: string): AnalysisResult[] {
    return selectByProjectStmt.all(projectId).map(rowToResult);
  }

  deleteById(id: string): boolean {
    const result = deleteByIdStmt.run(id);
    return result.changes > 0;
  }
}

export const analysisResultDAO = new AnalysisResultDAO();
