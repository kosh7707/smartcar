import { Router, type Request } from "express";
import type { AnalysisModule, FindingStatus, Severity } from "@smartcar/shared";
import { ReportService, type ReportFilters } from "../services/report.service";

const MODULE_MAP: Record<string, AnalysisModule> = {
  static: "static_analysis",
  dynamic: "dynamic_analysis",
  test: "dynamic_testing",
};

function parseFilters(query: Record<string, any>): ReportFilters | undefined {
  const filters: ReportFilters = {};
  let hasFilter = false;

  if (typeof query.severity === "string") {
    filters.severity = query.severity.split(",") as Severity[];
    hasFilter = true;
  }
  if (typeof query.status === "string") {
    filters.status = query.status.split(",") as FindingStatus[];
    hasFilter = true;
  }
  if (typeof query.runId === "string") {
    filters.runId = query.runId;
    hasFilter = true;
  }
  if (typeof query.from === "string") {
    filters.from = query.from;
    hasFilter = true;
  }
  if (typeof query.to === "string") {
    filters.to = query.to;
    hasFilter = true;
  }

  return hasFilter ? filters : undefined;
}

export function createReportRouter(service: ReportService): Router {
  const router = Router({ mergeParams: true });

  // GET / — 프로젝트 전체 보고서
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const filters = parseFilters(req.query);
    const report = service.generateProjectReport(pid, filters);
    if (!report) {
      res.status(404).json({ success: false, error: "Project not found" });
      return;
    }
    res.json({ success: true, data: report });
  });

  // GET /static, /dynamic, /test — 모듈별 보고서
  for (const [path, module] of Object.entries(MODULE_MAP)) {
    router.get(`/${path}`, (req: Request<{ pid: string }>, res) => {
      const pid = req.params.pid;
      const filters = parseFilters(req.query);
      const report = service.generateModuleReport(pid, module, filters);
      if (!report) {
        res.status(404).json({ success: false, error: "Project not found" });
        return;
      }
      res.json({ success: true, data: report });
    });
  }

  return router;
}
