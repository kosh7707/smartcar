import crypto from "crypto";
import { Router } from "express";
import type { PipelineOrchestrator } from "../services/pipeline-orchestrator";
import type { IBuildTargetDAO, IProjectDAO } from "../dao/interfaces";
import { asyncHandler } from "../middleware/async-handler";
import { InvalidInputError, NotFoundError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("pipeline-controller");

function validateProjectId(pid: string): void {
  if (!pid || !/^[\w-]+$/.test(pid)) {
    throw new InvalidInputError("Invalid project ID format");
  }
}

export function createPipelineRouter(
  orchestrator: PipelineOrchestrator,
  projectDAO: IProjectDAO,
  buildTargetDAO: IBuildTargetDAO,
): Router {
  const router = Router({ mergeParams: true });

  // POST /api/projects/:pid/pipeline/run — 전체 파이프라인 실행 (202)
  router.post("/run", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const { targetIds } = req.body as { targetIds?: string[] };
    const pipelineId = `pipe-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = req.requestId;

    res.status(202).json({
      success: true,
      data: { pipelineId, status: "running" },
    });

    orchestrator
      .runPipeline(pid, targetIds, requestId, undefined, pipelineId)
      .catch((err) => {
        logger.error({ err, pipelineId, pid, requestId }, "Pipeline failed");
      });
  }));

  // POST /api/projects/:pid/pipeline/prepare — explicit build-preparation only (202)
  router.post("/prepare", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const { targetIds } = req.body as { targetIds?: string[] };
    const preparationId = `prep-${crypto.randomUUID().slice(0, 8)}`;
    const requestId = req.requestId;

    res.status(202).json({
      success: true,
      data: { preparationId, status: "running" },
    });

    orchestrator
      .preparePipeline(pid, targetIds, requestId, undefined, preparationId)
      .catch((err) => {
        logger.error({ err, preparationId, pid, requestId }, "Build preparation failed");
      });
  }));

  // POST /api/projects/:pid/pipeline/run/:targetId — 개별 재실행 (202)
  router.post("/run/:targetId", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const targetId = req.params.targetId as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const target = buildTargetDAO.findById(targetId);
    if (!target || target.projectId !== pid) throw new NotFoundError(`Build target not found: ${targetId}`);

    // 실패 상태에서 discovered로 리셋 (resolve부터 재실행)
    if (target.status.endsWith("_failed")) {
      buildTargetDAO.updatePipelineState(targetId, { status: "discovered" });
    }

    const requestId = req.requestId;
    const pipelineId = `pipe-${crypto.randomUUID().slice(0, 8)}`;

    res.status(202).json({
      success: true,
      data: { pipelineId, targetId, status: "running" },
    });

    orchestrator
      .runPipeline(pid, [targetId], requestId, undefined, pipelineId)
      .catch((err) => {
        logger.error({ err, pipelineId, targetId, pid, requestId }, "Pipeline target re-run failed");
      });
  }));

  // POST /api/projects/:pid/pipeline/prepare/:targetId — explicit single-target build-preparation only (202)
  router.post("/prepare/:targetId", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    const targetId = req.params.targetId as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const target = buildTargetDAO.findById(targetId);
    if (!target || target.projectId !== pid) throw new NotFoundError(`Build target not found: ${targetId}`);

    if (target.status.endsWith("_failed")) {
      buildTargetDAO.updatePipelineState(targetId, { status: "discovered" });
    }

    const requestId = req.requestId;
    const preparationId = `prep-${crypto.randomUUID().slice(0, 8)}`;

    res.status(202).json({
      success: true,
      data: { preparationId, targetId, status: "running" },
    });

    orchestrator
      .preparePipeline(pid, [targetId], requestId, undefined, preparationId)
      .catch((err) => {
        logger.error({ err, preparationId, targetId, pid, requestId }, "Build preparation target failed");
      });
  }));

  // GET /api/projects/:pid/pipeline/status — 전체 상태
  router.get("/status", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const targets = buildTargetDAO.findByProjectId(pid);
    const readyCount = targets.filter((t) => t.status === "ready").length;
    const failedCount = targets.filter((t) => t.status.endsWith("_failed")).length;

    res.json({
      success: true,
      data: {
        targets: targets.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          phase: ["discovered", "resolving", "configured", "resolve_failed"].includes(t.status) ? "setup"
            : t.status === "ready" ? "ready" : "build",
          compileCommandsPath: t.compileCommandsPath,
          sastScanId: t.sastScanId,
          codeGraphNodeCount: t.codeGraphNodeCount,
          lastBuiltAt: t.lastBuiltAt,
        })),
        readyCount,
        failedCount,
        totalCount: targets.length,
      },
    });
  }));

  return router;
}
