import type { ApprovalRequest, ApprovalStatus } from "@smartcar/shared";
import db from "../db";

const insertStmt = db.prepare(
  `INSERT INTO approvals (id, action_type, requested_by, target_id, project_id, reason, status, decision, expires_at, created_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
);
const selectByIdStmt = db.prepare(`SELECT * FROM approvals WHERE id = ?`);
const selectByTargetStmt = db.prepare(
  `SELECT * FROM approvals WHERE target_id = ? ORDER BY created_at DESC`
);
const selectByProjectStmt = db.prepare(
  `SELECT * FROM approvals WHERE project_id = ? ORDER BY created_at DESC`
);
const selectByProjectAndStatusStmt = db.prepare(
  `SELECT * FROM approvals WHERE project_id = ? AND status = ? ORDER BY created_at DESC`
);
const selectPendingStmt = db.prepare(
  `SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC`
);
const updateDecisionStmt = db.prepare(
  `UPDATE approvals SET status = ?, decision = ? WHERE id = ?`
);

function rowToApproval(row: any): ApprovalRequest {
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

class ApprovalDAO {
  save(request: ApprovalRequest): void {
    insertStmt.run(
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
    const row = selectByIdStmt.get(id);
    return row ? rowToApproval(row) : undefined;
  }

  findByTargetId(targetId: string): ApprovalRequest[] {
    return selectByTargetStmt.all(targetId).map(rowToApproval);
  }

  findByProjectId(projectId: string, status?: ApprovalStatus): ApprovalRequest[] {
    if (status) {
      return selectByProjectAndStatusStmt.all(projectId, status).map(rowToApproval);
    }
    return selectByProjectStmt.all(projectId).map(rowToApproval);
  }

  findPending(): ApprovalRequest[] {
    return selectPendingStmt.all().map(rowToApproval);
  }

  updateStatus(id: string, status: ApprovalStatus, decision?: ApprovalRequest["decision"]): void {
    updateDecisionStmt.run(status, decision ? JSON.stringify(decision) : null, id);
  }
}

export const approvalDAO = new ApprovalDAO();
