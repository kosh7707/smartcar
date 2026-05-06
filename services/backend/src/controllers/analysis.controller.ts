import { Router } from "express";
import crypto from "crypto";
import type { AnalysisOrchestrator } from "../services/analysis-orchestrator";
import type { IAnalysisResultDAO, IFindingDAO, IRunDAO, IGateResultDAO } from "../dao/interfaces";
import type { AnalysisTracker } from "../services/analysis-tracker";
import type { AgentClient } from "../services/agent-client";
import type { ProjectSourceService } from "../services/project-source.service";
import type { AgentPocOutcome, AgentQualityOutcome, PocResponseData } from "@aegis/shared";
import { asyncHandler } from "../middleware/async-handler";
import { InvalidInputError, NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";
import { isVisibleAnalysisArtifact } from "../lib/analysis-visibility";
import { toValidClaimDiagnostics } from "../lib/claim-diagnostics";

const logger = createLogger("analysis-controller");

export function createAnalysisRouter(
  orchestrator: AnalysisOrchestrator,
  analysisResultDAO: IAnalysisResultDAO,
  analysisTracker: AnalysisTracker,
  findingDAO: IFindingDAO,
  runDAO: IRunDAO,
  gateResultDAO: IGateResultDAO,
  agentClient: AgentClient,
  sourceService: ProjectSourceService,
): Router {
  const router = Router();

  const rejectLegacyExecutionFields = (body: Record<string, unknown>) => {
    if (body.mode !== undefined) {
      throw new InvalidInputError("mode is no longer supported; use buildTargetId");
    }
    if (body.targetIds !== undefined) {
      throw new InvalidInputError("targetIds is no longer supported; use buildTargetId");
    }
    if (body.quickAnalysisId !== undefined) {
      throw new InvalidInputError("quickAnalysisId is no longer supported; use executionId");
    }
  };

  // POST /api/analysis/quick — explicit Quick only
  router.post("/quick", asyncHandler(async (req, res) => {
    const { projectId, buildTargetId } = req.body as {
      projectId?: string;
      buildTargetId?: string;
    };
    rejectLegacyExecutionFields(req.body as Record<string, unknown>);
    if (!projectId) throw new InvalidInputError("projectId is required");
    if (!buildTargetId) throw new InvalidInputError("buildTargetId is required");
    await orchestrator.preflightQuickRequest(projectId, buildTargetId);

    const analysisId = `analysis-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = req.requestId;
    const abortController = analysisTracker.start(analysisId, projectId, {
      buildTargetId,
      executionId: analysisId,
    });

    res.status(202).json({
      success: true,
      data: { analysisId, buildTargetId, executionId: analysisId, status: "running" },
    });

    orchestrator
      .runQuickAnalysis(projectId, analysisId, [buildTargetId], requestId, abortController.signal)
      .then(() => analysisTracker.complete(analysisId))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        analysisTracker.fail(analysisId, msg);
        logger.error({ err, analysisId, buildTargetId, requestId }, "Quick analysis failed");
      });
  }));

  // POST /api/analysis/deep — explicit Deep only, using prior execution context
  router.post("/deep", asyncHandler(async (req, res) => {
    const { projectId, buildTargetId, executionId } = req.body as {
      projectId?: string;
      buildTargetId?: string;
      executionId?: string;
    };
    rejectLegacyExecutionFields(req.body as Record<string, unknown>);
    if (!projectId) throw new InvalidInputError("projectId is required");
    if (!buildTargetId) throw new InvalidInputError("buildTargetId is required");
    if (!executionId) throw new InvalidInputError("executionId is required");
    await orchestrator.preflightDeepRequest(projectId, buildTargetId, executionId);

    const analysisId = `analysis-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = req.requestId;
    const abortController = analysisTracker.start(analysisId, projectId, {
      buildTargetId,
      executionId,
    });

    res.status(202).json({
      success: true,
      data: { analysisId, buildTargetId, executionId, status: "running" },
    });

    orchestrator
      .runDeepAnalysis(projectId, analysisId, buildTargetId, executionId, requestId, abortController.signal)
      .then(() => analysisTracker.complete(analysisId))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        analysisTracker.fail(analysisId, msg);
        logger.error({ err, analysisId, buildTargetId, executionId, requestId }, "Deep analysis failed");
      });
  }));

  // GET /api/analysis/status — 모든 진행 중 분석
  router.get("/status", asyncHandler(async (_req, res) => {
    const all = analysisTracker.getAll();
    res.json({ success: true, data: all });
  }));

  // GET /api/analysis/status/:analysisId — 단일 분석 진행률
  router.get("/status/:analysisId", asyncHandler(async (req, res) => {
    const analysisId = req.params.analysisId as string;
    const progress = analysisTracker.get(analysisId);
    if (!progress) throw new NotFoundError("Analysis not found");
    res.json({ success: true, data: progress });
  }));

  // POST /api/analysis/abort/:analysisId — 분석 중단
  router.post("/abort/:analysisId", asyncHandler(async (req, res) => {
    const analysisId = req.params.analysisId as string;
    const aborted = analysisTracker.abort(analysisId);
    if (!aborted) throw new NotFoundError("Analysis not found or already completed");
    res.json({ success: true, data: { analysisId, status: "aborted" } });
  }));

  // GET /api/analysis/results — 프로젝트별 결과 목록
  router.get("/results", asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string;
    if (!projectId) throw new InvalidInputError("projectId query parameter required");

    const results = analysisResultDAO.findByProjectId(projectId).filter((result) => isVisibleAnalysisArtifact(result));
    res.json({ success: true, data: results });
  }));

  // GET /api/analysis/results/:analysisId — 결과 상세
  router.get("/results/:analysisId", asyncHandler(async (req, res) => {
    const analysisId = req.params.analysisId as string;
    const result = analysisResultDAO.findById(analysisId)
      ?? analysisResultDAO.findById(`deep-${analysisId}`);
    if (!result || !isVisibleAnalysisArtifact(result)) throw new NotFoundError("Analysis result not found");
    res.json({ success: true, data: result });
  }));

  // DELETE /api/analysis/results/:analysisId — 결과 삭제
  router.delete("/results/:analysisId", asyncHandler(async (req, res) => {
    const analysisId = req.params.analysisId as string;
    const deleted = analysisResultDAO.deleteById(analysisId);
    analysisResultDAO.deleteById(`deep-${analysisId}`);
    if (!deleted) throw new NotFoundError("Analysis result not found");
    res.json({ success: true });
  }));

  // GET /api/analysis/summary — 분석 대시보드 요약 (static_analysis + deep_analysis 합산)
  router.get("/summary", asyncHandler(async (req, res) => {
    const projectId = req.query.projectId as string;
    if (!projectId) throw new InvalidInputError("projectId query parameter required");

    const period = (req.query.period as string) ?? "30d";
    const since = periodToDate(period);

    const modules = ["static_analysis", "deep_analysis"] as const;
    const isSummaryModule = (module: string): module is typeof modules[number] =>
      module === "static_analysis" || module === "deep_analysis";
    const visibleFindings = findingDAO.findByProjectId(projectId, { from: since })
      .filter((finding) => isSummaryModule(finding.module))
      .filter((finding) => isVisibleAnalysisArtifact(finding));
    const visibleRuns = runDAO.findByProjectId(projectId)
      .filter((run) => isSummaryModule(run.module))
      .filter((run) => isVisibleAnalysisArtifact(run))
      .filter((run) => !since || run.createdAt >= since);
    const visibleRunIds = new Set(visibleRuns.map((run) => run.id));
    const visibleGateResults = gateResultDAO.findByProjectId(projectId)
      .filter((gate) => visibleRunIds.has(gate.runId))
      .filter((gate) => !since || gate.createdAt >= since);

    const merged = { bySeverity: {} as Record<string, number>, byStatus: {} as Record<string, number>, bySource: {} as Record<string, number>, total: 0 };
    for (const finding of visibleFindings) {
      merged.total += 1;
      merged.bySeverity[finding.severity] = (merged.bySeverity[finding.severity] ?? 0) + 1;
      merged.byStatus[finding.status] = (merged.byStatus[finding.status] ?? 0) + 1;
      merged.bySource[finding.sourceType] = (merged.bySource[finding.sourceType] ?? 0) + 1;
    }

    const fileMap = new Map<string, { findingCount: number; topSeverity: string }>();
    const sevOrder: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
    for (const finding of visibleFindings) {
      if (!finding.location) continue;
      const filePath = finding.location;
      const existing = fileMap.get(filePath);
      if (existing) {
        existing.findingCount += 1;
        if ((sevOrder[finding.severity] ?? 0) > (sevOrder[existing.topSeverity] ?? 0)) {
          existing.topSeverity = finding.severity;
        }
      } else {
        fileMap.set(filePath, { findingCount: 1, topSeverity: finding.severity });
      }
    }
    const topFiles = [...fileMap.entries()]
      .map(([filePath, v]) => ({ filePath, ...v }))
      .sort((a, b) => b.findingCount - a.findingCount)
      .slice(0, 10);

    const ruleCounts = new Map<string, number>();
    for (const finding of visibleFindings) {
      if (finding.module !== "static_analysis" || !finding.ruleId) continue;
      ruleCounts.set(finding.ruleId, (ruleCounts.get(finding.ruleId) ?? 0) + 1);
    }
    const topRules = [...ruleCounts.entries()]
      .map(([ruleId, hitCount]) => ({ ruleId, hitCount }))
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, 10);

    const trendMap = new Map<string, { runCount: number; findingCount: number; gatePassCount: number }>();
    const gateByRunId = new Map(visibleGateResults.map((gate) => [gate.runId, gate]));
    for (const run of visibleRuns) {
      const date = run.createdAt.slice(0, 10);
      const existing = trendMap.get(date);
      const gate = gateByRunId.get(run.id);
      if (existing) {
        existing.runCount += 1;
        existing.findingCount += run.findingCount;
        existing.gatePassCount += gate?.status === "pass" ? 1 : 0;
      } else {
        trendMap.set(date, {
          runCount: 1,
          findingCount: run.findingCount,
          gatePassCount: gate?.status === "pass" ? 1 : 0,
        });
      }
    }
    const trend = [...trendMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const gateStats = {
      total: visibleGateResults.length,
      passed: visibleGateResults.filter((gate) => gate.status === "pass").length,
      failed: visibleGateResults.filter((gate) => gate.status === "fail").length,
      rate: visibleGateResults.length > 0
        ? Number((visibleGateResults.filter((gate) => gate.status === "pass").length / visibleGateResults.length).toFixed(4))
        : 0,
    };

    const unresolvedCount = {
      open: merged.byStatus["open"] ?? 0,
      needsReview: merged.byStatus["needs_review"] ?? 0,
      needsRevalidation: merged.byStatus["needs_revalidation"] ?? 0,
      sandbox: merged.byStatus["sandbox"] ?? 0,
    };

    res.json({
      success: true,
      data: {
        bySeverity: merged.bySeverity,
        byStatus: merged.byStatus,
        bySource: merged.bySource,
        topFiles,
        topRules,
        trend,
        gateStats,
        unresolvedCount,
      },
    });
  }));

  // POST /api/analysis/poc — PoC 생성 요청
  router.post("/poc", asyncHandler(async (req, res) => {
    const { projectId, findingId } = req.body as { projectId?: string; findingId?: string };
    if (!projectId || !findingId) throw new InvalidInputError("projectId and findingId are required");

    const finding = findingDAO.findById(findingId);
    if (!finding || !isVisibleAnalysisArtifact(finding)) throw new NotFoundError(`Finding not found: ${findingId}`);
    if (finding.projectId !== projectId) throw new NotFoundError(`Finding not found: ${findingId}`);

    // location에서 파일 경로 추출 (형식: "path/file.c:123" 또는 "path/file.c")
    const files: Array<{ path: string; content: string }> = [];
    if (finding.location) {
      const colonIdx = finding.location.lastIndexOf(":");
      const filePath = colonIdx > 0 ? finding.location.slice(0, colonIdx) : finding.location;
      try {
        const content = sourceService.readFile(projectId, filePath);
        files.push({ path: filePath, content });
      } catch {
        logger.warn({ findingId, filePath }, "Could not read source file for PoC generation");
      }
    }

    const requestId = req.requestId;
    const taskId = `poc-${crypto.randomUUID().slice(0, 8)}`;

    const projectPath = sourceService.getProjectPath(projectId) ?? undefined;
    const agentResponse = await agentClient.submitTask(
      {
        taskType: "generate-poc",
        taskId,
        context: {
          trusted: {
            objective: `${finding.title} PoC 생성`,
            projectId,
            projectPath,
            claim: {
              statement: finding.description,
              detail: finding.detail,
              location: finding.location,
            },
            files,
          },
        },
        evidenceRefs: [],
      },
      requestId,
    );

    if (agentClient.isSuccess(agentResponse)) {
      res.json({
        success: true,
        data: buildPocResponseData(findingId, agentResponse),
      });
    } else {
      res.status(502).json({
        success: false,
        error: agentResponse.failureDetail,
        errorDetail: {
          code: agentResponse.failureCode,
          message: agentResponse.failureDetail,
          retryable: agentResponse.retryable ?? false,
        },
      });
    }
  }));

  return router;
}

function buildPocResponseData(
  findingId: string,
  agentResponse: Extract<Awaited<ReturnType<AgentClient["submitTask"]>>, { status: "completed" }>,
): PocResponseData {
  const claims = agentResponse.result.claims;
  const poc = claims[0];
  const hasAcceptedPocClaim = Boolean(poc);
  const pocOutcome = resolvePocOutcome(agentResponse.result.pocOutcome, hasAcceptedPocClaim);
  const qualityOutcome = resolveQualityOutcome(agentResponse.result.qualityOutcome, hasAcceptedPocClaim);
  const cleanPass = agentResponse.result.cleanPass
    ?? (pocOutcome === "poc_accepted" && qualityOutcome === "accepted");

  return {
    findingId,
    poc: {
      statement: poc?.statement ?? "",
      detail: poc?.detail ?? "",
    },
    audit: {
      latencyMs: agentResponse.audit.latencyMs,
      tokenUsage: agentResponse.audit.tokenUsage,
    },
    pocOutcome,
    qualityOutcome,
    cleanPass,
    claimDiagnostics: toValidClaimDiagnostics(agentResponse.result.claimDiagnostics),
  };
}

function resolvePocOutcome(
  outcome: AgentPocOutcome | undefined,
  hasAcceptedPocClaim: boolean,
): AgentPocOutcome {
  return outcome ?? (hasAcceptedPocClaim ? "poc_accepted" : "poc_inconclusive");
}

function resolveQualityOutcome(
  outcome: AgentQualityOutcome | undefined,
  hasAcceptedPocClaim: boolean,
): AgentQualityOutcome {
  return outcome ?? (hasAcceptedPocClaim ? "accepted" : "inconclusive");
}

function periodToDate(period: string): string | undefined {
  if (period === "all") return undefined;
  const match = period.match(/^(\d+)d$/);
  if (!match) return undefined;
  const days = Number(match[1]);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
