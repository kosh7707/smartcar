import type { Notification, NotificationType, Severity } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { INotificationDAO } from "./interfaces";
import type { NotificationJobKind } from "@aegis/shared";

interface NotificationRow {
  id: string;
  project_id: string;
  type: NotificationType;
  title: string;
  body: string;
  severity: Severity | null;
  job_kind: NotificationJobKind | null;
  resource_id: string | null;
  correlation_id: string | null;
  read: number;
  created_at: string;
}

function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    title: row.title,
    body: row.body,
    severity: row.severity ?? undefined,
    jobKind: row.job_kind ?? undefined,
    resourceId: row.resource_id ?? undefined,
    correlationId: row.correlation_id ?? undefined,
    read: row.read === 1,
    createdAt: row.created_at,
  };
}

export class NotificationDAO implements INotificationDAO {
  private insertStmt;
  private selectByProjectStmt;
  private selectUnreadByProjectStmt;
  private selectByProjectLimitStmt;
  private selectUnreadByProjectLimitStmt;
  private unreadCountStmt;
  private markAsReadStmt;
  private markAllAsReadStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO notifications (id, project_id, type, title, body, severity, job_kind, resource_id, correlation_id, read, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM notifications WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.selectUnreadByProjectStmt = db.prepare(
      `SELECT * FROM notifications WHERE project_id = ? AND read = 0 ORDER BY created_at DESC`
    );
    this.selectByProjectLimitStmt = db.prepare(
      `SELECT * FROM notifications WHERE project_id = ? ORDER BY created_at DESC LIMIT ?`
    );
    this.selectUnreadByProjectLimitStmt = db.prepare(
      `SELECT * FROM notifications WHERE project_id = ? AND read = 0 ORDER BY created_at DESC LIMIT ?`
    );
    this.unreadCountStmt = db.prepare(
      `SELECT COUNT(*) as cnt FROM notifications WHERE project_id = ? AND read = 0`
    );
    this.markAsReadStmt = db.prepare(
      `UPDATE notifications SET read = 1 WHERE id = ?`
    );
    this.markAllAsReadStmt = db.prepare(
      `UPDATE notifications SET read = 1 WHERE project_id = ? AND read = 0`
    );
  }

  save(notification: {
    id: string;
    projectId: string;
    type: string;
    title: string;
    body: string;
    severity?: string;
    jobKind?: string;
    resourceId?: string;
    correlationId?: string;
    createdAt: string;
  }): void {
    this.insertStmt.run(
      notification.id,
      notification.projectId,
      notification.type,
      notification.title,
      notification.body,
      notification.severity ?? null,
      notification.jobKind ?? null,
      notification.resourceId ?? null,
      notification.correlationId ?? null,
      notification.createdAt,
    );
  }

  findByProjectId(projectId: string, unreadOnly?: boolean, limit?: number): Notification[] {
    if (unreadOnly && limit !== undefined) {
      return (this.selectUnreadByProjectLimitStmt.all(projectId, limit) as NotificationRow[]).map(rowToNotification);
    }
    if (unreadOnly) {
      return (this.selectUnreadByProjectStmt.all(projectId) as NotificationRow[]).map(rowToNotification);
    }
    if (limit !== undefined) {
      return (this.selectByProjectLimitStmt.all(projectId, limit) as NotificationRow[]).map(rowToNotification);
    }
    return (this.selectByProjectStmt.all(projectId) as NotificationRow[]).map(rowToNotification);
  }

  unreadCount(projectId: string): number {
    const row = this.unreadCountStmt.get(projectId) as { cnt: number } | undefined;
    return row?.cnt ?? 0;
  }

  markAsRead(id: string): void {
    this.markAsReadStmt.run(id);
  }

  markAllAsRead(projectId: string): void {
    this.markAllAsReadStmt.run(projectId);
  }
}
