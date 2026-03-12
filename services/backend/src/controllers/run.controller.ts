import { Router, type Request } from "express";
import type { RunService } from "../services/run.service";

export function createRunRouter(runService: RunService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/runs — 프로젝트 Run 목록
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const runs = runService.findByProjectId(pid);
    res.json({ success: true, data: runs });
  });

  return router;
}

export function createRunDetailRouter(runService: RunService): Router {
  const router = Router();

  // GET /api/runs/:id — Run 상세 (findings 포함)
  router.get("/:id", (req, res) => {
    const run = runService.findById(req.params.id);
    if (!run) {
      res.status(404).json({ success: false, error: "Run not found" });
      return;
    }
    res.json({ success: true, data: run });
  });

  return router;
}
