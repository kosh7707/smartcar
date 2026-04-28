import type { AnalysisResult, AnalysisModule, AnalysisStatus } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IAnalysisResultDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface AnalysisResultRow {
  id: string;
  project_id: string;
  build_target_id: string | null;
  analysis_execution_id: string | null;
  module: AnalysisModule;
  status: AnalysisStatus;
  vulnerabilities: string;
  summary: string;
  warnings: string | null;
  analyzed_file_ids: string | null;
  file_coverage: string | null;
  caveats: string | null;
  confidence_score: number | null;
  confidence_breakdown: string | null;
  needs_human_review: number | null;
  recommended_next_steps: string | null;
  policy_flags: string | null;
  analysis_outcome: string | null;
  quality_outcome: string | null;
  poc_outcome: string | null;
  recovery_trace: string | null;
  claim_diagnostics: string | null;
  evidence_diagnostics: string | null;
  sca_libraries: string | null;
  agent_audit: string | null;
  created_at: string;
}

function rowToResult(row: AnalysisResultRow): AnalysisResult {
  const warnings = safeJsonParse(row.warnings, []);
  const analyzedFileIds = safeJsonParse(row.analyzed_file_ids, []);
  const fileCoverage = safeJsonParse(row.file_coverage, []);
  const caveats = safeJsonParse(row.caveats, []);
  const confidenceBreakdown = safeJsonParse(row.confidence_breakdown, undefined);
  const recommendedNextSteps = safeJsonParse(row.recommended_next_steps, []);
  const policyFlags = safeJsonParse(row.policy_flags, []);
  const recoveryTrace = safeJsonParse(row.recovery_trace, []);
  const claimDiagnostics = safeJsonParse(row.claim_diagnostics, undefined);
  const evidenceDiagnostics = safeJsonParse(row.evidence_diagnostics, undefined);
  const scaLibraries = safeJsonParse(row.sca_libraries, []);
  const agentAudit = safeJsonParse(row.agent_audit, undefined);

  return {
    id: row.id,
    projectId: row.project_id,
    buildTargetId: row.build_target_id ?? undefined,
    analysisExecutionId: row.analysis_execution_id ?? undefined,
    module: row.module,
    status: row.status,
    vulnerabilities: safeJsonParse(row.vulnerabilities, []),
    summary: safeJsonParse(row.summary, { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }),
    ...(warnings.length > 0 ? { warnings } : {}),
    ...(analyzedFileIds.length > 0 ? { analyzedFileIds } : {}),
    ...(fileCoverage.length > 0 ? { fileCoverage } : {}),
    ...(caveats.length > 0 ? { caveats } : {}),
    ...(row.confidence_score != null ? { confidenceScore: row.confidence_score } : {}),
    ...(confidenceBreakdown ? { confidenceBreakdown } : {}),
    ...(row.needs_human_review != null ? { needsHumanReview: !!row.needs_human_review } : {}),
    ...(recommendedNextSteps.length > 0 ? { recommendedNextSteps } : {}),
    ...(policyFlags.length > 0 ? { policyFlags } : {}),
    ...(row.analysis_outcome ? { analysisOutcome: row.analysis_outcome as AnalysisResult["analysisOutcome"] } : {}),
    ...(row.quality_outcome ? { qualityOutcome: row.quality_outcome as AnalysisResult["qualityOutcome"] } : {}),
    ...(row.poc_outcome ? { pocOutcome: row.poc_outcome as AnalysisResult["pocOutcome"] } : {}),
    ...(recoveryTrace.length > 0 ? { recoveryTrace } : {}),
    ...(claimDiagnostics ? { claimDiagnostics } : {}),
    ...(evidenceDiagnostics ? { evidenceDiagnostics } : {}),
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
  private selectByExecutionStmt;
  private deleteByIdStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO analysis_results (id, project_id, build_target_id, analysis_execution_id, module, status, vulnerabilities, summary, warnings, analyzed_file_ids, file_coverage, caveats, confidence_score, confidence_breakdown, needs_human_review, recommended_next_steps, policy_flags, analysis_outcome, quality_outcome, poc_outcome, recovery_trace, claim_diagnostics, evidence_diagnostics, sca_libraries, agent_audit, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    this.selectByExecutionStmt = db.prepare(
      `SELECT * FROM analysis_results WHERE analysis_execution_id = ? ORDER BY created_at DESC`,
    );
    this.deleteByIdStmt = db.prepare(
      `DELETE FROM analysis_results WHERE id = ?`,
    );
  }

  save(result: AnalysisResult): void {
    this.insertStmt.run(
      result.id,
      result.projectId,
      result.buildTargetId ?? null,
      result.analysisExecutionId ?? null,
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
      result.analysisOutcome ?? null,
      result.qualityOutcome ?? null,
      result.pocOutcome ?? null,
      JSON.stringify(result.recoveryTrace ?? []),
      result.claimDiagnostics ? JSON.stringify(result.claimDiagnostics) : null,
      result.evidenceDiagnostics ? JSON.stringify(result.evidenceDiagnostics) : null,
      JSON.stringify(result.scaLibraries ?? []),
      result.agentAudit ? JSON.stringify(result.agentAudit) : null,
      result.createdAt,
    );
  }

  findById(id: string): AnalysisResult | undefined {
    const row = this.selectByIdStmt.get(id) as AnalysisResultRow | undefined;
    return row ? rowToResult(row) : undefined;
  }

  findAll(): AnalysisResult[] {
    return (this.selectAllStmt.all() as AnalysisResultRow[]).map(rowToResult);
  }

  findByModule(module: string): AnalysisResult[] {
    return (this.selectByModuleStmt.all(module) as AnalysisResultRow[]).map(rowToResult);
  }

  findByProjectId(projectId: string): AnalysisResult[] {
    return (this.selectByProjectStmt.all(projectId) as AnalysisResultRow[]).map(rowToResult);
  }

  findByExecutionId(analysisExecutionId: string, module?: AnalysisModule): AnalysisResult[] {
    const rows = (this.selectByExecutionStmt.all(analysisExecutionId) as AnalysisResultRow[]).map(rowToResult);
    return module ? rows.filter((row) => row.module === module) : rows;
  }

  deleteById(id: string): boolean {
    const result = this.deleteByIdStmt.run(id);
    return result.changes > 0;
  }
}
