import type { BuildTarget, BuildProfile } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IBuildTargetDAO } from "./interfaces";

function rowToBuildTarget(row: any): BuildTarget {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    relativePath: row.relative_path,
    buildProfile: JSON.parse(row.build_profile ?? "{}"),
    buildSystem: row.build_system ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BuildTargetDAO implements IBuildTargetDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private updateStmt;
  private deleteStmt;
  private deleteByProjectStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO build_targets (id, project_id, name, relative_path, build_profile, build_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_targets WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM build_targets WHERE project_id = ? ORDER BY name ASC`,
    );
    this.updateStmt = db.prepare(
      `UPDATE build_targets SET name = ?, relative_path = ?, build_profile = ?, build_system = ?, updated_at = ? WHERE id = ?`,
    );
    this.deleteStmt = db.prepare(`DELETE FROM build_targets WHERE id = ?`);
    this.deleteByProjectStmt = db.prepare(`DELETE FROM build_targets WHERE project_id = ?`);
  }

  save(target: BuildTarget): void {
    this.insertStmt.run(
      target.id,
      target.projectId,
      target.name,
      target.relativePath,
      JSON.stringify(target.buildProfile),
      target.buildSystem ?? null,
      target.createdAt,
      target.updatedAt,
    );
  }

  findById(id: string): BuildTarget | undefined {
    const row = this.selectByIdStmt.get(id);
    return row ? rowToBuildTarget(row) : undefined;
  }

  findByProjectId(projectId: string): BuildTarget[] {
    return this.selectByProjectStmt.all(projectId).map(rowToBuildTarget);
  }

  update(
    id: string,
    fields: { name?: string; relativePath?: string; buildProfile?: BuildProfile; buildSystem?: string },
  ): BuildTarget | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const name = fields.name ?? existing.name;
    const relativePath = fields.relativePath ?? existing.relativePath;
    const buildProfile = fields.buildProfile ?? existing.buildProfile;
    const buildSystem = fields.buildSystem ?? existing.buildSystem;
    const updatedAt = new Date().toISOString();

    this.updateStmt.run(name, relativePath, JSON.stringify(buildProfile), buildSystem ?? null, updatedAt, id);
    return { ...existing, name, relativePath, buildProfile, buildSystem: buildSystem as BuildTarget["buildSystem"], updatedAt };
  }

  delete(id: string): boolean {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }

  deleteByProjectId(projectId: string): number {
    const result = this.deleteByProjectStmt.run(projectId);
    return result.changes;
  }
}
