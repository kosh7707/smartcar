import { Router } from "express";
import type { ProjectSettingsService } from "../services/project-settings.service";

export function createProjectSettingsRouter(settingsService: ProjectSettingsService): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트 설정 조회
  router.get("/", (req, res) => {
    const pid = (req.params as any).pid as string;
    res.json({ success: true, data: settingsService.getAll(pid) });
  });

  // 프로젝트 설정 수정 (부분 업데이트)
  router.put("/", (req, res) => {
    const pid = (req.params as any).pid as string;
    const updated = settingsService.update(pid, req.body);
    res.json({ success: true, data: updated });
  });

  return router;
}
