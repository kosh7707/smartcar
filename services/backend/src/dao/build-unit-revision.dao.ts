import type { DatabaseType } from "../db";
import { safeJsonParse } from "../lib/utils";
import type {
  BuildArtifactRecord,
  BuildSelectionManifest,
  BuildUnitRevisionRecord,
  DeclaredBuildSpec,
  IBuildUnitRevisionDAO,
} from "./interfaces";

const EMPTY_SELECTION_MANIFEST: BuildSelectionManifest = { files: [], excluded: [] };
const EMPTY_EXPECTED_ARTIFACTS: BuildArtifactRecord[] = [];
const DEFAULT_DECLARED_BUILD: DeclaredBuildSpec = { mode: "unspecified" };

interface BuildUnitRevisionRow {
  id: string;
  build_unit_id: string;
  project_id: string;
  source_asset_id: string;
  build_target_asset_id: string;
  sdk_asset_id: string | null;
  revision_number: number;
  included_paths: string | null;
  selection_manifest: string | null;
  declared_build: string | null;
  expected_artifacts: string | null;
  frozen_at: string;
  supersedes_revision_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToBuildUnitRevision(row: BuildUnitRevisionRow): BuildUnitRevisionRecord {
  return {
    id: row.id,
    buildUnitId: row.build_unit_id,
    projectId: row.project_id,
    sourceAssetId: row.source_asset_id,
    buildTargetAssetId: row.build_target_asset_id,
    sdkAssetId: row.sdk_asset_id ?? undefined,
    revisionNumber: row.revision_number,
    includedPaths: safeJsonParse<string[]>(row.included_paths, []),
    selectionManifest: safeJsonParse<BuildSelectionManifest>(row.selection_manifest, EMPTY_SELECTION_MANIFEST),
    declaredBuild: safeJsonParse<DeclaredBuildSpec>(row.declared_build, DEFAULT_DECLARED_BUILD),
    expectedArtifacts: safeJsonParse<BuildArtifactRecord[]>(row.expected_artifacts, EMPTY_EXPECTED_ARTIFACTS),
    frozenAt: row.frozen_at,
    supersedesRevisionId: row.supersedes_revision_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BuildUnitRevisionDAO implements IBuildUnitRevisionDAO {
  private readonly upsertStmt;
  private readonly selectByIdStmt;
  private readonly selectByBuildUnitStmt;
  private readonly selectLatestByBuildUnitStmt;

  constructor(private readonly db: DatabaseType) {
    this.upsertStmt = db.prepare(
      `INSERT INTO build_unit_revisions (
         id,
         build_unit_id,
         project_id,
         source_asset_id,
         build_target_asset_id,
         sdk_asset_id,
         revision_number,
         included_paths,
         selection_manifest,
         declared_build,
         expected_artifacts,
         frozen_at,
         supersedes_revision_id,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         build_unit_id = excluded.build_unit_id,
         project_id = excluded.project_id,
         source_asset_id = excluded.source_asset_id,
         build_target_asset_id = excluded.build_target_asset_id,
         sdk_asset_id = excluded.sdk_asset_id,
         revision_number = excluded.revision_number,
         included_paths = excluded.included_paths,
         selection_manifest = excluded.selection_manifest,
         declared_build = excluded.declared_build,
         expected_artifacts = excluded.expected_artifacts,
         frozen_at = excluded.frozen_at,
         supersedes_revision_id = excluded.supersedes_revision_id,
         updated_at = excluded.updated_at`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_unit_revisions WHERE id = ?`);
    this.selectByBuildUnitStmt = db.prepare(
      `SELECT * FROM build_unit_revisions WHERE build_unit_id = ? ORDER BY revision_number DESC, frozen_at DESC`,
    );
    this.selectLatestByBuildUnitStmt = db.prepare(
      `SELECT * FROM build_unit_revisions WHERE build_unit_id = ? ORDER BY revision_number DESC, frozen_at DESC LIMIT 1`,
    );
  }

  save(revision: BuildUnitRevisionRecord): void {
    this.upsertStmt.run(
      revision.id,
      revision.buildUnitId,
      revision.projectId,
      revision.sourceAssetId,
      revision.buildTargetAssetId,
      revision.sdkAssetId ?? null,
      revision.revisionNumber,
      JSON.stringify(revision.includedPaths),
      JSON.stringify(revision.selectionManifest),
      JSON.stringify(revision.declaredBuild),
      JSON.stringify(revision.expectedArtifacts),
      revision.frozenAt,
      revision.supersedesRevisionId ?? null,
      revision.createdAt,
      revision.updatedAt,
    );
  }

  findById(id: string): BuildUnitRevisionRecord | undefined {
    const row = this.selectByIdStmt.get(id) as BuildUnitRevisionRow | undefined;
    return row ? rowToBuildUnitRevision(row) : undefined;
  }

  findByBuildUnitId(buildUnitId: string): BuildUnitRevisionRecord[] {
    return (this.selectByBuildUnitStmt.all(buildUnitId) as BuildUnitRevisionRow[]).map(rowToBuildUnitRevision);
  }

  findLatestByBuildUnitId(buildUnitId: string): BuildUnitRevisionRecord | undefined {
    const row = this.selectLatestByBuildUnitStmt.get(buildUnitId) as BuildUnitRevisionRow | undefined;
    return row ? rowToBuildUnitRevision(row) : undefined;
  }
}
