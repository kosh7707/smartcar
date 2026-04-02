import { Router } from "express";
import type { Request } from "express";
import { asyncHandler } from "../middleware/async-handler";
import type { NotificationService } from "../services/notification.service";

/** 프로젝트 스코프: /api/projects/:pid/notifications */
export function createNotificationRouter(service: NotificationService): Router {
  const router = Router({ mergeParams: true });

  // 미읽음 카운트
  router.get("/count", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    const count = service.unreadCount(req.params.pid);
    res.json({ success: true, data: { unread: count } });
  }));

  // 전체 읽음 처리
  router.patch("/read-all", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    service.markAllAsRead(req.params.pid);
    res.json({ success: true });
  }));

  // 알림 목록 (?unread=true)
  router.get("/", asyncHandler(async (req: Request<{ pid: string }>, res) => {
    const unreadOnly = req.query.unread === "true";
    const notifications = service.findByProjectId(req.params.pid, unreadOnly);
    res.json({ success: true, data: notifications });
  }));

  return router;
}

/** 글로벌 스코프: /api/notifications */
export function createNotificationDetailRouter(service: NotificationService): Router {
  const router = Router();

  // 개별 읽음 처리
  router.patch("/:id/read", asyncHandler(async (req: Request<{ id: string }>, res) => {
    service.markAsRead(req.params.id);
    res.json({ success: true });
  }));

  return router;
}
