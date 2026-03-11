import type { Project } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO projects (id, name, description, created_at, updated_at)
   VALUES (?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(`SELECT * FROM projects WHERE id = ?`);
const selectAllStmt = db.prepare(
  `SELECT * FROM projects ORDER BY updated_at DESC`
);
const updateStmt = db.prepare(
  `UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`
);
const deleteStmt = db.prepare(`DELETE FROM projects WHERE id = ?`);

function rowToProject(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class ProjectDAO {
  save(project: Project): void {
    insertStmt.run(
      project.id,
      project.name,
      project.description,
      project.createdAt,
      project.updatedAt
    );
  }

  findById(id: string): Project | undefined {
    const row = selectByIdStmt.get(id);
    return row ? rowToProject(row) : undefined;
  }

  findAll(): Project[] {
    return selectAllStmt.all().map(rowToProject);
  }

  update(id: string, fields: { name?: string; description?: string }): Project | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const name = fields.name ?? existing.name;
    const description = fields.description ?? existing.description;
    const updatedAt = new Date().toISOString();

    updateStmt.run(name, description, updatedAt, id);
    return { ...existing, name, description, updatedAt };
  }

  delete(id: string): boolean {
    const result = deleteStmt.run(id);
    return result.changes > 0;
  }
}

export const projectDAO = new ProjectDAO();
