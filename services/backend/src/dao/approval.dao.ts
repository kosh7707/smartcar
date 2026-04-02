import type { ApprovalRequest, ApprovalStatus, ApprovalActionType } from "@aegis/shared";
import type { DatabaseType } from "../db";
import type { IApprovalDAO } from "./interfaces";

interface ApprovalRow {
  id: string;
  action_type: ApprovalActionType;
  requested_by: string;
  target_id: string;
  project_id: string;
  reason: string;
  status: ApprovalStatus;
  decision: string | null;
  expires_at: string;
  created_at: string;
}

function rowToApproval(row: ApprovalRow): ApprovalRequest {
  return {
    id: row.id,
    actionType: row.action_type,
    requestedBy: row.requested_by,
    targetId: row.target_id,
    projectId: row.project_id,
    reason: row.reason,
    status: row.status,
    decision: row.decision ? JSON.parse(row.decision) : undefined,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export class ApprovalDAO implements IApprovalDAO {
  private insertStmt;
  private selectByIdStmt;
  private selectByTargetStmt;
  private selectByProjectStmt;
  private selectByProjectAndStatusStmt;
  private selectPendingStmt;
  private updateDecisionStmt;

  constructor(private db: DatabaseType) {
    this.insertStmt = db.prepare(
      `INSERT INTO approvals (id, action_type, requested_by, target_id, project_id, reason, status, decision, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    this.selectByIdStmt = db.prepare(`SELECT * FROM approvals WHERE id = ?`);
    this.selectByTargetStmt = db.prepare(
      `SELECT * FROM approvals WHERE target_id = ? ORDER BY created_at DESC`
    );
    this.selectByProjectStmt = db.prepare(
      `SELECT * FROM approvals WHERE project_id = ? ORDER BY created_at DESC`
    );
    this.selectByProjectAndStatusStmt = db.prepare(
      `SELECT * FROM approvals WHERE project_id = ? AND status = ? ORDER BY created_at DESC`
    );
    this.selectPendingStmt = db.prepare(
      `SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC`
    );
    this.updateDecisionStmt = db.prepare(
      `UPDATE approvals SET status = ?, decision = ? WHERE id = ?`
    );
  }

  save(request: ApprovalRequest): void {
    this.insertStmt.run(
      request.id,
      request.actionType,
      request.requestedBy,
      request.targetId,
      request.projectId,
      request.reason,
      request.status,
      request.decision ? JSON.stringify(request.decision) : null,
      request.expiresAt,
      request.createdAt
    );
  }

  findById(id: string): ApprovalRequest | undefined {
    const row = this.selectByIdStmt.get(id) as ApprovalRow | undefined;
    return row ? rowToApproval(row) : undefined;
  }

  findByTargetId(targetId: string): ApprovalRequest[] {
    return (this.selectByTargetStmt.all(targetId) as ApprovalRow[]).map(rowToApproval);
  }

  findByProjectId(projectId: string, status?: ApprovalStatus): ApprovalRequest[] {
    if (status) {
      return (this.selectByProjectAndStatusStmt.all(projectId, status) as ApprovalRow[]).map(rowToApproval);
    }
    return (this.selectByProjectStmt.all(projectId) as ApprovalRow[]).map(rowToApproval);
  }

  findPending(): ApprovalRequest[] {
    return (this.selectPendingStmt.all() as ApprovalRow[]).map(rowToApproval);
  }

  updateStatus(id: string, status: ApprovalStatus, decision?: ApprovalRequest["decision"]): void {
    this.updateDecisionStmt.run(status, decision ? JSON.stringify(decision) : null, id);
  }
}
