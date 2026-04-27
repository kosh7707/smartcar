import type {
  ApprovalActionType,
  ApprovalImpactSummary,
  ApprovalRequest,
  ApprovalTargetSnapshot,
} from "../../../api/approval";

export const ACTION_LABELS: Record<ApprovalActionType, string> = {
  "gate.override": "Quality Gate 오버라이드",
  "finding.accepted_risk": "Finding 위험 수용",
};

export const ACTION_EYEBROW: Record<ApprovalActionType, string> = {
  "gate.override": "GATE OVERRIDE",
  "finding.accepted_risk": "ACCEPTED RISK",
};

export const STATUS_LABELS: Record<ApprovalRequest["status"], string> = {
  pending: "대기",
  approved: "승인됨",
  rejected: "거부",
  expired: "만료",
};

// k-override = severity-critical exception, k-risk = severity-high exception (handoff §2.2).
export function actionKind(actionType: ApprovalActionType): "k-override" | "k-risk" {
  return actionType === "gate.override" ? "k-override" : "k-risk";
}

// NEVER frontend-derive: absent impactSummary → caller shows "—" (handoff §9).
export function formatImpactSummary(impact?: ApprovalImpactSummary): string | null {
  if (!impact) return null;
  const parts: string[] = [];
  parts.push(`차단 규칙 ${impact.failedRules}`);
  parts.push(`무시 발견 ${impact.ignoredFindings}`);
  if (impact.severityBreakdown) {
    const breakdown = Object.entries(impact.severityBreakdown)
      .filter(([, count]) => count > 0)
      .map(([severity, count]) => `${severity} ${count}`);
    if (breakdown.length > 0) parts.push(breakdown.join(", "));
  }
  return parts.join(" / ");
}

export interface TargetSnapshotRow {
  key: string;
  label: string;
  value: string | null;
}

// Absent fields → value=null → caller renders "—". NEVER backfill (handoff §9).
export function buildTargetSnapshotRows(
  snapshot?: ApprovalTargetSnapshot,
  actionType?: ApprovalActionType,
): TargetSnapshotRow[] {
  if (!snapshot) {
    if (actionType === "finding.accepted_risk") {
      return [
        { key: "findingId", label: "Finding", value: null },
        { key: "file", label: "File", value: null },
        { key: "line", label: "Line", value: null },
        { key: "severity", label: "Severity", value: null },
      ];
    }
    return [
      { key: "runId", label: "Run", value: null },
      { key: "commit", label: "Commit", value: null },
      { key: "branch", label: "Branch", value: null },
      { key: "profile", label: "Profile", value: null },
      { key: "action", label: "Action", value: null },
    ];
  }
  if ("runId" in snapshot) {
    return [
      { key: "runId", label: "Run", value: `#${snapshot.runId}` },
      { key: "commit", label: "Commit", value: snapshot.commit ? snapshot.commit.slice(0, 7) : null },
      { key: "branch", label: "Branch", value: snapshot.branch ?? null },
      { key: "profile", label: "Profile", value: snapshot.profile ?? null },
      { key: "action", label: "Action", value: snapshot.action ?? null },
    ];
  }
  return [
    { key: "findingId", label: "Finding", value: snapshot.findingId },
    { key: "file", label: "File", value: snapshot.file ?? null },
    { key: "line", label: "Line", value: snapshot.line !== undefined ? String(snapshot.line) : null },
    { key: "severity", label: "Severity", value: snapshot.severity ?? null },
  ];
}
