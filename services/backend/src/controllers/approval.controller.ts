import { Router } from "express";
import type { Request } from "express";
import { asyncHandler } from "../middleware/async-handler";
import type { ApprovalService } from "../services/approval.service";
import type { ApprovalStatus } from "@aegis/shared";

/** 프로젝트 스코프: /api/projects/:pid/approvals */
export function createApprovalRouter(service: ApprovalService): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트의 승인 대기 카운트
  router.get("/count", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    const data = service.getCountByProjectId(req.params.pid);
    res.json({ success: true, data });
  }));

  // 프로젝트의 승인 요청 목록 (?status=pending)
  router.get("/", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    const status = req.query.status as ApprovalStatus | undefined;
    const requests = status === "pending"
      ? service.getPending(req.params.pid)
      : service.getByProjectId(req.params.pid);
    res.json({ success: true, data: requests });
  }));

  return router;
}

/** 글로벌 스코프: /api/approvals */
export function createApprovalDetailRouter(service: ApprovalService): Router {
  const router = Router();

  // 승인 요청 상세
  router.get("/:id", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const request = service.getById(req.params.id);
    if (!request) {
      res.status(404).json({ success: false, error: "Approval not found" });
      return;
    }
    res.json({ success: true, data: request });
  }));

  // 승인/거절 결정
  router.post("/:id/decide", asyncHandler(async (req: Request<{ id: string }>, res) => {
    const { decision, comment, actor } = req.body;
    if (!decision || !["approved", "rejected"].includes(decision)) {
      res.status(400).json({ success: false, error: "decision must be 'approved' or 'rejected'" });
      return;
    }

    const requestId = req.requestId;
    const result = service.decide(
      req.params.id,
      decision,
      actor ?? "analyst",
      comment,
      requestId
    );
    res.json({ success: true, data: result });
  }));

  return router;
}
