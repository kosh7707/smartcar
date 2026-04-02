import type { AuditLogEntry } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IAuditLogDAO } from "./interfaces";
import { safeJsonParse } from "../lib/utils";

interface AuditLogRow {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource: string;
  resource_id: string | null;
  detail: string;
  request_id: string | null;
}

function rowToAuditLogEntry(row: AuditLogRow): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    resource: row.resource,
    resourceId: row.resource_id ?? undefined,
    detail: safeJsonParse(row.detail, {}),
    requestId: row.request_id ?? undefined,
  };
}

export class AuditLogDAO implements IAuditLogDAO {
  private insertStmt;
  private selectByResourceStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO audit_log (id, timestamp, actor, action, resource, resource_id, detail, request_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByResourceStmt = db.prepare(
      `SELECT * FROM audit_log WHERE resource_id = ? ORDER BY timestamp DESC`
    );
  }

  save(entry: AuditLogEntry): void {
    this.insertStmt.run(
      entry.id,
      entry.timestamp,
      entry.actor,
      entry.action,
      entry.resource,
      entry.resourceId ?? null,
      JSON.stringify(entry.detail),
      entry.requestId ?? null
    );
  }

  findByResourceId(resourceId: string): AuditLogEntry[] {
    return (this.selectByResourceStmt.all(resourceId) as AuditLogRow[]).map(rowToAuditLogEntry);
  }

  findByResourceIds(resourceIds: string[], limit = 100): AuditLogEntry[] {
    if (resourceIds.length === 0) return [];

    const placeholders = resourceIds.map(() => "?").join(",");
    return (this.db
      .prepare(
        `SELECT * FROM audit_log WHERE resource_id IN (${placeholders}) ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(...resourceIds, limit) as AuditLogRow[]).map(rowToAuditLogEntry);
  }

  findFindingStatusChanges(projectId: string, limit: number): AuditLogEntry[] {
    return (this.db.prepare(`
      SELECT a.* FROM audit_log a
      INNER JOIN findings f ON f.id = a.resource_id
      WHERE a.action = 'finding.status_change' AND f.project_id = ?
      ORDER BY a.timestamp DESC LIMIT ?
    `).all(projectId, limit) as AuditLogRow[]).map(rowToAuditLogEntry);
  }

  findApprovalDecisions(projectId: string, limit: number): AuditLogEntry[] {
    return (this.db.prepare(`
      SELECT a.* FROM audit_log a
      INNER JOIN approvals ap ON ap.id = a.resource_id
      WHERE a.action LIKE 'approval.%' AND ap.project_id = ?
      ORDER BY a.timestamp DESC LIMIT ?
    `).all(projectId, limit) as AuditLogRow[]).map(rowToAuditLogEntry);
  }
}
