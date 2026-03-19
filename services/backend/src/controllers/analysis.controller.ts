import { Router } from "express";
import crypto from "crypto";
import type { AnalysisOrchestrator } from "../services/analysis-orchestrator";
import type { IAnalysisResultDAO } from "../dao/interfaces";
import type { AnalysisTracker } from "../services/analysis-tracker";
import { asyncHandler } from "../middleware/async-handler";
import { InvalidInputError, NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("analysis-controller");

export function createAnalysisRouter(
  orchestrator: AnalysisOrchestrator,
  analysisResultDAO: IAnalysisResultDAO,
  analysisTracker: AnalysisTracker,
): Router {
  const router = Router();

  // POST /api/analysis/run — Quick → Deep 분석 실행
  router.post("/run", asyncHandler(async (req, res) => {
    const { projectId } = req.body as { projectId?: string };
    if (!projectId) throw new InvalidInputError("projectId is required");

    const analysisId = `analysis-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = req.requestId;

    // Async 실행 (항상 비동기)
    const abortController = analysisTracker.start(analysisId, projectId);

    res.status(202).json({
      success: true,
      data: { analysisId, status: "running" },
    });

    orchestrator
      .runAnalysis(projectId, analysisId, requestId, abortController.signal)
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

  return router;
}
