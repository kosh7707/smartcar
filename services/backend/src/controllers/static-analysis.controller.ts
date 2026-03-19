import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import type { UploadedFile } from "@aegis/shared";
import { StaticAnalysisService } from "../services/static-analysis.service";
import type { IFileStore, IAnalysisResultDAO, IFindingDAO, IRunDAO, IGateResultDAO } from "../dao/interfaces";
import { createLogger } from "../lib/logger";
import { asyncHandler } from "../middleware/async-handler";
import { analysisTracker } from "../services/analysis-tracker";

const logger = createLogger("static-analysis-controller");

const ALLOWED_EXTENSIONS = [
  ".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hh", ".hxx",
];

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function detectLanguage(ext: string): string {
  const map: Record<string, string> = {
    ".c": "c",
    ".h": "c-or-cpp",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
    ".hpp": "cpp",
    ".hh": "cpp",
    ".hxx": "cpp",
  };
  return map[ext.toLowerCase()] ?? "unknown";
}

export function createStaticAnalysisRouter(
  service: StaticAnalysisService,
  fileStore: IFileStore,
  analysisResultDAO: IAnalysisResultDAO,
  findingDAO: IFindingDAO,
  runDAO: IRunDAO,
  gateResultDAO: IGateResultDAO,
): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage() });

  // P0-1: 파일 업로드
  router.post("/upload", upload.array("files"), (req, res) => {
    const files = (req as any).files as MulterFile[] | undefined;
    const projectId = (req.body?.projectId as string) ?? "";
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: "No files provided" });
      return;
    }

    const pathsRaw = req.body?.paths as string | undefined;
    let paths: string[] = [];
    try {
      if (pathsRaw) paths = JSON.parse(pathsRaw);
    } catch (err) {
      logger.warn({ err }, "Failed to parse paths field");
    }

    const uploaded: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // multer는 multipart 헤더의 filename을 latin1로 해석 → UTF-8로 복원
      const originalName = Buffer.from(file.originalname, "latin1").toString("utf-8");
      const dotIdx = originalName.lastIndexOf(".");
      const ext = dotIdx >= 0 ? originalName.substring(dotIdx) : "";
      if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) continue;

      const id = `file-${crypto.randomUUID()}`;
      const language = detectLanguage(ext);
      const filePath = paths[i] || originalName;

      fileStore.save({
        id,
        projectId,
        name: originalName,
        path: filePath,
        size: file.size,
        content: file.buffer.toString("utf-8"),
        language,
      });

      uploaded.push({ id, name: originalName, size: file.size, language, projectId, path: filePath });
    }

    if (uploaded.length === 0) {
      res
        .status(400)
        .json({ success: false, error: "No supported files found" });
      return;
    }

    res.json({ success: true, data: uploaded });
  });

  // P0-2: 정적 분석 실행 (비동기 기본, ?sync=true 시 동기)
  router.post("/run", asyncHandler(async (req, res) => {
    const { projectId, files, analysisId } = req.body as {
      projectId?: string;
      files?: Array<{ id: string }>;
      analysisId?: string;
    };
    if (!projectId) {
      res.status(400).json({ success: false, error: "projectId is required" });
      return;
    }
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: "No files specified" });
      return;
    }

    const sync = req.query.sync === "true";
    const id = analysisId ?? `analysis-${crypto.randomUUID()}`;
    const fileIds = files.map((f) => f.id);

    if (sync) {
      // 동기 모드 (하위 호환)
      const result = await service.runAnalysis(projectId, fileIds, id, req.requestId);
      res.json({ success: true, data: result });
      return;
    }

    // 비동기 모드
    let abortController: AbortController;
    try {
      abortController = analysisTracker.start(id, projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(409).json({ success: false, error: message });
      return;
    }

    res.status(202).json({ success: true, data: { analysisId: id, status: "running" } });

    // 백그라운드 실행
    service.runAnalysis(projectId, fileIds, id, req.requestId, abortController.signal)
      .then(() => {
        analysisTracker.complete(id);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") {
          // abort()로 중단된 경우 — tracker는 이미 aborted 상태
          return;
        }
        const message = err instanceof Error ? err.message : "Unknown error";
        analysisTracker.fail(id, message);
        logger.error({ err, analysisId: id }, "Async analysis failed");
      });
  }));

  // 전체 분석 현황 목록
  router.get("/status", (req, res) => {
    const entries = analysisTracker.getAll();
    res.json({ success: true, data: entries });
  });

  // 단건 분석 진행률
  router.get("/status/:analysisId", (req, res) => {
    const entry = analysisTracker.get(req.params.analysisId);
    if (!entry) {
      res.status(404).json({ success: false, error: "Analysis not found" });
      return;
    }
    res.json({ success: true, data: entry });
  });

  // 분석 중단
  router.post("/abort/:analysisId", (req, res) => {
    const ok = analysisTracker.abort(req.params.analysisId);
    if (!ok) {
      res.status(404).json({ success: false, error: "No running analysis found with this ID" });
      return;
    }
    res.json({ success: true, data: { analysisId: req.params.analysisId, status: "aborted" } });
  });

  // 대시보드 집계
  router.get("/summary", (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ success: false, error: "projectId query is required" });
      return;
    }
    const period = (req.query.period as string) ?? "30d";
    const since = periodToDate(period);

    const dist = findingDAO.summaryByModule(projectId, "static_analysis", since);
    const topFiles = findingDAO.topFilesByModule(projectId, "static_analysis", 10, since);
    const topRules = findingDAO.topRulesByModule(projectId, "static_analysis", 10, since);
    const trend = runDAO.trendByModule(projectId, "static_analysis", since);
    const gateStats = gateResultDAO.statsByProject(projectId, since);

    const unresolvedCount = {
      open: (dist.byStatus["open"] ?? 0),
      needsReview: (dist.byStatus["needs_review"] ?? 0),
      needsRevalidation: (dist.byStatus["needs_revalidation"] ?? 0),
      sandbox: (dist.byStatus["sandbox"] ?? 0),
    };

    res.json({
      success: true,
      data: {
        bySeverity: dist.bySeverity,
        byStatus: dist.byStatus,
        bySource: dist.bySource,
        topFiles,
        topRules,
        trend,
        gateStats,
        unresolvedCount,
      },
    });
  });

  // 분석 결과 목록 (프로젝트별)
  router.get("/results", (req, res) => {
    const projectId = req.query.projectId as string | undefined;
    if (!projectId) {
      res.status(400).json({ success: false, error: "projectId query is required" });
      return;
    }
    const results = analysisResultDAO.findByProjectId(projectId);
    res.json({ success: true, data: results });
  });

  // P0-5: 분석 결과 조회
  router.get("/results/:analysisId", (req, res) => {
    const result = analysisResultDAO.findById(req.params.analysisId);
    if (!result) {
      res.status(404).json({ success: false, error: "Analysis not found" });
      return;
    }
    res.json({ success: true, data: result });
  });

  // 분석 결과 삭제
  router.delete("/results/:analysisId", (req, res) => {
    const deleted = analysisResultDAO.deleteById(req.params.analysisId);
    if (!deleted) {
      res.status(404).json({ success: false, error: "Analysis result not found" });
      return;
    }
    res.json({ success: true });
  });

  // P0-6: 보고서 데이터 생성
  router.get("/report/:analysisId", (req, res) => {
    const result = analysisResultDAO.findById(req.params.analysisId);
    if (!result) {
      res.status(404).json({ success: false, error: "Analysis not found" });
      return;
    }
    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        analysisId: result.id,
        module: result.module,
        analyzedAt: result.createdAt,
        summary: result.summary,
        vulnerabilities: result.vulnerabilities,
      },
    });
  });

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
