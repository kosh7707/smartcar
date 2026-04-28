import type { Project } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IProjectDAO } from "./interfaces";

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  owner_id: string | null;
  owner_name: string | null;
  owner_avatar: string | null;
  owner_kind: "user" | "system" | null;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  const owner = row.owner_id && row.owner_name
    ? {
        id: row.owner_id,
        name: row.owner_name,
        ...(row.owner_avatar != null ? { avatar: row.owner_avatar } : {}),
        ...(row.owner_kind ? { kind: row.owner_kind } : {}),
      }
    : undefined;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ...(owner ? { owner } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectDAO implements IProjectDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectAllStmt;
  private updateStmt;
  private deleteStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO projects (id, name, description, owner_id, owner_name, owner_avatar, owner_kind, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
    this.selectAllStmt = db.prepare(
      `SELECT * FROM projects ORDER BY updated_at DESC`
    );
    this.updateStmt = db.prepare(
      `UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`
    );
    this.deleteStmt = db.prepare(`DELETE FROM projects WHERE id = ?`);
  }

  save(project: Project): void {
    this.insertStmt.run(
      project.id,
      project.name,
      project.description,
      project.owner?.id ?? null,
      project.owner?.name ?? null,
      project.owner?.avatar ?? null,
      project.owner?.kind ?? null,
      project.createdAt,
      project.updatedAt
    );
  }

  findById(id: string): Project | undefined {
    const row = this.selectByIdStmt.get(id) as ProjectRow | undefined;
    return row ? rowToProject(row) : undefined;
  }

  findAll(): Project[] {
    return (this.selectAllStmt.all() as ProjectRow[]).map(rowToProject);
  }

  update(id: string, fields: { name?: string; description?: string }): Project | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const name = fields.name ?? existing.name;
    const description = fields.description ?? existing.description;
    const updatedAt = new Date().toISOString();

    this.updateStmt.run(name, description, updatedAt, id);
    return { ...existing, name, description, updatedAt };
  }

  delete(id: string): boolean {
    const result = this.deleteStmt.run(id);
    return result.changes > 0;
  }
}
