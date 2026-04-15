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
  pending: { icon: <Clock size={14} />, label: "대기", className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200", lineClassName: "bg-amber-400" },
  approved: { icon: <CheckCircle size={14} />, label: "승인됨", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200", lineClassName: "bg-emerald-500" },
  rejected: { icon: <XCircle size={14} />, label: "거부", className: "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/20", lineClassName: "bg-destructive" },
  expired: { icon: <Timer size={14} />, label: "만료", className: "border-border bg-muted text-muted-foreground", lineClassName: "bg-border" },
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
      <section className="rounded-lg border border-border bg-background p-6">
        <EmptyState
          title={filter === "all" ? "승인 요청이 없습니다" : `${STATUS_CONFIG[filter]?.label ?? filter} 상태의 요청이 없습니다`}
          description="Gate 예외 승인과 위험 수용 요청이 발생하면 이곳에서 검토, 승인, 거부 이력을 확인할 수 있습니다."
        />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label="승인 요청 목록">
      {approvals.map((approval) => {
        const statusConfig = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
        const isExpired = new Date(approval.expiresAt) < new Date();
        const isPending = approval.status === "pending";
        const isImminent = new Date(approval.expiresAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

        return (
          <Card key={approval.id} className={cn("approval-card relative overflow-hidden shadow-none", approval.status === "expired" && "opacity-90")}>
            <span className={cn("absolute inset-y-0 left-0 w-[3px] rounded-lg", statusConfig.lineClassName)} />
            <CardContent className="flex flex-col gap-4 p-5 max-sm:p-5">
            <div className="flex items-start justify-between gap-4 max-sm:flex-col">
              <div className="flex min-w-0 flex-col gap-3">
                <h3 className="m-0 text-base font-semibold text-foreground">{ACTION_LABELS[approval.actionType] ?? approval.actionType}</h3>
                <div className="flex flex-wrap gap-4 font-mono text-sm text-muted-foreground">
                  <span>요청자: {approval.requestedBy}</span>
                  <span>{formatDateTime(approval.createdAt)}</span>
                  {!isExpired && isPending && (
                    <span className={isImminent ? "text-amber-700" : "text-muted-foreground"}>
                      만료: {formatDateTime(approval.expiresAt)}
                    </span>
                  )}
                </div>
              </div>

              <Badge variant="outline" className={cn("min-h-9 shrink-0 gap-2 rounded-full px-4 text-sm font-medium", statusConfig.className)}>
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
            </div>

            <div className="flex items-start gap-3 rounded-lg bg-gradient-to-b from-muted/80 to-background/95 px-5 py-4 text-sm text-foreground">
              <AlertCircle size={14} />
              <span>{approval.reason}</span>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4 max-sm:flex-col">
              <Button type="button" variant="link" className="h-auto gap-2 p-0 text-sm font-medium" onClick={() => onOpenTarget(approval)}>
                <ExternalLink size={14} />
                {approval.actionType === "gate.override" ? "Gate 보기" : "Finding 보기"}
              </Button>

              {approval.decision && (
                <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                  <span>결정: {approval.decision.decidedBy} ({formatDateTime(approval.decision.decidedAt)})</span>
                  {approval.decision.comment && <span className="text-muted-foreground italic">"{approval.decision.comment}"</span>}
                </div>
              )}
            </div>

            {isPending && !isExpired && (
              <div className="flex flex-wrap gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => onStartDecision(approval.id, "approved")}
                >
                  승인
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onStartDecision(approval.id, "rejected")}
                >
                  거부
                </Button>
              </div>
            )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
};
