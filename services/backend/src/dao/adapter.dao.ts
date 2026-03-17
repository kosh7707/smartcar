import type { Adapter } from "@smartcar/shared";
import type { DatabaseType } from "../db";
import type { IAdapterDAO } from "./interfaces";

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

export class AdapterDAO implements IAdapterDAO {
  private insertStmt;
  private selectAllStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private updateStmt;
  private deleteStmt;
  private deleteByProjectStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO adapters (id, name, url, project_id, created_at) VALUES (?, ?, ?, ?, ?)`
    );
    this.selectAllStmt = db.prepare(`SELECT * FROM adapters ORDER BY created_at DESC`);
    this.selectByIdStmt = db.prepare(`SELECT * FROM adapters WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM adapters WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.updateStmt = db.prepare(
      `UPDATE adapters SET name = ?, url = ? WHERE id = ?`
    );
    this.deleteStmt = db.prepare(`DELETE FROM adapters WHERE id = ?`);
    this.deleteByProjectStmt = db.prepare(`DELETE FROM adapters WHERE project_id = ?`);
  }

  save(adapter: { id: string; name: string; url: string; projectId: string; createdAt: string }): void {
    this.insertStmt.run(adapter.id, adapter.name, adapter.url, adapter.projectId, adapter.createdAt);
  }

  findAll(): Omit<Adapter, "connected" | "ecuConnected">[] {
    return (this.selectAllStmt.all() as AdapterRow[]).map(rowToAdapter);
  }

  findByProjectId(projectId: string): Omit<Adapter, "connected" | "ecuConnected">[] {
    return (this.selectByProjectStmt.all(projectId) as AdapterRow[]).map(rowToAdapter);
  }

  findById(id: string): Omit<Adapter, "connected" | "ecuConnected"> | undefined {
    const row = this.selectByIdStmt.get(id) as AdapterRow | undefined;
    return row ? rowToAdapter(row) : undefined;
  }

  update(id: string, fields: { name?: string; url?: string }): boolean {
    const existing = this.findById(id);
    if (!existing) return false;
    this.updateStmt.run(
      fields.name ?? existing.name,
      fields.url ?? existing.url,
      id
    );
    return true;
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
