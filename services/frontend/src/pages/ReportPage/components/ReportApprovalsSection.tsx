import React from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import type { ProjectReport } from "@aegis/shared";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "../../../utils/format";

export function ReportApprovalsSection({ approvals }: { approvals: ProjectReport["approvals"] }) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3">
      <CardTitle>승인 이력 ({approvals.length})</CardTitle>
      {approvals.map((approval) => (
        <div key={approval.id} className="report-approval-row">
          <Badge variant="outline" className={`text-xs badge-severity--${approval.status === "approved" ? "low" : approval.status === "rejected" ? "critical" : "medium"}`}>
            {approval.status}
          </Badge>
          <span>{approval.actionType}</span>
          <span className="text-tertiary">요청: {approval.requestedBy}</span>
          {approval.decision && (
            <span className="text-tertiary">결정: {approval.decision.decidedBy}</span>
          )}
          <span className="text-sm text-tertiary">{formatDateTime(approval.createdAt)}</span>
        </div>
      ))}
      </CardContent>
    </Card>
  );
}
