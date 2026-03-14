import type { AuditLogEntry } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO audit_log (id, timestamp, actor, action, resource, resource_id, detail, request_id)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectByResourceStmt = db.prepare(
  `SELECT * FROM audit_log WHERE resource_id = ? ORDER BY timestamp DESC`
);

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

class AuditLogDAO {
  save(entry: AuditLogEntry): void {
    insertStmt.run(
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
    return selectByResourceStmt.all(resourceId).map(rowToAuditLogEntry);
  }

  findByResourceIds(resourceIds: string[], limit = 100): AuditLogEntry[] {
    if (resourceIds.length === 0) return [];

    const placeholders = resourceIds.map(() => "?").join(",");
    return db
      .prepare(
        `SELECT * FROM audit_log WHERE resource_id IN (${placeholders}) ORDER BY timestamp DESC LIMIT ?`,
      )
      .all(...resourceIds, limit)
      .map(rowToAuditLogEntry);
  }
}

export const auditLogDAO = new AuditLogDAO();
