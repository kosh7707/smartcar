import type { AnalysisResult } from "@smartcar/shared";
import type { DatabaseType } from "../db";
import type { IAnalysisResultDAO } from "./interfaces";

function rowToResult(row: any): AnalysisResult {
  const warnings = JSON.parse(row.warnings || "[]");
  const analyzedFileIds = JSON.parse(row.analyzed_file_ids || "[]");
  const fileCoverage = JSON.parse(row.file_coverage || "[]");
  return {
    id: row.id,
    projectId: row.project_id,
    module: row.module,
    status: row.status,
    vulnerabilities: JSON.parse(row.vulnerabilities),
    summary: JSON.parse(row.summary),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(analyzedFileIds.length > 0 ? { analyzedFileIds } : {}),
    ...(fileCoverage.length > 0 ? { fileCoverage } : {}),
    createdAt: row.created_at,
  };
}

export class AnalysisResultDAO implements IAnalysisResultDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectAllStmt;
  private selectByModuleStmt;
  private selectByProjectStmt;
  private deleteByIdStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO analysis_results (id, project_id, module, status, vulnerabilities, summary, warnings, analyzed_file_ids, file_coverage, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE id = ?`
    );
    this.selectAllStmt = db.prepare(
      `SELECT * FROM analysis_results ORDER BY created_at DESC`
    );
    this.selectByModuleStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE module = ? ORDER BY created_at DESC`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.deleteByIdStmt = db.prepare(
      `DELETE FROM analysis_results WHERE id = ?`
    );
  }

  save(result: AnalysisResult): void {
    this.insertStmt.run(
      result.id,
      result.projectId,
      result.module,
      result.status,
      JSON.stringify(result.vulnerabilities),
      JSON.stringify(result.summary),
      JSON.stringify(result.warnings ?? []),
      JSON.stringify(result.analyzedFileIds ?? []),
      JSON.stringify(result.fileCoverage ?? []),
      result.createdAt
    );
  }

  findById(id: string): AnalysisResult | undefined {
    const row = this.selectByIdStmt.get(id);
    return row ? rowToResult(row) : undefined;
  }

  findAll(): AnalysisResult[] {
    return this.selectAllStmt.all().map(rowToResult);
  }

  findByModule(module: string): AnalysisResult[] {
    return this.selectByModuleStmt.all(module).map(rowToResult);
  }

  findByProjectId(projectId: string): AnalysisResult[] {
    return this.selectByProjectStmt.all(projectId).map(rowToResult);
  }

  deleteById(id: string): boolean {
    const result = this.deleteByIdStmt.run(id);
    return result.changes > 0;
  }
}
