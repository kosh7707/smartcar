import type { DatabaseType } from "../db";
import { safeJsonParse } from "../lib/utils";
import type { BuildMaterialRef, BuildRequestRecord, BuildRequestStatus, BuildRequestType, IBuildRequestDAO } from "./interfaces";

interface BuildRequestRow {
  id: string;
  project_id: string;
  build_unit_id: string;
  build_unit_revision_id: string;
  request_type: BuildRequestType;
  requested_by: string;
  requested_snapshot_id: string | null;
  requested_attempt_id: string | null;
  build_script_ref: string | null;
  status: BuildRequestStatus | null;
  created_at: string;
  updated_at: string;
}

function rowToBuildRequest(row: BuildRequestRow): BuildRequestRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    buildUnitId: row.build_unit_id,
    buildUnitRevisionId: row.build_unit_revision_id,
    requestType: row.request_type,
    requestedBy: row.requested_by,
    requestedSnapshotId: row.requested_snapshot_id ?? undefined,
    requestedAttemptId: row.requested_attempt_id ?? undefined,
    buildScriptRef: safeJsonParse<BuildMaterialRef | undefined>(row.build_script_ref, undefined),
    status: row.status ?? "submitted",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BuildRequestDAO implements IBuildRequestDAO {
  private readonly upsertStmt;
  private readonly selectByIdStmt;
  private readonly selectByProjectStmt;
  private readonly selectByBuildUnitStmt;

  constructor(private readonly db: DatabaseType) {
    this.upsertStmt = db.prepare(
      `INSERT INTO build_requests (
         id,
         project_id,
         build_unit_id,
         build_unit_revision_id,
         request_type,
         requested_by,
         requested_snapshot_id,
         requested_attempt_id,
         build_script_ref,
         status,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         build_unit_id = excluded.build_unit_id,
         build_unit_revision_id = excluded.build_unit_revision_id,
         request_type = excluded.request_type,
         requested_by = excluded.requested_by,
         requested_snapshot_id = excluded.requested_snapshot_id,
         requested_attempt_id = excluded.requested_attempt_id,
         build_script_ref = excluded.build_script_ref,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_requests WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM build_requests WHERE project_id = ? ORDER BY created_at DESC`,
    );
    this.selectByBuildUnitStmt = db.prepare(
      `SELECT * FROM build_requests WHERE build_unit_id = ? ORDER BY created_at DESC`,
    );
  }

  save(request: BuildRequestRecord): void {
    this.upsertStmt.run(
      request.id,
      request.projectId,
      request.buildUnitId,
      request.buildUnitRevisionId,
      request.requestType,
      request.requestedBy,
      request.requestedSnapshotId ?? null,
      request.requestedAttemptId ?? null,
      request.buildScriptRef ? JSON.stringify(request.buildScriptRef) : null,
      request.status,
      request.createdAt,
      request.updatedAt ?? request.createdAt,
    );
  }

  findById(id: string): BuildRequestRecord | undefined {
    const row = this.selectByIdStmt.get(id) as BuildRequestRow | undefined;
    return row ? rowToBuildRequest(row) : undefined;
  }

  findByProjectId(projectId: string): BuildRequestRecord[] {
    return (this.selectByProjectStmt.all(projectId) as BuildRequestRow[]).map(rowToBuildRequest);
  }

  findByBuildUnitId(buildUnitId: string): BuildRequestRecord[] {
    return (this.selectByBuildUnitStmt.all(buildUnitId) as BuildRequestRow[]).map(rowToBuildRequest);
  }
}
