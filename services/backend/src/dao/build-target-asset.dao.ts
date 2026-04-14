import type { DatabaseType } from "../db";
import { safeJsonParse } from "../lib/utils";
import type { BuildSelectionManifest, IBuildTargetAssetDAO, BuildTargetAssetRecord } from "./interfaces";

const EMPTY_SELECTION_MANIFEST: BuildSelectionManifest = { files: [], excluded: [] };

interface BuildTargetAssetRow {
  id: string;
  project_id: string;
  build_unit_id: string;
  build_unit_revision_id: string;
  source_asset_id: string;
  root_path: string;
  selection_manifest: string | null;
  created_at: string;
  updated_at: string;
}

function rowToBuildTargetAsset(row: BuildTargetAssetRow): BuildTargetAssetRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    buildUnitId: row.build_unit_id,
    buildUnitRevisionId: row.build_unit_revision_id,
    sourceAssetId: row.source_asset_id,
    rootPath: row.root_path,
    selectionManifest: safeJsonParse<BuildSelectionManifest>(row.selection_manifest, EMPTY_SELECTION_MANIFEST),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BuildTargetAssetDAO implements IBuildTargetAssetDAO {
  private readonly upsertStmt;
  private readonly selectByIdStmt;
  private readonly selectByBuildUnitRevisionStmt;
  private readonly selectByBuildUnitStmt;

  constructor(private readonly db: DatabaseType) {
    this.upsertStmt = db.prepare(
      `INSERT INTO build_target_assets (
         id,
         project_id,
         build_unit_id,
         build_unit_revision_id,
         source_asset_id,
         root_path,
         selection_manifest,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         build_unit_id = excluded.build_unit_id,
         build_unit_revision_id = excluded.build_unit_revision_id,
         source_asset_id = excluded.source_asset_id,
         root_path = excluded.root_path,
         selection_manifest = excluded.selection_manifest,
         updated_at = excluded.updated_at`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_target_assets WHERE id = ?`);
    this.selectByBuildUnitRevisionStmt = db.prepare(
      `SELECT * FROM build_target_assets WHERE build_unit_revision_id = ? LIMIT 1`,
    );
    this.selectByBuildUnitStmt = db.prepare(
      `SELECT * FROM build_target_assets WHERE build_unit_id = ? ORDER BY updated_at DESC`,
    );
  }

  save(asset: BuildTargetAssetRecord): void {
    this.upsertStmt.run(
      asset.id,
      asset.projectId,
      asset.buildUnitId,
      asset.buildUnitRevisionId,
      asset.sourceAssetId,
      asset.rootPath,
      JSON.stringify(asset.selectionManifest),
      asset.createdAt,
      asset.updatedAt,
    );
  }

  findById(id: string): BuildTargetAssetRecord | undefined {
    const row = this.selectByIdStmt.get(id) as BuildTargetAssetRow | undefined;
    return row ? rowToBuildTargetAsset(row) : undefined;
  }

  findByBuildUnitRevisionId(buildUnitRevisionId: string): BuildTargetAssetRecord | undefined {
    const row = this.selectByBuildUnitRevisionStmt.get(buildUnitRevisionId) as BuildTargetAssetRow | undefined;
    return row ? rowToBuildTargetAsset(row) : undefined;
  }

  findByBuildUnitId(buildUnitId: string): BuildTargetAssetRecord[] {
    return (this.selectByBuildUnitStmt.all(buildUnitId) as BuildTargetAssetRow[]).map(rowToBuildTargetAsset);
  }
}
