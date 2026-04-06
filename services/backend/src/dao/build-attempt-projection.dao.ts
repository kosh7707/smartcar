import type { DatabaseType } from "../db";
import { safeJsonParse } from "../lib/utils";
import type {
  BuildArtifactRecord,
  BuildAttemptProjectionRecord,
  BuildAttemptProjectionStatus,
  BuildExecutionMaterialRecord,
  IBuildAttemptProjectionDAO,
} from "./interfaces";

const EMPTY_EXECUTION_MATERIAL: BuildExecutionMaterialRecord = {};
const EMPTY_PRODUCED_ARTIFACTS: BuildArtifactRecord[] = [];

interface BuildAttemptProjectionRow {
  id: string;
  build_request_id: string;
  build_unit_id: string;
  build_unit_revision_id: string;
  attempt_number: number;
  status: BuildAttemptProjectionStatus;
  failure_category: string | null;
  failure_detail: string | null;
  execution_material: string | null;
  produced_artifacts: string | null;
  started_at: string | null;
  completed_at: string | null;
  retry_of_attempt_id: string | null;
}

function rowToBuildAttemptProjection(row: BuildAttemptProjectionRow): BuildAttemptProjectionRecord {
  return {
    id: row.id,
    buildRequestId: row.build_request_id,
    buildUnitId: row.build_unit_id,
    buildUnitRevisionId: row.build_unit_revision_id,
    attemptNumber: row.attempt_number,
    status: row.status,
    failureCategory: row.failure_category ?? undefined,
    failureDetail: row.failure_detail ?? undefined,
    executionMaterial: safeJsonParse<BuildExecutionMaterialRecord>(row.execution_material, EMPTY_EXECUTION_MATERIAL),
    producedArtifacts: safeJsonParse<BuildArtifactRecord[]>(row.produced_artifacts, EMPTY_PRODUCED_ARTIFACTS),
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at ?? undefined,
    retryOfAttemptId: row.retry_of_attempt_id ?? undefined,
  };
}

export class BuildAttemptProjectionDAO implements IBuildAttemptProjectionDAO {
  private readonly upsertStmt;
  private readonly selectByIdStmt;
  private readonly selectByBuildRequestStmt;
  private readonly selectLatestByBuildRequestStmt;

  constructor(private readonly db: DatabaseType) {
    this.upsertStmt = db.prepare(
      `INSERT INTO build_attempt_projections (
         id,
         project_id,
         build_request_id,
         build_unit_id,
         build_unit_revision_id,
         attempt_number,
         status,
         failure_category,
         failure_detail,
         execution_material,
         produced_artifacts,
         started_at,
         completed_at,
         retry_of_attempt_id,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         build_request_id = excluded.build_request_id,
         build_unit_id = excluded.build_unit_id,
         build_unit_revision_id = excluded.build_unit_revision_id,
         attempt_number = excluded.attempt_number,
         status = excluded.status,
         failure_category = excluded.failure_category,
         failure_detail = excluded.failure_detail,
         execution_material = excluded.execution_material,
         produced_artifacts = excluded.produced_artifacts,
         started_at = excluded.started_at,
         completed_at = excluded.completed_at,
         retry_of_attempt_id = excluded.retry_of_attempt_id,
         updated_at = excluded.updated_at`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_attempt_projections WHERE id = ?`);
    this.selectByBuildRequestStmt = db.prepare(
      `SELECT * FROM build_attempt_projections WHERE build_request_id = ? ORDER BY attempt_number DESC, updated_at DESC`,
    );
    this.selectLatestByBuildRequestStmt = db.prepare(
      `SELECT * FROM build_attempt_projections WHERE build_request_id = ? ORDER BY attempt_number DESC, updated_at DESC LIMIT 1`,
    );
  }

  save(attempt: BuildAttemptProjectionRecord): void {
    const observedAt = new Date().toISOString();
    this.upsertStmt.run(
      attempt.id,
      attempt.projectId ?? "",
      attempt.buildRequestId,
      attempt.buildUnitId,
      attempt.buildUnitRevisionId,
      attempt.attemptNumber,
      attempt.status,
      attempt.failureCategory ?? null,
      attempt.failureDetail ?? null,
      JSON.stringify(attempt.executionMaterial),
      JSON.stringify(attempt.producedArtifacts),
      attempt.startedAt ?? null,
      attempt.completedAt ?? null,
      attempt.retryOfAttemptId ?? null,
      attempt.createdAt ?? observedAt,
      attempt.updatedAt ?? observedAt,
    );
  }

  findById(id: string): BuildAttemptProjectionRecord | undefined {
    const row = this.selectByIdStmt.get(id) as BuildAttemptProjectionRow | undefined;
    return row ? rowToBuildAttemptProjection(row) : undefined;
  }

  findByBuildRequestId(buildRequestId: string): BuildAttemptProjectionRecord[] {
    return (this.selectByBuildRequestStmt.all(buildRequestId) as BuildAttemptProjectionRow[]).map(rowToBuildAttemptProjection);
  }

  findLatestByBuildRequestId(buildRequestId: string): BuildAttemptProjectionRecord | undefined {
    const row = this.selectLatestByBuildRequestStmt.get(buildRequestId) as BuildAttemptProjectionRow | undefined;
    return row ? rowToBuildAttemptProjection(row) : undefined;
  }
}
