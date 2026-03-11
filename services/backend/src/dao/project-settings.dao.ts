import db from "../db";

const getStmt = db.prepare(`SELECT value FROM project_settings WHERE project_id = ? AND key = ?`);
const getAllStmt = db.prepare(`SELECT key, value FROM project_settings WHERE project_id = ?`);
const upsertStmt = db.prepare(
  `INSERT INTO project_settings (project_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
   ON CONFLICT(project_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
);
const deleteKeyStmt = db.prepare(`DELETE FROM project_settings WHERE project_id = ? AND key = ?`);
const deleteAllStmt = db.prepare(`DELETE FROM project_settings WHERE project_id = ?`);

export const projectSettingsDAO = {
  get(projectId: string, key: string): string | undefined {
    const row = getStmt.get(projectId, key) as { value: string } | undefined;
    return row?.value;
  },

  getAll(projectId: string): Record<string, string> {
    const rows = getAllStmt.all(projectId) as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) result[row.key] = row.value;
    return result;
  },

  set(projectId: string, key: string, value: string): void {
    upsertStmt.run(projectId, key, value);
  },

  deleteKey(projectId: string, key: string): void {
    deleteKeyStmt.run(projectId, key);
  },

  deleteByProjectId(projectId: string): void {
    deleteAllStmt.run(projectId);
  },
};
