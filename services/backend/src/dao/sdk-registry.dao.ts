import fs from "fs";
import type { RegisteredSdk, SdkRegistryStatus, SdkAnalyzedProfile, SdkPhaseHistoryEntry } from "@aegis/shared";
import type { DatabaseType } from "../db";

const SDK_RETRY_LIMIT = 3;
const SDK_RETRY_COOLDOWN_MS = 30_000;

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
  phase_history: string | null;
  current_phase_started_at: number | null;
  retry_count: number | null;
  retry_expires_at: number | null;
  created_at: string;
  updated_at: string;
}

function rowToSdk(row: SdkRegistryRow): RegisteredSdk {
  const profile = parseJson<SdkAnalyzedProfile | undefined>(row.profile, undefined);
  const phaseHistory = parseJson<SdkPhaseHistoryEntry[]>(row.phase_history, []);
  const updatedAtMs = Number.isFinite(Date.parse(row.updated_at)) ? Date.parse(row.updated_at) : 0;
  const retryable = (row.status === "extract_failed"
    || row.status === "install_failed"
    || row.status === "verify_failed")
    && (row.retry_count ?? 0) < SDK_RETRY_LIMIT
    && typeof row.retry_expires_at === "number"
    && Date.now() <= row.retry_expires_at
    && Date.now() >= updatedAtMs + SDK_RETRY_COOLDOWN_MS
    && fs.existsSync(row.path);
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
    currentPhaseStartedAt: row.current_phase_started_at ?? undefined,
    phaseHistory,
    retryCount: row.retry_count ?? 0,
    retryable,
    retryExpiresAt: row.retry_expires_at ?? undefined,
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
  private updateRetryStmt;
  private updateProfileStmt;
  private updatePathStmt;
  private deleteStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO sdk_registry (
         id, project_id, name, description, path, profile, status, verified,
         phase_history, current_phase_started_at, retry_count, retry_expires_at,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM sdk_registry WHERE project_id = ? ORDER BY created_at DESC`,
    );
    this.selectByIdStmt = db.prepare(
      `SELECT * FROM sdk_registry WHERE id = ?`,
    );
    this.updateStatusStmt = db.prepare(
      `UPDATE sdk_registry
       SET status = ?, verify_error = ?, verified = ?, phase_history = ?, current_phase_started_at = ?, retry_expires_at = ?, updated_at = ?
       WHERE id = ?`,
    );
    this.updateRetryStmt = db.prepare(
      `UPDATE sdk_registry SET retry_count = retry_count + 1, retry_expires_at = ?, updated_at = ? WHERE id = ?`,
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
      JSON.stringify(sdk.phaseHistory ?? [{ phase: sdk.status, startedAt: sdk.currentPhaseStartedAt ?? Date.now() }]),
      sdk.currentPhaseStartedAt ?? Date.now(),
      sdk.retryCount ?? 0,
      sdk.retryExpiresAt ?? null,
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

  updateStatus(id: string, status: SdkRegistryStatus, verifyError?: string, message?: string): void {
    const existing = this.findById(id);
    if (!existing) return;
    const nowMs = Date.now();
    const phaseHistory = [...(existing.phaseHistory ?? [])];
    const last = phaseHistory.length > 0 ? phaseHistory[phaseHistory.length - 1] : undefined;
    if (last && !last.endedAt) {
      last.endedAt = nowMs;
      last.durationMs = Math.max(0, nowMs - last.startedAt);
    }
    phaseHistory.push({ phase: status, startedAt: nowMs, ...(message ? { message } : {}) });
    const verified = status === "ready" ? 1 : 0;
    const retryExpiresAt = status.endsWith("_failed")
      ? nowMs + 24 * 60 * 60 * 1000
      : existing.retryExpiresAt ?? null;
    this.updateStatusStmt.run(
      status,
      verifyError ?? null,
      verified,
      JSON.stringify(phaseHistory),
      nowMs,
      retryExpiresAt,
      new Date().toISOString(),
      id,
    );
  }

  incrementRetry(id: string, retryExpiresAt?: number): void {
    this.updateRetryStmt.run(retryExpiresAt ?? Date.now() + 24 * 60 * 60 * 1000, new Date().toISOString(), id);
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
