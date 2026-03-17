import type { DatabaseType } from "../db";
import type { IProjectSettingsDAO } from "./interfaces";

export class ProjectSettingsDAO implements IProjectSettingsDAO {
  private getStmt;
  private getAllStmt;
  private upsertStmt;
  private deleteKeyStmt;
  private deleteAllStmt;

  constructor(private db: DatabaseType) {
    this.getStmt = db.prepare(`SELECT value FROM project_settings WHERE project_id = ? AND key = ?`);
    this.getAllStmt = db.prepare(`SELECT key, value FROM project_settings WHERE project_id = ?`);
    this.upsertStmt = db.prepare(
      `INSERT INTO project_settings (project_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );
    this.deleteKeyStmt = db.prepare(`DELETE FROM project_settings WHERE project_id = ? AND key = ?`);
    this.deleteAllStmt = db.prepare(`DELETE FROM project_settings WHERE project_id = ?`);
  }

  get(projectId: string, key: string): string | undefined {
    const row = this.getStmt.get(projectId, key) as { value: string } | undefined;
    return row?.value;
  }

  getAll(projectId: string): Record<string, string> {
    const rows = this.getAllStmt.all(projectId) as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  }

  set(projectId: string, key: string, value: string): void {
    this.upsertStmt.run(projectId, key, value);
  }

  deleteKey(projectId: string, key: string): void {
    this.deleteKeyStmt.run(projectId, key);
  }

  deleteByProjectId(projectId: string): void {
    this.deleteAllStmt.run(projectId);
  }
}
