import type { AnalysisExecution, AnalysisExecutionStatus } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IAnalysisExecutionDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface AnalysisExecutionRow {
  id: string;
  project_id: string;
  build_target_id: string;
  build_target_name: string;
  build_target_relative_path: string;
  build_profile_snapshot: string | null;
  sdk_choice_state: AnalysisExecution["sdkChoiceState"];
  status: AnalysisExecutionStatus;
  quick_build_prep_status: AnalysisExecution["quickBuildPrepStatus"];
  quick_graphrag_status: AnalysisExecution["quickGraphRagStatus"];
  quick_sast_status: AnalysisExecution["quickSastStatus"];
  deep_status: AnalysisExecution["deepStatus"];
  superseded_by_execution_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToExecution(row: AnalysisExecutionRow): AnalysisExecution {
  return {
    id: row.id,
    projectId: row.project_id,
    buildTargetId: row.build_target_id,
    buildTargetName: row.build_target_name,
    buildTargetRelativePath: row.build_target_relative_path,
    buildProfileSnapshot: safeJsonParse(row.build_profile_snapshot, {} as AnalysisExecution["buildProfileSnapshot"]),
    sdkChoiceState: row.sdk_choice_state,
    status: row.status,
    quickBuildPrepStatus: row.quick_build_prep_status,
    quickGraphRagStatus: row.quick_graphrag_status,
    quickSastStatus: row.quick_sast_status,
    deepStatus: row.deep_status,
    supersededByExecutionId: row.superseded_by_execution_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AnalysisExecutionDAO implements IAnalysisExecutionDAO {
  private readonly insertStmt;
  private readonly selectByIdStmt;
  private readonly selectByProjectStmt;
  private readonly selectByTargetStmt;
  private readonly selectActiveByTargetStmt;
  private readonly updateStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO analysis_executions (
        id, project_id, build_target_id, build_target_name, build_target_relative_path,
        build_profile_snapshot, sdk_choice_state, status,
        quick_build_prep_status, quick_graphrag_status, quick_sast_status, deep_status,
        superseded_by_execution_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM analysis_executions WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(`SELECT * FROM analysis_executions WHERE project_id = ? ORDER BY created_at DESC`);
    this.selectByTargetStmt = db.prepare(`SELECT * FROM analysis_executions WHERE build_target_id = ? ORDER BY created_at DESC`);
    this.selectActiveByTargetStmt = db.prepare(
      `SELECT * FROM analysis_executions WHERE build_target_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    );
    this.updateStmt = db.prepare(
      `UPDATE analysis_executions
       SET sdk_choice_state = ?, status = ?, quick_build_prep_status = ?, quick_graphrag_status = ?, quick_sast_status = ?, deep_status = ?, superseded_by_execution_id = ?, updated_at = ?
       WHERE id = ?`,
    );
  }

  save(execution: AnalysisExecution): void {
    this.insertStmt.run(
      execution.id,
      execution.projectId,
      execution.buildTargetId,
      execution.buildTargetName,
      execution.buildTargetRelativePath,
      JSON.stringify(execution.buildProfileSnapshot),
      execution.sdkChoiceState,
      execution.status,
      execution.quickBuildPrepStatus,
      execution.quickGraphRagStatus,
      execution.quickSastStatus,
      execution.deepStatus,
      execution.supersededByExecutionId ?? null,
      execution.createdAt,
      execution.updatedAt,
    );
  }

  findById(id: string): AnalysisExecution | undefined {
    const row = this.selectByIdStmt.get(id) as AnalysisExecutionRow | undefined;
    return row ? rowToExecution(row) : undefined;
  }

  findByProjectId(projectId: string): AnalysisExecution[] {
    return (this.selectByProjectStmt.all(projectId) as AnalysisExecutionRow[]).map(rowToExecution);
  }

  findByBuildTargetId(buildTargetId: string): AnalysisExecution[] {
    return (this.selectByTargetStmt.all(buildTargetId) as AnalysisExecutionRow[]).map(rowToExecution);
  }

  findActiveByBuildTargetId(buildTargetId: string): AnalysisExecution | undefined {
    const row = this.selectActiveByTargetStmt.get(buildTargetId) as AnalysisExecutionRow | undefined;
    return row ? rowToExecution(row) : undefined;
  }

  update(
    id: string,
    fields: Partial<Omit<AnalysisExecution, "id" | "projectId" | "buildTargetId" | "buildTargetName" | "buildTargetRelativePath" | "buildProfileSnapshot" | "createdAt">>,
  ): AnalysisExecution | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const next: AnalysisExecution = {
      ...existing,
      ...fields,
      updatedAt: new Date().toISOString(),
    };

    this.updateStmt.run(
      next.sdkChoiceState,
      next.status,
      next.quickBuildPrepStatus,
      next.quickGraphRagStatus,
      next.quickSastStatus,
      next.deepStatus,
      next.supersededByExecutionId ?? null,
      next.updatedAt,
      id,
    );

    return this.findById(id);
  }
}
