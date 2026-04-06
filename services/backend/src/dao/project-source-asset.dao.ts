import type { ProjectSourceAsset } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IProjectSourceAssetDAO } from "./interfaces";

interface ProjectSourceAssetRow {
  id: string;
  project_id: string;
  root_path: string;
  source_type: "upload" | "clone";
  created_at: string;
  updated_at: string;
}

function rowToProjectSourceAsset(row: ProjectSourceAssetRow): ProjectSourceAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    rootPath: row.root_path,
    sourceType: row.source_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectSourceAssetDAO implements IProjectSourceAssetDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectLatestByProjectStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO project_source_assets (id, project_id, root_path, source_type, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM project_source_assets WHERE id = ?`);
    this.selectLatestByProjectStmt = db.prepare(
      `SELECT * FROM project_source_assets WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
    );
  }

  save(asset: ProjectSourceAsset): void {
    this.insertStmt.run(asset.id, asset.projectId, asset.rootPath, asset.sourceType, asset.createdAt, asset.updatedAt);
  }

  findById(id: string): ProjectSourceAsset | undefined {
    const row = this.selectByIdStmt.get(id) as ProjectSourceAssetRow | undefined;
    return row ? rowToProjectSourceAsset(row) : undefined;
  }

  findLatestByProjectId(projectId: string): ProjectSourceAsset | undefined {
    const row = this.selectLatestByProjectStmt.get(projectId) as ProjectSourceAssetRow | undefined;
    return row ? rowToProjectSourceAsset(row) : undefined;
  }
}
