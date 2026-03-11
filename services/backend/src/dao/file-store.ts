import type { UploadedFile } from "@smartcar/shared";
import db from "../db";

export interface StoredFile {
  id: string;
  projectId: string;
  name: string;
  path?: string;
  size: number;
  content: string;
  language?: string;
  createdAt?: string;
}

const insertStmt = db.prepare(
  `INSERT INTO uploaded_files (id, project_id, name, path, size, language, content) VALUES (?, ?, ?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(
  `SELECT id, project_id, name, path, size, language, content, created_at FROM uploaded_files WHERE id = ?`
);
const selectByProjectStmt = db.prepare(
  `SELECT id, project_id, name, path, size, language, created_at FROM uploaded_files WHERE project_id = ? ORDER BY created_at DESC`
);
const countByProjectStmt = db.prepare(
  `SELECT COUNT(*) AS cnt FROM uploaded_files WHERE project_id = ?`
);
const deleteStmt = db.prepare(`DELETE FROM uploaded_files WHERE id = ?`);
const deleteByProjectAndFileStmt = db.prepare(
  `DELETE FROM uploaded_files WHERE id = ? AND project_id = ?`
);

function rowToStored(row: any): StoredFile {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    path: row.path || undefined,
    size: row.size,
    language: row.language ?? undefined,
    content: row.content ?? "",
    createdAt: row.created_at,
  };
}

function rowToUploaded(row: any): UploadedFile {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    language: row.language ?? undefined,
    projectId: row.project_id,
    path: row.path || undefined,
    createdAt: row.created_at,
  };
}

class FileStore {
  save(file: StoredFile): void {
    insertStmt.run(file.id, file.projectId, file.name, file.path ?? "", file.size, file.language ?? null, file.content);
  }

  findById(id: string): StoredFile | undefined {
    const row = selectByIdStmt.get(id);
    return row ? rowToStored(row) : undefined;
  }

  findByIds(ids: string[]): StoredFile[] {
    const placeholders = ids.map(() => "?").join(",");
    const stmt = db.prepare(
      `SELECT id, project_id, name, path, size, language, content, created_at FROM uploaded_files WHERE id IN (${placeholders})`
    );
    return stmt.all(...ids).map(rowToStored);
  }

  findByProjectId(projectId: string): UploadedFile[] {
    return selectByProjectStmt.all(projectId).map(rowToUploaded);
  }

  countByProjectId(projectId: string): number {
    return (countByProjectStmt.get(projectId) as any).cnt;
  }

  delete(id: string): void {
    deleteStmt.run(id);
  }

  deleteByProjectAndFile(fileId: string, projectId: string): boolean {
    const result = deleteByProjectAndFileStmt.run(fileId, projectId);
    return result.changes > 0;
  }
}

export const fileStore = new FileStore();
