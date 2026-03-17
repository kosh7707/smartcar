import type { AuditLogEntry } from "@smartcar/shared";
import type { DatabaseType } from "../db";
import type { IAuditLogDAO } from "./interfaces";

function rowToAuditLogEntry(row: any): AuditLogEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action,
    resource: row.resource,
    resourceId: row.resource_id ?? undefined,
    detail: JSON.parse(row.detail || "{}"),
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
    return this.selectByResourceStmt.all(resourceId).map(rowToAuditLogEntry);
  }

  findByResourceIds(resourceIds: string[], limit = 100): AuditLogEntry[] {
    if (resourceIds.length === 0) return [];

    const placeholders = resourceIds.map(() => "?").join(",");
    return this.db
      .prepare(
        `SELECT * FROM audit_log WHERE resource_id IN (${placeholders}) ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(...resourceIds, limit)
      .map(rowToAuditLogEntry);
  }
}
