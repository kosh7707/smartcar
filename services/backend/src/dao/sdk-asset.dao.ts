import type { SdkAsset, SdkAnalyzedProfile, SdkRegistryStatus } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { ISdkAssetDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface SdkAssetRow {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  storage_path: string;
  profile: string | null;
  status: SdkRegistryStatus;
  verify_error: string | null;
  verified: number;
  created_at: string;
  updated_at: string;
}

function rowToSdkAsset(row: SdkAssetRow): SdkAsset {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? undefined,
    storagePath: row.storage_path,
    profile: safeJsonParse<SdkAnalyzedProfile | undefined>(row.profile, undefined),
    status: row.status,
    verifyError: row.verify_error ?? undefined,
    verified: row.verified === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SdkAssetDAO implements ISdkAssetDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private updateStmt;
  private deleteStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO sdk_assets (id, project_id, name, description, storage_path, profile, status, verify_error, verified, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM sdk_assets WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(`SELECT * FROM sdk_assets WHERE project_id = ? ORDER BY created_at DESC`);
    this.updateStmt = db.prepare(
      `UPDATE sdk_assets SET name = ?, description = ?, storage_path = ?, profile = ?, status = ?, verify_error = ?, verified = ?, updated_at = ? WHERE id = ?`,
    );
    this.deleteStmt = db.prepare(`DELETE FROM sdk_assets WHERE id = ?`);
  }

  save(asset: SdkAsset): void {
    this.insertStmt.run(
      asset.id,
      asset.projectId,
      asset.name,
      asset.description ?? null,
      asset.storagePath,
      JSON.stringify(asset.profile ?? {}),
      asset.status,
      asset.verifyError ?? null,
      asset.verified ? 1 : 0,
      asset.createdAt,
      asset.updatedAt,
    );
  }

  findById(id: string): SdkAsset | undefined {
    const row = this.selectByIdStmt.get(id) as SdkAssetRow | undefined;
    return row ? rowToSdkAsset(row) : undefined;
  }

  findByProjectId(projectId: string): SdkAsset[] {
    return (this.selectByProjectStmt.all(projectId) as SdkAssetRow[]).map(rowToSdkAsset);
  }

  update(assetId: string, fields: Partial<Omit<SdkAsset, "id" | "projectId" | "createdAt">>): SdkAsset | undefined {
    const existing = this.findById(assetId);
    if (!existing) return undefined;

    const updated: SdkAsset = {
      ...existing,
      ...fields,
      updatedAt: new Date().toISOString(),
    };

    this.updateStmt.run(
      updated.name,
      updated.description ?? null,
      updated.storagePath,
      JSON.stringify(updated.profile ?? {}),
      updated.status,
      updated.verifyError ?? null,
      updated.verified ? 1 : 0,
      updated.updatedAt,
      assetId,
    );
    return updated;
  }

  delete(id: string): boolean {
    return this.deleteStmt.run(id).changes > 0;
  }
}
