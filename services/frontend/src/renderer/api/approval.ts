import { apiFetch } from "./core";

/* ── Types ── */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalActionType = "gate.override" | "finding.accepted_risk";

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  requestedBy: string;
  targetId: string;
  projectId: string;
  reason: string;
  status: ApprovalStatus;
  decision?: {
    decidedBy: string;
    decidedAt: string;
    comment?: string;
  };
  expiresAt: string;
  createdAt: string;
}

/* ── API ── */

export async function fetchProjectApprovals(projectId: string): Promise<ApprovalRequest[]> {
  const res = await apiFetch<{ success: boolean; data: ApprovalRequest[] }>(
    `/api/projects/${projectId}/approvals`,
  );
  return res.data;
}

export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  actor?: string,
  comment?: string,
): Promise<ApprovalRequest> {
  const res = await apiFetch<{ success: boolean; data: ApprovalRequest }>(
    `/api/approvals/${approvalId}/decide`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, actor, comment }),
    },
  );
  return res.data;
}

export async function fetchApprovalCount(projectId: string): Promise<{ pending: number; total: number }> {
  const res = await apiFetch<{ success: boolean; data: { pending: number; total: number } }>(
    `/api/projects/${projectId}/approvals/count`,
  );
  return res.data;
}
