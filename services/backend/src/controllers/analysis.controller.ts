import { Router } from "express";
import crypto from "crypto";
import type { AnalysisOrchestrator } from "../services/analysis-orchestrator";
import type { IAnalysisResultDAO, IFindingDAO, IRunDAO, IGateResultDAO } from "../dao/interfaces";
import type { AnalysisTracker } from "../services/analysis-tracker";
import type { AgentClient } from "../services/agent-client";
import type { ProjectSourceService } from "../services/project-source.service";
import { asyncHandler } from "../middleware/async-handler";
import { InvalidInputError, NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";

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

  // POST /api/analysis/run — Quick → Deep 분석 실행
  router.post("/run", asyncHandler(async (req, res) => {
    const { projectId, targetIds, mode } = req.body as {
      projectId?: string;
      targetIds?: string[];
      mode?: string;
    };
    if (!projectId) throw new InvalidInputError("projectId is required");

    // mode 검증 (생략 시 기존 동작 유지)
    if (mode !== undefined) {
      if (mode !== "full" && mode !== "subproject") {
        throw new InvalidInputError('mode must be "full" or "subproject"');
      }
      if (mode === "subproject" && (!targetIds || targetIds.length === 0)) {
        throw new InvalidInputError("targetIds is required when mode is 'subproject'");
      }
      if (mode === "full" && targetIds && targetIds.length > 0) {
        throw new InvalidInputError("targetIds must be empty when mode is 'full'");
      }
    }

    const analysisId = `analysis-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = req.requestId;

    // Async 실행 (항상 비동기)
    const abortController = analysisTracker.start(analysisId, projectId);

    res.status(202).json({
      success: true,
      data: { analysisId, status: "running" },
    });

    orchestrator
      .runAnalysis(projectId, analysisId, targetIds, requestId, abortController.signal)
      .then(() => analysisTracker.complete(analysisId))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Unknown error";
        analysisTracker.fail(analysisId, msg);
        logger.error({ err, analysisId, requestId }, "Analysis failed");
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

    const results = analysisResultDAO.findByProjectId(projectId);
    res.json({ success: true, data: results });
  }));

  // GET /api/analysis/results/:analysisId — 결과 상세
  router.get("/results/:analysisId", asyncHandler(async (req, res) => {
    const analysisId = req.params.analysisId as string;
    const result = analysisResultDAO.findById(analysisId)
      ?? analysisResultDAO.findById(`deep-${analysisId}`);
    if (!result) throw new NotFoundError("Analysis result not found");
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

    // 모듈별 집계 후 합산
    const merged = { bySeverity: {} as Record<string, number>, byStatus: {} as Record<string, number>, bySource: {} as Record<string, number>, total: 0 };
    for (const mod of modules) {
      const dist = findingDAO.summaryByModule(projectId, mod, since);
      merged.total += dist.total;
      for (const [k, v] of Object.entries(dist.bySeverity)) merged.bySeverity[k] = (merged.bySeverity[k] ?? 0) + v;
      for (const [k, v] of Object.entries(dist.byStatus)) merged.byStatus[k] = (merged.byStatus[k] ?? 0) + v;
      for (const [k, v] of Object.entries(dist.bySource)) merged.bySource[k] = (merged.bySource[k] ?? 0) + v;
    }

    // topFiles — 두 모듈 합산 후 상위 10개
    const allFiles = modules.flatMap((mod) => findingDAO.topFilesByModule(projectId, mod, 20, since));
    const fileMap = new Map<string, { findingCount: number; topSeverity: string }>();
    const sevOrder: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
    for (const f of allFiles) {
      const existing = fileMap.get(f.filePath);
      if (existing) {
        existing.findingCount += f.findingCount;
        if ((sevOrder[f.topSeverity] ?? 0) > (sevOrder[existing.topSeverity] ?? 0)) existing.topSeverity = f.topSeverity;
      } else {
        fileMap.set(f.filePath, { findingCount: f.findingCount, topSeverity: f.topSeverity });
      }
    }
    const topFiles = [...fileMap.entries()]
      .map(([filePath, v]) => ({ filePath, ...v }))
      .sort((a, b) => b.findingCount - a.findingCount)
      .slice(0, 10);

    // topRules — static_analysis만 (deep_analysis는 ruleId 없음)
    const topRules = findingDAO.topRulesByModule(projectId, "static_analysis", 10, since);

    // trend — 두 모듈 합산
    const allTrend = modules.flatMap((mod) => runDAO.trendByModule(projectId, mod, since));
    const trendMap = new Map<string, { runCount: number; findingCount: number; gatePassCount: number }>();
    for (const t of allTrend) {
      const existing = trendMap.get(t.date);
      if (existing) {
        existing.runCount += t.runCount;
        existing.findingCount += t.findingCount;
        existing.gatePassCount += t.gatePassCount;
      } else {
        trendMap.set(t.date, { runCount: t.runCount, findingCount: t.findingCount, gatePassCount: t.gatePassCount });
      }
    }
    const trend = [...trendMap.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const gateStats = gateResultDAO.statsByProject(projectId, since);

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
    if (!finding) throw new NotFoundError(`Finding not found: ${findingId}`);
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
      const claims = agentResponse.result.claims;
      if (claims.length === 0) {
        res.json({ success: true, data: { findingId, poc: { statement: "", detail: "" }, audit: { latencyMs: agentResponse.audit.latencyMs } } });
        return;
      }
      const poc = claims[0];
      res.json({
        success: true,
        data: {
          findingId,
          poc: {
            statement: poc.statement,
            detail: poc.detail ?? "",
          },
          audit: {
            latencyMs: agentResponse.audit.latencyMs,
            tokenUsage: agentResponse.audit.tokenUsage,
          },
        },
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

function periodToDate(period: string): string | undefined {
  if (period === "all") return undefined;
  const match = period.match(/^(\d+)d$/);
  if (!match) return undefined;
  const days = Number(match[1]);
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}
