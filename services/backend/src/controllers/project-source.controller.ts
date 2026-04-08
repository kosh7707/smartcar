import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import type { WsUploadMessage } from "@aegis/shared";
import type { ProjectSourceService } from "../services/project-source.service";
import type { IProjectDAO } from "../dao/interfaces";
import type { WsBroadcaster } from "../services/ws-broadcaster";
import type { NotificationService } from "../services/notification.service";
import { asyncHandler } from "../middleware/async-handler";
import { NotFoundError, InvalidInputError } from "../lib/errors";
import { createLogger } from "../lib/logger";

const logger = createLogger("project-source-controller");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

const ARCHIVE_EXTENSIONS = new Set([".zip", ".gz", ".tgz", ".bz2", ".tar"]);

function isArchive(buffer: Buffer, filename?: string): boolean {
  if (buffer.length >= 4) {
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return true;
    if (buffer[0] === 0x1F && buffer[1] === 0x8B) return true;
    if (buffer[0] === 0x42 && buffer[1] === 0x5A) return true;
    if (buffer.length > 262 && buffer.toString("ascii", 257, 262) === "ustar") return true;
  }
  if (filename) {
    const lower = filename.toLowerCase();
    for (const ext of ARCHIVE_EXTENSIONS) {
      if (lower.endsWith(ext)) return true;
    }
  }
  return false;
}

function validateProjectId(pid: string): void {
  if (!pid || !/^[\w-]+$/.test(pid)) {
    throw new InvalidInputError("Invalid project ID format");
  }
}

export function createProjectSourceRouter(
  sourceService: ProjectSourceService,
  projectDAO: IProjectDAO,
  uploadWs?: WsBroadcaster<WsUploadMessage>,
  buildTargetDAO?: import("../dao/interfaces").IBuildTargetDAO,
  notificationService?: NotificationService,
): Router {
  const router = Router({ mergeParams: true });

  // POST /api/projects/:pid/source/upload — 비동기 통합 업로드 (202 + WS 이벤트)
  router.post("/upload", upload.array("file", 200), asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      throw new InvalidInputError("No file uploaded. Send archive (ZIP/tar.gz) or source files as 'file'");
    }

    const uploadId = `upload-${crypto.randomUUID().slice(0, 8)}`;

    // 즉시 202 반환
    res.status(202).json({
      success: true,
      data: { uploadId, status: "received" },
    });

    // 백그라운드 처리
    processUpload(pid, uploadId, uploadedFiles, sourceService, uploadWs, notificationService).catch((err) => {
      logger.error({ err, uploadId, pid }, "Upload processing failed");
    });
  }));

  // GET /api/projects/:pid/source/upload-status/:uploadId — 폴링 폴백
  router.get("/upload-status/:uploadId", asyncHandler(async (req, res) => {
    // WS가 메인이지만, 폴링 폴백으로 마지막 상태를 반환
    // uploadTracker에서 조회 (간단한 인메모리 맵)
    const status = uploadStatusMap.get(req.params.uploadId as string);
    if (!status) throw new NotFoundError("Upload not found");
    res.json({ success: true, data: status });
  }));

  // POST /api/projects/:pid/source/clone — Git clone
  router.post("/clone", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const { gitUrl, branch } = req.body as { gitUrl?: string; branch?: string };
    if (!gitUrl) throw new InvalidInputError("gitUrl is required");

    const projectPath = await sourceService.cloneGit(pid, gitUrl, branch);
    const files = sourceService.listFiles(pid);

    res.json({
      success: true,
      data: { projectPath, fileCount: files.length, files: files.slice(0, 100) },
    });
  }));

  // GET /api/projects/:pid/source/files — 파일 트리
  // ?filter=source → 분석 대상(C/C++)만, 기본(없음) → 전체 파일
  router.get("/files", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const filter = req.query.filter as string | undefined;
    const files = filter === "source"
      ? sourceService.listFiles(pid)          // C/C++ 기본 필터
      : sourceService.listFiles(pid, null);   // 전체 파일
    const { composition, totalFiles, totalSize } = sourceService.computeComposition(pid);

    // 파일→타겟 매핑: 각 파일이 어느 BuildTarget에 속하는지 표시
    let targetMapping: Record<string, { targetId: string; targetName: string }> | undefined;
    if (buildTargetDAO) {
      const targets = buildTargetDAO.findByProjectId(pid);
      if (targets.length > 0) {
        targetMapping = {};
        for (const file of files) {
          const relativePath = file.relativePath;
          for (const t of targets) {
            if (relativePath.startsWith(t.relativePath)) {
              targetMapping[relativePath] = { targetId: t.id, targetName: t.name };
              break;
            }
          }
        }
      }
    }

    res.json({ success: true, data: files, composition, totalFiles, totalSize, targetMapping });
  }));

  // GET /api/projects/:pid/source/file — 파일 내용 읽기
  router.get("/file", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    const filePath = req.query.path as string;
    if (!filePath) throw new InvalidInputError("path query parameter required");

    const content = sourceService.readFile(pid, filePath);
    const meta = sourceService.getFileMetadata(pid, filePath);
    res.json({ success: true, data: { path: filePath, content, ...meta } });
  }));

  // DELETE /api/projects/:pid/source — 소스 삭제
  router.delete("/", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    sourceService.deleteSource(pid);
    res.json({ success: true });
  }));

  return router;
}

// ── 업로드 상태 추적 (인메모리) ──

interface UploadStatus {
  uploadId: string;
  phase: string;
  message: string;
  fileCount?: number;
  projectPath?: string;
  error?: string;
}

const uploadStatusMap = new Map<string, UploadStatus>();

function setUploadStatus(uploadId: string, status: UploadStatus): void {
  uploadStatusMap.set(uploadId, status);
  // 30분 후 정리
  setTimeout(() => uploadStatusMap.delete(uploadId), 30 * 60 * 1000);
}

async function processUpload(
  pid: string,
  uploadId: string,
  uploadedFiles: Express.Multer.File[],
  sourceService: ProjectSourceService,
  ws?: WsBroadcaster<WsUploadMessage>,
  notificationService?: NotificationService,
): Promise<void> {
  const broadcast = (msg: WsUploadMessage) => {
    ws?.broadcast(uploadId, msg);
  };

  try {
    // Phase: received
    broadcast({
      type: "upload-progress",
      payload: { uploadId, phase: "received", message: `파일 ${uploadedFiles.length}개 수신 완료` },
    });
    setUploadStatus(uploadId, { uploadId, phase: "received", message: "수신 완료" });

    let projectPath: string;
    let mode: string;

    if (uploadedFiles.length === 1 && isArchive(uploadedFiles[0].buffer, uploadedFiles[0].originalname)) {
      // Phase: extracting (아카이브)
      broadcast({
        type: "upload-progress",
        payload: { uploadId, phase: "extracting", message: "아카이브 추출 중..." },
      });
      setUploadStatus(uploadId, { uploadId, phase: "extracting", message: "추출 중" });

      const f = uploadedFiles[0];
      const originalName = f.originalname
        ? Buffer.from(f.originalname, "latin1").toString("utf-8")
        : undefined;
      projectPath = await sourceService.extractArchive(pid, f.buffer, originalName);
      mode = "archive";
    } else {
      // Phase: extracting (개별 파일 저장)
      broadcast({
        type: "upload-progress",
        payload: { uploadId, phase: "extracting", message: `소스 파일 ${uploadedFiles.length}개 저장 중...` },
      });
      setUploadStatus(uploadId, { uploadId, phase: "extracting", message: "파일 저장 중" });

      await sourceService.saveFiles(
        pid,
        uploadedFiles.map((f) => ({
          name: Buffer.from(f.originalname, "latin1").toString("utf-8"),
          buffer: f.buffer,
        })),
      );
      projectPath = sourceService.getProjectPath(pid) ?? "";
      mode = "files";
    }

    // Phase: indexing
    broadcast({
      type: "upload-progress",
      payload: { uploadId, phase: "indexing", message: "파일 인덱싱 중..." },
    });
    setUploadStatus(uploadId, { uploadId, phase: "indexing", message: "인덱싱 중" });

    const files = sourceService.listFiles(pid);

    // Phase: complete
    broadcast({
      type: "upload-complete",
      payload: { uploadId, fileCount: files.length, projectPath },
    });
    setUploadStatus(uploadId, {
      uploadId, phase: "complete", message: "완료",
      fileCount: files.length, projectPath,
    });
    try {
      notificationService?.emit({
        projectId: pid,
        type: "upload_complete",
        title: "소스 업로드 완료",
        body: `파일 ${files.length}개 인덱싱 완료`,
        jobKind: "upload",
        resourceId: uploadId,
        correlationId: uploadId,
      });
    } catch {
      // notification failure must not affect upload completion
    }

    logger.info({ uploadId, pid, mode, fileCount: files.length }, "Upload processing complete");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Upload processing failed";
    broadcast({
      type: "upload-error",
      payload: { uploadId, phase: "failed", error: errorMsg },
    });
    setUploadStatus(uploadId, { uploadId, phase: "failed", message: errorMsg, error: errorMsg });
    try {
      notificationService?.emit({
        projectId: pid,
        type: "upload_failed",
        title: "소스 업로드 실패",
        body: errorMsg,
        jobKind: "upload",
        resourceId: uploadId,
        correlationId: uploadId,
      });
    } catch {
      // notification failure must not affect upload failure propagation
    }

    logger.error({ err, uploadId, pid }, "Upload processing failed");
  }
}
