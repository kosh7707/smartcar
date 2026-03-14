import { Router } from "express";
import type { Request } from "express";
import { asyncHandler } from "../middleware/async-handler";
import type { QualityGateService } from "../services/quality-gate.service";
import type { ApprovalService } from "../services/approval.service";

/** 프로젝트 스코프: /api/projects/:pid/gates */
export function createQualityGateRouter(service: QualityGateService): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트의 모든 gate 결과 목록
  router.get("/", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    const results = service.getByProjectId(req.params.pid);
    res.json({ success: true, data: results });
  }));

  // 특정 Run의 gate 결과
  router.get("/runs/:runId", asyncHandler(async (req: Request<{ pid: string; runId: string }>, res) => {
    const result = service.getByRunId(req.params.runId);
    if (!result) {
      res.status(404).json({ success: false, error: "Gate result not found for this run" });
      return;
    }
    res.json({ success: true, data: result });
  }));

  return router;
}

/** 글로벌 스코프: /api/gates */
export function createQualityGateDetailRouter(
  service: QualityGateService,
  approvalService: ApprovalService
): Router {
  const router = Router();

  // gate 결과 상세
  router.get("/:id", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const result = service.getById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, error: "Gate result not found" });
      return;
    }
    res.json({ success: true, data: result });
  }));

  // gate override 요청 → approval 생성
  router.post("/:id/override", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const { reason, actor } = req.body;
    if (!reason) {
      res.status(400).json({ success: false, error: "reason is required" });
      return;
    }

    const gate = service.getById(req.params.id);
    if (!gate) {
      res.status(404).json({ success: false, error: "Gate result not found" });
      return;
    }

    if (gate.override) {
      res.status(409).json({ success: false, error: "Gate is already overridden" });
      return;
    }

    if (gate.status === "pass") {
      res.status(400).json({ success: false, error: "Gate already passed — override not needed" });
      return;
    }

    const approval = approvalService.createRequest(
      "gate.override",
      gate.id,
      gate.projectId,
      reason,
      actor
    );

    res.status(201).json({ success: true, data: approval });
  }));

  return router;
}
