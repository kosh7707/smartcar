import { Router, type Request } from "express";
import type { ActivityService } from "../services/activity.service";

export function createActivityRouter(activityService: ActivityService): Router {
  const router = Router({ mergeParams: true });

  // GET /api/projects/:pid/activity?limit=10
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 50);
    const data = activityService.getTimeline(req.params.pid, limit);
    res.json({ success: true, data });
  });

  return router;
}
