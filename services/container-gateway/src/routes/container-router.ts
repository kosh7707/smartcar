import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ProjectContainerManager } from "../services/project-container-manager";
import { assertProjectId } from "../utils/project-id";

export function createContainerRouter(manager: ProjectContainerManager): Router {
  const router = Router({ mergeParams: true });
  router.get('/', asyncHandler(async (req, res) => {
    try {
      assertProjectId(req.params.projectId as string);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid projectId' });
      return;
    }
    const result = await manager.getContainerStatus(req.params.projectId as string);
    res.json({ success: true, data: result });
  }));
  return router;
}
