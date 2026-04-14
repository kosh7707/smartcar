import type { BuildTarget, BuildProfile, BuildTargetStatus, ScaLibrary } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IBuildTargetDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface BuildTargetRow {
  id: string;
  project_id: string;
  name: string;
  relative_path: string;
  build_profile: string | null;
  sdk_choice_state: BuildTarget["sdkChoiceState"] | null;
  build_system: "cmake" | "make" | "custom" | null;
  included_paths: string | null;
  source_path: string | null;
  build_command: string | null;
  status: BuildTargetStatus | null;
  compile_commands_path: string | null;
  build_log: string | null;
  sast_scan_id: string | null;
  sca_libraries: string | null;
  code_graph_status: "pending" | "ingested" | "failed" | null;
  code_graph_node_count: number | null;
  last_built_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToBuildTarget(row: BuildTargetRow): BuildTarget {
  const scaLibraries = safeJsonParse<ScaLibrary[]>(row.sca_libraries, []);
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    relativePath: row.relative_path,
    buildProfile: safeJsonParse(row.build_profile, {} as BuildProfile),
    sdkChoiceState: row.sdk_choice_state ?? "sdk-unresolved",
    buildSystem: row.build_system ?? undefined,
    includedPaths: safeJsonParse<string[]>(row.included_paths, []).length > 0
      ? safeJsonParse<string[]>(row.included_paths, []) : undefined,
    sourcePath: row.source_path ?? undefined,
    buildCommand: row.build_command ?? undefined,
    status: (row.status ?? "discovered") as BuildTargetStatus,
    compileCommandsPath: row.compile_commands_path ?? undefined,
    buildLog: row.build_log ?? undefined,
    sastScanId: row.sast_scan_id ?? undefined,
    scaLibraries: scaLibraries.length > 0 ? scaLibraries : undefined,
    codeGraphStatus: row.code_graph_status ?? undefined,
    codeGraphNodeCount: row.code_graph_node_count ?? undefined,
    lastBuiltAt: row.last_built_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class BuildTargetDAO implements IBuildTargetDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByProjectStmt;
  private updateStmt;
  private updateStatusStmt;
  private deleteStmt;
  private deleteByProjectStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO build_targets (id, project_id, name, relative_path, build_profile, sdk_choice_state, build_system, status, included_paths, source_path, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM build_targets WHERE id = ?`);
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM build_targets WHERE project_id = ? ORDER BY name ASC`,
    );
    this.updateStmt = db.prepare(
      `UPDATE build_targets SET name = ?, relative_path = ?, build_profile = ?, sdk_choice_state = ?, build_system = ?, status = ?, updated_at = ? WHERE id = ?`,
    );
    this.updateStatusStmt = db.prepare(
      `UPDATE build_targets SET status = ?, compile_commands_path = ?, build_log = ?, sast_scan_id = ?, sca_libraries = ?, code_graph_status = ?, code_graph_node_count = ?, last_built_at = ?, build_command = ?, sdk_choice_state = ?, updated_at = ? WHERE id = ?`,
    );
    this.deleteStmt = db.prepare(`DELETE FROM build_targets WHERE id = ?`);
    this.deleteByProjectStmt = db.prepare(`DELETE FROM build_targets WHERE project_id = ?`);
  }

  save(target: BuildTarget): void {
    this.insertStmt.run(
      target.id,
      target.projectId,
      target.name,
      target.relativePath,
      JSON.stringify(target.buildProfile),
      target.sdkChoiceState,
      target.buildSystem ?? null,
      target.status ?? "discovered",
      JSON.stringify(target.includedPaths ?? []),
      target.sourcePath ?? null,
      target.createdAt,
      target.updatedAt,
    );
  }

  findById(id: string): BuildTarget | undefined {
    const row = this.selectByIdStmt.get(id) as BuildTargetRow | undefined;
    return row ? rowToBuildTarget(row) : undefined;
  }

  findByProjectId(projectId: string): BuildTarget[] {
    return (this.selectByProjectStmt.all(projectId) as BuildTargetRow[]).map(rowToBuildTarget);
  }

  update(
    id: string,
    fields: { name?: string; relativePath?: string; buildProfile?: BuildProfile; buildSystem?: string; status?: BuildTargetStatus; sdkChoiceState?: BuildTarget["sdkChoiceState"] },
  ): BuildTarget | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const name = fields.name ?? existing.name;
    const relativePath = fields.relativePath ?? existing.relativePath;
    const buildProfile = fields.buildProfile ?? existing.buildProfile;
    const sdkChoiceState = fields.sdkChoiceState ?? existing.sdkChoiceState;
    const buildSystem = fields.buildSystem ?? existing.buildSystem;
    const status = fields.status ?? existing.status;
    const updatedAt = new Date().toISOString();

    this.updateStmt.run(name, relativePath, JSON.stringify(buildProfile), sdkChoiceState, buildSystem ?? null, status, updatedAt, id);
    return { ...existing, name, relativePath, buildProfile, sdkChoiceState, buildSystem: buildSystem as BuildTarget["buildSystem"], status, updatedAt };
  }

  /** 파이프라인 상태 전이용 (모든 파이프라인 관련 필드 일괄 업데이트) */
  updatePipelineState(
    id: string,
    fields: {
      status: BuildTargetStatus;
      compileCommandsPath?: string;
      buildLog?: string;
      sastScanId?: string;
      scaLibraries?: ScaLibrary[];
      codeGraphStatus?: string;
      codeGraphNodeCount?: number;
      lastBuiltAt?: string;
      buildCommand?: string;
      sdkChoiceState?: BuildTarget["sdkChoiceState"];
    },
  ): BuildTarget | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    this.updateStatusStmt.run(
      fields.status,
      fields.compileCommandsPath ?? existing.compileCommandsPath ?? null,
      fields.buildLog ?? existing.buildLog ?? null,
      fields.sastScanId ?? existing.sastScanId ?? null,
      JSON.stringify(fields.scaLibraries ?? existing.scaLibraries ?? []),
      fields.codeGraphStatus ?? existing.codeGraphStatus ?? "pending",
      fields.codeGraphNodeCount ?? existing.codeGraphNodeCount ?? 0,
      fields.lastBuiltAt ?? existing.lastBuiltAt ?? null,
      fields.buildCommand ?? existing.buildCommand ?? null,
      fields.sdkChoiceState ?? existing.sdkChoiceState,
      updatedAt,
      id,
    );

    return this.findById(id);
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
