import type { Adapter } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO adapters (id, name, url, project_id, created_at) VALUES (?, ?, ?, ?, ?)`
);
const selectAllStmt = db.prepare(`SELECT * FROM adapters ORDER BY created_at DESC`);
const selectByIdStmt = db.prepare(`SELECT * FROM adapters WHERE id = ?`);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM adapters WHERE project_id = ? ORDER BY created_at DESC`
);
const updateStmt = db.prepare(
  `UPDATE adapters SET name = ?, url = ? WHERE id = ?`
);
const deleteStmt = db.prepare(`DELETE FROM adapters WHERE id = ?`);
const deleteByProjectStmt = db.prepare(`DELETE FROM adapters WHERE project_id = ?`);

interface AdapterRow {
  id: string;
  name: string;
  url: string;
  project_id: string;
  created_at: string;
}

function rowToAdapter(row: AdapterRow): Omit<Adapter, "connected" | "ecuConnected"> {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

class AdapterDAO {
  save(adapter: { id: string; name: string; url: string; projectId: string; createdAt: string }): void {
    insertStmt.run(adapter.id, adapter.name, adapter.url, adapter.projectId, adapter.createdAt);
  }

  findAll(): Omit<Adapter, "connected" | "ecuConnected">[] {
    return (selectAllStmt.all() as AdapterRow[]).map(rowToAdapter);
  }

  findByProjectId(projectId: string): Omit<Adapter, "connected" | "ecuConnected">[] {
    return (selectByProjectStmt.all(projectId) as AdapterRow[]).map(rowToAdapter);
  }

  findById(id: string): Omit<Adapter, "connected" | "ecuConnected"> | undefined {
    const row = selectByIdStmt.get(id) as AdapterRow | undefined;
    return row ? rowToAdapter(row) : undefined;
  }

  update(id: string, fields: { name?: string; url?: string }): boolean {
    const existing = this.findById(id);
    if (!existing) return false;
    updateStmt.run(
      fields.name ?? existing.name,
      fields.url ?? existing.url,
      id
    );
    return true;
  }

  delete(id: string): boolean {
    const result = deleteStmt.run(id);
    return result.changes > 0;
  }

  deleteByProjectId(projectId: string): number {
    const result = deleteByProjectStmt.run(projectId);
    return result.changes;
  }
}

export const adapterDAO = new AdapterDAO();
