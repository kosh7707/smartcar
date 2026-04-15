import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ProjectContainerManager } from "../services/project-container-manager";
import { ProjectSourceStore } from "../services/project-source-store";
import type { WorkspaceVersionStore } from "../services/workspace-version-store";
import logger from "../logger";
import { assertProjectId } from "../utils/project-id";

export function createRuntimeRouter(manager: ProjectContainerManager, sources: ProjectSourceStore, versions: WorkspaceVersionStore): Router {
  const router = Router({ mergeParams: true });
  router.delete('/runtime', asyncHandler(async (req, res) => {
    const projectId = req.params.projectId as string;
    try {
      assertProjectId(projectId);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid projectId' });
      return;
    }
    const record = sources.quarantineWorkspace(projectId);
    if (!record) {
      await manager.teardownProject(projectId);
      res.json({ success: true, data: { projectId, status: 'deleted' } });
      return;
    }
    try {
      await manager.teardownProject(projectId);
      sources.finalizeDelete(record);
      logger.info({ projectId, workspaceId: record.workspaceId, quarantinePath: record.quarantinedPath }, 'Runtime teardown complete');
      res.json({ success: true, data: { projectId, status: 'deleted', workspaceId: record.workspaceId } });
    } catch (error: any) {
      sources.restoreQuarantine(record);
      logger.warn({ projectId, workspaceId: record.workspaceId, err: error }, 'Runtime teardown failed and workspace restored');
      res.status(500).json({ success: false, error: error?.message ?? 'teardown failed', data: { projectId, status: 'teardown_failed', workspaceId: record.workspaceId } });
    }
  }));
  return router;
}
