import { apiFetch } from "./core";
import type { Severity } from "@aegis/shared";

/* ── Types ── */

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalActionType = "gate.override" | "finding.accepted_risk";

/**
 * S2 contract (H4) — backend-populated impact summary. NEVER frontend-derived.
 * historical rows may be absent → render dim placeholder, do not backfill.
 */
export interface ApprovalImpactSummary {
  failedRules: number;
  ignoredFindings: number;
  severityBreakdown?: Record<string, number>;
}

/**
 * S2 contract (H5) — backend-populated target snapshot. NEVER frontend-derived.
 * gate.override → first variant, finding.accepted_risk → second variant.
 * historical rows may be absent → render dim "—" placeholder per row.
 */
export type ApprovalTargetSnapshot =
  | {
      runId: string;
      commit?: string;
      branch?: string;
      profile?: string;
      action?: ApprovalActionType;
    }
  | {
      findingId: string;
      file?: string;
      line?: number;
      severity?: Severity;
    };

export interface ApprovalRequest {
  id: string;
  actionType: ApprovalActionType;
  requestedBy: string;
  targetId: string;
  projectId: string;
  reason: string;
  status: ApprovalStatus;
  impactSummary?: ApprovalImpactSummary;
  targetSnapshot?: ApprovalTargetSnapshot;
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
