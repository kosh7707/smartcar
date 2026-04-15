import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ContainerCompiler } from "../services/container-compiler";
import type { CompileRequest } from "../contracts/compile-contract";
import { assertProjectId } from "../utils/project-id";

export function createCompileRouter(compiler: ContainerCompiler): Router {
  const router = Router({ mergeParams: true });
  router.post('/compile', asyncHandler(async (req, res) => {
    try {
      assertProjectId(req.params.projectId as string);
    } catch {
      res.status(400).json({ success: false, error: 'Invalid projectId' });
      return;
    }
    const body = req.body as Partial<CompileRequest>;
    if (!body.workspaceId) { res.status(400).json({ success: false, error: 'workspaceId is required' }); return; }
    if (!body.profile?.language || !body.profile.entryFile || !body.profile.outputName) { res.status(400).json({ success: false, error: 'profile.language, profile.entryFile, and profile.outputName are required' }); return; }
    const result = await compiler.compile(req.params.projectId as string, body as CompileRequest);
    res.status(result.success ? 200 : 422).json({ success: true, data: result });
  }));
  return router;
}
