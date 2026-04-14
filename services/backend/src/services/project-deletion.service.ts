import type { DatabaseType } from "../db";
import type { BuildTargetStatus, SdkRegistryStatus } from "@aegis/shared";
import type { ProjectSourceService, ProjectSourceQuarantine } from "./project-source.service";
import type { AdapterManager } from "./adapter-manager";
import type { AnalysisTracker } from "./analysis-tracker";
import type { DynamicTestService } from "./dynamic-test.service";
import type { DynamicSessionDAO } from "../dao/dynamic-session.dao";
import type { SdkRegistryDAO } from "../dao/sdk-registry.dao";
import type { BuildTargetDAO } from "../dao/build-target.dao";
import { ConflictError, DbError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("project-deletion");

const ACTIVE_PIPELINE_STATUSES = new Set<BuildTargetStatus>([
  "resolving",
  "configured",
  "building",
  "built",
  "scanning",
  "scanned",
  "graphing",
  "graphed",
]);

const NON_TERMINAL_SDK_STATUSES = new Set<SdkRegistryStatus>([
  "uploading",
  "uploaded",
  "extracting",
  "extracted",
  "installing",
  "installed",
  "analyzing",
  "verifying",
]);

const DELETE_BY_PROJECT_SQL: ReadonlyArray<{ key: string; sql: string }> = [
  {
    key: "dynamic_analysis_alerts",
    sql: `DELETE FROM dynamic_analysis_alerts WHERE session_id IN (SELECT id FROM dynamic_analysis_sessions WHERE project_id = ?)`,
  },
  {
    key: "dynamic_analysis_messages",
    sql: `DELETE FROM dynamic_analysis_messages WHERE session_id IN (SELECT id FROM dynamic_analysis_sessions WHERE project_id = ?)`,
  },
  {
    key: "evidence_refs",
    sql: `DELETE FROM evidence_refs WHERE finding_id IN (SELECT id FROM findings WHERE project_id = ?)`,
  },
  { key: "target_libraries", sql: `DELETE FROM target_libraries WHERE project_id = ?` },
  { key: "gate_results", sql: `DELETE FROM gate_results WHERE project_id = ?` },
  { key: "approvals", sql: `DELETE FROM approvals WHERE project_id = ?` },
  { key: "findings", sql: `DELETE FROM findings WHERE project_id = ?` },
  { key: "runs", sql: `DELETE FROM runs WHERE project_id = ?` },
  { key: "analysis_results", sql: `DELETE FROM analysis_results WHERE project_id = ?` },
  { key: "uploaded_files", sql: `DELETE FROM uploaded_files WHERE project_id = ?` },
  { key: "dynamic_analysis_sessions", sql: `DELETE FROM dynamic_analysis_sessions WHERE project_id = ?` },
  { key: "dynamic_test_results", sql: `DELETE FROM dynamic_test_results WHERE project_id = ?` },
  { key: "notifications", sql: `DELETE FROM notifications WHERE project_id = ?` },
  { key: "sdk_registry", sql: `DELETE FROM sdk_registry WHERE project_id = ?` },
  { key: "build_target_assets", sql: `DELETE FROM build_target_assets WHERE project_id = ?` },
  { key: "build_snapshot_projections", sql: `DELETE FROM build_snapshot_projections WHERE project_id = ?` },
  { key: "build_attempt_projections", sql: `DELETE FROM build_attempt_projections WHERE project_id = ?` },
  { key: "build_requests", sql: `DELETE FROM build_requests WHERE project_id = ?` },
  { key: "build_unit_revisions", sql: `DELETE FROM build_unit_revisions WHERE project_id = ?` },
  { key: "build_units", sql: `DELETE FROM build_units WHERE project_id = ?` },
  { key: "sdk_assets", sql: `DELETE FROM sdk_assets WHERE project_id = ?` },
  { key: "project_source_assets", sql: `DELETE FROM project_source_assets WHERE project_id = ?` },
  { key: "build_targets", sql: `DELETE FROM build_targets WHERE project_id = ?` },
  { key: "adapters", sql: `DELETE FROM adapters WHERE project_id = ?` },
  { key: "project_settings", sql: `DELETE FROM project_settings WHERE project_id = ?` },
];

export interface ProjectDeleteBlockers {
  activeAnalysis?: { analysisId: string };
  connectedAdapters?: Array<{ id: string; name: string }>;
  activeDynamicSessions?: Array<{ id: string; status: string }>;
  runningDynamicTest?: { projectId: string };
  activeSdkRegistrations?: Array<{ id: string; name: string; status: SdkRegistryStatus }>;
  activePipelineTargets?: Array<{ id: string; name: string; status: BuildTargetStatus }>;
}

function hasProjectDeleteBlockers(blockers: ProjectDeleteBlockers): boolean {
  return Object.values(blockers).some((value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

export class ProjectDeletionService {
  constructor(
    private db: DatabaseType,
    private sourceService: ProjectSourceService,
    private adapterManager: AdapterManager,
    private analysisTracker: AnalysisTracker,
    private dynamicSessionDAO: DynamicSessionDAO,
    private dynamicTestService: DynamicTestService,
    private sdkRegistryDAO: SdkRegistryDAO,
    private buildTargetDAO: BuildTargetDAO,
  ) {}

  getBlockers(projectId: string): ProjectDeleteBlockers {
    const runningAnalysis = this.analysisTracker.getRunning(projectId);
    const connectedAdapters = this.adapterManager
      .findByProjectId(projectId)
      .filter((adapter) => adapter.connected)
      .map((adapter) => ({ id: adapter.id, name: adapter.name }));
    const activeDynamicSessions = this.dynamicSessionDAO
      .findByProjectId(projectId)
      .filter((session) => session.status === "connected" || session.status === "monitoring")
      .map((session) => ({ id: session.id, status: session.status }));
    const activeSdkRegistrations = this.sdkRegistryDAO
      .findByProjectId(projectId)
      .filter((sdk) => NON_TERMINAL_SDK_STATUSES.has(sdk.status))
      .map((sdk) => ({ id: sdk.id, name: sdk.name, status: sdk.status }));
    const activePipelineTargets = this.buildTargetDAO
      .findByProjectId(projectId)
      .filter((target) => ACTIVE_PIPELINE_STATUSES.has(target.status))
      .map((target) => ({ id: target.id, name: target.name, status: target.status }));

    return {
      ...(runningAnalysis ? { activeAnalysis: { analysisId: runningAnalysis.analysisId } } : {}),
      ...(connectedAdapters.length > 0 ? { connectedAdapters } : {}),
      ...(activeDynamicSessions.length > 0 ? { activeDynamicSessions } : {}),
      ...(this.dynamicTestService.isRunningForProject(projectId) ? { runningDynamicTest: { projectId } } : {}),
      ...(activeSdkRegistrations.length > 0 ? { activeSdkRegistrations } : {}),
      ...(activePipelineTargets.length > 0 ? { activePipelineTargets } : {}),
    };
  }

  async deleteProject(projectId: string): Promise<void> {
    const blockers = this.getBlockers(projectId);
    if (hasProjectDeleteBlockers(blockers)) {
      throw new ConflictError("Project has active resources", undefined, { blockers });
    }

    logger.info({ projectId, phase: "preflight" }, "Project deletion preflight passed");

    let quarantineState: ProjectSourceQuarantine;
    try {
      quarantineState = this.sourceService.quarantineProjectRoot(projectId);
    } catch (err) {
      logger.error({ err, projectId, phase: "quarantine" }, "Project uploads quarantine failed");
      throw new DbError(`Failed to quarantine project uploads: ${projectId}`, err);
    }

    try {
      this.db.transaction(() => {
        for (const step of DELETE_BY_PROJECT_SQL) {
          this.db.prepare(step.sql).run(projectId);
        }

        const deleted = this.db.prepare(`DELETE FROM projects WHERE id = ?`).run(projectId);
        if (deleted.changes === 0) {
          throw new DbError(`Project not found during deletion: ${projectId}`);
        }
      })();
    } catch (err) {
      logger.error({ err, projectId, phase: "db-delete" }, "Project DB deletion failed");
      try {
        this.sourceService.restoreQuarantinedProjectRoot(quarantineState);
      } catch (restoreErr) {
        logger.error({ err: restoreErr, projectId, phase: "restore" }, "Project uploads restore failed after DB deletion failure");
      }
      throw new DbError(`Failed to delete project: ${projectId}`, err);
    }

    try {
      this.sourceService.removeQuarantinedProjectRoot(quarantineState);
    } catch (err) {
      logger.error({ err, projectId, phase: "final-remove" }, "Failed to remove quarantined project root after DB deletion");
    }

    logger.info({ projectId, phase: "complete" }, "Project deletion completed");
  }
}
