import crypto from "crypto";
import type {
  Project,
  AnalysisSummary,
  AnalysisModule,
} from "@aegis/shared";
import type { ProjectOverviewResponse } from "@aegis/shared";
import type { IProjectDAO, IAnalysisResultDAO, IFileStore, IFindingDAO, IRunDAO, IGateResultDAO } from "../dao/interfaces";
import type { AdapterManager } from "./adapter-manager";
import type { ProjectSettingsService } from "./project-settings.service";
import type { BuildTargetService } from "./build-target.service";
import type { ProjectListItem } from "@aegis/shared";
import type { ProjectDeletionService } from "./project-deletion.service";

export class ProjectService {
  constructor(
    private projectDAO: IProjectDAO,
    private analysisResultDAO: IAnalysisResultDAO,
    private fileStore: IFileStore,
    private adapterManager?: AdapterManager,
    private settingsService?: ProjectSettingsService,
    private buildTargetService?: BuildTargetService,
    private findingDAO?: IFindingDAO,
    private runDAO?: IRunDAO,
    private gateResultDAO?: IGateResultDAO,
    private projectDeletionService?: ProjectDeletionService,
  ) {}

  create(name: string, description?: string): Project {
    const now = new Date().toISOString();
    const project: Project = {
      id: `proj-${crypto.randomUUID()}`,
      name,
      description: description ?? "",
      createdAt: now,
      updatedAt: now,
    };
    this.projectDAO.save(project);

    return project;
  }

  findById(id: string): Project | undefined {
    return this.projectDAO.findById(id);
  }

  findAll(): Project[] {
    return this.projectDAO.findAll();
  }

  findAllWithSummary(): ProjectListItem[] {
    const projects = this.projectDAO.findAll();
    if (!this.findingDAO || !this.runDAO || !this.gateResultDAO) {
      return projects;
    }
    return projects.map((p) => {
      const runs = this.runDAO!.findLatestCompletedRuns(p.id, 2);
      const latestRun = runs[0];
      const lastAnalysisAt = latestRun?.endedAt ?? latestRun?.createdAt;
      const severitySummary = this.findingDAO!.severitySummaryByProjectId(p.id);
      const latestGate = this.gateResultDAO!.latestByProjectId(p.id);

      let unresolvedDelta: number | undefined;
      if (runs.length >= 2) {
        const current = this.findingDAO!.unresolvedCountByProjectId(p.id);
        const prevCutoff = runs[1].endedAt ?? runs[1].createdAt;
        const previous = this.findingDAO!.unresolvedCountByProjectId(p.id, { createdBefore: prevCutoff });
        unresolvedDelta = current - previous;
      }

      return {
        ...p,
        lastAnalysisAt,
        severitySummary,
        gateStatus: latestGate?.status,
        unresolvedDelta,
      };
    });
  }

  update(id: string, fields: { name?: string; description?: string }): Project | undefined {
    return this.projectDAO.update(id, fields);
  }

  async delete(id: string): Promise<boolean> {
    const existing = this.projectDAO.findById(id);
    if (!existing) return false;

    if (this.projectDeletionService) {
      await this.projectDeletionService.deleteProject(id);
      return true;
    }

    // fallback legacy behavior
    this.adapterManager?.deleteByProjectId(id);
    this.settingsService?.deleteByProjectId(id);
    this.buildTargetService?.deleteByProjectId(id);
    return this.projectDAO.delete(id);
  }

  getOverview(projectId: string): ProjectOverviewResponse | undefined {
    const project = this.projectDAO.findById(projectId);
    if (!project) return undefined;

    const analyses = this.analysisResultDAO.findByProjectId(projectId);
    const fileCount = this.fileStore.countByProjectId(projectId);

    // 모듈별 최신 완료 분석 1건만 사용 (재분석 시 중복 방지)
    const latestByModule = new Map<AnalysisModule, typeof analyses[0]>();
    for (const a of analyses) {
      if (a.status !== "completed") continue;
      if (!latestByModule.has(a.module)) {
        latestByModule.set(a.module, a); // analyses는 이미 created_at DESC
      }
    }

    const bySeverity: AnalysisSummary = {
      total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0,
    };
    const byModule = { static: 0, dynamic: 0, test: 0 };

    for (const [module, a] of latestByModule) {
      bySeverity.total += a.summary.total;
      bySeverity.critical += a.summary.critical;
      bySeverity.high += a.summary.high;
      bySeverity.medium += a.summary.medium;
      bySeverity.low += a.summary.low;
      bySeverity.info += a.summary.info;

      if (module === "static_analysis") byModule.static = a.summary.total;
      else if (module === "dynamic_analysis") byModule.dynamic = a.summary.total;
      else if (module === "dynamic_testing") byModule.test = a.summary.total;
    }

    const recentAnalyses = analyses.slice(0, 10);

    // 서브프로젝트 상태 집계
    let targetSummary: { total: number; ready: number; failed: number; running: number; discovered: number } | undefined;
    if (this.buildTargetService) {
      const targets = this.buildTargetService.findByProjectId(projectId);
      if (targets.length > 0) {
        const failedStatuses = new Set(["build_failed", "scan_failed", "graph_failed", "resolve_failed"]);
        const runningStatuses = new Set(["building", "scanning", "graphing", "resolving", "configured", "built", "scanned", "graphed"]);
        targetSummary = { total: targets.length, ready: 0, failed: 0, running: 0, discovered: 0 };
        for (const t of targets) {
          if (t.status === "ready") targetSummary.ready++;
          else if (failedStatuses.has(t.status)) targetSummary.failed++;
          else if (t.status === "discovered") targetSummary.discovered++;
          else if (runningStatuses.has(t.status)) targetSummary.running++;
          else targetSummary.running++;
        }
      }
    }

    // trend 계산
    let trend: { newFindings: number; resolvedFindings: number; unresolvedTotal: number } | undefined;
    if (this.findingDAO && this.runDAO) {
      const unresolvedTotal = this.findingDAO.unresolvedCountByProjectId(projectId);
      const latestRuns = this.runDAO.findLatestCompletedRuns(projectId, 1);
      const latestRun = latestRuns[0];
      const newFindings = latestRun?.findingCount ?? 0;
      let resolvedFindings = 0;
      if (latestRun) {
        const since = latestRun.startedAt ?? latestRun.createdAt;
        resolvedFindings = this.findingDAO.resolvedCountSince(projectId, since);
      }
      trend = { newFindings, resolvedFindings, unresolvedTotal };
    }

    return {
      project,
      fileCount,
      summary: {
        totalVulnerabilities: bySeverity.total,
        bySeverity,
        byModule,
      },
      targetSummary,
      recentAnalyses,
      trend,
    };
  }
}
