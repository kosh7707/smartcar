import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectReport } from "@aegis/shared";
import { formatDateTime } from "../../../utils/format";

const approvalStatusTone = {
  approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const;

export function ReportApprovalsSection({ approvals }: { approvals: ProjectReport["approvals"] }) {
  return (
    <Card className="border-border/80 shadow-none">
      <CardHeader className="border-b border-border/70">
        <CardTitle>승인 이력 ({approvals.length})</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border px-4 py-0">
        {approvals.map((approval) => (
          <div key={approval.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={approvalStatusTone[approval.status as keyof typeof approvalStatusTone] ?? "text-muted-foreground"}
              >
                {approval.status}
              </Badge>
              <span className="font-medium text-foreground">{approval.actionType}</span>
              <span className="text-sm text-muted-foreground">요청: {approval.requestedBy}</span>
              {approval.decision && (
                <span className="text-sm text-muted-foreground">결정: {approval.decision.decidedBy}</span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{formatDateTime(approval.createdAt)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
