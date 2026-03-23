import type { AnalysisResult } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IAnalysisResultDAO } from "./interfaces";

function parseJsonOrDefault<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function rowToResult(row: any): AnalysisResult {
  const warnings = parseJsonOrDefault(row.warnings, []);
  const analyzedFileIds = parseJsonOrDefault(row.analyzed_file_ids, []);
  const fileCoverage = parseJsonOrDefault(row.file_coverage, []);
  const caveats = parseJsonOrDefault(row.caveats, []);
  const confidenceBreakdown = parseJsonOrDefault(row.confidence_breakdown, undefined);
  const recommendedNextSteps = parseJsonOrDefault(row.recommended_next_steps, []);
  const policyFlags = parseJsonOrDefault(row.policy_flags, []);
  const scaLibraries = parseJsonOrDefault(row.sca_libraries, []);
  const agentAudit = parseJsonOrDefault(row.agent_audit, undefined);

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
    ...(caveats.length > 0 ? { caveats } : {}),
    ...(row.confidence_score != null ? { confidenceScore: row.confidence_score } : {}),
    ...(confidenceBreakdown ? { confidenceBreakdown } : {}),
    ...(row.needs_human_review != null ? { needsHumanReview: !!row.needs_human_review } : {}),
    ...(recommendedNextSteps.length > 0 ? { recommendedNextSteps } : {}),
    ...(policyFlags.length > 0 ? { policyFlags } : {}),
    ...(scaLibraries.length > 0 ? { scaLibraries } : {}),
    ...(agentAudit ? { agentAudit } : {}),
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
      `INSERT INTO analysis_results (id, project_id, module, status, vulnerabilities, summary, warnings, analyzed_file_ids, file_coverage, caveats, confidence_score, confidence_breakdown, needs_human_review, recommended_next_steps, policy_flags, sca_libraries, agent_audit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByIdStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE id = ?`,
    );
    this.selectAllStmt = db.prepare(
      `SELECT * FROM analysis_results ORDER BY created_at DESC`,
    );
    this.selectByModuleStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE module = ? ORDER BY created_at DESC`,
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE project_id = ? ORDER BY created_at DESC`,
    );
    this.deleteByIdStmt = db.prepare(
      `DELETE FROM analysis_results WHERE id = ?`,
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
      JSON.stringify(result.caveats ?? []),
      result.confidenceScore ?? null,
      result.confidenceBreakdown ? JSON.stringify(result.confidenceBreakdown) : null,
      result.needsHumanReview != null ? (result.needsHumanReview ? 1 : 0) : null,
      JSON.stringify(result.recommendedNextSteps ?? []),
      JSON.stringify(result.policyFlags ?? []),
      JSON.stringify(result.scaLibraries ?? []),
      result.agentAudit ? JSON.stringify(result.agentAudit) : null,
      result.createdAt,
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
