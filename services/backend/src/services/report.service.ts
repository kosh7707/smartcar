import type {
  AnalysisModule,
  FindingStatus,
  Severity,
  ModuleReport,
  ProjectReport,
  ReportSummary,
  FindingReportEntry,
  RunReportEntry,
} from "@smartcar/shared";
import { ProjectService } from "./project.service";
import { RunService } from "./run.service";
import { FindingService } from "./finding.service";
import { QualityGateService } from "./quality-gate.service";
import { ApprovalService } from "./approval.service";
import { evidenceRefDAO } from "../dao/evidence-ref.dao";
import { auditLogDAO } from "../dao/audit-log.dao";

const MODULE_KEY_MAP: Record<AnalysisModule, "static" | "dynamic" | "test"> = {
  static_analysis: "static",
  dynamic_analysis: "dynamic",
  dynamic_testing: "test",
};

const ALL_MODULES: AnalysisModule[] = [
  "static_analysis",
  "dynamic_analysis",
  "dynamic_testing",
];

export interface ReportFilters {
  severity?: Severity[];
  status?: FindingStatus[];
  runId?: string;
  from?: string;
  to?: string;
}

export class ReportService {
  constructor(
    private projectService: ProjectService,
    private runService: RunService,
    private findingService: FindingService,
    private gateService: QualityGateService,
    private approvalService: ApprovalService,
  ) {}

  generateModuleReport(
    projectId: string,
    module: AnalysisModule,
    filters?: ReportFilters,
  ): ModuleReport | undefined {
    const project = this.projectService.findById(projectId);
    if (!project) return undefined;

    const findings = this.findingService.findByProjectId(projectId, {
      module,
      ...filters,
    });
    const evidenceMap = evidenceRefDAO.findByFindingIds(findings.map((f) => f.id));
    const findingEntries: FindingReportEntry[] = findings.map((f) => ({
      finding: f,
      evidenceRefs: evidenceMap.get(f.id) ?? [],
    }));

    // Collect unique runIds from findings
    const runIdSet = new Set(findings.map((f) => f.runId));
    const allRuns = this.runService.findByProjectId(projectId);
    const moduleRuns = allRuns.filter(
      (r) => r.module === module && runIdSet.has(r.id),
    );

    const runEntries: RunReportEntry[] = moduleRuns.map((run) => ({
      run,
      gate: this.gateService.getByRunId(run.id),
    }));

    const gateResults = this.gateService
      .getByProjectId(projectId)
      .filter((g) => moduleRuns.some((r) => r.id === g.runId));

    const summary = this.buildSummary(findings);

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        projectId,
        projectName: project.name,
        module,
      },
      summary,
      runs: runEntries,
      findings: findingEntries,
      gateResults,
    };
  }

  generateProjectReport(projectId: string, filters?: ReportFilters): ProjectReport | undefined {
    const project = this.projectService.findById(projectId);
    if (!project) return undefined;

    const modules: ProjectReport["modules"] = {};
    const allSummaries: ReportSummary[] = [];

    for (const mod of ALL_MODULES) {
      const report = this.generateModuleReport(projectId, mod, filters);
      if (report && report.findings.length > 0) {
        modules[MODULE_KEY_MAP[mod]] = report;
        allSummaries.push(report.summary);
      }
    }

    const totalSummary = this.mergeSummaries(allSummaries);
    const approvals = this.approvalService.getByProjectId(projectId);

    // Collect audit logs from all findings + approvals, limit 100
    const findingIds = Object.values(modules)
      .flatMap((m) => m!.findings.map((f) => f.finding.id));
    const approvalIds = approvals.map((a) => a.id);
    const resourceIds = [...findingIds, ...approvalIds];

    const auditTrail = auditLogDAO.findByResourceIds(resourceIds, 100);

    return {
      generatedAt: new Date().toISOString(),
      projectId,
      projectName: project.name,
      modules,
      totalSummary,
      approvals,
      auditTrail,
    };
  }

  private buildSummary(
    findings: { severity: string; status: string; sourceType: string }[],
  ): ReportSummary {
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const f of findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      bySource[f.sourceType] = (bySource[f.sourceType] ?? 0) + 1;
    }

    return { totalFindings: findings.length, bySeverity, byStatus, bySource };
  }

  private mergeSummaries(summaries: ReportSummary[]): ReportSummary {
    const merged: ReportSummary = {
      totalFindings: 0,
      bySeverity: {},
      byStatus: {},
      bySource: {},
    };

    for (const s of summaries) {
      merged.totalFindings += s.totalFindings;
      for (const [k, v] of Object.entries(s.bySeverity))
        merged.bySeverity[k] = (merged.bySeverity[k] ?? 0) + v;
      for (const [k, v] of Object.entries(s.byStatus))
        merged.byStatus[k] = (merged.byStatus[k] ?? 0) + v;
      for (const [k, v] of Object.entries(s.bySource))
        merged.bySource[k] = (merged.bySource[k] ?? 0) + v;
    }

    return merged;
  }
}
