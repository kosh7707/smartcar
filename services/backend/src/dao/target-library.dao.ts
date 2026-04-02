import crypto from "crypto";
import type { TargetLibrary } from "@aegis/shared";
import type { DatabaseType } from "../db";

function parseJsonOrDefault<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

interface TargetLibraryRow {
  id: string;
  target_id: string;
  project_id: string;
  name: string;
  version: string | null;
  path: string;
  included: number;
  modified_files: string | null;
  created_at: string;
  updated_at: string;
}

function rowToLib(row: TargetLibraryRow): TargetLibrary {
  return {
    id: row.id,
    targetId: row.target_id,
    projectId: row.project_id,
    name: row.name,
    version: row.version ?? undefined,
    path: row.path,
    included: row.included === 1,
    modifiedFiles: parseJsonOrDefault<string[]>(row.modified_files, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TargetLibraryDAO {
  private insertStmt;
  private selectByTargetStmt;
  private updateIncludedStmt;
  private deleteByTargetStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT OR REPLACE INTO target_libraries (id, target_id, project_id, name, version, path, included, modified_files, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByTargetStmt = db.prepare(
      `SELECT * FROM target_libraries WHERE target_id = ? ORDER BY name ASC`,
    );
    this.updateIncludedStmt = db.prepare(
      `UPDATE target_libraries SET included = ?, updated_at = ? WHERE id = ?`,
    );
    this.deleteByTargetStmt = db.prepare(
      `DELETE FROM target_libraries WHERE target_id = ?`,
    );
  }

  upsertFromScan(
    targetId: string,
    projectId: string,
    libraries: Array<{ name: string; version?: string; path: string; modifiedFiles?: string[] }>,
  ): TargetLibrary[] {
    const now = new Date().toISOString();
    const existing = this.findByTargetId(targetId);
    const existingByPath = new Map(existing.map((l) => [l.path, l]));

    const results: TargetLibrary[] = [];
    for (const lib of libraries) {
      const prev = existingByPath.get(lib.path);
      const id = prev?.id ?? `lib-${crypto.randomUUID().slice(0, 8)}`;
      const included = prev?.included ?? false; // 기존 상태 보존, 신규는 기본 제외

      this.insertStmt.run(
        id, targetId, projectId,
        lib.name, lib.version ?? null, lib.path,
        included ? 1 : 0,
        JSON.stringify(lib.modifiedFiles ?? []),
        prev?.createdAt ?? now, now,
      );
      results.push({
        id, targetId, projectId,
        name: lib.name, version: lib.version,
        path: lib.path, included,
        modifiedFiles: lib.modifiedFiles ?? [],
        createdAt: prev?.createdAt ?? now, updatedAt: now,
      });
    }
    return results;
  }

  findByTargetId(targetId: string): TargetLibrary[] {
    return (this.selectByTargetStmt.all(targetId) as TargetLibraryRow[]).map(rowToLib);
  }

  updateIncluded(id: string, included: boolean): void {
    this.updateIncludedStmt.run(included ? 1 : 0, new Date().toISOString(), id);
  }

  deleteByTargetId(targetId: string): number {
    return this.deleteByTargetStmt.run(targetId).changes;
  }

  /** included=true인 라이브러리의 path 목록 반환 */
  getIncludedPaths(targetId: string): string[] {
    return this.findByTargetId(targetId)
      .filter((l) => l.included)
      .map((l) => l.path);
  }
}
