import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import type { UploadedFile } from "@smartcar/shared";
import { StaticAnalysisService } from "../services/static-analysis.service";
import { fileStore } from "../dao/file-store";
import { analysisResultDAO } from "../dao/analysis-result.dao";

const ALLOWED_EXTENSIONS = [
  ".c", ".cpp", ".h", ".hpp", ".py", ".java", ".js", ".ts",
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
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".py": "python",
    ".java": "java",
    ".js": "javascript",
    ".ts": "typescript",
  };
  return map[ext.toLowerCase()] ?? "unknown";
}

export function createStaticAnalysisRouter(
  service: StaticAnalysisService
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
    try { if (pathsRaw) paths = JSON.parse(pathsRaw); } catch {}

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

  // P0-2: 정적 분석 실행
  router.post("/run", async (req, res) => {
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

    try {
      const result = await service.runAnalysis(
        projectId,
        files.map((f) => f.id),
        analysisId
      );
      res.json({ success: true, data: result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ success: false, error: message });
    }
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
