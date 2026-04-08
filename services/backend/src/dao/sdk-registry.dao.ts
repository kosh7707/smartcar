import type { RegisteredSdk, SdkRegistryStatus, SdkAnalyzedProfile } from "@aegis/shared";
import type { DatabaseType } from "../db";

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

interface SdkRegistryRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  path: string;
  profile: string | null;
  status: SdkRegistryStatus;
  verify_error: string | null;
  verified: number;
  created_at: string;
  updated_at: string;
}

function rowToSdk(row: SdkRegistryRow): RegisteredSdk {
  const profile = parseJson<SdkAnalyzedProfile | undefined>(row.profile, undefined);
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? undefined,
    path: row.path,
    profile,
    artifactKind: profile?.artifactKind,
    sdkVersion: profile?.sdkVersion,
    targetSystem: profile?.targetSystem,
    installLogPath: profile?.installLogPath,
    status: row.status as SdkRegistryStatus,
    verifyError: row.verify_error ?? undefined,
    verified: row.verified === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SdkRegistryDAO {
  private insertStmt;
  private selectByProjectStmt;
  private selectByIdStmt;
  private updateStatusStmt;
  private updateProfileStmt;
  private updatePathStmt;
  private deleteStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO sdk_registry (id, project_id, name, description, path, profile, status, verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM sdk_registry WHERE project_id = ? ORDER BY created_at DESC`,
    );
    this.selectByIdStmt = db.prepare(
      `SELECT * FROM sdk_registry WHERE id = ?`,
    );
    this.updateStatusStmt = db.prepare(
      `UPDATE sdk_registry SET status = ?, verify_error = ?, verified = ?, updated_at = ? WHERE id = ?`,
    );
    this.updateProfileStmt = db.prepare(
      `UPDATE sdk_registry SET profile = ?, updated_at = ? WHERE id = ?`,
    );
    this.updatePathStmt = db.prepare(
      `UPDATE sdk_registry SET path = ?, updated_at = ? WHERE id = ?`,
    );
    this.deleteStmt = db.prepare(
      `DELETE FROM sdk_registry WHERE id = ?`,
    );
  }

  save(sdk: RegisteredSdk): void {
    this.insertStmt.run(
      sdk.id, sdk.projectId, sdk.name, sdk.description ?? null,
      sdk.path, JSON.stringify(sdk.profile ?? {}),
      sdk.status, sdk.verified ? 1 : 0,
      sdk.createdAt, sdk.updatedAt,
    );
  }

  findByProjectId(projectId: string): RegisteredSdk[] {
    return (this.selectByProjectStmt.all(projectId) as SdkRegistryRow[]).map(rowToSdk);
  }

  findById(id: string): RegisteredSdk | undefined {
    const row = this.selectByIdStmt.get(id) as SdkRegistryRow | undefined;
    return row ? rowToSdk(row) : undefined;
  }

  updateStatus(id: string, status: SdkRegistryStatus, verifyError?: string): void {
    const verified = status === "ready" ? 1 : 0;
    this.updateStatusStmt.run(status, verifyError ?? null, verified, new Date().toISOString(), id);
  }

  updateProfile(id: string, profile: SdkAnalyzedProfile): void {
    this.updateProfileStmt.run(JSON.stringify(profile), new Date().toISOString(), id);
  }

  updatePath(id: string, sdkPath: string): void {
    this.updatePathStmt.run(sdkPath, new Date().toISOString(), id);
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0;
  }
}
