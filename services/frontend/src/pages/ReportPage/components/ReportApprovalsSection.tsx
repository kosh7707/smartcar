import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

const approvalStatusTone = {
  approved: "report-status-tone report-status-tone--approved",
  rejected: "report-status-tone report-status-tone--rejected",
  pending: "report-status-tone report-status-tone--pending",
} as const;

export function ReportApprovalsSection({ approvals }: { approvals: ProjectReport["approvals"] }) {
  return (
    <Card className="report-approvals-card">
      <CardHeader className="report-approvals-card__head">
        <CardTitle>승인 이력 ({approvals.length})</CardTitle>
      </CardHeader>
      <CardContent className="report-approvals-card__body">
        {approvals.map((approval) => (
          <div key={approval.id} className="report-approvals-card__row">
            <div className="report-approvals-card__meta">
              <Badge
                variant="outline"
                className={approvalStatusTone[approval.status as keyof typeof approvalStatusTone] ?? "report-approvals-card__status report-approvals-card__status--idle"}
              >
                {approval.status}
              </Badge>
              <span className="report-approvals-card__action">{approval.actionType}</span>
              <span className="report-approvals-card__copy">요청: {approval.requestedBy}</span>
              {approval.decision && (
                <span className="report-approvals-card__copy">결정: {approval.decision.decidedBy}</span>
              )}
            </div>
            <span className="report-approvals-card__timestamp">{formatDateTime(approval.createdAt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
