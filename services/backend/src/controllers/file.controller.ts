import { Router } from "express";
import type { IFileStore } from "../dao/interfaces";

export function createFileRouter(fileStore: IFileStore): Router {
  const router = Router();

  // P1-10: 프로젝트 파일 목록
  router.get("/projects/:projectId/files", (req, res) => {
    const files = fileStore.findByProjectId(req.params.projectId);
    res.json({ success: true, data: files });
  });

  // 파일 내용 조회 (JSON)
  router.get("/files/:fileId/content", (req, res) => {
    const file = fileStore.findById(req.params.fileId);
    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }
    res.json({
      success: true,
      data: {
        id: file.id,
        name: file.name,
        path: file.path,
        language: file.language,
        content: file.content,
      },
    });
  });

  // 파일 내용 다운로드
  router.get("/files/:fileId/download", (req, res) => {
    const file = fileStore.findById(req.params.fileId);
    if (!file) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.send(file.content);
  });

  // P1-10: 프로젝트에서 파일 삭제
  router.delete("/projects/:projectId/files/:fileId", (req, res) => {
    const deleted = fileStore.deleteByProjectAndFile(req.params.fileId, req.params.projectId);
    if (!deleted) {
      res.status(404).json({ success: false, error: "File not found" });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
