import { Router, type Request } from "express";
import type { ProjectSettingsService } from "../services/project-settings.service";
import { SDK_PROFILES, findSdkProfile } from "../services/sdk-profiles";

export function createProjectSettingsRouter(settingsService: ProjectSettingsService): Router {
  const router = Router({ mergeParams: true });

  // 프로젝트 설정 조회
  router.get("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    res.json({ success: true, data: settingsService.getAll(pid) });
  });

  // 프로젝트 설정 수정 (부분 업데이트)
  router.put("/", (req: Request<{ pid: string }>, res) => {
    const pid = req.params.pid;
    const updated = settingsService.update(pid, req.body);
    res.json({ success: true, data: updated });
  });

  return router;
}

export function createSdkProfileRouter(): Router {
  const router = Router();

  // SDK 프로파일 목록
  router.get("/", (_req, res) => {
    res.json({ success: true, data: SDK_PROFILES });
  });

  // SDK 프로파일 상세
  router.get("/:id", (req, res) => {
    const profile = findSdkProfile(req.params.id);
    if (!profile) {
      res.status(404).json({ success: false, error: "SDK profile not found" });
      return;
    }
    res.json({ success: true, data: profile });
  });

  return router;
}
