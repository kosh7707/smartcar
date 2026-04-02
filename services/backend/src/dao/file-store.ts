import type { UploadedFile } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IFileStore } from "./interfaces";

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

interface StoredFileRow {
  id: string;
  project_id: string;
  name: string;
  path: string | null;
  size: number;
  language: string | null;
  content: string | null;
  created_at: string;
}

interface UploadedFileRow {
  id: string;
  project_id: string;
  name: string;
  path: string | null;
  size: number;
  language: string | null;
  created_at: string;
}

function rowToStored(row: StoredFileRow): StoredFile {
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

function rowToUploaded(row: UploadedFileRow): UploadedFile {
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

export class FileStore implements IFileStore {
  private insertStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private countByProjectStmt;
  private deleteStmt;
  private deleteByProjectAndFileStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO uploaded_files (id, project_id, name, path, size, language, content) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(
      `SELECT id, project_id, name, path, size, language, content, created_at FROM uploaded_files WHERE id = ?`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT id, project_id, name, path, size, language, created_at FROM uploaded_files WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.countByProjectStmt = db.prepare(
      `SELECT COUNT(*) AS cnt FROM uploaded_files WHERE project_id = ?`
    );
    this.deleteStmt = db.prepare(`DELETE FROM uploaded_files WHERE id = ?`);
    this.deleteByProjectAndFileStmt = db.prepare(
      `DELETE FROM uploaded_files WHERE id = ? AND project_id = ?`
    );
  }

  save(file: StoredFile): void {
    this.insertStmt.run(file.id, file.projectId, file.name, file.path ?? "", file.size, file.language ?? null, file.content);
  }

  findById(id: string): StoredFile | undefined {
    const row = this.selectByIdStmt.get(id) as StoredFileRow | undefined;
    return row ? rowToStored(row) : undefined;
  }

  findByIds(ids: string[]): StoredFile[] {
    const placeholders = ids.map(() => "?").join(",");
    const stmt = this.db.prepare(
      `SELECT id, project_id, name, path, size, language, content, created_at FROM uploaded_files WHERE id IN (${placeholders})`
    );
    return (stmt.all(...ids) as StoredFileRow[]).map(rowToStored);
  }

  findByProjectId(projectId: string): UploadedFile[] {
    return (this.selectByProjectStmt.all(projectId) as UploadedFileRow[]).map(rowToUploaded);
  }

  countByProjectId(projectId: string): number {
    return (this.countByProjectStmt.get(projectId) as { cnt: number }).cnt;
  }

  delete(id: string): void {
    this.deleteStmt.run(id);
  }

  deleteByProjectAndFile(fileId: string, projectId: string): boolean {
    const result = this.deleteByProjectAndFileStmt.run(fileId, projectId);
    return result.changes > 0;
  }
}
