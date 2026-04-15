import React from "react";
import { AlertCircle, CheckCircle, Clock, ExternalLink, Timer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest } from "../../../api/approval";
import { EmptyState } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";
import type { ApprovalDecisionAction, ApprovalFilterStatus } from "../hooks/useApprovalsPage";

type ApprovalStatusConfig = {
  icon: React.ReactNode;
  label: string;
  className: string;
};

const STATUS_CONFIG: Record<Exclude<ApprovalFilterStatus, "all">, ApprovalStatusConfig> = {
  pending: { icon: <Clock size={14} />, label: "대기", className: "approval-status--pending" },
  approved: { icon: <CheckCircle size={14} />, label: "승인됨", className: "approval-status--approved" },
  rejected: { icon: <XCircle size={14} />, label: "거부", className: "approval-status--rejected" },
  expired: { icon: <Timer size={14} />, label: "만료", className: "approval-status--expired" },
};

const ACTION_LABELS: Record<string, string> = {
  "gate.override": "Quality Gate 오버라이드",
  "finding.accepted_risk": "Finding 위험 수용",
};

interface ApprovalRequestListProps {
  approvals: ApprovalRequest[];
  filter: ApprovalFilterStatus;
  onOpenTarget: (approval: ApprovalRequest) => void;
  onStartDecision: (approvalId: string, action: ApprovalDecisionAction) => void;
}

export const ApprovalRequestList: React.FC<ApprovalRequestListProps> = ({
  approvals,
  filter,
  onOpenTarget,
  onStartDecision,
}) => {
  if (approvals.length === 0) {
    return (
      <section className="approval-empty-panel">
        <EmptyState
          title={filter === "all" ? "승인 요청이 없습니다" : `${STATUS_CONFIG[filter]?.label ?? filter} 상태의 요청이 없습니다`}
          description="Gate 예외 승인과 위험 수용 요청이 발생하면 이곳에서 검토, 승인, 거부 이력을 확인할 수 있습니다."
        />
      </section>
    );
  }

  return (
    <section className="approval-list" aria-label="승인 요청 목록">
      {approvals.map((approval) => {
        const statusConfig = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
        const isExpired = new Date(approval.expiresAt) < new Date();
        const isPending = approval.status === "pending";
        const isImminent = new Date(approval.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

        return (
          <article key={approval.id} className={`approval-card approval-card--${approval.status}`}>
            <div className="approval-card__topline" />
            <div className="approval-card__header">
              <div className="approval-card__intro">
                <h3 className="approval-card__action">{ACTION_LABELS[approval.actionType] ?? approval.actionType}</h3>
                <div className="approval-card__meta">
                  <span>요청자: {approval.requestedBy}</span>
                  <span>{formatDateTime(approval.createdAt)}</span>
                  {!isExpired && isPending && (
                    <span className={`approval-card__expires${isImminent ? " approval-card__expires--imminent" : ""}`}>
                      만료: {formatDateTime(approval.expiresAt)}
                    </span>
                  )}
                </div>
              </div>

              <span className={`approval-card__status-badge ${statusConfig.className}`}>
                {statusConfig.icon}
                {statusConfig.label}
              </span>
            </div>

            <div className="approval-card__reason">
              <AlertCircle size={14} />
              <span>{approval.reason}</span>
            </div>

            <div className="approval-card__footer">
              <button type="button" className="approval-card__target" onClick={() => onOpenTarget(approval)}>
                <ExternalLink size={14} />
                {approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기"}
              </button>

              {approval.decision && (
                <div className="approval-card__decision">
                  <span>결정: {approval.decision.decidedBy} ({formatDateTime(approval.decision.decidedAt)})</span>
                  {approval.decision.comment && <span className="approval-card__comment">"{approval.decision.comment}"</span>}
                </div>
              )}
            </div>

            {isPending && !isExpired && (
              <div className="approval-card__actions">
                <Button
                  type="button"
                  size="sm"
                  className="approval-btn--approve"
                  onClick={() => onStartDecision(approval.id, "approved")}
                >
                  승인
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="approval-btn--reject"
                  onClick={() => onStartDecision(approval.id, "rejected")}
                >
                  거부
                </Button>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
};
