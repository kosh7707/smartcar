import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/async-handler";
import { WorkspaceMaterializer } from "../services/workspace-materializer";
import { assertProjectId } from "../utils/project-id";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

export function createUploadRouter(materializer: WorkspaceMaterializer): Router {
  const router = Router({ mergeParams: true });
  router.post('/upload', upload.array('file', 200), asyncHandler(async (req, res) => {
    try {
      assertProjectId(req.params.projectId as string);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid projectId' });
      return;
    }
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    const summary = materializer.materialize(req.params.projectId as string, files);
    res.status(201).json({ success: true, data: summary });
  }));
  return router;
}
