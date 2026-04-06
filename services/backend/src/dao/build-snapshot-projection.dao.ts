import type { DatabaseType } from "../db";
import { safeJsonParse } from "../lib/utils";
import type {
  BuildArtifactRecord,
  BuildExecutionMaterialRecord,
  BuildSnapshotProjectionRecord,
  DeclaredBuildSpec,
  IBuildSnapshotProjectionDAO,
} from "./interfaces";

const DEFAULT_DECLARED_BUILD: DeclaredBuildSpec = { mode: "unspecified" };
const EMPTY_EXECUTION_MATERIAL: BuildExecutionMaterialRecord = {};
const EMPTY_PRODUCED_ARTIFACTS: BuildArtifactRecord[] = [];

interface BuildSnapshotProjectionRow {
  id: string;
  snapshot_schema_version: string;
  build_unit_id: string;
  build_unit_revision_id: string;
  source_build_attempt_id: string;
  declared_build: string | null;
  execution_material: string | null;
  produced_artifacts: string | null;
  third_party_inventory_ref: string | null;
  success_metadata: string | null;
  parent_snapshot_id: string | null;
  created_at: string;
}

function rowToBuildSnapshotProjection(row: BuildSnapshotProjectionRow): BuildSnapshotProjectionRecord {
  return {
    id: row.id,
    snapshotSchemaVersion: row.snapshot_schema_version,
    buildUnitId: row.build_unit_id,
    buildUnitRevisionId: row.build_unit_revision_id,
    sourceBuildAttemptId: row.source_build_attempt_id,
    declaredBuild: safeJsonParse<DeclaredBuildSpec>(row.declared_build, DEFAULT_DECLARED_BUILD),
    executionMaterial: safeJsonParse<BuildExecutionMaterialRecord>(row.execution_material, EMPTY_EXECUTION_MATERIAL),
    producedArtifacts: safeJsonParse<BuildArtifactRecord[]>(row.produced_artifacts, EMPTY_PRODUCED_ARTIFACTS),
    thirdPartyInventoryRef: row.third_party_inventory_ref ?? undefined,
    successMetadata: safeJsonParse<Record<string, unknown> | undefined>(row.success_metadata, undefined),
    parentSnapshotId: row.parent_snapshot_id ?? undefined,
    createdAt: row.created_at,
  };
}

export class BuildSnapshotProjectionDAO implements IBuildSnapshotProjectionDAO {
  private readonly upsertStmt;
  private readonly selectByIdStmt;
  private readonly selectByBuildUnitStmt;
  private readonly selectLatestByBuildUnitStmt;
  private readonly selectBySourceAttemptStmt;

  constructor(private readonly db: DatabaseType) {
    this.upsertStmt = db.prepare(
      `INSERT INTO build_snapshot_projections (
         id,
         project_id,
         snapshot_schema_version,
         build_unit_id,
         build_unit_revision_id,
         source_build_attempt_id,
         declared_build,
         execution_material,
         produced_artifacts,
         third_party_inventory_ref,
         success_metadata,
         parent_snapshot_id,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         snapshot_schema_version = excluded.snapshot_schema_version,
         build_unit_id = excluded.build_unit_id,
         build_unit_revision_id = excluded.build_unit_revision_id,
         source_build_attempt_id = excluded.source_build_attempt_id,
         declared_build = excluded.declared_build,
         execution_material = excluded.execution_material,
         produced_artifacts = excluded.produced_artifacts,
         third_party_inventory_ref = excluded.third_party_inventory_ref,
         success_metadata = excluded.success_metadata,
         parent_snapshot_id = excluded.parent_snapshot_id,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_snapshot_projections WHERE id = ?`);
    this.selectByBuildUnitStmt = db.prepare(
      `SELECT * FROM build_snapshot_projections WHERE build_unit_id = ? ORDER BY created_at DESC, updated_at DESC`,
    );
    this.selectLatestByBuildUnitStmt = db.prepare(
      `SELECT * FROM build_snapshot_projections WHERE build_unit_id = ? ORDER BY created_at DESC, updated_at DESC LIMIT 1`,
    );
    this.selectBySourceAttemptStmt = db.prepare(
      `SELECT * FROM build_snapshot_projections WHERE source_build_attempt_id = ? ORDER BY created_at DESC, updated_at DESC`,
    );
  }

  save(snapshot: BuildSnapshotProjectionRecord): void {
    this.upsertStmt.run(
      snapshot.id,
      snapshot.projectId ?? "",
      snapshot.snapshotSchemaVersion,
      snapshot.buildUnitId,
      snapshot.buildUnitRevisionId,
      snapshot.sourceBuildAttemptId,
      JSON.stringify(snapshot.declaredBuild),
      JSON.stringify(snapshot.executionMaterial),
      JSON.stringify(snapshot.producedArtifacts),
      snapshot.thirdPartyInventoryRef ?? null,
      snapshot.successMetadata ? JSON.stringify(snapshot.successMetadata) : null,
      snapshot.parentSnapshotId ?? null,
      snapshot.createdAt,
      new Date().toISOString(),
    );
  }

  findById(id: string): BuildSnapshotProjectionRecord | undefined {
    const row = this.selectByIdStmt.get(id) as BuildSnapshotProjectionRow | undefined;
    return row ? rowToBuildSnapshotProjection(row) : undefined;
  }

  findByBuildUnitId(buildUnitId: string): BuildSnapshotProjectionRecord[] {
    return (this.selectByBuildUnitStmt.all(buildUnitId) as BuildSnapshotProjectionRow[]).map(rowToBuildSnapshotProjection);
  }

  findLatestByBuildUnitId(buildUnitId: string): BuildSnapshotProjectionRecord | undefined {
    const row = this.selectLatestByBuildUnitStmt.get(buildUnitId) as BuildSnapshotProjectionRow | undefined;
    return row ? rowToBuildSnapshotProjection(row) : undefined;
  }

  findBySourceBuildAttemptId(buildAttemptId: string): BuildSnapshotProjectionRecord[] {
    return (this.selectBySourceAttemptStmt.all(buildAttemptId) as BuildSnapshotProjectionRow[]).map(rowToBuildSnapshotProjection);
  }
}
