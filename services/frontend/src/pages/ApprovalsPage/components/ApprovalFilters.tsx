import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  statusCounts: Record<ApprovalFilterStatus, number>;
  pendingCount: number;
  totalCount: number;
}

export const ApprovalFilters: React.FC<ApprovalFiltersProps> = ({ filter, onChange, statusCounts, pendingCount, totalCount }) => (
  <section className="approval-filters" aria-label="승인 요청 필터와 요약">
    <div className="approval-filters__tabs" role="tablist" aria-label="Approval status filters">
      {(Object.keys(FILTER_LABELS) as ApprovalFilterStatus[]).map((status) => (
        <Button
          key={status}
          type="button"
          variant={filter === status ? "default" : "outline"}
          className={filter === status ? "pill active" : "pill"}
          onClick={() => onChange(status)}
        >
          {FILTER_LABELS[status]} {statusCounts[status]}
        </Button>
      ))}
    </div>

    <div className="approval-filters__stats">
      <Card>
        <CardContent className="approval-filters__stat">
          <span className="approval-filters__label">전체 요청</span>
          <span className="approval-filters__value">{totalCount}</span>
        </CardContent>
      </Card>
      <Card className="approval-filters__stat--pending">
        <CardContent className="approval-filters__stat">
          <span className="approval-filters__label">대기 중</span>
          <span className="approval-filters__value">{pendingCount}</span>
        </CardContent>
      </Card>
    </div>
  </section>
);
