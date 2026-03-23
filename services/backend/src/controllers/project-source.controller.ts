import { Router } from "express";
import multer from "multer";
import type { ProjectSourceService } from "../services/project-source.service";
import type { IProjectDAO } from "../dao/interfaces";
import { asyncHandler } from "../middleware/async-handler";
import { NotFoundError, InvalidInputError } from "../lib/errors";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

function validateProjectId(pid: string): void {
  if (!pid || !/^[\w-]+$/.test(pid)) {
    throw new InvalidInputError("Invalid project ID format");
  }
}

export function createProjectSourceRouter(
  sourceService: ProjectSourceService,
  projectDAO: IProjectDAO,
): Router {
  const router = Router({ mergeParams: true });

  // POST /api/projects/:pid/source/upload — ZIP/tar.gz 업로드
  router.post("/upload", upload.single("file"), asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);
    if (!req.file) throw new InvalidInputError("No file uploaded. Send a ZIP or tar.gz as 'file'");

    const projectPath = await sourceService.extractZip(pid, req.file.buffer);
    const files = sourceService.listFiles(pid);

    res.json({
      success: true,
      data: {
        projectPath,
        fileCount: files.length,
        files: files.slice(0, 100),
      },
    });
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
      data: {
        projectPath,
        fileCount: files.length,
        files: files.slice(0, 100),
      },
    });
  }));

  // GET /api/projects/:pid/source/files — 파일 트리
  router.get("/files", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    if (!projectDAO.findById(pid)) throw new NotFoundError(`Project not found: ${pid}`);

    const files = sourceService.listFiles(pid);
    res.json({ success: true, data: files });
  }));

  // GET /api/projects/:pid/source/file — 파일 내용 읽기
  router.get("/file", asyncHandler(async (req, res) => {
    const pid = req.params.pid as string;
    validateProjectId(pid);
    const filePath = req.query.path as string;
    if (!filePath) throw new InvalidInputError("path query parameter required");

    const content = sourceService.readFile(pid, filePath);
    res.json({ success: true, data: { path: filePath, content } });
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
