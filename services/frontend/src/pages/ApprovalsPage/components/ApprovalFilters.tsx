import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApprovalFilterStatus } from "../hooks/useApprovalsPage";

const FILTER_LABELS: Record<ApprovalFilterStatus, string> = {
  all: "전체",
  pending: "대기",
  approved: "승인됨",
  rejected: "거부",
  expired: "만료",
};

interface ApprovalFiltersProps {
  filter: ApprovalFilterStatus;
  onChange: (value: ApprovalFilterStatus) => void;
  pendingCount: number;
  totalCount: number;
}

export const ApprovalFilters: React.FC<ApprovalFiltersProps> = ({
  filter,
  onChange,
  pendingCount,
  totalCount,
}) => (
  <section className="grid grid-cols-[minmax(0,1.4fr)_minmax(220px,auto)] items-start gap-5 rounded-lg border border-border bg-gradient-to-b from-muted/80 to-background/95 p-5 max-[960px]:grid-cols-1" aria-label="승인 요청 필터와 요약">
    <div className="flex flex-wrap gap-3" role="tablist" aria-label="Approval status filters">
      {(Object.keys(FILTER_LABELS) as ApprovalFilterStatus[]).map((status) => (
        <Button
          key={status}
          type="button"
          variant={filter === status ? "default" : "outline"}
          className={cn("min-h-10 rounded-full px-5 text-sm font-medium", filter === status && "border-primary bg-primary/10 text-primary")}
          onClick={() => onChange(status)}
        >
          {FILTER_LABELS[status]}
        </Button>
      ))}
    </div>

    <div className="grid grid-cols-2 gap-3">
      <Card className="shadow-none">
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium text-muted-foreground">전체 요청</span>
          <span className="font-mono text-lg font-semibold text-foreground">{totalCount}</span>
        </CardContent>
      </Card>
      <Card className="border-amber-200 bg-amber-50/70 shadow-none dark:border-amber-900/70 dark:bg-amber-950/30">
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium text-muted-foreground">대기 중</span>
          <span className="font-mono text-lg font-semibold text-foreground">{pendingCount}</span>
        </CardContent>
      </Card>
    </div>
  </section>
);
