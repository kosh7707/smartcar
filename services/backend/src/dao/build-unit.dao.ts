import type { DatabaseType } from "../db";
import type { BuildUnitRecord, BuildUnitStatus, IBuildUnitDAO } from "./interfaces";

interface BuildUnitRow {
  id: string;
  project_id: string;
  name: string;
  relative_path: string;
  status: BuildUnitStatus | null;
  latest_revision_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToBuildUnit(row: BuildUnitRow): BuildUnitRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    relativePath: row.relative_path,
    status: row.status ?? "active",
    latestRevisionId: row.latest_revision_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BuildUnitDAO implements IBuildUnitDAO {
  private readonly upsertStmt;
  private readonly selectByIdStmt;
  private readonly selectByProjectStmt;
  private readonly selectByRelativePathStmt;

  constructor(private readonly db: DatabaseType) {
    this.upsertStmt = db.prepare(
      `INSERT INTO build_units (id, project_id, name, relative_path, status, latest_revision_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         project_id = excluded.project_id,
         name = excluded.name,
         relative_path = excluded.relative_path,
         status = excluded.status,
         latest_revision_id = excluded.latest_revision_id,
         updated_at = excluded.updated_at`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_units WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM build_units WHERE project_id = ? ORDER BY name ASC, created_at ASC`,
    );
    this.selectByRelativePathStmt = db.prepare(
      `SELECT * FROM build_units WHERE project_id = ? AND relative_path = ?`,
    );
  }

  save(unit: BuildUnitRecord): void {
    this.upsertStmt.run(
      unit.id,
      unit.projectId,
      unit.name,
      unit.relativePath,
      unit.status,
      unit.latestRevisionId ?? null,
      unit.createdAt,
      unit.updatedAt,
    );
  }

  findById(id: string): BuildUnitRecord | undefined {
    const row = this.selectByIdStmt.get(id) as BuildUnitRow | undefined;
    return row ? rowToBuildUnit(row) : undefined;
  }

  findByProjectId(projectId: string): BuildUnitRecord[] {
    return (this.selectByProjectStmt.all(projectId) as BuildUnitRow[]).map(rowToBuildUnit);
  }

  findByRelativePath(projectId: string, relativePath: string): BuildUnitRecord | undefined {
    const row = this.selectByRelativePathStmt.get(projectId, relativePath) as BuildUnitRow | undefined;
    return row ? rowToBuildUnit(row) : undefined;
  }
}
