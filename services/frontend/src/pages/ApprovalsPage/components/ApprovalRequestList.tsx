import React from "react";
import { AlertCircle, CheckCircle, Clock, ExternalLink, Timer, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApprovalRequest } from "../../../api/approval";
import { EmptyState } from "../../../shared/ui";
import { formatDateTime } from "../../../utils/format";
import type { ApprovalDecisionAction, ApprovalFilterStatus } from "../hooks/useApprovalsPage";

type ApprovalStatusConfig = {
  icon: React.ReactNode;
  label: string;
  className: string;
  lineClassName: string;
};

const STATUS_CONFIG: Record<Exclude<ApprovalFilterStatus, "all">, ApprovalStatusConfig> = {
  pending: { icon: <Clock size={14} />, label: "대기", className: "approval-status-tone approval-status-tone--pending", lineClassName: "approval-line-tone approval-line-tone--pending" },
  approved: { icon: <CheckCircle size={14} />, label: "승인됨", className: "approval-status-tone approval-status-tone--approved", lineClassName: "approval-line-tone approval-line-tone--approved" },
  rejected: { icon: <XCircle size={14} />, label: "거부", className: "approval-status-tone approval-status-tone--rejected", lineClassName: "approval-line-tone approval-line-tone--rejected" },
  expired: { icon: <Timer size={14} />, label: "만료", className: "approval-status-tone approval-status-tone--expired", lineClassName: "approval-line-tone approval-line-tone--expired" },
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

export const ApprovalRequestList: React.FC<ApprovalRequestListProps> = ({ approvals, filter, onOpenTarget, onStartDecision }) => {
  if (approvals.length === 0) {
    return (
      <section className="approval-list-empty">
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
          <Card key={approval.id} className={cn("approval-card", approval.status === "expired" && "opacity-90")}>
            <span className={cn("approval-card__line", statusConfig.lineClassName)} />
            <CardContent className="approval-card__body">
              <div className="approval-card__header">
                <div className="approval-card__header-main">
                  <h3 className="approval-card__title">{ACTION_LABELS[approval.actionType] ?? approval.actionType}</h3>
                  <div className="approval-card__meta">
                    <span>요청자: {approval.requestedBy}</span>
                    <span>{formatDateTime(approval.createdAt)}</span>
                    {!isExpired && isPending ? (
                      <span className={isImminent ? "approval-card__expires-soon" : undefined}>만료: {formatDateTime(approval.expiresAt)}</span>
                    ) : null}
                  </div>
                </div>

                <Badge variant="outline" className={statusConfig.className}>
                  {statusConfig.icon}
                  {statusConfig.label}
                </Badge>
              </div>

              <div className="approval-card__reason">
                <AlertCircle size={14} />
                <span>{approval.reason}</span>
              </div>

              <div className="approval-card__actions">
                <Button type="button" variant="link" className="approval-card__link" onClick={() => onOpenTarget(approval)}>
                  <ExternalLink size={14} />
                  {approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기"}
                </Button>

                {approval.decision ? (
                  <div className="approval-card__decision">
                    <span>결정: {approval.decision.decidedBy} ({formatDateTime(approval.decision.decidedAt)})</span>
                    {approval.decision.comment ? <span className="approval-card__decision-comment">"{approval.decision.comment}"</span> : null}
                  </div>
                ) : null}
              </div>

              {isPending && !isExpired ? (
                <div className="approval-card__buttons">
                  <Button type="button" size="sm" className="approval-card__approve" onClick={() => onStartDecision(approval.id, "approved")}>승인</Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => onStartDecision(approval.id, "rejected")}>거부</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
};
