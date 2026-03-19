import { Router, type Request } from "express";
import type { FindingStatus, Severity, AnalysisModule } from "@aegis/shared";
import type { FindingService } from "../services/finding.service";

export function createFindingRouter(findingService: FindingService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/findings — Finding 목록
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const filters: { status?: FindingStatus; severity?: Severity; module?: AnalysisModule } = {};
    if (req.query.status) filters.status = req.query.status as FindingStatus;
    if (req.query.severity) filters.severity = req.query.severity as Severity;
    if (req.query.module) filters.module = req.query.module as AnalysisModule;

    const findings = findingService.findByProjectId(pid, filters);
    res.json({ success: true, data: findings });
  });

  // GET /api/projects/:pid/findings/summary — 집계
  router.get("/summary", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const summary = findingService.getSummary(pid);
    res.json({ success: true, data: summary });
  });

  return router;
}

export function createFindingDetailRouter(findingService: FindingService): Router {
  const router = Router();

  // GET /api/findings/:id — Finding 상세 (evidenceRefs + auditLog 포함)
  router.get("/:id", (req, res) => {
    const finding = findingService.findById(req.params.id);
    if (!finding) {
      res.status(404).json({ success: false, error: "Finding not found" });
      return;
    }
    res.json({ success: true, data: finding });
  });

  // PATCH /api/findings/:id/status — 상태 변경
  router.patch("/:id/status", (req, res) => {
    const { status, reason, actor } = req.body as {
      status?: FindingStatus;
      reason?: string;
      actor?: string;
    };

    if (!status || !reason) {
      res.status(400).json({ success: false, error: "status and reason are required" });
      return;
    }

    const requestId = (req as any).requestId;
    const updated = findingService.updateStatus(
      req.params.id,
      status,
      actor ?? "system",
      reason,
      requestId
    );
    res.json({ success: true, data: updated });
  });

  return router;
}
