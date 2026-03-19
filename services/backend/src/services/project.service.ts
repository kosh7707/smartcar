import crypto from "crypto";
import type {
  Project,
  AnalysisSummary,
  AnalysisModule,
} from "@aegis/shared";
import type { ProjectOverviewResponse } from "@aegis/shared";
import type { IProjectDAO, IAnalysisResultDAO, IFileStore } from "../dao/interfaces";
import type { RuleService } from "./rule.service";
import type { AdapterManager } from "./adapter-manager";
import type { ProjectSettingsService } from "./project-settings.service";

export class ProjectService {
  constructor(
    private projectDAO: IProjectDAO,
    private analysisResultDAO: IAnalysisResultDAO,
    private fileStore: IFileStore,
    private ruleService?: RuleService,
    private adapterManager?: AdapterManager,
    private settingsService?: ProjectSettingsService,
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

    // 기본 룰 시딩
    this.ruleService?.seedDefaultRules(project.id);

    return project;
  }

  findById(id: string): Project | undefined {
    return this.projectDAO.findById(id);
  }

  findAll(): Project[] {
    return this.projectDAO.findAll();
  }

  update(id: string, fields: { name?: string; description?: string }): Project | undefined {
    return this.projectDAO.update(id, fields);
  }

  delete(id: string): boolean {
    // cascade: 프로젝트 룰/어댑터/설정 삭제
    this.ruleService?.deleteByProjectId(id);
    this.adapterManager?.deleteByProjectId(id);
    this.settingsService?.deleteByProjectId(id);
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

    return {
      project,
      fileCount,
      summary: {
        totalVulnerabilities: bySeverity.total,
        bySeverity,
        byModule,
      },
      recentAnalyses,
    };
  }
}
