import { Router, type Request } from "express";
import type { FindingStatus, Severity, AnalysisModule } from "@aegis/shared";
import type { FindingService } from "../services/finding.service";
import type { FindingFilters } from "../dao/interfaces";
import { InvalidInputError } from "../lib/errors";

const VALID_STATUSES = new Set<string>(["open","needs_review","accepted_risk","false_positive","fixed","needs_revalidation","sandbox"]);
const VALID_SEVERITIES = new Set<string>(["critical","high","medium","low","info"]);
const VALID_SORT_FIELDS = new Set<string>(["severity","createdAt","location"]);
const VALID_ORDERS = new Set<string>(["asc","desc"]);

export function createFindingRouter(findingService: FindingService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/findings — Finding 목록
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const filters: FindingFilters = {};
    if (req.query.status) {
      const s = req.query.status as string;
      if (!VALID_STATUSES.has(s)) throw new InvalidInputError(`Invalid status: ${s}`);
      filters.status = s as FindingStatus;
    }
    if (req.query.severity) {
      const s = req.query.severity as string;
      if (!VALID_SEVERITIES.has(s)) throw new InvalidInputError(`Invalid severity: ${s}`);
      filters.severity = s as Severity;
    }
    if (req.query.module) filters.module = req.query.module as AnalysisModule;
    if (req.query.sourceType) filters.sourceType = req.query.sourceType as string;
    if (req.query.q) filters.q = req.query.q as string;
    if (req.query.sort) {
      const s = req.query.sort as string;
      if (!VALID_SORT_FIELDS.has(s)) throw new InvalidInputError(`Invalid sort field: ${s}`);
      filters.sort = s as FindingFilters["sort"];
    }
    if (req.query.order) {
      const s = req.query.order as string;
      if (!VALID_ORDERS.has(s)) throw new InvalidInputError(`Invalid order: ${s}`);
      filters.order = s as FindingFilters["order"];
    }

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

  // PATCH /api/findings/bulk-status — 벌크 상태 변경
  router.patch("/bulk-status", (req, res) => {
    const { findingIds, status, reason, actor } = req.body as {
      findingIds?: string[];
      status?: FindingStatus;
      reason?: string;
      actor?: string;
    };

    if (!Array.isArray(findingIds) || findingIds.length === 0) {
      throw new InvalidInputError("findingIds must be a non-empty array");
    }
    if (findingIds.length > 100) {
      throw new InvalidInputError("findingIds cannot exceed 100 items");
    }
    if (!status || !reason) {
      throw new InvalidInputError("status and reason are required");
    }

    const requestId = (req as any).requestId;
    const result = findingService.bulkUpdateStatus(findingIds, status, actor ?? "system", reason, requestId);
    res.json({ success: true, data: result });
  });

  // GET /api/findings/:id/history — fingerprint 이력
  router.get("/:id/history", (req, res) => {
    const history = findingService.getHistory(req.params.id);
    if (history === undefined) {
      res.status(404).json({ success: false, error: "Finding not found" });
      return;
    }
    res.json({ success: true, data: history });
  });

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
