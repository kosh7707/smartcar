import crypto from "crypto";
import type { Notification, NotificationType, Severity } from "@aegis/shared";
import type { WsNotificationMessage } from "@aegis/shared";
import type { INotificationDAO } from "../dao/interfaces";
import type { WsBroadcaster } from "./ws-broadcaster";
import { createLogger } from "../lib/logger";

const logger = createLogger("notification");

export class NotificationService {
  constructor(
    private notificationDAO: INotificationDAO,
    private notificationWs?: WsBroadcaster<WsNotificationMessage>,
  ) {}

  emit(params: {
    projectId: string;
    type: NotificationType;
    title: string;
    body?: string;
    severity?: Severity;
    resourceId?: string;
  }): Notification {
    const now = new Date().toISOString();
    const notification: Notification = {
      id: `notif-${crypto.randomUUID()}`,
      projectId: params.projectId,
      type: params.type,
      title: params.title,
      body: params.body ?? "",
      severity: params.severity,
      resourceId: params.resourceId,
      read: false,
      createdAt: now,
    };

    this.notificationDAO.save({
      id: notification.id,
      projectId: notification.projectId,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      severity: notification.severity,
      resourceId: notification.resourceId,
      createdAt: notification.createdAt,
    });

    if (this.notificationWs) {
      this.notificationWs.broadcast(params.projectId, {
        type: "notification",
        payload: notification,
      });
    }

    logger.info({ notificationId: notification.id, type: params.type, projectId: params.projectId }, "Notification emitted");
    return notification;
  }

  findByProjectId(projectId: string, unreadOnly?: boolean): Notification[] {
    return this.notificationDAO.findByProjectId(projectId, unreadOnly);
  }

  unreadCount(projectId: string): number {
    return this.notificationDAO.unreadCount(projectId);
  }

  markAsRead(id: string): void {
    this.notificationDAO.markAsRead(id);
  }

  markAllAsRead(projectId: string): void {
    this.notificationDAO.markAllAsRead(projectId);
  }
}
